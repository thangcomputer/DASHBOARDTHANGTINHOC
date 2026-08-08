const express = require('express');
const router = express.Router();
const Student = require('../models/Student');
const Invoice = require('../models/Invoice');
const Schedule = require('../models/Schedule');
const { authMiddleware, checkPermission, isTeacher, branchFilter, userHasPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const { assertStudentBranchAccess } = require('../middleware/studentBranchGuard');
const { sanitizeRegex } = require('../middleware/sanitizeRegex');
const logger = require('../config/logger');
const {
  applyEnrollmentStats,
  legacyEnrollmentFromStudent,
  studentMatchesTeacher,
  resolveEnrollmentExamSubjects,
} = require('../services/enrollmentService');
const { generateTempPassword } = require('../utils/tempPassword');
const { settlePayment } = require('../services/ledgerService');
const cache = require('../utils/cache');
const { createTuitionInvoice } = require('../services/cqrs/tuitionInvoice');
const { payStudentCqrs } = require('../services/cqrs/payStudentCqrs');
const { refundStudentCqrs } = require('../services/cqrs/refundStudentCqrs');
const { payEnrollmentCqrs } = require('../services/cqrs/payEnrollmentCqrs');
const { addEnrollmentPaidCqrs } = require('../services/cqrs/addEnrollmentPaidCqrs');
const { cancelEnrollmentCqrs } = require('../services/cqrs/cancelEnrollmentCqrs');
const { requireFinanceCqrs, requireStudentCreateCqrs, assertFinanceCqrs } = require('../shared/cqrs/middleware');

function financeActor(req) {
  return {
    id: String(req.user?.id || req.user?._id || ''),
    role: String(req.user?.role || ''),
  };
}

function financeReqMeta(req, student) {
  return {
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.ip
      || '',
    userAgent: req.headers['user-agent'] || '',
    branchId: student?.branchId || req.user?.branchId || null,
  };
}

function bustFinanceCaches() {
  try {
    cache.delByPrefix('bi:overview');
  } catch { /* ignore */ }
}

// ─── GET /api/students ─────────────────────────────────────────────────────────
// Lấy danh sách học viên (Admin / Teacher) — hỗ trợ Server-side Pagination
router.get('/', [authMiddleware, branchFilter], async (req, res) => {
  try {
    const { teacherId, paid, status, course, search, page, limit, branch_id } = req.query;
    const andConditions = [];

    if (req.branchFilter && Object.keys(req.branchFilter).length > 0) {
      andConditions.push(req.branchFilter);
    }
    if (branch_id && branch_id !== 'all' && !req.userBranchId) {
      andConditions.push({ branchId: branch_id });
    }

    if (req.user.role === 'teacher') {
      andConditions.push({
        $or: [
          { teacherId: req.user.id },
          { 'enrollments.teacherId': req.user.id },
        ],
      });
    } else if (req.user.role === 'admin' || req.user.role === 'staff') {
      if (teacherId) andConditions.push({ teacherId });
    } else {
      return res.status(403).json({ success: false, message: 'Quyền truy cập bị từ chối' });
    }

    if (paid && paid !== 'all') {
      if (paid === 'paid' || paid === 'true') {
        andConditions.push({
          $or: [
            { paid: true },
            { 'enrollments.paid': true },
            { 'enrollments.status': 'active' },
            { 'enrollments.status': 'completed' },
            { 'enrollments.status': 'pending_payment' },
            { course: { $exists: true, $ne: '' } },
          ],
        });
      } else if (paid === 'unpaid' || paid === 'refunded' || paid === 'false') {
        andConditions.push({
          $or: [
            { 'enrollments.status': 'cancelled' },
            { 'enrollments.status': 'refunded' },
            { 'enrollments.refundedAmount': { $gt: 0 } },
            { refundedAmount: { $gt: 0 } },
            { status: 'cancelled' },
            { status: 'refunded' },
          ],
        });
      }
    }

    if (status) andConditions.push({ status });

    if (course && course !== 'all') {
      const cReg = { $regex: sanitizeRegex(course), $options: 'i' };
      andConditions.push({
        $or: [
          { course: cReg },
          { 'enrollments.courseName': cReg },
          { 'enrollments.name': cReg },
        ],
      });
    }

    if (search) {
      const s = sanitizeRegex(search);
      const sReg = { $regex: s, $options: 'i' };
      andConditions.push({
        $or: [
          { name: sReg },
          { zalo: sReg },
          { phone: sReg },
          { course: sReg },
          { 'enrollments.courseName': sReg },
        ],
      });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};

    // ── Pagination ──────────────────────────────────────────────────
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit) || 10));
    const skip = (pageNum - 1) * limitNum;

    const totalRecords = await Student.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limitNum);

    const students = await Student.find(filter)
      .populate('teacherId', 'name phone specialty')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // ⚡ FIX N+1: Thay vì chạy 3 query/học-viên, dùng 1 lần aggregate tổng hợp toàn bộ
    const studentIds = students.map(s => s._id);

    // 1. Đếm số buổi hoàn thành + số buổi chưa trả lương (gom theo học viên)
    const sessionAgg = await Schedule.aggregate([
      { $match: { studentId: { $in: studentIds }, status: 'completed' } },
      {
        $group: {
          _id: '$studentId',
          completed: { $sum: 1 },
          pendingPayment: { $sum: { $cond: [{ $eq: ['$is_paid_to_teacher', false] }, 1, 0] } },
        }
      },
    ]);
    const sessionMap = Object.fromEntries(sessionAgg.map(r => [String(r._id), r]));

    // 2. Kiểm tra Cooldown 12h bằng 1 query duy nhất
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const cooldownAgg = await Schedule.aggregate([
      { $match: { studentId: { $in: studentIds }, status: 'completed', createdAt: { $gte: twelveHoursAgo } } },
      { $group: { _id: '$studentId', latestCreatedAt: { $max: '$createdAt' } } },
    ]);
    const cooldownMap = Object.fromEntries(cooldownAgg.map(r => [String(r._id), r.latestCreatedAt]));

    const studentsWithRealSessions = students.map(st => {
      const doc = st.toObject();
      doc.requireWebcam = doc.requireWebcam !== false;
      const sid = String(st._id);
      const sess = sessionMap[sid];
      const realCompleted = sess?.completed || 0;
      doc.completedSessions = realCompleted;
      doc.remainingSessions = Math.max(0, (st.totalSessions || 12) - realCompleted);
      doc.pendingTeacherPaymentSessions = sess?.pendingPayment || 0;

      const lastAt = cooldownMap[sid];
      if (lastAt) {
        const diffMs = Date.now() - new Date(lastAt).getTime();
        const remainHrs = Math.max(0, 12 - diffMs / (1000 * 60 * 60));
        doc.can_check_in = false;
        doc.remaining_cooldown_hours = parseFloat(remainHrs.toFixed(1));
        doc.last_attendance_at = lastAt;
      } else {
        doc.can_check_in = true;
        doc.remaining_cooldown_hours = 0;
        doc.last_attendance_at = null;
      }

      return doc;
    });

    const enrichedStudents = await Promise.all(
      studentsWithRealSessions.map((doc) => applyEnrollmentStats(doc, doc._id, Schedule))
    );

    // Heal: khóa cancelled thiếu refundedAmount trên DTO → lấy từ ledger refund
    try {
      const needHealIds = [];
      enrichedStudents.forEach((s) => {
        const list = Array.isArray(s.courses) && s.courses.length
          ? s.courses
          : (Array.isArray(s.enrollments) ? s.enrollments : []);
        const missing = list.some((e) => e?.status === 'cancelled' && !(Number(e.refundedAmount) > 0));
        if (missing) needHealIds.push(s._id);
      });
      if (needHealIds.length) {
        const LedgerEntry = require('../models/LedgerEntry');
        const refundRows = await LedgerEntry.find({
          studentId: { $in: needHealIds },
          type: 'refund',
          status: 'posted',
        }).select('studentId courseName amount postedAt').lean();
        const byStudent = new Map();
        refundRows.forEach((r) => {
          const sid = String(r.studentId);
          if (!byStudent.has(sid)) byStudent.set(sid, []);
          byStudent.get(sid).push(r);
        });
        const norm = (n) => String(n || '').trim().toLowerCase();
        enrichedStudents.forEach((s) => {
          const sid = String(s._id);
          const ledgers = byStudent.get(sid);
          if (!ledgers?.length) return;
          const patchList = (list) => {
            if (!Array.isArray(list)) return;
            list.forEach((e) => {
              if (e?.status !== 'cancelled' || Number(e.refundedAmount) > 0) return;
              const courseKey = norm(e.courseName || e.name);
              const match = ledgers.find((r) => norm(r.courseName) === courseKey)
                || ledgers.find((r) => courseKey && norm(r.courseName).includes(courseKey))
                || ledgers[0];
              if (match) e.refundedAmount = Math.abs(Number(match.amount) || 0);
            });
          };
          patchList(s.courses);
          patchList(s.enrollments);
        });
      }
    } catch (healErr) {
      logger.warn('[STUDENTS] refund heal skipped: %s', healErr.message);
    }

    res.json({
      success: true,
      count: enrichedStudents.length,
      totalRecords,
      totalPages,
      currentPage: pageNum,
      data: enrichedStudents,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/students/stats ───────────────────────────────────────────────────
// Thống kê tổng quan (Admin dashboard)
// ─── GET /api/students/stats (branch-aware, timezone-safe) ────────────────────
router.get('/stats', [authMiddleware, branchFilter], async (req, res) => {
  try {
    // branchFilter đã gán req.branchFilter: {} cho SUPER_ADMIN, {branchId:...} cho STAFF
    const bf = { ...req.branchFilter };
    // Admin có thể override bằng ?branch_id query
    const { branch_id } = req.query;
    if (branch_id && branch_id !== 'all' && !req.userBranchId) {
      bf.branchId = branch_id;
    }

    const total = await Student.countDocuments(bf);
    const paid = await Student.countDocuments({ ...bf, paid: true });
    const unpaid = await Student.countDocuments({ ...bf, paid: false });
    const unlocked = await Student.countDocuments({ ...bf, studentExamUnlocked: true });

    const { sumFinancialRevenue } = require('../services/ledgerService');
    const branchId = bf.branchId || null;

    // Doanh thu SoT = Ledger (PAYMENT − REFUND), không dùng enrollment.paid
    const [revenueAll, pendingResult, todayRevenueRow] = await Promise.all([
      sumFinancialRevenue({ branchId }),
      Student.aggregate([
        { $match: { ...bf } },
        {
          $project: {
            pending: {
              $cond: [
                { $gt: [{ $size: { $ifNull: ['$enrollments', []] } }, 0] },
                {
                  $sum: {
                    $map: {
                      input: {
                        $filter: {
                          input: '$enrollments',
                          as: 'e',
                          cond: {
                            $and: [
                              { $ne: ['$$e.paid', true] },
                              { $ne: ['$$e.status', 'cancelled'] },
                            ],
                          },
                        },
                      },
                      as: 'e',
                      in: { $ifNull: ['$$e.price', 0] },
                    },
                  },
                },
                {
                  $cond: [{ $eq: ['$paid', true] }, 0, { $ifNull: ['$price', 0] }],
                },
              ],
            },
          },
        },
        { $group: { _id: null, total: { $sum: '$pending' } } },
      ]),
      (async () => {
        const nowVN = new Date(new Date().getTime() + 7 * 60 * 60 * 1000);
        const startOfTodayVN = new Date(Date.UTC(nowVN.getUTCFullYear(), nowVN.getUTCMonth(), nowVN.getUTCDate()) - 7 * 60 * 60 * 1000);
        return sumFinancialRevenue({ branchId, from: startOfTodayVN, to: new Date() });
      })(),
    ]);
    const totalRevenue = revenueAll.net || 0;
    const pendingRevenue = pendingResult[0]?.total || 0;
    const todayRevenue = todayRevenueRow.net || 0;

    // Số giảng viên active (branch-aware)
    const Teacher = require('../models/Teacher');
    const teacherBranchFilter = req.userBranchId ? { branchId: req.userBranchId } : {};
    if (branch_id && branch_id !== 'all' && !req.userBranchId) teacherBranchFilter.branchId = branch_id;
    const activeTeachers = await Teacher.countDocuments({ ...teacherBranchFilter, status: { $in: ['Active', 'active'] }, role: 'teacher' });
    const pendingTeachers = await Teacher.countDocuments({ role: 'teacher', status: 'Pending' });
    const totalTeachers = await Teacher.countDocuments({ ...teacherBranchFilter, role: 'teacher' });
    res.json({
      success: true,
      data: { total, paid, unpaid, unlocked, totalRevenue, pendingRevenue, todayRevenue, activeTeachers, pendingTeachers, totalTeachers },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/students/:id ─────────────────────────────────────────────────────────────────
router.get('/:id', [authMiddleware, branchFilter], async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('teacherId', 'name phone specialty avatar');

    if (!student) return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });

    // ⭐ 403 guard: STAFF chỉ được xem HV của chi nhánh mình
    if (req.userBranchId) {
      const studentBranch = student.branchId ? String(student.branchId) : null;
      if (studentBranch && studentBranch !== String(req.userBranchId)) {
        return res.status(403).json({ success: false, message: 'Không có quyền truy cập học viên này' });
      }
    }

    const isSelf = req.user.role === 'student' && req.user.id === student._id.toString();
    const isMyTeacher = req.user.role === 'teacher' && studentMatchesTeacher(student, req.user.id);
    const isAdminOrStaff = req.user.role === 'admin' || req.user.role === 'staff';

    if (!isAdminOrStaff && !isSelf && !isMyTeacher) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem thông tin này' });
    }

    const doc = student.toObject();
    doc.requireWebcam = doc.requireWebcam !== false;
    await applyEnrollmentStats(doc, req.params.id, Schedule);

    res.json({
      success: true,
      data: doc,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── GET /api/students/:id/full-detail (MEGA ENDPOINT) ───────────────────────
// Tổng hợp toàn bộ hồ sơ học viên: Thông tin cá nhân, Lịch sử điểm danh, Hóa đơn, Điểm thi
router.get('/:id/full-detail', [authMiddleware, branchFilter], async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('teacherId', 'name phone specialty avatar');

    if (!student) return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });

    // 🛡️ 403 guard: STAFF chỉ được xem HV của chi nhánh mình
    if (req.userBranchId && student.branchId && String(student.branchId) !== String(req.userBranchId)) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập dữ liệu học viên cơ sở khác' });
    }

    const isSelf = req.user.role === 'student' && req.user.id === student._id.toString();
    const isMyTeacher = req.user.role === 'teacher' && studentMatchesTeacher(student, req.user.id);
    const isAdminOrStaff = req.user.role === 'admin' || req.user.role === 'staff';
    if (!isAdminOrStaff && !isSelf && !isMyTeacher) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem thông tin này' });
    }

    // 1. Lịch sử điểm danh/học tập
    const schedules = await Schedule.find({ studentId: req.params.id }).sort({ date: -1 });

    // 2. Lịch sử hóa đơn học phí
    const mongoose = require('mongoose');
    const studentOid = mongoose.Types.ObjectId.isValid(req.params.id)
      ? new mongoose.Types.ObjectId(req.params.id)
      : req.params.id;
    const invoicesRaw = await Invoice.find({ hocVien: studentOid }).sort({ createdAt: -1 }).lean();
    let invoices = Array.isArray(invoicesRaw) ? [...invoicesRaw] : [];

    // H11: GET read-only — không backfill Invoice (tránh chứng từ orphan không Ledger).
    // Heal thiếu HĐ bằng job reconcile / finance reconcile API.

    // 2b) Ledger refund (không tạo Invoice gốc) — append để UI "Tài chính" hiển thị.
    const LedgerEntry = require('../models/LedgerEntry');
    const refundEntries = await LedgerEntry.find({
      studentId: studentOid,
      type: 'refund',
      status: 'posted',
    }).sort({ postedAt: -1 }).lean();

    const refundInvoices = (refundEntries || []).map((e, idx) => ({
      _id: e._id,
      maHoaDon: `R-${String(e._id || idx).slice(-6)}`,
      createdAt: e.postedAt || e.updatedAt || new Date(),
      ngayXuat: e.postedAt || e.updatedAt || new Date(),
      khoaHoc: e.courseName || 'Khóa học',
      ghiChu: e.note || 'Hoàn tiền (refund)',
      hocPhi: Number(e.amount) || 0,
      synthetic: true,
    }));

    // 3. Kết quả thi (nếu có)
    const ExamResult = require('../models/ExamResult');
    const examResults = await ExamResult.find({
      $or: [
        { studentId: req.params.id },
        { sbd: student.sbd }
      ]
    }).sort({ createdAt: -1 });

    const studentDoc = student.toObject();
    studentDoc.requireWebcam = studentDoc.requireWebcam !== false;
    await applyEnrollmentStats(studentDoc, req.params.id, Schedule);

    res.json({
      success: true,
      data: {
        student: studentDoc,
        schedules: schedules || [],
        invoices: [...(invoices || []), ...(refundInvoices || [])],
        examResults: examResults || []
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/students/import (BẢN GHI HÀNG LOẠT) ──────────────────────────
// Nhập danh sách học viên từ file Excel (Array of Objects)
router.post('/import', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), branchFilter], async (req, res) => {
  try {
    const { students: rawStudents } = req.body;
    if (!Array.isArray(rawStudents) || rawStudents.length === 0) {
      return res.status(400).json({ success: false, message: 'Dữ liệu không hợp lệ hoặc rỗng.' });
    }

    // Gán chi nhánh tự động: STAFF chỉ được nhập vào CS của mình
    const branchId = req.userBranchId || null;

    // Import không ghi ledger/invoice — luôn tạo unpaid; thu phí qua PUT .../pay (CQRS).
    let claimedPaidSkipped = 0;
    const studentsToInsert = rawStudents.map(s => {
      const {
        password: _omitPassword,
        refreshToken: _omitRefresh,
        tokenVersion: _omitTv,
        paid: _omitPaid,
        paidAt: _omitPaidAt,
        paidAmount: _omitPaidAmount,
        paymentMethod: _omitPayMethod,
        ...safe
      } = s || {};
      const claimedPaid = s.paid === true || s.paid === 'Đã đóng phí' || s.paid === 'true' || s.paid === 1;
      if (claimedPaid) claimedPaidSkipped += 1;
      return {
        ...safe,
        name: s.name?.toUpperCase()?.trim(),
        branchId: branchId || s.branchId || null,
        status: s.status || 'Chờ xếp lớp',
        paid: false,
        paidAmount: 0,
        learningMode: ['ONLINE', 'OFFLINE'].includes(s.learningMode?.toUpperCase())
          ? s.learningMode.toUpperCase()
          : 'OFFLINE',
      };
    }).filter(s => s.name && (s.phone || s.zalo));

    if (studentsToInsert.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có bản ghi nào hợp lệ để nhập (Thiếu Tên hoặc SĐT/Zalo).' });
    }

    const result = await Student.insertMany(studentsToInsert, { ordered: false });

    const paidNote = claimedPaidSkipped
      ? ` ${claimedPaidSkipped} dòng đánh dấu đã đóng phí được nhập unpaid — thu qua API pay.`
      : '';
    res.json({
      success: true,
      message: `Đã nhập thành công ${result.length} học viên.${paidNote}`,
      count: result.length,
      forcedUnpaid: claimedPaidSkipped,
    });
  } catch (err) {
    if (err.name === 'BulkWriteError' || err.code === 11000) {
      const inserted = err.result?.nInserted || 0;
      return res.json({
        success: true,
        message: `Đã nhập ${inserted} bản ghi (Một số bản ghi bị trùng SĐT đã được bỏ qua).`,
        count: inserted
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/students ────────────────────────────────────────────────────────
// Admin thêm học viên mới
// ─── POST /api/students ──────────────────────────────────────────────────────────────────
router.post('/', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), branchFilter, requireStudentCreateCqrs], async (req, res) => {
  try {

    // Không dùng Zalo/SĐT làm mật khẩu mặc định (dễ đoán) — random + isFirstLogin
    const plainPassword = req.body.password != null && String(req.body.password).trim() !== ''
      ? String(req.body.password).trim()
      : generateTempPassword(8);
    req.body.password = plainPassword;
    req.body.isFirstLogin = true;

    // Bảo mật: STAFF chỉ được tạo HV thuộc chi nhánh của mình
    // SUPER_ADMIN tự đặt branchId hoặc để trống
    if (req.userBranchId) {
      req.body.branchId = req.userBranchId;
      req.body.branchCode = req.userBranchCode || '';
    }

    // Đồng bộ số buổi / tên khóa từ catalog khi có courseId
    if (req.body.courseId) {
      const Course = require('../models/Course');
      const catalog = await Course.findById(req.body.courseId)
        .select('name totalSessions price discountPercent')
        .lean();
      if (catalog) {
        if (!req.body.course) req.body.course = catalog.name;
        const catalogSessions = Number(catalog.totalSessions) > 0 ? Number(catalog.totalSessions) : 12;
        if (!(Number(req.body.totalSessions) > 0)) {
          req.body.totalSessions = catalogSessions;
        }
      }
    }
    const sessions = Number(req.body.totalSessions) > 0 ? Number(req.body.totalSessions) : 12;
    req.body.totalSessions = sessions;
    if (req.body.remainingSessions == null || req.body.remainingSessions === '') {
      req.body.remainingSessions = sessions;
    }

    // Nếu lúc tạo có gán Giảng viên luôn thì chuyển trạng thái thành Đang học
    if (req.body.teacherId && (!req.body.status || req.body.status === 'Chờ xếp lớp')) {
      req.body.status = 'Đang học';
    }

    // 1 SĐT / 1 email duy nhất — không trùng HV khác hoặc GV
    try {
      const { assertUniqueContact } = require('../utils/uniqueContact');
      await assertUniqueContact({
        phone: req.body.phone,
        zalo: req.body.zalo || req.body.phone,
        email: req.body.email,
      });
    } catch (dupErr) {
      if (dupErr.status === 409) {
        return res.status(409).json({ success: false, message: dupErr.message });
      }
      throw dupErr;
    }

    const student = new Student(req.body);
    if (!student.studentCode || !String(student.studentCode).trim()) {
      const seq = String(Date.now()).slice(-8);
      student.studentCode = `HV${seq}`;
    }

    // Luôn có enrollment primary (đồng bộ danh sách khóa + thu phí)
    const isPaidOnCreate = student.paid === true || student.paid === 'true' || student.paid === 1;
    const courseName = String(student.course || '').trim() || 'Khóa học';
    const courseId = req.body.courseId || null;
    const price = Number(student.price) || 0;
    const enrollSessions = Number(student.totalSessions) > 0 ? Number(student.totalSessions) : sessions;
    let teacherName = student.teacherName || '';
    if (student.teacherId && !teacherName) {
      try {
        const Teacher = require('../models/Teacher');
        const t = await Teacher.findById(student.teacherId).select('name').lean();
        teacherName = t?.name || '';
        student.teacherName = teacherName;
      } catch { /* ignore */ }
    }
    const examSubjects = await resolveEnrollmentExamSubjects({
      courseName,
      courseId,
    });
    if (!Array.isArray(student.enrollments) || student.enrollments.length === 0) {
      student.enrollments = [{
        courseName,
        courseId: courseId || null,
        examSubjects,
        teacherId: student.teacherId || null,
        teacherName,
        price,
        paid: !!isPaidOnCreate,
        paidAt: isPaidOnCreate ? new Date() : undefined,
        totalSessions: enrollSessions,
        remainingSessions: enrollSessions,
        completedSessions: 0,
        grades: [],
        status: isPaidOnCreate ? 'active' : 'pending_payment',
        learningAccess: !!isPaidOnCreate,
        isPrimary: true,
        registeredAt: new Date(),
        requireWebcam: true,
        examUnlocked: false,
      }];
    } else if (isPaidOnCreate) {
      student.enrollments.forEach((e, i) => {
        if (i === 0 || e.isPrimary) {
          e.paid = true;
          e.paidAt = e.paidAt || new Date();
          e.learningAccess = true;
          if (!e.status || e.status === 'pending_payment') e.status = 'active';
        }
      });
    }
    if (isPaidOnCreate) {
      student.paid = true;
      if (!(Number(student.paidAmount) > 0)) student.paidAmount = price;
      if (!student.paidAt) student.paidAt = new Date();
      if (!student.paymentMethod) student.paymentMethod = 'cash';
    }

    let createdInvoice = null;
    // Hướng mới only: Student (+ Invoice + Ledger if paid) + OutboxEvent
    const { withTransaction } = require('../shared/cqrs/withTransaction');
    const OutboxEvent = require('../shared/outbox/OutboxEvent');
    try {
      const txResult = await withTransaction(async (session) => {
        await student.save({ session });
        let invoice = null;
        if (isPaidOnCreate && price > 0) {
          invoice = await createTuitionInvoice({
            student,
            courseName,
            amount: Number(student.paidAmount) > 0 ? student.paidAmount : price,
            note: `Thanh toán khi thêm học viên — ${courseName}`,
            session,
          });
          if (!invoice) {
            const err = new Error('Không tạo được hóa đơn trong transaction');
            err.status = 500;
            throw err;
          }
          const primaryEnr = student.enrollments?.[0];
          await settlePayment({
            student,
            amount: Number(student.paidAmount) > 0 ? student.paidAmount : price,
            invoice,
            enrollmentId: primaryEnr?._id ? String(primaryEnr._id) : '',
            courseName,
            source: 'student_create_paid',
            sourceRef: invoice?.maHoaDon || `create:${student._id}`,
            idempotencyKey: `payment:create:${student._id}:${primaryEnr?._id || invoice?.maHoaDon || 'nohd'}`,
            actor: financeActor(req),
            note: 'Thanh toán khi thêm học viên',
            reqMeta: financeReqMeta(req, student),
            session,
          });
        }
        await OutboxEvent.create([{
          eventType: 'StudentCreatedEvent',
          aggregateType: 'Student',
          aggregateId: student._id,
          payload: {
            studentId: student._id,
            name: student.name,
            phone: student.phone,
            zalo: student.zalo,
            email: student.email,
            plainPassword,
          },
          status: 'PENDING',
          branchId: student.branchId || undefined,
          actorId: (req.user?._id && require('mongoose').isValidObjectId(req.user._id))
            ? req.user._id
            : undefined,
        }], { session });
        return { invoice };
      });
      createdInvoice = txResult.invoice;
      if (createdInvoice) bustFinanceCaches();
    } catch (txErr) {
      logger.error('[STUDENTS] CQRS create TX failed: %s', txErr.message);
      const status = txErr.status || txErr.statusCode || 500;
      return res.status(status).json({
        success: false,
        message: txErr.message || 'Tạo học viên thất bại (CQRS transaction)',
      });
    }

    const io = req.app.get('io');
    if (io) {
      const NotificationService = require('../services/NotificationService');
      NotificationService.notifyBranchAdmins(io, {
        branchId: student.branchId,
        title: '🆕 Học viên mới đăng ký',
        content: `Học viên ${student.name} đã đăng ký khóa học ${student.course}.`,
        payload: { studentId: student._id },
        link: '/admin/students',
      });
      
      io.emit('student:new', {
        studentId: student._id,
        name: student.name,
        course: student.course,
      });
      io.emit('data:refresh', { type: 'student', action: 'create' });
      if (createdInvoice) {
        io.emit('revenue:updated', { amount: price, studentName: student.name });
      }
    }

    // Welcome deferred via OutboxWorker (StudentCreatedEvent)
    const welcome = { queued: false, notified: false };

    // Populate branch để logger và frontend có tên chi nhánh (không chỉ ObjectId)
    const Branch = require('../models/Branch');
    const branchDoc = student.branchId
      ? await Branch.findById(student.branchId).select('name code').lean()
      : null;
    const studentObj = student.toObject();
    delete studentObj.password;
    delete studentObj.refreshToken;
    delete studentObj.deviceFingerprint;
    if (branchDoc) {
      studentObj.branchName = branchDoc.name || branchDoc.code || '';
      studentObj.branchCode = studentObj.branchCode || branchDoc.code || '';
    }
    studentObj.welcomeQueued = welcome.queued;
    studentObj.welcomeNotified = welcome.notified;
    studentObj.tempPassword = plainPassword;
    if (createdInvoice) {
      studentObj.invoice = {
        _id: createdInvoice._id,
        maHoaDon: createdInvoice.maHoaDon,
        hocPhi: createdInvoice.hocPhi,
      };
    }

    res.status(201).json({ success: true, data: studentObj });

  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    const status = error.status || error.statusCode || 400;
    if (status >= 500) logger.error('[STUDENTS] Create error:', error);
    res.status(status).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/students/:id ─────────────────────────────────────────────────────
// Cập nhật thông tin học viên (Admin, Teacher, Student tự cập nhật)
router.put('/:id', [authMiddleware, branchFilter, assertStudentBranchAccess], async (req, res) => {
  try {
    // STAFF/Admin thiếu manage_students → 403 (H7); teacher/student tự sửa vẫn theo allowlist bên dưới
    if (req.user.role === 'admin' || req.user.role === 'staff') {
      const allowed = await userHasPermission(req.user, PERMISSIONS.MANAGE_STUDENTS);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Bạn không có quyền quản lý học viên.',
        });
      }
    }

    const safeBody = { ...req.body };
    // H12: cấm set paid/paidAmount/paymentMethod qua PUT generic — phải qua /pay hoặc /refund
    delete safeBody.paid;
    delete safeBody.paidAmount;
    delete safeBody.paidAt;
    delete safeBody.paymentMethod;
    delete safeBody.paidNote;
    const before = await Student.findById(req.params.id)
      .select('studentExamUnlocked examApproved name examProgress')
      .lean();

    // Nếu là Teacher, chỉ cho phép cập nhật thông tin điểm danh, thành tích
    const enrollmentCourse = safeBody.courseName;
    delete safeBody.courseName;

    if (req.user.role === 'teacher') {
      const allowedKeys = ['completedSessions', 'remainingSessions', 'lastGrade', 'avgGrade', 'grades', 'status', 'notes', 'linkHoc', 'nextClass', 'nextClassTime'];
      Object.keys(safeBody).forEach(key => {
        if (!allowedKeys.includes(key)) {
          delete safeBody[key];
        }
      });

      if (enrollmentCourse) {
        const doc = await Student.findById(req.params.id);
        if (doc?.enrollments?.length) {
          const idx = doc.enrollments.findIndex((e) => e.courseName === enrollmentCourse);
          if (idx >= 0) {
            const patchKeys = ['completedSessions', 'remainingSessions', 'lastGrade', 'avgGrade', 'grades', 'status', 'notes', 'linkHoc', 'nextClass', 'nextClassTime'];
            patchKeys.forEach((k) => {
              if (safeBody[k] !== undefined) doc.enrollments[idx][k] = safeBody[k];
            });
            if (doc.enrollments[idx].isPrimary) {
              patchKeys.forEach((k) => {
                if (safeBody[k] !== undefined) doc[k] = safeBody[k];
              });
            }
            await doc.save();
            const populated = await Student.findById(doc._id).populate('teacherId', 'name phone specialty');
            const io = req.app.get('io');
            if (io) io.emit('student:updated', populated._id);
            return res.json({ success: true, data: populated });
          }
        }
      }
    }

    // Nếu Admin cập nhật thông tin và có gán Giảng viên, tự động chuyển sang Đang học
    if (safeBody.teacherId) {
      const currentSt = await Student.findById(req.params.id);
      if (currentSt && currentSt.status === 'Chờ xếp lớp') {
        safeBody.status = 'Đang học';
      }
    }

    // Nếu là Student, chỉ cho phép cập nhật hồ sơ cá nhân CỦA CHÍNH MÌNH
    if (req.user.role === 'student') {
      if (req.user.id !== req.params.id) {
        return res.status(403).json({ success: false, message: 'Bạn chỉ có thể cập nhật hồ sơ của chính mình' });
      }
      // examProgress: dùng PUT /:id/exam-progress (state machine server-side)
      const allowedKeys = ['email', 'zalo', 'address', 'password', 'avatar'];
      Object.keys(safeBody).forEach(key => {
        if (!allowedKeys.includes(key)) {
          delete safeBody[key];
        }
      });
    }

    // Một nguồn đúng cho link vào lớp: GV/Admin sửa linkHoc → đồng bộ online_meeting_url (tránh URL cũ chiếm ưu tiên ở client)
    if (Object.prototype.hasOwnProperty.call(safeBody, 'linkHoc')) {
      safeBody.online_meeting_url = safeBody.linkHoc || '';
    }

    // Admin/staff đổi khóa học / số buổi → lấy từ catalog nếu thiếu
    const isStaffOrAdmin = req.user.role === 'admin' || req.user.role === 'staff';
    if (isStaffOrAdmin && safeBody.courseId && !(Number(safeBody.totalSessions) > 0)) {
      const Course = require('../models/Course');
      const catalog = await Course.findById(safeBody.courseId).select('name totalSessions').lean();
      if (catalog) {
        safeBody.totalSessions = Number(catalog.totalSessions) > 0 ? Number(catalog.totalSessions) : 12;
        if (!safeBody.course) safeBody.course = catalog.name;
      }
    }

    // Hash mật khẩu nếu admin/staff đổi (findByIdAndUpdate không chạy pre('save'))
    if (Object.prototype.hasOwnProperty.call(safeBody, 'password')) {
      const plain = String(safeBody.password || '').trim();
      if (plain) {
        const bcrypt = require('bcryptjs');
        safeBody.password = await bcrypt.hash(plain, 10);
      } else {
        delete safeBody.password;
      }
    }

    // Đổi SĐT / Zalo / email → kiểm tra trùng toàn hệ thống (HV + GV)
    if (
      safeBody.phone !== undefined
      || safeBody.zalo !== undefined
      || safeBody.email !== undefined
    ) {
      const current = await Student.findById(req.params.id).select('phone zalo email').lean();
      if (!current) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
      }
      try {
        const { assertUniqueContact } = require('../utils/uniqueContact');
        await assertUniqueContact({
          phone: safeBody.phone !== undefined ? safeBody.phone : current.phone,
          zalo: safeBody.zalo !== undefined ? safeBody.zalo : current.zalo,
          email: safeBody.email !== undefined ? safeBody.email : current.email,
          excludeRole: 'student',
          excludeId: req.params.id,
        });
      } catch (dupErr) {
        if (dupErr.status === 409) {
          return res.status(409).json({ success: false, message: dupErr.message });
        }
        throw dupErr;
      }
    }

    const prevStatusDoc = await Student.findById(req.params.id).select('status').lean();
    const nextStatus = safeBody.status != null ? String(safeBody.status).toLowerCase() : null;
    const prevStatus = String(prevStatusDoc?.status || '').toLowerCase();
    const locking = nextStatus
      && ['suspended', 'inactive'].includes(nextStatus)
      && !['suspended', 'inactive'].includes(prevStatus);

    const updateOps = locking
      ? { $set: safeBody, $inc: { tokenVersion: 1 }, $unset: { refreshToken: '' } }
      : safeBody;

    const student = await Student.findByIdAndUpdate(req.params.id, updateOps, {
      returnDocument: 'after',
      runValidators: true,
    }).populate('teacherId', 'name phone specialty');

    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }

    if (locking) {
      const ioLock = req.app.get('io');
      if (ioLock) {
        ioLock.emit('auth:forceLogout', {
          userId: String(student._id),
          role: 'student',
          reason: 'account_disabled',
        });
      }
    }

    // Đồng bộ enrollment chính — applyEnrollmentStats lấy totalSessions từ đây
    if (isStaffOrAdmin) {
      const touchCourse =
        safeBody.totalSessions != null
        || safeBody.course != null
        || safeBody.courseId != null
        || safeBody.price != null
        || safeBody.teacherId !== undefined;

      if (touchCourse) {
        const { legacyEnrollmentFromStudent } = require('../services/enrollmentService');
        if (!student.enrollments?.length && (student.course || safeBody.course)) {
          student.enrollments = [legacyEnrollmentFromStudent(student)];
          student.enrollments[0].isPrimary = true;
        }
        if (student.enrollments?.length) {
          let idx = student.enrollments.findIndex((e) => e.isPrimary);
          if (idx < 0) idx = 0;
          const enr = student.enrollments[idx];
          if (safeBody.course != null) enr.courseName = safeBody.course;
          if (safeBody.courseId != null) enr.courseId = safeBody.courseId;
          if (safeBody.price != null) enr.price = Number(safeBody.price) || 0;
          if (safeBody.teacherId !== undefined) {
            enr.teacherId = safeBody.teacherId || null;
          }
          if (safeBody.totalSessions != null) {
            const ts = Number(safeBody.totalSessions) > 0 ? Number(safeBody.totalSessions) : 12;
            const completed = Number(enr.completedSessions) || Number(student.completedSessions) || 0;
            enr.totalSessions = ts;
            enr.remainingSessions = Math.max(0, ts - completed);
            student.totalSessions = ts;
            student.remainingSessions = Math.max(0, ts - completed);
          }
          student.markModified('enrollments');
          await student.save();
        }
      }

      // Đồng bộ quyền thi/camera xuống từng enrollment khi cập nhật flag root (list/edit modal)
      if (safeBody.studentExamUnlocked !== undefined || safeBody.requireWebcam !== undefined) {
        if (!student.enrollments?.length && student.course) {
          const { legacyEnrollmentFromStudent: legacyEnr } = require('../services/enrollmentService');
          student.enrollments = [legacyEnr(student)];
          student.enrollments[0].isPrimary = true;
        }
        if (student.enrollments?.length) {
          if (typeof safeBody.studentExamUnlocked === 'boolean') {
            student.enrollments.forEach((e) => {
              e.examUnlocked = !!safeBody.studentExamUnlocked;
            });
          }
          if (typeof safeBody.requireWebcam === 'boolean') {
            student.enrollments.forEach((e) => {
              e.requireWebcam = !!safeBody.requireWebcam;
            });
          }
          student.markModified('enrollments');
          await student.save();
        }
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('student:updated', student._id);
      io.emit('data:refresh', { type: 'student', id: student._id });

      // ── Notification: duyệt/thu hồi quyền thi (khi admin/staff cập nhật qua PUT /students/:id)
      // AdminDashboard hiện dùng endpoint này cho approve/revoke exam, nên cần bắn noti ở đây.
      try {
        const NotificationService = require('../services/NotificationService');
        const beforeUnlocked = Boolean(before?.studentExamUnlocked);
        const afterUnlocked = Boolean(student.studentExamUnlocked);
        const beforeApproved = Boolean(before?.examApproved);
        const afterApproved = Boolean(student.examApproved);

        // Chỉ bắn noti nếu có thay đổi trạng thái (tránh spam khi update fields khác)
        if ((beforeUnlocked !== afterUnlocked) || (beforeApproved !== afterApproved)) {
          if (afterUnlocked || afterApproved) {
            await NotificationService.send(io, {
              type: 'EXAM',
              title: '✅ Bạn đã được duyệt thi',
              content: 'Admin đã cấp quyền cho bạn vào phòng thi. Bạn có thể vào thi ngay.',
              receivers: student._id.toString(),
              payload: { studentId: student._id.toString(), action: 'exam_approved' },
              link: '/student/exam'
            });
            io.emit('exam:unlocked', { studentId: student._id.toString(), studentName: student.name });
          } else {
            await NotificationService.send(io, {
              type: 'EXAM',
              title: '🔒 Quyền thi đã bị thu hồi',
              content: 'Quyền vào phòng thi của bạn vừa bị khóa. Vui lòng liên hệ trung tâm nếu cần hỗ trợ.',
              receivers: student._id.toString(),
              payload: { studentId: student._id.toString(), action: 'exam_revoked' },
              link: '/student/exam'
            });
            io.emit('exam:locked', { studentId: student._id.toString(), reason: 'revoked', message: '🔒 Quyền thi đã bị thu hồi' });
          }
        }

        // ── Notification: cấp lại bài thi (thi lại) theo từng môn (examProgress reset)
        // AdminDashboard reset môn thi bằng cách update examProgress[].lockUntil=null, status='chua_thi', score/null...
        const beforeProg = Array.isArray(before?.examProgress) ? before.examProgress : null;
        const afterProg = Array.isArray(student.examProgress) ? student.examProgress : null;
        const isAdminActor = ['admin', 'staff'].includes(String(req.user?.role || '').toLowerCase());

        if (isAdminActor && beforeProg && afterProg && Object.prototype.hasOwnProperty.call(safeBody, 'examProgress')) {
          const beforeMap = new Map(beforeProg.map((p) => [String(p?.id || ''), p]));
          const retakeSubjects = [];
          for (const ap of afterProg) {
            const sid = String(ap?.id || '');
            if (!sid) continue;
            const bp = beforeMap.get(sid);
            if (!bp) continue;

            const beforeLocked = bp.lockUntil != null;
            const afterLocked = ap.lockUntil != null;
            const becameUnlocked = beforeLocked && !afterLocked;
            const statusReset = String(bp.status || '') === 'khong_dat' && String(ap.status || '') === 'chua_thi';

            if (becameUnlocked || statusReset) retakeSubjects.push(sid);
          }

          if (retakeSubjects.length > 0) {
            const uniq = Array.from(new Set(retakeSubjects));
            const subjectText = uniq.length === 1 ? `môn "${uniq[0]}"` : `${uniq.length} môn thi`;
            await NotificationService.send(io, {
              type: 'EXAM',
              title: '🔓 Đã cấp lại bài thi',
              content: `Admin đã mở khóa để bạn thi lại ${subjectText}. Bạn có thể vào phòng thi để làm lại.`,
              receivers: student._id.toString(),
              payload: { studentId: student._id.toString(), action: 'exam_retake_granted', subjects: uniq },
              link: '/student/exam'
            });
          }
        }
      } catch (notifErr) {
        logger?.error?.('[STUDENTS] Exam approval notification error:', notifErr);
      }
    }

    res.json({ success: true, data: student });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    res.status(400).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/students/:id/exam-progress ───────────────────────────────────────
// Học viên cập nhật tiến độ thi 1 môn (server merge + validate)
router.put('/:id/exam-progress', [authMiddleware, branchFilter, assertStudentBranchAccess], async (req, res) => {
  try {
    const { applyStudentExamProgress } = require('../services/examProgressService');
    const isSelf = req.user.role === 'student' && String(req.user.id) === String(req.params.id);
    const isStaff = req.user.role === 'admin' || req.user.role === 'staff';
    if (!isSelf && !isStaff) {
      return res.status(403).json({ success: false, message: 'Không có quyền cập nhật tiến độ thi' });
    }

    const { subjectId, changes } = req.body || {};
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }

    if (isSelf) {
      const unlocked = Boolean(student.studentExamUnlocked || student.examApproved);
      const hasActive = (student.examProgress || []).some((e) => e && e.status === 'dang_thi');
      if (!unlocked && !hasActive) {
        return res.status(403).json({ success: false, message: 'Chưa được mở khóa phòng thi' });
      }
    }

    let progress;
    let entry;
    try {
      ({ progress, entry } = applyStudentExamProgress(student, subjectId, changes || {}));
    } catch (verr) {
      return res.status(verr.status || 400).json({ success: false, message: verr.message });
    }

    student.examProgress = progress;
    await student.save({ validateModifiedOnly: true });

    const io = req.app.get('io');
    if (io) {
      io.emit('student:updated', student._id);
      io.emit('data:refresh', { type: 'student', id: student._id });
    }

    return res.json({
      success: true,
      data: { examProgress: student.examProgress, entry },
    });
  } catch (error) {
    logger.error('[STUDENTS] exam-progress error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PATCH /api/students/:id/price ────────────────────────────────────────────
// Admin điều chỉnh học phí riêng cho 1 học viên cụ thể (ghi đè price snapshot)
// Dùng khi: học viên xin giảm học phí, có mã giảm giá, hoặc Admin muốn áp giá mới
router.patch('/:id/price', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter, assertStudentBranchAccess], async (req, res) => {
  try {
    const { newPrice, reason = '' } = req.body;
    if (!newPrice || isNaN(newPrice) || Number(newPrice) < 0) {
      return res.status(400).json({ success: false, message: 'Học phí không hợp lệ' });
    }

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }

    const oldPrice = student.price;
    student.price = Number(newPrice);
    student.priceHistory = student.priceHistory || [];
    student.priceHistory.push({
      oldPrice,
      newPrice: Number(newPrice),
      reason,
      changedBy: req.user.id,
      changedAt: new Date(),
    });
    await student.save({ validateModifiedOnly: true });

    const io = req.app.get('io');
    if (io) io.emit('student:updated', student._id);

    res.json({
      success: true,
      message: `Đã cập nhật học phí từ ${oldPrice.toLocaleString('vi-VN')}đ → ${Number(newPrice).toLocaleString('vi-VN')}đ`,
      data: student,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});



// ─── PUT /api/students/:id/pay ─────────────────────────────────────────────────
// Hướng mới: TX claim unpaid → enrollments → invoice → ledger
router.put('/:id/pay', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter, assertStudentBranchAccess, requireFinanceCqrs], async (req, res) => {
  try {
    const { student, invoice } = await payStudentCqrs(req, {
      financeActor,
      financeReqMeta,
      bustFinanceCaches,
    });
    const maHD = invoice?.maHoaDon || '';

    const io = req.app.get('io');
    if (io) {
      const NotificationService = require('../services/NotificationService');
      NotificationService.notifyAdmins(io, '💰 Thu học phí', `Đã thu ${student.price.toLocaleString('vi-VN')}đ từ ${student.name}`, { studentId: student._id }, '/admin/invoices');
      NotificationService.send(io, {
        type: 'FINANCE',
        title: '✅ Thanh toán thành công',
        content: `Học phí của bạn đã được xác nhận. Mã HĐ: ${maHD}`,
        receivers: student._id.toString(),
        link: '/student#profile',
      });
      io.emit('revenue:updated', { amount: student.price, studentName: student.name });
      io.emit('data:refresh', { type: 'student', id: student._id });
    }

    res.json({
      success: true,
      message: `Đã xác nhận thanh toán ${student.price.toLocaleString('vi-VN')}đ`,
      data: {
        student: (() => {
          const o = student.toObject();
          delete o.password;
          delete o.refreshToken;
          return o;
        })(),
        invoice,
      },
    });
  } catch (error) {
    const status = error.status || error.statusCode || 500;
    if (status >= 500) logger.error('[STUDENTS] Pay error:', error);
    res.status(status).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/students/:id/refund ─────────────────────────────────────────────
// Hướng mới: TX ledger refund + cập nhật trạng thái paid
router.put('/:id/refund', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter, assertStudentBranchAccess, requireFinanceCqrs], async (req, res) => {
  try {
    const {
      student,
      ledgerEntry,
      refundAmt,
      partial,
      oldSnapshot,
    } = await refundStudentCqrs(req, {
      financeActor,
      financeReqMeta,
      bustFinanceCaches,
    });
    const note = String(req.body?.note || 'Hoàn tiền / hủy xác nhận thanh toán').slice(0, 300);

    const io = req.app.get('io');
    if (io) {
      const NotificationService = require('../services/NotificationService');
      NotificationService.notifyAdmins(
        io,
        partial ? '↩️ Hoàn học phí (một phần)' : '↩️ Hoàn học phí',
        `Đã hoàn ${refundAmt.toLocaleString('vi-VN')}đ của ${student.name}${partial ? ` (còn ${Number(student.paidAmount).toLocaleString('vi-VN')}đ)` : ''}`,
        { studentId: student._id },
        '/admin/students',
      ).catch(() => {});
      NotificationService.send(io, {
        type: 'FINANCE',
        title: partial ? 'Hoàn học phí một phần' : 'Hoàn học phí',
        content: partial
          ? `Đã hoàn ${refundAmt.toLocaleString('vi-VN')}đ. Số dư đã thanh toán còn ${Number(student.paidAmount).toLocaleString('vi-VN')}đ. ${note}`
          : `Trạng thái thanh toán của bạn đã được cập nhật (hoàn/hủy). ${note}`,
        receivers: String(student._id),
        link: '/student#profile',
      }).catch(() => {});
      io.emit('data:refresh', { type: 'student', id: student._id });
      io.emit('revenue:updated', { amount: -refundAmt, studentName: student.name });
    }

    const o = student.toObject();
    delete o.password;
    delete o.refreshToken;
    return res.json({
      success: true,
      message: partial
        ? `Đã hoàn một phần ${refundAmt.toLocaleString('vi-VN')}đ (còn ${Number(student.paidAmount).toLocaleString('vi-VN')}đ)`
        : `Đã hoàn/hủy thanh toán ${refundAmt.toLocaleString('vi-VN')}đ`,
      data: {
        student: o,
        refundedAmount: refundAmt,
        partial,
        remainingPaidAmount: Number(student.paidAmount) || 0,
        oldValue: oldSnapshot,
        ledgerEntryId: ledgerEntry?._id || null,
      },
    });
  } catch (error) {
    const status = error.status || error.statusCode || 500;
    if (status >= 500) logger.error('[STUDENTS] Refund error:', error);
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/students/:id/unlock-exam ────────────────────────────────────────
// Workflow 2: Admin mở khóa phòng thi thủ công
// Body optional: { enrollmentId } — chỉ mở 1 khóa; không có = mở tất cả enrollment
router.put('/:id/unlock-exam', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), branchFilter, assertStudentBranchAccess], async (req, res) => {
  try {
    const { enrollmentId } = req.body || {};
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }

    const ALLOWED_ENR_STATUS = new Set(['active', 'completed', 'paused', 'pending_payment', 'refunded']);

    if (!student.enrollments?.length && student.course) {
      student.enrollments = [legacyEnrollmentFromStudent(student)];
      student.enrollments[0].isPrimary = true;
    }

    // Chuẩn hóa status lệch enum (seed/legacy) trước khi markModified — tránh ValidationError 500
    (student.enrollments || []).forEach((e) => {
      if (e.status && !ALLOWED_ENR_STATUS.has(String(e.status))) {
        e.status = e.paid ? 'active' : 'pending_payment';
      }
    });

    const hasEnrollmentId = enrollmentId
      && enrollmentId !== 'main'
      && require('mongoose').Types.ObjectId.isValid(String(enrollmentId));

    if (hasEnrollmentId) {
      const idx = (student.enrollments || []).findIndex((e) => String(e._id) === String(enrollmentId));
      if (idx < 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học để mở thi' });
      }
      student.enrollments[idx].examUnlocked = true;
      // Root flag = true nếu có ít nhất 1 khóa được mở
      student.studentExamUnlocked = (student.enrollments || []).some((e) => e.examUnlocked === true);
      student.examApproved = student.studentExamUnlocked;
    } else {
      student.studentExamUnlocked = true;
      student.examApproved = true;
      (student.enrollments || []).forEach((e) => { e.examUnlocked = true; });
    }

    if (student.enrollments?.length) student.markModified('enrollments');
    await student.save({ validateModifiedOnly: true });

    // Thông báo — không để lỗi kênh làm fail API sau khi đã mở khóa trong DB
    const io = req.app.get('io');
    if (io) {
      try {
        const NotificationService = require('../services/NotificationService');
        await NotificationService.send(io, {
          type: 'EXAM',
          title: '🔓 Phòng thi đã mở',
          content: hasEnrollmentId
            ? 'Admin đã cấp quyền thi cho một khóa học của bạn.'
            : 'Giảng viên/Admin đã cấp quyền cho bạn vào thi.',
          receivers: student._id.toString(),
          link: '/student/exam',
          payload: {
            studentId: String(student._id),
            enrollmentId: hasEnrollmentId ? String(enrollmentId) : null,
          },
        });
        io.emit('exam:unlocked', {
          studentId: student._id.toString(),
          studentName: student.name,
          enrollmentId: hasEnrollmentId ? String(enrollmentId) : null,
        });
        io.emit('data:refresh', { type: 'student', id: student._id });
      } catch (notifErr) {
        logger.warn('[STUDENTS] unlock-exam notify: %s', notifErr.message);
      }
    }

    try {
      const workflowService = require('../services/workflowService');
      await workflowService.completeOpenForEntity('exam_unlock', student._id, {
        action: 'approve',
        user: req.user,
        note: 'Mở khóa từ API students/unlock-exam',
      });
    } catch (wfErr) {
      logger.warn({ err: wfErr.message }, '[STUDENTS] workflow sync');
    }

    try {
      const { writeAudit } = require('../services/auditLogService');
      await writeAudit({
        action: 'exam.unlock',
        actorUserId: String(req.user?.id || ''),
        actorRole: String(req.user?.role || ''),
        branchId: student.branchId || null,
        entityType: 'student',
        entityId: String(student._id),
        studentId: student._id,
        oldValue: { studentExamUnlocked: false },
        newValue: {
          studentExamUnlocked: true,
          enrollmentId: hasEnrollmentId ? String(enrollmentId) : 'all',
        },
        ip: req.ip,
        userAgent: req.headers['user-agent'] || '',
      });
    } catch (_) { /* non-blocking */ }

    const o = student.toObject();
    delete o.password;
    delete o.refreshToken;
    return res.json({
      success: true,
      message: `Đã mở khóa phòng thi cho ${student.name}`,
      data: o,
    });
  } catch (error) {
    logger.error('[STUDENTS] unlock-exam error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/students/:id/lock-exam ──────────────────────────────────────────
// Admin/Staff hoặc GV phụ trách: đánh trượt / khóa phòng thi
router.put('/:id/lock-exam', [authMiddleware, branchFilter, assertStudentBranchAccess], async (req, res) => {
  try {
    const role = String(req.user?.role || '').toLowerCase();
    const isAdminActor = role === 'admin' || role === 'staff';

    if (isAdminActor) {
      const allowed = await userHasPermission(req.user, PERMISSIONS.MANAGE_STUDENTS);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Bạn không có quyền khóa phòng thi học viên.',
        });
      }
    }

    const existing = await Student.findById(req.params.id).select('teacherId name studentExamUnlocked enrollments.teacherId').lean();
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }

    if (!existing.studentExamUnlocked) {
      return res.status(400).json({
        success: false,
        message: 'Học viên chưa được mở khóa phòng thi hoặc đã bị đánh trượt',
      });
    }

    if (!isAdminActor) {
      if (role !== 'teacher') {
        return res.status(403).json({ success: false, message: 'Không có quyền khóa phòng thi' });
      }
      const uid = String(req.user.id);
      const rootOk = String(existing.teacherId || '') === uid;
      const enrOk = (existing.enrollments || []).some(
        (e) => String(e?.teacherId || '') === uid,
      );
      if (!rootOk && !enrOk) {
        return res.status(403).json({
          success: false,
          message: 'Chỉ được đánh trượt học viên do bạn phụ trách',
        });
      }
    }

    const { reason: rawReason = '' } = req.body || {};
    const actorLabel = isAdminActor
      ? (req.user.name || 'Admin')
      : (req.user.name || 'Giảng viên');
    const reason = String(rawReason || '').trim()
      || `Vi phạm quy chế giám sát thi (${actorLabel} đã đánh trượt)`;

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }
    const ALLOWED_ENR_STATUS = new Set(['active', 'completed', 'paused', 'pending_payment', 'refunded']);
    (student.enrollments || []).forEach((e) => {
      if (e.status && !ALLOWED_ENR_STATUS.has(String(e.status))) {
        e.status = e.paid ? 'active' : 'pending_payment';
      }
      e.examUnlocked = false;
    });
    student.studentExamUnlocked = false;
    student.examApproved = false;
    if (student.enrollments?.length) student.markModified('enrollments');
    await student.save({ validateModifiedOnly: true });

    const io = req.app.get('io');
    if (io) {
      try {
        const NotificationService = require('../services/NotificationService');

        await NotificationService.send(io, {
          type: 'EXAM',
          title: '🔒 Bài thi bị đánh trượt',
          content: `Phòng thi của bạn đã bị khóa. Lý do: ${reason}`,
          sender_id: req.user.id,
          receivers: student._id.toString(),
          payload: {
            studentId: student._id.toString(),
            action: 'exam_failed',
            reason,
            by: role,
            actorName: actorLabel,
          },
          link: '/student/exam',
        });

        const adminTitle = isAdminActor
          ? '🔒 Admin đã khóa phòng thi học viên'
          : '🚨 Giảng viên đánh trượt học viên';
        const adminContent = isAdminActor
          ? `${actorLabel} đã khóa phòng thi của học viên ${student.name}. Lý do: ${reason}`
          : `${actorLabel} đã đánh trượt học viên ${student.name}. Lý do: ${reason}`;

        await NotificationService.send(io, {
          type: 'EXAM',
          title: adminTitle,
          content: adminContent,
          sender_id: req.user.id,
          receivers: 'ALL_ADMIN',
          payload: {
            studentId: student._id.toString(),
            studentName: student.name,
            teacherId: student.teacherId?.toString?.() || student.teacherId,
            action: 'exam_failed',
            reason,
            by: role,
          },
          link: '/admin#students',
        });
      } catch (notifErr) {
        logger?.error?.('[LOCK_EXAM] Notification error:', notifErr);
      }

      const lockPayload = {
        studentId: student._id.toString(),
        reason,
        message: `🔒 Phòng thi đã bị khóa. Lý do: ${reason}`,
      };
      io.to(`student_${student._id}`).emit('exam:locked', lockPayload);
      io.emit('exam:locked', lockPayload);
      io.emit('student:updated', student._id);
      io.emit('data:refresh', { type: 'student', id: student._id });
    }

    res.json({
      success: true,
      message: `Đã đánh trượt / khóa phòng thi của ${student.name}`,
      data: student,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/students/:id/enrollments ───────────────────────────────────────
// Admin thêm khóa học mới cho học viên (cùng tài khoản, khác môn / thầy)
router.post('/:id/enrollments', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), branchFilter, assertStudentBranchAccess], async (req, res) => {
  try {
    const { courseName, courseId, teacherId, price, totalSessions, paid } = req.body;
    if (!courseName?.trim() && !courseId) {
      return res.status(400).json({ success: false, message: 'Tên khóa học hoặc courseId là bắt buộc' });
    }

    const isPaidFlag = paid === true || paid === 'true' || paid === 1 || paid === '1';
    if (isPaidFlag) {
      const canFinance = await userHasPermission(req.user, PERMISSIONS.MANAGE_FINANCE);
      if (!canFinance) {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Đánh dấu đã thanh toán khi thêm khóa cần quyền tài chính.',
        });
      }
    }

    const Course = require('../models/Course');
    let catalogCourse = null;
    if (courseId) {
      catalogCourse = await Course.findById(courseId).lean();
    }
    const resolvedName = (catalogCourse?.name || courseName || '').trim();
    if (!resolvedName) {
      return res.status(400).json({ success: false, message: 'Không xác định được tên khóa học' });
    }

    const student = await Student.findById(req.params.id).populate('teacherId', 'name phone');
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }

    if (!student.enrollments?.length && student.course) {
      student.enrollments = [legacyEnrollmentFromStudent(student)];
      student.enrollments[0].isPrimary = true;
    }

    const duplicate = (student.enrollments || []).some((e) => {
      if (String(e.status || '') === 'cancelled') return false;
      if (catalogCourse?._id && e.courseId && String(e.courseId) === String(catalogCourse._id)) return true;
      return (e.courseName || '').toLowerCase() === resolvedName.toLowerCase();
    });
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'Học viên đã đăng ký khóa học này' });
    }

    let teacherName = '';
    if (teacherId) {
      const Teacher = require('../models/Teacher');
      const t = await Teacher.findById(teacherId).select('name').lean();
      teacherName = t?.name || '';
    }

    const sessions = Number(totalSessions) > 0 ? Number(totalSessions) : (catalogCourse?.totalSessions || 12);
    const resolvedPrice = Number(price) || catalogCourse?.discountPrice || catalogCourse?.price || 0;
    const isPaid = paid === true || paid === 'true' || paid === 1 || paid === '1';
    const examSubjects = await resolveEnrollmentExamSubjects({
      courseName: resolvedName,
      courseId: catalogCourse?._id || courseId,
    });

    const enrollmentPayload = {
      courseName: resolvedName,
      courseId: catalogCourse?._id || courseId || null,
      examSubjects,
      teacherId: teacherId || null,
      teacherName,
      price: resolvedPrice,
      paid: isPaid,
      paidAt: isPaid ? new Date() : undefined,
      totalSessions: sessions,
      remainingSessions: sessions,
      completedSessions: 0,
      grades: [],
      status: isPaid ? 'active' : 'pending_payment',
      learningAccess: !!isPaid,
      isPrimary: false,
      registeredAt: new Date(),
      requireWebcam: true,
      examUnlocked: false,
    };

    let studentDoc = student;
    let createdInvoice = null;

    if (isPaid && resolvedPrice > 0) {
      try {
        assertFinanceCqrs();
        const paidResult = await addEnrollmentPaidCqrs({
          studentId: student._id,
          enrollmentPayload,
          resolvedPrice,
          resolvedName,
          financeActor,
          financeReqMeta,
          bustFinanceCaches,
          req,
        });
        studentDoc = paidResult.student;
        createdInvoice = paidResult.invoice;
      } catch (txErr) {
        const status = txErr.status || txErr.statusCode || 500;
        return res.status(status).json({ success: false, message: txErr.message });
      }
    } else {
      student.enrollments.push(enrollmentPayload);
      await student.save();
      studentDoc = student;
    }

    const doc = studentDoc.toObject();
    await applyEnrollmentStats(doc, studentDoc._id, Schedule);

    const io = req.app.get('io');
    if (io) io.emit('data:refresh', { type: 'student', id: studentDoc._id });

    res.status(201).json({
      success: true,
      message: `Đã thêm khóa "${resolvedName}" cho học viên`,
      data: doc,
      ...(createdInvoice ? { invoice: { _id: createdInvoice._id, maHoaDon: createdInvoice.maHoaDon } } : {}),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function syncStudentFromPrimaryEnrollment(student) {
  const { syncStudentFromPrimaryEnrollment: sync } = require('../services/cqrs/cancelEnrollmentCqrs');
  return sync(student);
}


// ─── PUT /api/students/:id/enrollments/:enrollmentId/settings ─────────────────
// Cập nhật quyền theo khóa: requireWebcam, examUnlocked
router.put('/:id/enrollments/:enrollmentId/settings', authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }
    if (!student.enrollments?.length && student.course) {
      student.enrollments = [legacyEnrollmentFromStudent(student)];
      student.enrollments[0].isPrimary = true;
    }
    const idx = (student.enrollments || []).findIndex((e) => String(e._id) === String(req.params.enrollmentId));
    if (idx < 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học' });
    }

    const { requireWebcam, examUnlocked } = req.body || {};
    if (typeof requireWebcam === 'boolean') {
      student.enrollments[idx].requireWebcam = requireWebcam;
    }
    if (typeof examUnlocked === 'boolean') {
      student.enrollments[idx].examUnlocked = examUnlocked;
    }

    // Đồng bộ flag root để tương thích API cũ / danh sách
    student.studentExamUnlocked = (student.enrollments || []).some((e) => e.examUnlocked === true);
    const primary = student.enrollments.find((e) => e.isPrimary) || student.enrollments[0];
    if (primary) {
      student.requireWebcam = primary.requireWebcam !== false;
    }

    student.markModified('enrollments');
    await student.save({ validateModifiedOnly: true });

    const doc = student.toObject();
    await applyEnrollmentStats(doc, student._id, Schedule);
    const io = req.app.get('io');
    if (io) io.emit('data:refresh', { type: 'student', id: student._id });

    return res.json({
      success: true,
      message: 'Đã cập nhật quyền khóa học',
      data: doc,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/students/:id/enrollments/:enrollmentId/pay ──────────────────────
// Hướng mới: TX claim enrollment → invoice → ledger
router.put('/:id/enrollments/:enrollmentId/pay', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter, assertStudentBranchAccess, requireFinanceCqrs], async (req, res) => {
  try {
    const { student: fresh, invoice, claimedEnr, amount } = await payEnrollmentCqrs(req, {
      financeActor,
      financeReqMeta,
      bustFinanceCaches,
    });

    const io = req.app.get('io');
    if (io) io.emit('data:refresh', { type: 'student', id: fresh._id });

    const doc = fresh.toObject();
    await applyEnrollmentStats(doc, fresh._id, Schedule);
    return res.json({
      success: true,
      message: `Đã xác nhận thanh toán khóa "${claimedEnr.courseName}"${amount ? ` — ${amount.toLocaleString('vi-VN')}đ` : ''}`,
      data: { student: doc, invoice },
    });
  } catch (error) {
    const status = error.status || error.statusCode || 500;
    return res.status(status).json({ success: false, message: error.message });
  }
});

// ─── DELETE /api/students/:id/enrollments/:enrollmentId ───────────────────────
// Soft-cancel; hoàn tiền (nếu có) + cancel trong một TX
router.delete('/:id/enrollments/:enrollmentId', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), branchFilter, assertStudentBranchAccess], async (req, res) => {
  try {
    const cancelReason = String(req.body?.cancelReason || '').trim() || 'Admin hủy khóa';

    // Peek enrollment for refund permission / amount validation
    const peek = await Student.findById(req.params.id).select('enrollments course price paid teacherId teacherName');
    if (!peek) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }
    if (!peek.enrollments?.length && peek.course) {
      peek.enrollments = [legacyEnrollmentFromStudent(peek)];
      peek.enrollments[0].isPrimary = true;
    }
    const peekList = peek.enrollments || [];
    const peekIdx = peekList.findIndex((e) => String(e._id) === String(req.params.enrollmentId));
    if (peekIdx < 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học' });
    }
    const peekEnr = peekList[peekIdx];
    if (peekEnr.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Khóa học này đã bị hủy trước đó.' });
    }

    const wasPaid = peekEnr.paid === true;
    const paidAmt = Number(peekEnr.price || 0);
    let refundAmt = 0;
    if (wasPaid && paidAmt > 0 && req.body?.refundAmount != null) {
      const bodyRefund = Number(req.body.refundAmount);
      if (Number.isFinite(bodyRefund) && bodyRefund >= 0 && bodyRefund <= paidAmt) {
        refundAmt = bodyRefund;
      }
    }

    if (refundAmt > 0) {
      const canFinance = await userHasPermission(req.user, PERMISSIONS.MANAGE_FINANCE);
      if (!canFinance) {
        return res.status(403).json({
          success: false,
          message: '403 Forbidden: Hoàn tiền khi hủy khóa cần quyền quản lý tài chính.',
        });
      }
      try {
        assertFinanceCqrs();
      } catch (flagErr) {
        return res.status(flagErr.status || 503).json({ success: false, message: flagErr.message });
      }
    }

    let result;
    try {
      result = await cancelEnrollmentCqrs({
        studentId: req.params.id,
        enrollmentId: req.params.enrollmentId,
        cancelReason,
        refundAmt,
        financeActor,
        financeReqMeta,
        bustFinanceCaches,
        req,
      });
    } catch (txErr) {
      const status = txErr.status || txErr.statusCode || 500;
      return res.status(status).json({ success: false, message: txErr.message });
    }

    const { student, enr, courseName } = result;
    let refundMsg = '';
    if (refundAmt > 0) {
      try {
        const { writeAudit } = require('../services/auditLogService');
        await writeAudit({
          action: 'enrollment.cancel_refund',
          actorUserId: String(req.user?.id || ''),
          actorRole: String(req.user?.role || ''),
          studentId: student._id,
          branchId: student.branchId,
          entityType: 'enrollment',
          entityId: String(enr._id),
          oldValue: { status: 'active', paid: true, price: paidAmt },
          newValue: { status: 'cancelled', refundedAmount: refundAmt, cancelReason },
          ip: req.ip,
          userAgent: req.headers['user-agent'] || '',
        });
      } catch { /* ignore audit */ }
      refundMsg = ` Đã hoàn ${refundAmt.toLocaleString('vi-VN')}đ.`;
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('data:refresh', { type: 'student', id: student._id });
      if (refundAmt > 0) io.emit('revenue:updated', { amount: -refundAmt, studentName: student.name });
    }

    const doc = student.toObject();
    await applyEnrollmentStats(doc, student._id, Schedule);
    return res.json({
      success: true,
      message: `Đã hủy khóa "${courseName}".${refundMsg}`,
      data: doc,
      meta: { refundedAmount: refundAmt, cancelReason },
    });
  } catch (error) {
    logger.error('[STUDENTS] cancel enrollment:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/students/:id/assign-teacher ─────────────────────────────────────
// Admin/Staff gán (hoặc bỏ gán) giảng viên — theo khóa (enrollmentId) hoặc khóa chính
router.put('/:id/assign-teacher', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), branchFilter, assertStudentBranchAccess], async (req, res) => {
  try {
    const { teacherId, enrollmentId, reason = '' } = req.body;
    const isUnassign = teacherId === null || teacherId === '' || teacherId === undefined;

    const student = await Student.findById(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }

    if (!student.enrollments?.length && student.course) {
      student.enrollments = [legacyEnrollmentFromStudent(student)];
      student.enrollments[0].isPrimary = true;
    }

    let teacherName = '';
    let teacherDoc = null;
    let prevTeacherIdForReassign = null;
    let activeEnrollmentId = '';
    let activeEnrollmentIdx = -1;
    // Validate ObjectId khi gán GV
    if (!isUnassign && teacherId) {
      const mongoose = require('mongoose');
      if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        return res.status(400).json({ success: false, message: 'ID giảng viên không hợp lệ' });
      }
      const Teacher = require('../models/Teacher');
      const t = await Teacher.findById(teacherId).select('name status role specialty subjectIds').lean();
      if (!t || t.role !== 'teacher') {
        return res.status(404).json({ success: false, message: 'Không tìm thấy giảng viên' });
      }
      if (String(t.status || '').toLowerCase() !== 'active') {
        return res.status(400).json({
          success: false,
          message: 'Giảng viên chưa được cấp quyền giảng dạy (Active). Duyệt GV trước khi phân công.',
        });
      }
      teacherDoc = t;
      teacherName = t.name || 'Giảng viên';
    }

    // Khớp môn: khóa học HV ↔ chuyên môn GV — lệch môn thì từ chối phân công
    let targetCourse = student.course;
    let targetExamSubjects = [];
    if (enrollmentId && student.enrollments?.length) {
      const idxPreview = student.enrollments.findIndex((e) => String(e._id) === String(enrollmentId));
      if (idxPreview >= 0) {
        targetCourse = student.enrollments[idxPreview].courseName || targetCourse;
        targetExamSubjects = student.enrollments[idxPreview].examSubjects || [];
      }
    } else if (student.enrollments?.length) {
      const primaryIdx = student.enrollments.findIndex((e) => e.isPrimary);
      const idx = primaryIdx >= 0 ? primaryIdx : 0;
      targetCourse = student.enrollments[idx]?.courseName || targetCourse;
      targetExamSubjects = student.enrollments[idx]?.examSubjects || [];
    }

    if (!isUnassign && teacherDoc && targetCourse) {
      const courseName = String(targetCourse || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd');
      const specialty = String(teacherDoc.specialty || '').toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd');

      const courseFocus = (() => {
        if (courseName.includes('thvp') || courseName.includes('van phong') || courseName.includes('tin hoc van phong') || courseName.includes('microsoft office')) {
          return ['thvp'];
        }
        if (courseName.includes('canva') && (courseName.includes('powerpoint') || courseName.includes('ppt'))) return ['powerpoint', 'canva'];
        if (courseName.includes('canva')) return ['canva'];
        if (courseName.includes('excel')) return ['excel'];
        if (courseName.includes('word')) return ['word'];
        if (courseName.includes('powerpoint') || courseName.includes('ppt')) return ['powerpoint'];
        if (Array.isArray(targetExamSubjects) && targetExamSubjects.length) {
          const office = ['coban', 'word', 'excel', 'powerpoint'];
          const hits = targetExamSubjects.map(String).filter((id) => office.includes(id) && id !== 'coban');
          if (hits.length >= 3) return ['thvp'];
          return [...new Set(targetExamSubjects.map(String).filter((id) => id !== 'coban'))];
        }
        return [];
      })();

      const teacherFocus = (() => {
        if (specialty.includes('thvp') || specialty.includes('van phong') || specialty.includes('tin hoc van phong') || specialty.includes('microsoft office')) {
          return ['thvp'];
        }
        const focuses = new Set();
        if (specialty.includes('excel')) focuses.add('excel');
        if (specialty.includes('word')) focuses.add('word');
        if (specialty.includes('powerpoint') || specialty.includes('ppt')) focuses.add('powerpoint');
        if (specialty.includes('canva')) focuses.add('canva');
        const { resolveTeacherSubjectIds } = require('../utils/trainingSubjectAccess');
        const teacherSubs = resolveTeacherSubjectIds(teacherDoc).map(String);
        const office = ['coban', 'word', 'excel', 'powerpoint'];
        teacherSubs.forEach((id) => {
          if (id === 'coban') return;
          if (office.includes(id) || id === 'canva') focuses.add(id);
        });
        // Đủ Word+Excel+PowerPoint → focus THVP (khớp khóa Tin học văn phòng)
        const hasCanva = focuses.has('canva') || teacherSubs.includes('canva');
        const hasFullOffice = ['word', 'excel', 'powerpoint'].every((id) => focuses.has(id));
        if (hasFullOffice && !hasCanva) {
          focuses.delete('word');
          focuses.delete('excel');
          focuses.delete('powerpoint');
          focuses.delete('coban');
          focuses.add('thvp');
        }
        return [...focuses];
      })();

      let matched = false;
      if (courseFocus.length && teacherFocus.length) {
        const set = new Set(teacherFocus);
        matched = courseFocus.some((f) => set.has(f));
      }
      if (!matched && specialty && courseName) {
        matched = specialty.includes(courseName) || courseName.includes(specialty)
          || specialty.split(/[,;|/]+/).some((p) => {
            const part = p.trim();
            return part.length >= 3 && (courseName.includes(part) || part.includes(courseName));
          });
      }
      if (!matched) {
        return res.status(400).json({
          success: false,
          message: `Giảng viên "${teacherName}" không phụ trách môn "${targetCourse}". Chọn GV đúng chuyên môn.`,
        });
      }
    }

    const mongoose = require('mongoose');
    const hasValidEnrollmentId = enrollmentId
      && enrollmentId !== 'main'
      && mongoose.Types.ObjectId.isValid(String(enrollmentId));

    if (hasValidEnrollmentId && student.enrollments?.length) {
      const idx = student.enrollments.findIndex((e) => String(e._id) === String(enrollmentId));
      if (idx < 0) {
        return res.status(404).json({ success: false, message: 'Không tìm thấy khóa học' });
      }
      activeEnrollmentIdx = idx;
      activeEnrollmentId = String(student.enrollments[idx]._id);
      const prevEnrTeacher = student.enrollments[idx].teacherId;
      prevTeacherIdForReassign = prevEnrTeacher ? String(prevEnrTeacher) : null;
      student.enrollments[idx].teacherId = isUnassign ? null : teacherId;
      student.enrollments[idx].teacherName = teacherName;
      targetCourse = student.enrollments[idx].courseName;
      const isPrimary = !!student.enrollments[idx].isPrimary || student.enrollments.length === 1;
      if (isUnassign) {
        // Bỏ phân công: luôn xóa teacherId cấp HV nếu là khóa chính / khóa duy nhất
        // hoặc teacherId cấp HV đang trùng GV của khóa này
        const topTid = student.teacherId?._id || student.teacherId;
        if (isPrimary || String(topTid || '') === String(prevEnrTeacher || '')) {
          student.teacherId = null;
          student.teacherName = '';
        }
      } else if (isPrimary) {
        student.teacherId = teacherId;
        student.teacherName = teacherName;
      }
    } else {
      const primaryIdx = student.enrollments?.findIndex((e) => e.isPrimary);
      const idx = primaryIdx >= 0 ? primaryIdx : 0;
      if (student.enrollments?.[idx]) {
        activeEnrollmentIdx = idx;
        activeEnrollmentId = String(student.enrollments[idx]._id);
        prevTeacherIdForReassign = student.enrollments[idx].teacherId
          ? String(student.enrollments[idx].teacherId)
          : (student.teacherId ? String(student.teacherId._id || student.teacherId) : null);
        student.enrollments[idx].teacherId = isUnassign ? null : teacherId;
        student.enrollments[idx].teacherName = teacherName;
        targetCourse = student.enrollments[idx].courseName;
      }
      student.teacherId = isUnassign ? null : teacherId;
      student.teacherName = isUnassign ? '' : teacherName;
    }

    // Mark enrollments modified for Mongoose subdocument arrays
    if (student.enrollments?.length) {
      student.markModified('enrollments');
    }

    if (student.status === 'Chờ xếp lớp' && !isUnassign) {
      student.status = 'Đang học';
    }

    await student.save();
    await student.populate('teacherId', 'name phone specialty');

    const ScheduleModel = require('../models/Schedule');
    const schedFilter = {
      studentId: student._id,
      status: 'scheduled',
      ...(targetCourse ? { course: targetCourse } : {}),
    };
    let futureSchedulesUpdated = 0;
    if (isUnassign) {
      const r = await ScheduleModel.updateMany(schedFilter, { $set: { teacherId: null, teacherName: '' } });
      futureSchedulesUpdated = r.modifiedCount || 0;
    } else {
      const r = await ScheduleModel.updateMany(schedFilter, {
        $set: { teacherId, teacherName },
      });
      futureSchedulesUpdated = r.modifiedCount || 0;
    }

    const completedAgg = await ScheduleModel.aggregate([
      {
        $match: {
          studentId: student._id,
          status: 'completed',
          ...(targetCourse ? { course: targetCourse } : {}),
        },
      },
      { $group: { _id: '$teacherId', count: { $sum: 1 } } },
    ]);
    const completedSplit = {};
    completedAgg.forEach((row) => {
      if (row._id) completedSplit[String(row._id)] = row.count;
    });

    const enrSnap = activeEnrollmentIdx >= 0 ? student.enrollments[activeEnrollmentIdx] : null;
    const completedSessionsAtSwitch = Number(enrSnap?.completedSessions) || 0;
    const remainingSessionsSnap = Number(enrSnap?.remainingSessions) || 0;
    const progressPreserved = completedSessionsAtSwitch >= 0 && remainingSessionsSnap >= 0;

    const newTeacherStr = !isUnassign && teacherId ? String(teacherId) : '';
    const isReassign = !isUnassign && newTeacherStr
      && prevTeacherIdForReassign
      && prevTeacherIdForReassign !== newTeacherStr;

    if (isReassign || (!isUnassign && newTeacherStr && !prevTeacherIdForReassign)) {
      try {
        const TeacherAssignmentSegment = require('../models/TeacherAssignmentSegment');
        const enrollKey = activeEnrollmentId || 'primary';
        if (isReassign) {
          await TeacherAssignmentSegment.updateMany(
            {
              studentId: student._id,
              enrollmentId: enrollKey,
              endedAt: null,
            },
            { $set: { endedAt: new Date() } },
          );
        }
        await TeacherAssignmentSegment.create({
          studentId: student._id,
          enrollmentId: enrollKey,
          courseName: targetCourse || student.course || '',
          teacherId,
          teacherName,
          completedSessionsAtStart: completedSessionsAtSwitch,
          actorId: String(req.user?.id || ''),
          actorRole: String(req.user?.role || ''),
          reason: String(reason || '').slice(0, 500) || (isReassign ? 'Đổi giảng viên' : 'Phân công giảng viên'),
        });

        const { writeAudit } = require('../services/auditLogService');
        await writeAudit({
          action: isReassign ? 'teacher.reassign' : 'teacher.assign',
          actorUserId: String(req.user?.id || ''),
          actorRole: String(req.user?.role || ''),
          branchId: student.branchId || null,
          entityType: 'enrollment',
          entityId: enrollKey,
          studentId: student._id,
          teacherId,
          oldValue: {
            teacherId: prevTeacherIdForReassign,
            completedSessions: completedSessionsAtSwitch,
          },
          newValue: {
            teacherId: newTeacherStr,
            completedSessions: completedSessionsAtSwitch,
            futureSchedulesUpdated,
            completedSplit,
          },
          ip: req.ip,
          userAgent: req.headers['user-agent'] || '',
        });
      } catch (segErr) {
        logger.warn('[ASSIGN_TEACHER] segment/audit: %s', segErr.message);
      }
    }

    const io = req.app.get('io');

    try {
      if (io && !isUnassign) {
        const NotificationService = require('../services/NotificationService');
        const isNewAssign = !isReassign;
        await NotificationService.send(io, {
          type: 'COURSE',
          title: isNewAssign ? '📚 Học viên mới được giao' : '👨‍🏫 Đổi giảng viên phụ trách',
          content: isNewAssign
            ? `Học viên ${student.name} (${targetCourse || student.course}) đã được giao cho bạn.`
            : `Bạn được phân công tiếp khóa "${targetCourse || student.course}" của ${student.name} (từ buổi ${completedSessionsAtSwitch + 1}).`,
          receivers: teacherId.toString(),
          payload: { studentId: student._id, type: 'student', reassign: isReassign },
          link: `/teacher#students?studentId=${student._id}`,
        });

        if (isReassign) {
          await NotificationService.send(io, {
            type: 'COURSE',
            title: '👨‍🏫 Giảng viên khóa học đã đổi',
            content: `Khóa "${targetCourse || student.course}" chuyển sang GV ${teacherName}. Tiến độ đã học: ${completedSessionsAtSwitch} buổi (không mất lịch).`,
            receivers: String(student._id),
            link: '/student#profile',
          });
        } else {
          await NotificationService.send(io, {
            type: 'COURSE',
            title: '👨‍🏫 Phân công giảng viên phụ trách',
            content: `Bạn đã được phân công Giảng viên ${teacherName} phụ trách khóa "${targetCourse || student.course}".`,
            receivers: String(student._id),
            link: '/student#profile',
          });
        }


        io.to(teacherId.toString()).emit('CONTACT_LIST_UPDATED', { studentId: student._id });
        io.to(student._id.toString()).emit('CONTACT_LIST_UPDATED', { teacherId });
        io.emit('student:assigned', { teacherId: teacherId.toString(), studentId: student._id.toString() });
        io.emit('data:refresh', { type: 'student', id: student._id });
      } else if (io && isUnassign) {
        io.to(student._id.toString()).emit('CONTACT_LIST_UPDATED', { teacherId: null });
        io.emit('data:refresh', { type: 'student', id: student._id });
      }
    } catch (notifErr) {
      logger.error('[ASSIGN_TEACHER] Notification error:', notifErr);
    }

    const doc = student.toObject();
    await applyEnrollmentStats(doc, student._id, Schedule);

    res.json({
      success: true,
      message: isUnassign ? 'Đã bỏ phân công giảng viên' : (isReassign ? 'Đã đổi giảng viên thành công' : 'Đã gán giảng viên thành công'),
      data: doc,
      meta: {
        reassign: !!isReassign,
        completedSessionsAtSwitch,
        futureSchedulesUpdated,
        completedSplit,
        progressPreserved,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});


// ─── DELETE /api/students/:id ──────────────────────────────────────────────────
router.delete('/:id', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), branchFilter, assertStudentBranchAccess], async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });
    }
    res.json({ success: true, message: `Đã xóa học viên ${student.name}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/students/:id/reset-today-attendance ─────────────────────────────
// Xóa điểm danh HÔM NAY của học viên — CHỈ CHO PHÉP TRONG VÒNG 1 TIẾNG
router.post('/:id/reset-today-attendance', authMiddleware, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });

    const todayVN = new Date().toLocaleDateString('vi-VN');
    const oldGrades = student.grades || [];
    const hadTodayRecord = oldGrades.some(g => g.date === todayVN);

    if (!hadTodayRecord) {
      return res.json({ success: true, message: 'Học viên chưa được điểm danh hôm nay.' });
    }

    // ⏰ Kiểm tra thời gian 1 tiếng: Lấy schedule gần nhất hôm nay
    const todayISO = new Date().toISOString().split('T')[0];
    const latestSchedule = await Schedule.findOne({
      studentId: req.params.id,
      date: { $gte: new Date(todayISO), $lt: new Date(new Date(todayISO).getTime() + 86400000) },
      status: 'completed',
    }).sort({ createdAt: -1 }).lean();

    if (latestSchedule) {
      const diffMs = Date.now() - new Date(latestSchedule.createdAt).getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins >= 60) {
        return res.status(403).json({
          success: false,
          message: `⏰ Đã quá 1 tiếng kể từ lúc điểm danh (${diffMins} phút). Không thể hủy nữa.`,
          code: 'CANCEL_TIMEOUT'
        });
      }
    }

    // Xóa record hôm nay khỏi grades
    const newGrades = oldGrades.filter(g => g.date !== todayVN);

    // Khôi phục số buổi (tính toán toán học tuyệt đối để tránh sai số)
    const newCompleted = newGrades.length;
    const newRemaining = Math.max(0, (student.totalSessions || 12) - newCompleted);

    await Student.findByIdAndUpdate(req.params.id, {
      grades: newGrades,
      completedSessions: newCompleted,
      remainingSessions: newRemaining,
      status: 'Đang học'
    });

    // Xóa schedule hôm nay nếu có
    await Schedule.deleteMany({
      studentId: req.params.id,
      date: { $gte: new Date(todayISO), $lt: new Date(new Date(todayISO).getTime() + 86400000) },
      status: 'completed'
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('data:refresh', { type: 'student', id: req.params.id });
    }

    res.json({ success: true, message: `✅ Đã hủy điểm danh hôm nay cho "${student.name}"` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── POST /api/students/:id/reset-history ──────────────────────────────────────
// Reset lịch sử học (xóa buổi học, điểm danh, điểm số) — giữ thông tin cá nhân & học phí
router.post('/:id/reset-history', authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS), async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Không tìm thấy học viên' });

    // Xóa tất cả lịch học liên quan đến học viên này
    const deletedSchedules = await Schedule.deleteMany({ studentId: req.params.id });

    // Reset các field lịch sử trên Student document, giữ nguyên: name, phone, zalo, course, paid, price...
    await Student.findByIdAndUpdate(req.params.id, {
      $set: {
        remainingSessions: student.totalSessions || 12, // reset về đủ buổi
        studentExamUnlocked: false,
        grade: null,
        status: 'active',
        // Xóa lịch sử điểm danh nếu có field này
        attendanceHistory: [],
        examScore: null,
        practicalStatus: 'pending',
      },
    });

    // Log hệ thống
    const io = req.app.get('io');
    if (io) io.emit('student:history_reset', { studentId: req.params.id, name: student.name });

    res.json({
      success: true,
      message: `✅ Đã reset lịch sử học viên "${student.name}" — Xóa ${deletedSchedules.deletedCount} buổi học`,
      data: { deletedSchedules: deletedSchedules.deletedCount },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── PUT /api/students/:id/pay-teacher (THANH TOÁN LƯƠNG TRÊN TỪNG HỌC VIÊN) ───
router.put('/:id/pay-teacher', [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE), branchFilter, assertStudentBranchAccess, requireFinanceCqrs], async (req, res) => {
  try {
    const { action } = req.body; // 'PARTIAL' hoặc 'PAID_IN_ADVANCE'
    const studentId = req.params.id;
    const { withTransaction } = require('../shared/cqrs/withTransaction');
    const Schedule = require('../models/Schedule');

    const result = await withTransaction(async (session) => {
      const student = await Student.findById(studentId).session(session);
      if (!student) {
        const err = new Error('Không tìm thấy học viên');
        err.status = 404;
        throw err;
      }

      if (action === 'PAID_IN_ADVANCE') {
        student.teacher_payment_status = 'PAID_IN_ADVANCE';
        await student.save({ session });
        const updated = await Schedule.updateMany(
          { studentId, status: 'completed', is_paid_to_teacher: false },
          { $set: { is_paid_to_teacher: true, paymentStatus: 'paid' } },
          { session }
        );
        return {
          student,
          action: 'PAID_IN_ADVANCE',
          paidSessions: updated.modifiedCount || 0,
          message: 'Đã thiết lập thanh toán TRỌN GÓI. Mọi buổi điểm danh tiếp theo sẽ tự động tick Đã thanh toán.',
        };
      }

      const updated = await Schedule.updateMany(
        { studentId, status: 'completed', is_paid_to_teacher: false },
        { $set: { is_paid_to_teacher: true, paymentStatus: 'paid' } },
        { session }
      );
      if (student.teacher_payment_status === 'UNPAID') {
        student.teacher_payment_status = 'PARTIAL';
        await student.save({ session });
      }
      return {
        student,
        action: 'PARTIAL',
        paidSessions: updated.modifiedCount || 0,
        message: `Thanh toán thành công ${updated.modifiedCount || 0} buổi dạy của HV ${student.name}.`,
      };
    });

    const io = req.app.get('io');
    const teacherId = result.student.teacherId ? String(result.student.teacherId) : '';
    if (io && teacherId) {
      const NotificationService = require('../services/NotificationService');
      const content = result.action === 'PAID_IN_ADVANCE'
        ? `Admin đã thiết lập TRẢ TRƯỚC cho học viên ${result.student.name}. Đã xác nhận thanh toán ${result.paidSessions} buổi đã hoàn thành (các buổi sau sẽ tự động tick đã thanh toán).`
        : `Admin đã thanh toán ${result.paidSessions} buổi dạy của học viên ${result.student.name}.`;
      await NotificationService.send(io, {
        type: 'FINANCE',
        title: '💵 Đã thanh toán lương (theo học viên)',
        content,
        receivers: teacherId,
        payload: { studentId: String(result.student._id), action: result.action, paidSessions: result.paidSessions },
        link: '/teacher/finance',
      });
      io.emit('student:updated', result.student._id.toString());
      io.emit('data:refresh', { type: 'student', id: result.student._id.toString(), action: 'pay_teacher' });
    }

    return res.json({ success: true, message: result.message });
  } catch (error) {
    const status = error.status || error.statusCode || 500;
    if (status >= 500) logger.error('[STUDENTS] Pay Teacher error:', error);
    res.status(status).json({ success: false, message: error.message });
  }
});

module.exports = router;
