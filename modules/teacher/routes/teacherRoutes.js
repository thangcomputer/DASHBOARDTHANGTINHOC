const express  = require('express');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

const { teacherRepository } = require('../repositories');
const Teacher = require('../models/Teacher'); // Temp for new Teacher
const Schedule = require('../../attendance/models/Schedule');
const Transaction = require('../../transaction/models/Transaction');
const { authMiddleware, branchFilter } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const { PERMISSIONS } = require('../../../constants/permissions');
const { sanitizeRegex } = require('../../../middleware/sanitizeRegex');
const logger = require('../../../config/logger');
const { resolveTeacherSubjectIds } = require('../../../utils/trainingSubjectAccess');
const { sendAccountWelcome } = require('../../../services/accountWelcome');
const NotificationService = require('../../notification/services/NotificationService');
const { generateTempPassword } = require('../../../utils/tempPassword');
const { postSalary } = require('../../finance/services/ledgerService');
const { computeStarBonusSummary, resolveBonusForPayout } = require('../services/teacherStarBonus');

const router = express.Router();
const teacherController = require('../controllers/TeacherController');
const teacherStrangler = require('./teacherStrangler');

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
router.post('/upload-practical', authMiddleware, authorizeAny(...legacyMapping.resolve('view_teachers')), (req, res) => {
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
const superAdminOnlyTeacher = async (req, res, next) => {
  if (!req.currentUser) return res.status(401).json({ success: false, message: 'Chưa xác thực' });
  if (req.currentUser.id === 'admin') return next(); // Hardcoded admin
  const user = await teacherRepository.findById(req.currentUser.id).select('adminRole').lean();
  if (user?.adminRole === 'SUPER_ADMIN') return next();
  return res.status(403).json({
    success: false,
    message: '403 Forbidden — Bạn không có quyền thực hiện thao tác này. Chỉ Super Admin mới được thêm/sửa/xóa giảng viên.',
  });
};

// ─── POST /api/teachers ───────────────────────────────────────────────────────
// Chỉ Super Admin được tạo giảng viên
router.post('/', [authMiddleware, authorizeAny(NEW_PERMISSIONS.USER_MANAGE, NEW_PERMISSIONS.STUDENT_CREATE, NEW_PERMISSIONS.TEACHER_UPDATE), authorizeAll(NEW_PERMISSIONS.TEACHER_UPDATE), branchFilter], teacherStrangler.post_root);

// ─── GET /api/teachers ────────────────────────────────────────────────────────
// Lấy danh sách giảng viên (Admin/Staff only — Teacher bị chặn)
router.get('/', [authMiddleware, branchFilter],teacherController.get_root);

// ─── GET /api/teachers/stats/summary ──────────────────────────────────────────
router.get('/stats/summary', [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.VIEW_TEACHERS)), branchFilter],teacherController.get_stats_summary);

// ─── GET /api/teachers/:id ────────────────────────────────────────────────────
router.get('/:id', [authMiddleware, branchFilter],teacherController.get_id);

// ─── PUT /api/teachers/:id ────────────────────────────────────────────────────
// Cập nhật thông tin cơ bản giảng viên (STAFF bị chặn, teacher tự sửa được)
router.put('/:id', [authMiddleware, branchFilter],teacherController.put_id);

// ─── PUT /api/teachers/:id/score ──────────────────────────────────────────────
// Admin nhập điểm bài test Onboarding cho giảng viên
router.put('/:id/score', authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.VIEW_TEACHERS)),teacherController.put_id_score);

// ─── PUT /api/teachers/:id/approve ────────────────────────────────────────────
// Admin duyệt giảng viên — STRICT: chỉ khi testScore >= 80
router.put('/:id/approve', authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.VIEW_TEACHERS)),teacherController.put_id_approve);

// ─── POST /api/teachers/:id/submit-practical ──────────────────────────────────
// Giảng viên nộp file thực hành (Workflow 1 Phase 2)
router.post('/:id/submit-practical', authMiddleware, authorizeAny(...legacyMapping.resolve('view_teachers')),teacherController.post_id_submit_practical);

// ─── PUT /api/teachers/:id/reject ─────────────────────────────────────────────
// Admin từ chối / tạm dừng giảng viên
router.put('/:id/reject', authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.VIEW_TEACHERS)),teacherController.put_id_reject);

// ─── DELETE /api/teachers/:id ─────────────────────────────────────────────────
// Admin xóa giảng viên (STAFF bị chặn)
router.delete('/:id', [authMiddleware, authorizeAny(NEW_PERMISSIONS.USER_MANAGE, NEW_PERMISSIONS.STUDENT_CREATE, NEW_PERMISSIONS.TEACHER_UPDATE), authorizeAll(NEW_PERMISSIONS.TEACHER_UPDATE)],teacherController.delete_id);

// ─── GET /api/teachers/:id/finance ──────────────────────────────────────────────
router.get('/:id/finance', authMiddleware,teacherController.get_id_finance);

// ─── GET /api/teachers/:id/finance/pending ──────────────────────────────────────
// Lấy số buổi còn nợ thanh toán + thưởng sao tích lũy (cho modal Step 1)
router.get('/:id/finance/pending', authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE)),teacherController.get_id_finance_pending);

// ─── PUT /api/teachers/:id/finance/pay-flexible ──────────────────────────────────
// Thanh toán linh hoạt: Admin tự chọn số buổi và số tiền, FIFO (cũ nhất trước)
// Có thể cộng thưởng sao tích lũy (includeStarBonus)
router.put('/:id/finance/pay-flexible', [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE)), authorizeAll(NEW_PERMISSIONS.TEACHER_UPDATE)],teacherController.put_id_finance_pay_flexible);

// ─── PUT /api/teachers/:id/finance/pay-all ──────────────────────────────────────
router.put('/:id/finance/pay-all', [authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_FINANCE)), authorizeAll(NEW_PERMISSIONS.TEACHER_UPDATE)],teacherController.put_id_finance_pay_all);

module.exports = router;
