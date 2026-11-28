'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const { authMiddleware, checkPermission, checkAnyPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const logger = require('../config/logger');
const { validateUploadedFileMagic } = require('../utils/uploadSniff');
const service = require('../services/dewskillClassService');
const catalogUiService = require('../services/dewskillCatalogUiService');
const DailyPracticeProfile = require('../models/DailyPracticeProfile');
const referralConfigService = require('../services/referralConfigService');

const CATALOG_UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'images', 'catalog');
fs.mkdirSync(CATALOG_UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
const ALLOWED_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const catalogImageUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(CATALOG_UPLOAD_DIR, { recursive: true });
      cb(null, CATALOG_UPLOAD_DIR);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const safeExt = ALLOWED_IMAGE_EXTS.has(ext) ? ext : '.png';
      cb(null, `catalog_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${safeExt}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mime = String(file.mimetype || '').toLowerCase();
    if (!ALLOWED_IMAGE_EXTS.has(ext) || !ALLOWED_IMAGE_MIMES.has(mime)) {
      return cb(new Error('Chỉ hỗ trợ ảnh định dạng PNG, JPG, WEBP hoặc GIF'));
    }
    return cb(null, true);
  },
});

function handleCatalogImageMulter(req, res, next) {
  catalogImageUpload.single('image')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Kích thước ảnh tối đa 5MB'
        : (err.message || 'Tải ảnh thất bại');
      return res.status(400).json({ success: false, message: msg });
    }
    return next();
  });
}

const requireClassAdmin = [authMiddleware, checkPermission(PERMISSIONS.MANAGE_DEWSKILL_CLASSES)];
const requireClassOrStudentAdmin = [
  authMiddleware,
  checkAnyPermission(PERMISSIONS.MANAGE_DEWSKILL_CLASSES, PERMISSIONS.MANAGE_DEWSKILL_STUDENTS),
];
// Backward-compatible alias for class management routes
const requireAdmin = requireClassAdmin;

function requireStudentRole(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Chưa xác thực' });
  }
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Chỉ học viên được dùng chức năng này' });
  }
  return next();
}

const requireStudent = [authMiddleware, requireStudentRole];

function sendError(res, err) {
  if (err && err.status) {
    return res.status(err.status).json({ success: false, message: err.message });
  }
  logger.error('[DEWSKILL-CLASSES]', err);
  return res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
}

// ── Static routes first (before parameterized /:id) ─────────────────────────

router.get('/catalog-ui', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !['student', 'admin', 'staff'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem cấu hình giao diện danh mục' });
    }
    const data = await catalogUiService.getCatalogUiConfig();
    return res.json({
      success: true,
      data,
      presets: {
        gradients: catalogUiService.GRADIENT_PRESETS,
        mascots: catalogUiService.MASCOT_PRESETS,
        tiers: catalogUiService.ACTION_TIER_OPTIONS,
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.put('/catalog-ui', ...requireAdmin, async (req, res) => {
  try {
    const data = await catalogUiService.saveCatalogUiConfig(req.body, req.user);
    req.app.get('io')?.emit('dewskill:catalog-ui-updated', data);
    return res.json({
      success: true,
      message: 'Đã lưu cấu hình giao diện Danh mục khóa học',
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/catalog-ui/reset', ...requireAdmin, async (req, res) => {
  try {
    const data = await catalogUiService.resetCatalogUiConfig(req.user);
    req.app.get('io')?.emit('dewskill:catalog-ui-updated', data);
    return res.json({
      success: true,
      message: 'Đã khôi phục giao diện Danh mục về mặc định',
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/catalog-ui/upload-image', ...requireAdmin, handleCatalogImageMulter, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn tệp ảnh để tải lên' });
    }
    const magic = validateUploadedFileMagic(req.file.path, req.file.originalname);
    if (!magic.ok) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
      return res.status(400).json({ success: false, message: 'Tệp tải lên không phải ảnh hợp lệ' });
    }
    const url = `/uploads/images/catalog/${req.file.filename}`;
    return res.json({
      success: true,
      message: 'Đã tải ảnh lên thành công',
      data: { url, filename: req.file.filename },
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/meta', ...requireAdmin, async (_req, res) => {
  try {
    const data = await service.getMeta();
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/seed-defaults', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.seedDefaultTemplates(req.user);
    return res.json({
      success: true,
      message:
        data.createdCount > 0
          ? `Đã tạo ${data.createdCount} lớp học mẫu (đang ở chế độ Ẩn / Nháp)`
          : 'Tất cả lớp học mẫu đã có sẵn trong danh sách',
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/students/search', ...requireClassOrStudentAdmin, async (req, res) => {
  try {
    const data = await service.searchStudents({
      q: req.query.q || '',
      accountFilter: req.query.accountFilter || 'all',
      limit: req.query.limit || 30,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/access', ...requireClassOrStudentAdmin, async (req, res) => {
  try {
    const data = await service.listAccess({
      classId: req.query.classId || '',
      studentId: req.query.studentId || '',
      statusFilter: req.query.status || 'all',
      q: req.query.q || '',
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/access/grant', ...requireClassOrStudentAdmin, async (req, res) => {
  try {
    const data = await service.grantAccess(req.body, req.user);
    return res.json({
      success: true,
      message: `Đã cấp quyền hiển thị (${data.grantedCount} lượt)`,
      data,
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/access/:accessId', ...requireClassOrStudentAdmin, async (req, res) => {
  try {
    const data = await service.updateAccess(req.params.accessId, req.body);
    return res.json({ success: true, message: 'Đã cập nhật quyền hiển thị', data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/access/:accessId', ...requireClassOrStudentAdmin, async (req, res) => {
  try {
    const data = await service.revokeAccess(req.params.accessId);
    return res.json({ success: true, message: 'Đã thu hồi quyền hiển thị lớp học', data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/my-visible', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !['student', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền truy cập danh mục lớp học' });
    }
    const previewAsAdmin = req.user.role === 'admin';
    const [data, catalogUi, dpProf, refCfg] = await Promise.all([
      previewAsAdmin
        ? service.listActiveClassesForAdminPreview()
        : service.listVisibleClassesForStudent(req.user.id || req.user._id),
      catalogUiService.getCatalogUiConfig(),
      previewAsAdmin
        ? Promise.resolve(null)
        : DailyPracticeProfile.findOne({ studentId: req.user.id || req.user._id })
          .select('referralDiscountAvailableVnd referredByCode')
          .lean(),
      previewAsAdmin
        ? Promise.resolve(null)
        : referralConfigService.getReferralConfig().catch(() => null),
    ]);
    const referralDiscount = previewAsAdmin
      ? null
      : {
        enabled: Boolean(refCfg?.enabled),
        availableDiscountVnd: Math.max(0, Math.round(Number(dpProf?.referralDiscountAvailableVnd) || 0)),
        minOrderAmountVnd: Number(refCfg?.minOrderAmountVnd) || 0,
        applyToCourses: refCfg?.applyToCourses !== false,
        referredByCode: String(dpProf?.referredByCode || ''),
      };
    return res.json({
      success: true,
      data,
      meta: {
        tiers: service.TIER_OPTIONS,
        previewAsAdmin,
        catalogUi,
        referralDiscount,
      },
    });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/my/purchase-history', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !['student', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem lịch sử mua khóa học' });
    }
    const data = await service.listMyPurchaseHistory(req.user.id || req.user._id);
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/my/checkout', ...requireStudent, async (req, res) => {
  try {
    const data = await service.checkoutClass({
      user: req.user,
      classId: req.body?.classId,
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/my/redeem-code', ...requireStudent, async (req, res) => {
  try {
    const data = await service.redeemClassActivationCode({
      user: req.user,
      classId: req.body?.classId,
      code: req.body?.code,
      io: req.app.get('io'),
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/my/payment-sessions/:sessionId', authMiddleware, async (req, res) => {
  try {
    if (!req.user || !['student', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Không có quyền xem phiên thanh toán' });
    }
    const data = await service.getPaymentSession({
      user: req.user,
      sessionId: req.params.sessionId,
    });
    return res.json({ success: true, data, ...data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/my/payment-sessions/:sessionId/simulate-paid', ...requireStudent, async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ success: false, message: 'Không tìm thấy endpoint' });
  }
  try {
    const data = await service.simulateClassPurchase({
      studentId: req.user.id || req.user._id,
      sessionId: req.params.sessionId,
      io: req.app.get('io'),
    });
    return res.json({ success: true, paid: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

// ── Admin Class CRUD ─────────────────────────────────────────────────────────

router.get('/', ...requireClassOrStudentAdmin, async (req, res) => {
  try {
    const data = await service.listAdminClasses({
      tier: req.query.tier || '',
      visibilityMode: req.query.visibilityMode || '',
      q: req.query.q || '',
    });
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.post('/', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.createClass(req.body, req.user);
    return res.status(201).json({ success: true, message: 'Đã tạo lớp học DewSkill', data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.put('/:id', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.updateClass(req.params.id, req.body, req.user);
    return res.json({ success: true, message: 'Đã cập nhật lớp học DewSkill', data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.patch('/:id/visibility', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.updateVisibility(req.params.id, req.body, req.user);
    return res.json({ success: true, message: 'Đã cập nhật quyền hiển thị lớp học', data });
  } catch (err) {
    return sendError(res, err);
  }
});

router.delete('/:id', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.deleteClass(req.params.id);
    return res.json({ success: true, message: 'Đã xóa lớp học DewSkill', data });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
