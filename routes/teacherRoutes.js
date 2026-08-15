const express  = require('express');
const mongoose = require('mongoose');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const Teacher  = require('../models/Teacher');
const Schedule = require('../models/Schedule');
const Transaction = require('../models/Transaction');
const { authMiddleware, branchFilter } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { policyShadowTeacherWrite } = require('../middleware/policyShadowTeacherWrite');
const { policyShadowTeacherRoute } = require('../middleware/policyShadowTeacherRoute');
const { teachersCutoverGate } = require('../middleware/teachersCutoverGate');
const { sanitizeRegex } = require('../middleware/sanitizeRegex');
const logger = require('../config/logger');
const { resolveTeacherSubjectIds } = require('../utils/trainingSubjectAccess');
const { sendAccountWelcome } = require('../services/accountWelcome');
const NotificationService = require('../services/NotificationService');
const { resolveDefaultAccountPassword } = require('../utils/tempPassword');
const { generateTeacherCode } = require('../services/businessCodeService');
const { postSalary } = require('../services/ledgerService');
const { computeStarBonusSummary, resolveBonusForPayout } = require('../services/teacherStarBonus');
const { emitTeacherEvent, emitDataRefresh, emitFinanceEvent, emitUser } = require('../utils/realtimeEmit');
const { purgeTeacherSideEffects } = require('../services/userCascadeCleanup');

const router = express.Router();

/**
 * Phase 7.31 cutover:
 * auth → [branchFilter if present] → policyShadow* → teachersCutoverGate → handler
 * Legacy isAdmin/isTeacher/checkPermission/assertTeacherBranchAccess/superAdminOnly
 * retained inside teachersCutoverGate.
 */
const teacherRouteGuard = (action) => [
  policyShadowTeacherRoute(action),
  teachersCutoverGate(action),
];
const teacherWriteGuard = (action) => [
  policyShadowTeacherWrite(action),
  teachersCutoverGate(action),
];

// Tự động tạo thư mục uploads/practical nếu chưa có
const uploadDir = path.join(__dirname, '..', 'uploads', 'practical');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_PRACTICAL_EXT = new Set([
  '.zip', '.rar', '.tar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.mp4',
]);

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadDir); },
  filename: function (req, file, cb) {
    const rawExt = path.extname(file.originalname || '').toLowerCase();
    const ext = ALLOWED_PRACTICAL_EXT.has(rawExt) ? rawExt : '';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `practical-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (!ALLOWED_PRACTICAL_EXT.has(ext)) {
      return cb(new Error('Định dạng file không được phép. Chỉ hỗ trợ ZIP/RAR/PDF/DOC/XLS/PPT/MP4.'));
    }
    const mime = String(file.mimetype || '').toLowerCase();
    if (!mime || mime === 'application/octet-stream') {
      return cb(null, true);
    }
    const okMime = /^(application\/(zip|x-zip-compressed|x-(rar|7z)-compressed|x-tar|pdf|msword|vnd\.|octet-stream)|video\/mp4)/.test(mime);
    if (!okMime) {
      return cb(new Error('MIME type không khớp định dạng cho phép.'));
    }
    cb(null, true);
  }
});

function handlePracticalUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Chưa chọn file để tải lên' });
    }
    const fileUrl = `/uploads/practical/${req.file.filename}`;
    return res.json({ success: true, fileUrl, message: 'Tải file bài thực hành lên thành công!' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server khi tải file thực hành' });
  }
}

// ─── POST /api/teachers/upload-practical ──────────────────────────────────────
router.post('/upload-practical', authMiddleware, ...teacherRouteGuard('upload_practical'), (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const msg = err.message || 'Không thể tải file lên';
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ success: false, message: msg });
    }
    return handlePracticalUpload(req, res);
  });
});

// ⭐ RBAC Guard: Chặn STAFF thực hiện thao tác ghi trên teachers
// STAFF chỉ được GET (xem), KHÔNG được POST/PUT/DELETE
// superAdminOnlyTeacher retained inside teachersCutoverGate (Phase 7.31).

// ─── POST /api/teachers ───────────────────────────────────────────────────────
// Chỉ Super Admin được tạo giảng viên
// Strangler Facade: ENABLE_CQRS_TEACHER=true → CQRS (transaction + outbox)
router.post('/', [authMiddleware, branchFilter, ...teacherRouteGuard('create')], async (req, res, next) => {
  try {
    if (process.env.ENABLE_CQRS_TEACHER === 'true' || process.env.ENABLE_CQRS_TEACHER === '1') {
      require('../modules/teacher/commands');
      const CQRSTeacherController = require('../modules/teacher/controllers/CQRSTeacherController');
      return CQRSTeacherController.post_root(req, res, next);
    }

    const { name, phone, specialty, subjectIds, password, status, branchId: reqBranchId, branchCode: reqBranchCode, startDate, address, email: rawEmail, baseSalaryPerSession } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập Tên và Số điện thoại' });
    }
    const emailTrim = (rawEmail || '').trim();
    const email = emailTrim && emailTrim !== 'email@example.com' ? emailTrim : undefined;
    try {
      const { assertUniqueContact } = require('../utils/uniqueContact');
      await assertUniqueContact({ phone, zalo: phone, email });
    } catch (dupErr) {
      if (dupErr.status === 409) {
        return res.status(409).json({ success: false, message: dupErr.message });
      }
      throw dupErr;
    }
    if (password && String(password).trim().length > 0 && String(password).trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải ít nhất 6 ký tự' });
    }

    // ⭐ Xác định branchId:
    //   - STAFF → bắt buộc dùng branchId của chính họ (không được chọn chi nhánh khác)
    //   - SUPER_ADMIN → dùng branchId từ request body (dropdown chọn), hoặc null
    let finalBranchId   = null;
    let finalBranchCode = '';
    if (req.userBranchId) {
      // STAFF → ép branchId
      finalBranchId   = req.userBranchId;
      finalBranchCode = req.userBranchCode || '';
    } else if (reqBranchId) {
      // SUPER_ADMIN chọn chi nhánh
      finalBranchId   = reqBranchId;
      finalBranchCode = reqBranchCode || '';
    }

    // Auto-Approve Logic: Nếu Admin gán chi nhánh ngay từ lúc tạo, tự động duyệt
    const isAssigningBranch = !!(finalBranchId || finalBranchCode);
    
    const normalizedSubjectIds = Array.isArray(subjectIds)
      ? [...new Set(subjectIds.map((id) => String(id).trim()).filter(Boolean))]
      : [];

    const plainPassword = resolveDefaultAccountPassword({ password, phone });
    const teacherCode = await generateTeacherCode();
    const teacher = await Teacher.create({
      name,
      phone,
      email,
      specialty: specialty || normalizedSubjectIds.join(', '),
      subjectIds: normalizedSubjectIds,
      startDate: startDate || Date.now(),
      address:   address   || '',
      password:  plainPassword,
      status:    status || 'inactive',
      testStatus: null,
      role: 'teacher',
      isFirstLogin: false,
      branchId:   finalBranchId,
      branchCode: finalBranchCode,
      baseSalaryPerSession: Math.max(0, Number(baseSalaryPerSession) || 0),
      teacherCode,
    });

    // Emit socket scoped theo branch (không io.emit global)
    const io = req.app.get('io');
    if (io) {
      emitTeacherEvent(io, teacher, 'teacher:new', {
        teacherId: teacher._id,
        name: teacher.name,
        branchCode: teacher.branchCode,
        message: `Giảng viên mới: ${teacher.name} — Chi nhánh: ${teacher.branchCode || 'Chưa phân'}`,
      });
      NotificationService.notifyAdmins(
        io,
        '🆕 Giảng viên mới',
        `Đã tạo giảng viên ${teacher.name} (${teacher.phone}).`,
        { teacherId: teacher._id },
        '/admin/teachers',
      ).catch((err) => logger.warn('[TEACHERS] notifyAdmins:', err.message));
    }

    const welcome = await sendAccountWelcome(io, {
      role: 'teacher',
      userId: teacher._id,
      name: teacher.name,
      phone: teacher.phone,
      email: teacher.email,
      password: plainPassword,
    });

    return res.status(201).json({
      success: true,
      message: `Đã tạo giảng viên ${teacher.name}`,
      data: {
        ...teacher.toObject(),
        password: undefined,
        tempPassword: plainPassword,
        welcomeQueued: welcome.queued,
        welcomeNotified: welcome.notified,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Số điện thoại đã tồn tại' });
    }
    if (error.name === 'ValidationError') {
      const msg = Object.values(error.errors || {}).map((e) => e.message).join(', ');
      return res.status(400).json({ success: false, message: msg || 'Dữ liệu không hợp lệ' });
    }
    logger.error('[TEACHERS] Create error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Lỗi server' });
  }
});

// ─── GET /api/teachers ────────────────────────────────────────────────────────
// Lấy danh sách giảng viên (Admin/Staff only — Teacher bị chặn)
router.get('/', [authMiddleware, branchFilter, ...teacherRouteGuard('list')], async (req, res) => {
  try {
    // ⭐ Chỉ Admin/Staff được xem danh sách GV — Teacher chỉ được xem profile của mình
    if (req.user.role === 'teacher' || req.user.role === 'student') {
      return res.status(403).json({ success: false, message: 'Không có quyền xem danh sách giảng viên' });
    }

    const { status, search } = req.query;
    const filter = {};
    const bf = req.branchFilter || {};
    if (bf.branchId?.$in) {
      // Tenant scope: vẫn hiển thị GV chưa phân chi nhánh
      filter.$or = [
        { branchId: { $in: bf.branchId.$in } },
        { branchId: null },
      ];
    } else if (bf.branchId != null && bf.branchId !== '') {
      // Lọc 1 chi nhánh: gồm GV thuộc chi nhánh đó + GV chưa gán chi nhánh (để vẫn phân công được)
      filter.$or = [
        { branchId: bf.branchId },
        { branchId: null },
      ];
    } else {
      Object.assign(filter, bf);
    }
    filter.role = { $in: ['teacher'] };
    if (status) filter.status = status;
    if (search) {
      const s = sanitizeRegex(search);
      filter.$or = [
        { name:      { $regex: s, $options: 'i' } },
        { phone:     { $regex: s, $options: 'i' } },
        { specialty: { $regex: s, $options: 'i' } },
        { teacherCode: { $regex: s, $options: 'i' } },
      ];
    }

    const Evaluation = require('../models/Evaluation');
    const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));
    const skip = (pageNum - 1) * limitNum;

    const [teachersRaw, total, ratingAgg] = await Promise.all([
      Teacher.find(filter)
        .select('-password -refreshToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Teacher.countDocuments(filter),
      Evaluation.aggregate([
        { $match: { type: 'teacher_rating' } },
        {
          $group: {
            _id: '$targetTeacherId',
            ratings: { $push: '$$ROOT' },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const ratingMap = new Map(
      (ratingAgg || []).map((r) => [String(r._id), r.ratings || []])
    );

    const teachers = teachersRaw.map((t) => {
      const myRatings = ratingMap.get(String(t._id)) || [];
      const subjectIds = Array.isArray(t.subjectIds) && t.subjectIds.length
        ? t.subjectIds.filter(Boolean)
        : resolveTeacherSubjectIds(t);
      return { ...t, subjectIds, ratings: myRatings, id: t._id };
    });

    return res.json({
      success: true,
      count: teachers.length,
      total,
      page: pageNum,
      limit: limitNum,
      data: teachers,
    });
  } catch (error) {
    logger.error('[TEACHERS] Get all error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── GET /api/teachers/stats/summary ──────────────────────────────────────────
router.get('/stats/summary', [authMiddleware, branchFilter, ...teacherRouteGuard('stats_summary')], async (req, res) => {
  try {
    const bf = { ...req.branchFilter };
    const { branch_id } = req.query;
    if (branch_id && branch_id !== 'all' && !req.userBranchId) {
      bf.branchId = branch_id;
    }

    const total   = await Teacher.countDocuments({ ...bf, role: 'teacher' });
    const active  = await Teacher.countDocuments({ ...bf, role: 'teacher', status: { $in: ['active', 'Active'] } });
    const pending = await Teacher.countDocuments({ ...bf, role: 'teacher', status: 'pending' });
    const suspended = await Teacher.countDocuments({ ...bf, role: 'teacher', status: 'suspended' });

    return res.json({
      success: true,
      data: { total, active, pending, suspended },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── GET /api/teachers/:id ────────────────────────────────────────────────────
router.get('/:id', [authMiddleware, branchFilter, ...teacherRouteGuard('get_one')], async (req, res) => {
  try {
    // Teacher chỉ xem profile của chính mình
    if (req.user.role === 'teacher' && req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem thông tin này' });
    }
    // Student không được xem GV
    if (req.user.role === 'student') {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập' });
    }

    const teacher = await Teacher.findById(req.params.id)
      .select('-password -refreshToken');

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    // ⭐ STAFF cross-branch guard: STAFF chỉ xem GV cùng chi nhánh
    if (req.userBranchId && teacher.branchId
        && String(teacher.branchId) !== String(req.userBranchId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem giảng viên chi nhánh khác' });
    }

    // Lấy thống kê buổi dạy
    const completedSessions = await Schedule.countDocuments({
      teacherId: req.params.id,
      status: 'completed',
    });

    const obj = teacher.toObject();
    const subjectIds = Array.isArray(obj.subjectIds) && obj.subjectIds.length
      ? obj.subjectIds.filter(Boolean)
      : resolveTeacherSubjectIds(obj);

    return res.json({
      success: true,
      data: { ...obj, subjectIds, completedSessionsFromDB: completedSessions },
    });
  } catch (error) {
    logger.error('[TEACHERS] Get by ID error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── PUT /api/teachers/:id ────────────────────────────────────────────────────
// Cập nhật thông tin cơ bản giảng viên (STAFF bị chặn, teacher tự sửa được)
router.put('/:id', [authMiddleware, branchFilter, ...teacherRouteGuard('update_profile')], async (req, res) => {
  try {
    // Teacher sửa chính mình → cho phép
    const isSelfEdit = req.user.id === req.params.id && req.user.role === 'teacher';
    // STAFF → chặn (chỉ Super Admin mới được sửa GV)
    if (!isSelfEdit && req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Không có quyền' });
    }
    if (!isSelfEdit && (req.user.role === 'admin' || req.user.role === 'staff')) {
      if (req.user.id !== 'admin') {
        const me = await Teacher.findById(req.user.id).select('adminRole permissions').lean();
        const canTraining = Array.isArray(me?.permissions) && me.permissions.includes('manage_training');
        const canManageTeachers = Array.isArray(me?.permissions) && me.permissions.includes(PERMISSIONS.MANAGE_TEACHERS);
        if (me?.adminRole !== 'SUPER_ADMIN' && !canTraining && !canManageTeachers) {
          return res.status(403).json({
            success: false,
            message: '403 Forbidden — Chỉ Super Admin hoặc tài khoản có quyền Đào tạo / Quản lý Giảng viên mới được sửa thông tin giảng viên.',
          });
        }
      }
    }

    // Branch isolation: assertTeacherBranchAccess (trusted req.userBranchId)

    const isAdminRole = (req.user.role === 'admin' || req.user.role === 'staff');
    // Self-edit: profile + kết quả thi onboarding (client-side grade rồi sync)
    const allowedFields = isAdminRole 
      ? [
          'name', 'phone', 'zalo', 'email', 'specialty', 'subjectIds', 'bio', 'startDate', 'address',
          'bankAccount', 'avatar', 'status', 'baseSalaryPerSession', 'customStarBonusAmount',
          'assignedClasses', 'assignedStudents',
          'testScore', 'testStatus', 'testDate', 'testNotes', 'faceViolationCount',
          'testMcCorrect', 'testMcWrong', 'testMcTotal',
          'lockReason', 'practicalFile', 'practicalStatus',
          'branchId', 'branchCode',
        ]
      : isSelfEdit
        ? [
            'zalo', 'email', 'bio', 'bankAccount', 'avatar', 'address',
            'testScore', 'testStatus', 'testDate', 'testNotes', 'faceViolationCount',
            'testMcCorrect', 'testMcWrong', 'testMcTotal',
            'lockReason', 'practicalFile', 'practicalStatus', 'status',
          ]
        : [
          'zalo', 'email', 'bio', 'bankAccount', 'avatar', 'address',
        ];

    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    // Chuyên môn / subjectIds: chỉ Admin / Staff được sửa
    if (isAdminRole && req.body.subjectIds !== undefined) {
      updates.subjectIds = Array.isArray(req.body.subjectIds)
        ? [...new Set(req.body.subjectIds.map((id) => String(id).trim()).filter(Boolean))]
        : [];
      if (!updates.subjectIds.length) {
        const spec = req.body.specialty ?? updates.specialty;
        if (spec) updates.subjectIds = resolveTeacherSubjectIds({ specialty: spec, subjectIds: [] });
      }
      if (req.body.specialty === undefined && updates.subjectIds.length) {
        const LABELS = { coban: 'Máy vi tính (Cơ bản)', word: 'Word', excel: 'Excel', powerpoint: 'PowerPoint', canva: 'Canva' };
        updates.specialty = updates.subjectIds.map((id) => LABELS[id] || id).join(', ');
      }
    }

    // Luôn có ngày/giờ thi khi ghi nhận đạt/trượt trắc nghiệm (tránh cột "Ngày thi" N/A trên admin)
    if (
      (updates.testStatus === 'passed' || updates.testStatus === 'failed') &&
      (updates.testDate === undefined || updates.testDate === null)
    ) {
      updates.testDate = new Date();
    }

    // Security check: teacher cannot set their own status to 'active'
    if (req.user.role === 'teacher' && updates.status === 'active') {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền tự kích hoạt tài khoản chính thức' });
    }

    // Auto-Approve Logic: Nếu Admin gán chi nhánh hoặc xếp lớp, tự động duyệt
    if (isAdminRole) {
      const isAssigningStudents = updates.assignedClasses?.length > 0 || updates.assignedStudents?.length > 0;
      
      if (isAssigningStudents) {
        updates.status = 'active';
        // Remove test exemption here if they want strict testing, or keep it if assigning students implies exemption
        // updates.testStatus = 'exempt'; 
      }
    }

    const prev = await Teacher.findById(req.params.id).select('status tokenVersion phone zalo email testStatus testScore name').lean();
    if (!prev) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    if (updates.phone !== undefined || updates.zalo !== undefined || updates.email !== undefined) {
      try {
        const { assertUniqueContact } = require('../utils/uniqueContact');
        await assertUniqueContact({
          phone: updates.phone !== undefined ? updates.phone : prev.phone,
          zalo: updates.zalo !== undefined ? updates.zalo : (prev.zalo || prev.phone),
          email: updates.email !== undefined ? updates.email : prev.email,
          excludeRole: 'teacher',
          excludeId: req.params.id,
        });
      } catch (dupErr) {
        if (dupErr.status === 409) {
          return res.status(409).json({ success: false, message: dupErr.message });
        }
        throw dupErr;
      }
    }

    const nextStatus = updates.status !== undefined ? String(updates.status).toLowerCase() : null;
    const prevStatus = String(prev.status || '').toLowerCase();
    const locking = nextStatus && ['suspended', 'inactive'].includes(nextStatus)
      && !['suspended', 'inactive'].includes(prevStatus);

    const updateOps = { $set: updates };
    if (locking) {
      updateOps.$inc = { tokenVersion: 1 };
      updateOps.$unset = { ...(updateOps.$unset || {}), refreshToken: 1 };
    }

    const teacher = await Teacher.findByIdAndUpdate(req.params.id, updateOps, {
      returnDocument: 'after',
      runValidators: true,
    }).select('-password -refreshToken');

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    const io = req.app.get('io');
    if (io) {
      emitDataRefresh(io, { type: 'teacher', id: teacher._id }, {
        branchId: teacher.branchId,
        userIds: [teacher._id],
      });
      if (locking) {
        emitUser(io, teacher._id, 'auth:forceLogout', {
          userId: String(teacher._id),
          role: 'teacher',
          reason: 'account_disabled',
        });
      }

      // Thông báo khi GV thi đạt / trượt (lần đầu ghi nhận hoặc đổi trạng thái)
      const nextTest = String(updates.testStatus || '').toLowerCase();
      const prevTest = String(prev.testStatus || '').toLowerCase();
      if ((nextTest === 'passed' || nextTest === 'failed') && nextTest !== prevTest) {
        const score = teacher.testScore != null ? Number(teacher.testScore) : null;
        const scoreText = Number.isFinite(score) ? ` (${score}/100)` : '';
        if (nextTest === 'passed') {
          NotificationService.notifyAdmins(
            io,
            '🎉 Giảng viên thi đạt',
            `GV ${teacher.name} đã thi đạt${scoreText}.`,
            { teacherId: teacher._id, testStatus: 'passed', testScore: score },
            '/admin#training',
          ).catch((err) => logger.warn('[TEACHERS] notify exam pass:', err.message));
          NotificationService.send(io, {
            type: 'EXAM',
            title: '🎉 Bạn đã thi đạt',
            content: `Chúc mừng! Kết quả thi của bạn: ĐẠT${scoreText}.`,
            receivers: String(teacher._id),
            payload: { teacherId: String(teacher._id), testStatus: 'passed' },
            link: '/teacher/test',
          }).catch((err) => logger.warn('[TEACHERS] notify self exam:', err.message));
        } else {
          NotificationService.notifyAdmins(
            io,
            '❌ Giảng viên thi chưa đạt',
            `GV ${teacher.name} thi chưa đạt${scoreText}.`,
            { teacherId: teacher._id, testStatus: 'failed', testScore: score },
            '/admin#training',
          ).catch((err) => logger.warn('[TEACHERS] notify exam fail:', err.message));
        }
      }
    }

    return res.json({
      success: true,
      message: `Đã cập nhật giảng viên ${teacher.name}`,
      data: teacher,
    });
  } catch (error) {
    logger.error('[TEACHERS] Update error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── PUT /api/teachers/:id/score ──────────────────────────────────────────────
// Admin nhập điểm bài test Onboarding cho giảng viên
router.put('/:id/score', [
  authMiddleware,
  branchFilter,
  ...teacherWriteGuard('score'),
], async (req, res) => {
  try {
    const { testScore, testNotes } = req.body;

    if (testScore === undefined || testScore === null || !Number.isFinite(Number(testScore))) {
      return res.status(400).json({ success: false, message: 'Thiếu testScore' });
    }
    const scoreNum = Number(testScore);
    if (scoreNum < 0 || scoreNum > 100) {
      return res.status(400).json({ success: false, message: 'Điểm phải trong khoảng 0-100' });
    }

    const prev = await Teacher.findById(req.params.id).select('testScore name').lean();
    if (!prev) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }
    const oldScore = prev.testScore != null ? Number(prev.testScore) : null;
    const newStatus = scoreNum >= 80 ? 'tested_passed' : 'tested_failed';

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          testScore: scoreNum,
          testNotes: testNotes || '',
          testDate: new Date(),
          status: newStatus,
        },
        $push: {
          scoreHistory: {
            at: new Date(),
            oldScore,
            newScore: scoreNum,
            actorUserId: String(req.user?.id || ''),
            actorRole: String(req.user?.role || ''),
            actorName: String(req.user?.name || ''),
            note: String(testNotes || '').slice(0, 300),
          },
        },
      },
      { returnDocument: 'after' },
    ).select('-password -refreshToken');

    try {
      const { writeAudit } = require('../services/auditLogService');
      await writeAudit({
        action: 'teacher.score_change',
        actorUserId: String(req.user?.id || ''),
        actorRole: String(req.user?.role || ''),
        entityType: 'teacher',
        entityId: String(teacher._id),
        teacherId: teacher._id,
        oldValue: { oldScore },
        newValue: { newScore: scoreNum },
        ip: req.ip,
        userAgent: req.headers['user-agent'] || '',
      });
    } catch (auditErr) {
      logger.warn('[TEACHERS] score audit: %s', auditErr.message);
    }

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    // Thông báo real-time cho giảng viên + branch (không global)
    const io = req.app.get('io');
    if (io) {
      emitTeacherEvent(io, teacher, 'teacher:scored', {
        teacherId:  teacher._id.toString(),
        testScore: scoreNum,
        passed:     scoreNum >= 80,
        message:    scoreNum >= 80
          ? `🎉 Chúc mừng! Bạn đạt ${scoreNum}/100 điểm. Đã qua bài test!`
          : `❌ Bạn đạt ${scoreNum}/100 điểm. Chưa đạt yêu cầu (>=80). Vui lòng liên hệ Admin.`,
      });
    }

    return res.json({
      success: true,
      message: `Đã lưu điểm ${scoreNum}/100 cho ${teacher.name}`,
      data: teacher,
    });
  } catch (error) {
    logger.error('[TEACHERS] Score error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── PUT /api/teachers/:id/approve ────────────────────────────────────────────
// Admin duyệt giảng viên — STRICT: chỉ khi testScore >= 80
router.put('/:id/approve', [
  authMiddleware,
  branchFilter,
  ...teacherWriteGuard('approve'),
], async (req, res) => {
  try {
    const teacherCheck = await Teacher.findById(req.params.id);
    if (!teacherCheck) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    // STRICT LOGIC (Workflow 1): Không thể approve nếu điểm < 80
    if (!Number.isFinite(Number(teacherCheck.testScore)) || Number(teacherCheck.testScore) < 80) {
      return res.status(403).json({
        success: false,
        message: `Không thể cấp quyền! Điểm bài test: ${teacherCheck.testScore}/100 (yêu cầu ≥ 80).`,
      });
    }

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      { status: 'active', approvedAt: new Date() },
      { returnDocument: 'after' }
    ).select('-password -refreshToken');

    // Thông báo real-time (branch + teacher)
    const io = req.app.get('io');
    if (io) {
      emitTeacherEvent(io, teacher, 'teacher:approved', {
        teacherId: teacher._id.toString(),
        name:      teacher.name,
        message:   '🎊 Tài khoản của bạn đã được Admin phê duyệt! Bạn có thể bắt đầu giảng dạy.',
      });
    }

    try {
      const workflowService = require('../services/workflowService');
      await workflowService.completeOpenForEntity('teacher_approval', teacher._id, {
        action: 'approve',
        user: req.user,
        note: 'Duyệt từ API teachers/approve',
      });
    } catch (wfErr) {
      logger.warn({ err: wfErr.message }, '[TEACHERS] workflow sync');
    }

    return res.json({
      success: true,
      message: `Đã phê duyệt giảng viên ${teacher.name}`,
      data: teacher,
    });
  } catch (error) {
    logger.error('[TEACHERS] Approve error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── POST /api/teachers/:id/submit-practical ──────────────────────────────────
// Giảng viên nộp file thực hành (Workflow 1 Phase 2)
router.post('/:id/submit-practical', authMiddleware, ...teacherRouteGuard('submit_practical'), async (req, res) => {
  try {
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Bạn không thể nộp giùm người khác' });
    }
    const { fileUrl } = req.body;
    if (!fileUrl) {
      return res.status(400).json({ success: false, message: 'Thiếu fileUrl' });
    }

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      {
        practicalFileUrl: fileUrl,
        status: 'practical_submitted',
      },
      { returnDocument: 'after' }
    ).select('-password');

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    // Thông báo Admin có file mới (branch-scoped)
    const io = req.app.get('io');
    if (io) {
      emitTeacherEvent(io, teacher, 'teacher:practical_submitted', {
        teacherId:   teacher._id.toString(),
        teacherName: teacher.name,
        fileUrl,
        message: `📁 Giảng viên ${teacher.name} đã nộp bài thực hành`,
      });
      NotificationService.notifyAdmins(
        io,
        '📁 GV nộp bài thực hành',
        `Giảng viên ${teacher.name} đã nộp bài thực hành.`,
        { teacherId: teacher._id, fileUrl },
        '/admin#training',
      ).catch((err) => logger.warn('[TEACHERS] notify practical:', err.message));
    }

    try {
      const workflowService = require('../services/workflowService');
      await workflowService.start({
        definitionKey: 'teacher_approval',
        entityId: teacher._id,
        entityLabel: teacher.name,
        title: 'Duyệt GV: ' + teacher.name,
        payload: { testScore: teacher.testScore, practicalFileUrl: fileUrl },
        createdBy: String(req.user.id || ''),
      });
    } catch (wfErr) {
      logger.warn({ err: wfErr.message }, '[TEACHERS] workflow start');
    }

    return res.json({ success: true, data: teacher });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── PUT /api/teachers/:id/reject ─────────────────────────────────────────────
// Admin từ chối / tạm dừng giảng viên
router.put('/:id/reject', [
  authMiddleware,
  branchFilter,
  ...teacherWriteGuard('reject'),
], async (req, res) => {
  try {
    const { reason } = req.body;

    const teacher = await Teacher.findByIdAndUpdate(
      req.params.id,
      {
        status: 'suspended',
        rejectedReason: reason || '',
        rejectedAt: new Date(),
      },
      { returnDocument: 'after' }
    ).select('-password -refreshToken');

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }

    try {
      const workflowService = require('../services/workflowService');
      await workflowService.completeOpenForEntity('teacher_approval', teacher._id, {
        action: 'reject',
        user: req.user,
        note: reason || 'Từ chối từ API teachers/reject',
      });
    } catch (wfErr) {
      logger.warn({ err: wfErr.message }, '[TEACHERS] workflow reject sync');
    }

    const io = req.app.get('io');
    if (io) {
      emitTeacherEvent(io, teacher, 'teacher:rejected', {
        teacherId: teacher._id.toString(),
        reason,
        message: `❌ Tài khoản bị từ chối. Lý do: ${reason || 'Không đáp ứng yêu cầu'}`,
      });
    }

    return res.json({
      success: true,
      message: `Đã từ chối giảng viên ${teacher.name}`,
      data: teacher,
    });
  } catch (error) {
    logger.error('[TEACHERS] Reject error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── DELETE /api/teachers/:id ─────────────────────────────────────────────────
// Admin xóa giảng viên (STAFF bị chặn)
router.delete('/:id', [authMiddleware, ...teacherRouteGuard('delete')], async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
    }
    const cascade = await purgeTeacherSideEffects(teacher._id, { teacherName: teacher.name });
    await Teacher.findByIdAndDelete(teacher._id);
    return res.json({
      success: true,
      message: `Đã xóa giảng viên ${teacher.name}`,
      cascade,
    });
  } catch (error) {
    logger.error('[TEACHERS] Delete error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── GET /api/teachers/:id/finance ──────────────────────────────────────────────
router.get('/:id/finance', authMiddleware, ...teacherRouteGuard('finance_self'), async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập thông tin này' });
    }

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

    // Tổng buổi đã dạy (Trạng thái completed)
    const totalSessions = await Schedule.countDocuments({
      teacherId: req.params.id,
      status: 'completed',
    });

    // Buổi đã dạy nhưng chưa thanh toán
    const pendingSessionsCount = await Schedule.countDocuments({
      teacherId: req.params.id,
      status: 'completed',
      is_paid_to_teacher: { $ne: true }
    });

    // Chưa nhận = pendingSessionsCount * salary_per_session
    const salaryPerSession = teacher.baseSalaryPerSession || 0;
    const unpaidAmount = pendingSessionsCount * salaryPerSession;

    // Tổng đã nhận = Tổng tiền từ các giao dịch thành công của giảng viên
    const transactionsContext = await Transaction.aggregate([
      { $match: { 
          teacherId: new mongoose.Types.ObjectId(req.params.id), 
          status: 'confirmed' 
      }},
      { $group: { _id: null, totalString: { $sum: "$amount" } }}
    ]);
    const paidAmount = transactionsContext.length > 0 ? transactionsContext[0].totalString : 0;

    return res.json({
      success: true,
      data: {
        totalSessions,
        unpaidAmount,
        paidAmount,
        salaryPerSession
      }
    });
  } catch (error) {
    logger.error('[FINANCE] Get stats error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── GET /api/teachers/:id/finance/pending ──────────────────────────────────────
// Lấy số buổi còn nợ thanh toán + list FIFO (kèm số buổi HV) + thưởng sao
router.get('/:id/finance/pending', authMiddleware, ...teacherRouteGuard('finance_pending'), async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

    const teacherOid = req.params.id;
    const pending = await Schedule.find({
      teacherId: teacherOid,
      status: 'completed',
      is_paid_to_teacher: { $ne: true },
    }).sort({ date: 1, createdAt: 1 }).lean();

    const pendingSessionsCount = pending.length;
    const salaryPerSession = teacher.baseSalaryPerSession || 0;
    const unpaidAmount = pendingSessionsCount * salaryPerSession;
    const starBonus = await computeStarBonusSummary(teacher);

    // Số buổi thứ mấy của HV (trong khóa, theo lịch completed của GV này)
    const studentIds = [...new Set(
      pending.map((s) => (s.studentId ? String(s.studentId) : '')).filter(Boolean)
    )];
    const sessionNoMap = new Map();
    if (studentIds.length > 0) {
      const allCompleted = await Schedule.find({
        teacherId: teacherOid,
        status: 'completed',
        studentId: { $in: studentIds },
      }).sort({ date: 1, createdAt: 1 }).select('_id studentId course').lean();

      const groups = Object.create(null);
      for (const s of allCompleted) {
        const key = `${s.studentId || ''}|${s.course || ''}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(s);
      }
      for (const list of Object.values(groups)) {
        list.forEach((s, i) => sessionNoMap.set(String(s._id), i + 1));
      }
    }

    const pendingSessions = pending.map((s) => ({
      id: s._id,
      date: s.date,
      startTime: s.startTime || '',
      endTime: s.endTime || '',
      course: s.course || '',
      studentId: s.studentId || null,
      studentName: s.studentName || '',
      sessionNo: sessionNoMap.get(String(s._id)) || null,
    }));

    return res.json({
      success: true,
      data: {
        pendingSessionsCount,
        salaryPerSession,
        unpaidAmount,
        starBonus,
        pendingSessions,
        bankInfo: {
          bankName: teacher.bankAccount?.bankName || '',
          accountNumber: teacher.bankAccount?.accountNumber || '',
          accountHolder: teacher.bankAccount?.accountHolder || teacher.name || '',
          bankCode: teacher.bankAccount?.bankCode || '',
        }
      }
    });
  } catch (error) {
    logger.error('[FINANCE] Get pending error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

// ─── PUT /api/teachers/:id/finance/pay-flexible ──────────────────────────────────
// Thanh toán linh hoạt: Admin tự chọn số buổi và số tiền, FIFO (cũ nhất trước)
// Có thể cộng thưởng sao tích lũy (includeStarBonus)
router.put('/:id/finance/pay-flexible', [authMiddleware, ...teacherRouteGuard('finance_pay_flexible')], async (req, res) => {
  try {
    const { sessionsCount, amount, note, includeStarBonus, starBonusMonths } = req.body;
    const idempotencyKey = String(
      req.headers['idempotency-key'] || req.body.idempotencyKey || ''
    ).trim() || null;

    const paidCount = Math.max(0, Number(sessionsCount) || 0);
    const wantBonus = includeStarBonus === true || includeStarBonus === 'true' || includeStarBonus === 1;

    if (paidCount <= 0 && !wantBonus) {
      return res.status(400).json({ success: false, message: 'Số buổi thanh toán phải lớn hơn 0 (hoặc bật thưởng sao)' });
    }
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Số tiền thanh toán phải lớn hơn 0' });
    }
    if (Number(amount) > 500000000) {
      return res.status(400).json({ success: false, message: `Số tiền vượt giới hạn 500 triệu/lần` });
    }

    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).lean();
      if (existing) {
        return res.json({
          success: true,
          message: 'Giao dịch đã tồn tại (idempotent)',
          data: {
            paidSessions: paidCount,
            markedSessions: 0,
            totalAmount: existing.amount,
            starBonusAmount: existing.starBonusAmount || 0,
            starBonusMonths: existing.starBonusMonths || [],
            transaction: existing,
            idempotent: true,
          },
        });
      }
    }

    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

    let bonusPayout = { payoutMonths: [], payoutBonusAmount: 0 };
    if (wantBonus) {
      bonusPayout = await resolveBonusForPayout(
        teacher,
        Array.isArray(starBonusMonths) ? starBonusMonths : null
      );
      if (paidCount <= 0 && bonusPayout.payoutBonusAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Không có thưởng sao đủ điều kiện để thanh toán',
        });
      }
    }
    const starBonusAmount = Number(bonusPayout.payoutBonusAmount) || 0;
    const starBonusMonthKeys = Array.isArray(bonusPayout.payoutMonths) ? bonusPayout.payoutMonths : [];

    // Tìm buổi chưa thanh toán theo FIFO (chỉ tính các buổi đã hoàn thành - completed)
    let sessionIds = [];
    let actualCount = 0;
    let claimedSessions = [];
    if (paidCount > 0) {
      const pendingSessions = await Schedule.find({
        teacherId: req.params.id,
        status: 'completed',
        is_paid_to_teacher: { $ne: true }
      }).sort({ date: 1, createdAt: 1 }).limit(paidCount);

      claimedSessions = pendingSessions;
      sessionIds = pendingSessions.map(s => s._id);

      if (sessionIds.length > 0) {
        const claim = await Schedule.updateMany(
          {
            _id: { $in: sessionIds },
            status: 'completed',
            is_paid_to_teacher: { $ne: true },
          },
          { $set: { is_paid_to_teacher: true, paymentStatus: 'paid' } }
        );
        actualCount = claim.modifiedCount || 0;
      }
    }

    const now = new Date();
    const monthLabel = `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
    const bonusNote = starBonusAmount > 0
      ? ` + thưởng sao ${starBonusAmount.toLocaleString('vi-VN')}đ (${starBonusMonthKeys.join(', ')})`
      : '';
    const fifoNote = claimedSessions.length
      ? claimedSessions.map((s) => {
          const name = s.studentName || 'HV';
          const d = s.date ? new Date(s.date).toLocaleDateString('vi-VN') : '';
          return d ? `Buổi - ${name} (${d})` : `Buổi - ${name}`;
        }).join('; ')
      : '';
    const defaultDesc = paidCount > 0
      ? `${fifoNote || `Thù lao ${paidCount} buổi dạy`}${bonusNote}`
      : `Thưởng sao giảng viên${bonusNote}`;

    let transaction;
    try {
      transaction = await Transaction.create({
        teacherId: req.params.id,
        teacherName: teacher.name,
        teacherPhone: teacher.phone || '',
        amount: Number(amount),
        description: note || defaultDesc,
        month: monthLabel,
        status: 'confirmed',
        confirmedBy: req.user?.name || 'Admin',
        confirmedAt: now,
        bankName: teacher.bankAccount?.bankName || '',
        bankAccount: teacher.bankAccount?.accountNumber || '',
        note: note || '',
        starBonusAmount,
        starBonusMonths: starBonusMonthKeys,
        ...(idempotencyKey ? { idempotencyKey } : {}),
      });
    } catch (createErr) {
      // Rollback claim nếu tạo phiếu chi thất bại (tránh buổi bị đánh dấu paid mà không có ledger)
      if (actualCount > 0 && sessionIds.length > 0 && !(createErr?.code === 11000 && idempotencyKey)) {
        try {
          await Schedule.updateMany(
            { _id: { $in: sessionIds }, is_paid_to_teacher: true },
            { $set: { is_paid_to_teacher: false, paymentStatus: 'unpaid' } }
          );
        } catch (rollbackErr) {
          logger.error('[TEACHERS] Pay rollback failed:', rollbackErr);
        }
      }
      if (createErr?.code === 11000 && idempotencyKey) {
        const existing = await Transaction.findOne({ idempotencyKey }).lean();
        if (existing) {
          return res.json({
            success: true,
            message: 'Giao dịch đã tồn tại (idempotent)',
            data: {
              paidSessions: paidCount,
              markedSessions: actualCount,
              totalAmount: existing.amount,
              starBonusAmount: existing.starBonusAmount || 0,
              starBonusMonths: existing.starBonusMonths || [],
              transaction: existing,
              idempotent: true,
            },
          });
        }
      }
      throw createErr;
    }

    // P2: post Ledger salary — fail-closed (rollback Transaction + sessions nếu Ledger lỗi)
    try {
      await postSalary({
        teacher,
        amount: Number(amount),
        transaction,
        branchId: teacher.branchId || null,
        idempotencyKey: `salary:tx:${transaction._id}`,
        sourceRef: `tx:${transaction._id}`,
        actor: { id: req.user?.id || req.user?._id || '', role: req.user?.role || 'admin', name: req.user?.name || '' },
        note: note || defaultDesc,
        metadata: {
          sessionsCount: paidCount,
          sessionIds: sessionIds.map(String),
          starBonusAmount,
          starBonusMonths: starBonusMonthKeys,
        },
      });
    } catch (ledgerErr) {
      logger.error('[FINANCE] salary ledger (pay-flexible) FAILED — rollback: %s', ledgerErr.message);
      try {
        await Transaction.findByIdAndUpdate(transaction._id, { status: 'cancelled' });
        if (sessionIds.length > 0) {
          await Schedule.updateMany(
            { _id: { $in: sessionIds }, is_paid_to_teacher: true },
            { $set: { is_paid_to_teacher: false, paymentStatus: 'unpaid' } }
          );
        }
      } catch (rbErr) {
        logger.error('[FINANCE] pay-flexible rollback failed: %s', rbErr.message);
      }
      return res.status(500).json({
        success: false,
        message: 'Ghi sổ lương thất bại — đã hủy phiếu chi. Thử lại.',
      });
    }

    // Đánh dấu tháng thưởng đã chi sau khi Ledger OK
    if (starBonusMonthKeys.length > 0) {
      try {
        await Teacher.findByIdAndUpdate(req.params.id, {
          $addToSet: { starBonusPaidMonths: { $each: starBonusMonthKeys } },
        });
      } catch (bonusMarkErr) {
        logger.error('[FINANCE] Mark starBonusPaidMonths failed: %s', bonusMarkErr.message);
      }
    }

    const io = req.app.get('io');
    if (io) {
      const financeScope = { branchId: teacher.branchId, userIds: [teacher._id] };
      const financeMsg = `Admin đã thanh toán ${Number(amount).toLocaleString('vi-VN')}đ`
        + (paidCount > 0 ? ` cho ${paidCount} buổi` : '')
        + (starBonusAmount > 0 ? ` (gồm thưởng sao ${starBonusAmount.toLocaleString('vi-VN')}đ)` : '')
        + '.';
      emitFinanceEvent(io, financeScope, 'teacher:financeUpdated', {
        teacherId: req.params.id,
        message: financeMsg,
      });
      emitFinanceEvent(io, financeScope, 'transactions:new', transaction);
      emitFinanceEvent(io, financeScope, 'revenue:updated', { amount: Number(amount), type: 'salary' });

      NotificationService.send(io, {
        type: 'FINANCE',
        title: '✅ Lương đã được thanh toán',
        content: financeMsg,
        receivers: String(teacher._id),
        payload: { transactionId: transaction._id, amount: Number(amount), sessionsCount: paidCount },
        link: '/teacher/finance',
      }).catch((err) => logger.warn('[FINANCE] notify teacher pay-flexible: %s', err.message));
    }

    return res.json({
      success: true,
      message: paidCount > 0
        ? `Thanh toán thành công ${paidCount} buổi`
          + (starBonusAmount > 0 ? ` + thưởng sao ${starBonusAmount.toLocaleString('vi-VN')}đ` : '')
        : `Thanh toán thưởng sao ${starBonusAmount.toLocaleString('vi-VN')}đ`,
      data: {
        paidSessions: paidCount,
        markedSessions: actualCount,
        totalAmount: Number(amount),
        starBonusAmount,
        starBonusMonths: starBonusMonthKeys,
        transaction,
      }
    });
  } catch (error) {
    logger.error('[FINANCE] Flexible pay error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
});

// ─── PUT /api/teachers/:id/finance/pay-all ──────────────────────────────────────
router.put('/:id/finance/pay-all', [authMiddleware, ...teacherRouteGuard('finance_pay_all')], async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id);
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

    // Tìm các buổi chưa thanh toán
    const pendingSessionsCount = await Schedule.countDocuments({
      teacherId: req.params.id,
      status: 'completed',
      is_paid_to_teacher: { $ne: true }
    });

    if (pendingSessionsCount === 0) {
      return res.status(400).json({ success: false, message: 'Không có buổi dạy nào cần thanh toán' });
    }

    const salaryPerSession = teacher.baseSalaryPerSession || 0;
    const estimatedAmount = pendingSessionsCount * salaryPerSession;

    // Validation: Không cho phép thanh toán 0đ hoặc số phi lý (> 500 triệu/lần)
    if (estimatedAmount <= 0) {
      return res.status(400).json({ success: false, message: `Giảng viên chưa được cấu hình mức lương/buổi. Vui lòng Admin cập nhật trường "Lương/buổi" trước khi thanh toán.` });
    }
    if (estimatedAmount > 500000000) {
      return res.status(400).json({ success: false, message: `Số tiền thanh toán (${estimatedAmount.toLocaleString('vi-VN')}đ) vượt quá giới hạn 500 triệu. Vui lòng kiểm tra lại mức lương/buổi.` });
    }

    // Claim atomic theo danh sách _id đã chọn — rollback chỉ các id này nếu create fail
    const pendingSessions = await Schedule.find({
      teacherId: req.params.id,
      status: 'completed',
      is_paid_to_teacher: { $ne: true }
    }).select('_id').lean();

    const sessionIds = pendingSessions.map((s) => s._id);
    if (sessionIds.length === 0) {
      return res.status(409).json({ success: false, message: 'Các buổi đã được thanh toán bởi yêu cầu khác' });
    }

    const claim = await Schedule.updateMany(
      {
        _id: { $in: sessionIds },
        status: 'completed',
        is_paid_to_teacher: { $ne: true }
      },
      { $set: { is_paid_to_teacher: true, paymentStatus: 'paid' } }
    );

    const paidCount = claim.modifiedCount || 0;
    if (paidCount === 0) {
      return res.status(409).json({ success: false, message: 'Các buổi đã được thanh toán bởi yêu cầu khác' });
    }

    const totalAmount = paidCount * salaryPerSession;

    // Tạo giao dịch thanh toán
    const now = new Date();
    let transaction;
    try {
      transaction = await Transaction.create({
        teacherId: req.params.id,
        teacherName: teacher.name,
        teacherPhone: teacher.phone,
        amount: totalAmount,
        description: `Thanh toán thù lao ${paidCount} buổi dạy`,
        month: `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`,
        status: 'confirmed',
        confirmedBy: req.user.name || 'Admin',
        confirmedAt: now,
        bankName: teacher.bankAccount?.bankName || '',
        bankAccount: teacher.bankAccount?.accountNumber || ''
      });
    } catch (createErr) {
      try {
        await Schedule.updateMany(
          { _id: { $in: sessionIds }, is_paid_to_teacher: true },
          { $set: { is_paid_to_teacher: false, paymentStatus: 'unpaid' } }
        );
      } catch (rollbackErr) {
        logger.error('[FINANCE] Pay-all rollback failed:', rollbackErr);
      }
      throw createErr;
    }

    try {
      await postSalary({
        teacher,
        amount: totalAmount,
        transaction,
        branchId: teacher.branchId || null,
        idempotencyKey: `salary:tx:${transaction._id}`,
        sourceRef: `tx:${transaction._id}`,
        actor: { id: req.user?.id || req.user?._id || '', role: req.user?.role || 'admin', name: req.user?.name || '' },
        note: `Thanh toán thù lao ${paidCount} buổi dạy`,
        metadata: { sessionsCount: paidCount, sessionIds: sessionIds.map(String) },
      });
    } catch (ledgerErr) {
      logger.error('[FINANCE] salary ledger (pay-all) FAILED — rollback: %s', ledgerErr.message);
      try {
        await Transaction.findByIdAndUpdate(transaction._id, { status: 'cancelled' });
        await Schedule.updateMany(
          { _id: { $in: sessionIds }, is_paid_to_teacher: true },
          { $set: { is_paid_to_teacher: false, paymentStatus: 'unpaid' } }
        );
      } catch (rbErr) {
        logger.error('[FINANCE] pay-all rollback failed: %s', rbErr.message);
      }
      return res.status(500).json({
        success: false,
        message: 'Ghi sổ lương thất bại — đã hủy phiếu chi. Thử lại.',
      });
    }

    const io = req.app.get('io');
    if (io) {
      const financeScope = { branchId: teacher.branchId, userIds: [teacher._id] };
      const financeMsg = `Admin đã thanh toán ${totalAmount.toLocaleString('vi-VN')}đ cho ${paidCount} buổi dạy.`;
      emitFinanceEvent(io, financeScope, 'teacher:financeUpdated', {
        teacherId: req.params.id,
        message: financeMsg,
      });
      emitFinanceEvent(io, financeScope, 'transactions:new', transaction);
      emitFinanceEvent(io, financeScope, 'revenue:updated', { amount: totalAmount, type: 'salary' });

      NotificationService.send(io, {
        type: 'FINANCE',
        title: '✅ Lương đã được thanh toán',
        content: financeMsg,
        receivers: String(teacher._id),
        payload: { transactionId: transaction._id, amount: totalAmount, sessionsCount: paidCount },
        link: '/teacher/finance',
      }).catch((err) => logger.warn('[FINANCE] notify teacher pay-all: %s', err.message));
    }

    return res.json({
      success: true,
      message: 'Đã thanh toán thành công',
      data: {
        paidSessions: paidCount,
        totalAmount,
        transaction
      }
    });
  } catch (error) {
    logger.error('[FINANCE] Pay error:', error);
    return res.status(500).json({ success: false, message: 'Lỗi server' });
  }
});

module.exports = router;
