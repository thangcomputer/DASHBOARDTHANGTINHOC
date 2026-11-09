'use strict';

const express = require('express');
const router = express.Router();
const { authMiddleware, checkPermission, branchFilter } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const logger = require('../config/logger');
const service = require('../services/subscriptionService');

const requireStudentAdmin = [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENTS)];
const requireFinanceAdmin = [authMiddleware, checkPermission(PERMISSIONS.MANAGE_FINANCE)];

function requireStudentRole(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Chưa xác thực' });
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Chỉ học viên được dùng chức năng này' });
  }
  return next();
}

const requireStudent = [authMiddleware, requireStudentRole];
const userId = (req) => req.user.id || req.user._id;
const actorOf = (req) => ({ id: String(req.user.id || req.user._id || ''), name: req.user.name || req.user.fullName || '' });

function sendError(res, err) {
  // publicMessage: lời báo nghiệp vụ tiếng Việt, mobile hiển thị nguyên văn thay cho thông báo chung.
  if (err && err.status) return res.status(err.status).json({ success: false, message: err.message, code: err.code, publicMessage: true });
  logger.error('[SUBSCRIPTION]', err);
  return res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
}

const handle = (fn) => async (req, res) => {
  try {
    return res.json({ success: true, data: await fn(req) });
  } catch (err) {
    return sendError(res, err);
  }
};

// ── Học viên (web + mobile; vẫn dùng được khi đã hết hạn) ───────────────────
router.get('/my', ...requireStudent, handle((req) => service.myOverview(userId(req))));
router.post('/my/redeem', ...requireStudent, handle((req) => service.redeemCode(userId(req), req.body?.code)));
router.post('/my/checkout', ...requireStudent, handle((req) => service.checkout(userId(req), String(req.body?.plan || ''))));
router.get('/my/sessions/:sessionId', ...requireStudent, handle((req) => service.sessionStatus(userId(req), req.params.sessionId)));
router.post('/my/sessions/:sessionId/simulate-paid', ...requireStudent, async (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.status(404).json({ success: false, message: 'Not found' });
  try {
    return res.json({ success: true, data: await service.simulatePayment(userId(req), req.params.sessionId) });
  } catch (err) {
    return sendError(res, err);
  }
});

// ── Admin ────────────────────────────────────────────────────────────────────
router.get('/plans', ...requireStudentAdmin, handle(() => service.planCatalog()));
router.put('/plans', ...requireFinanceAdmin, handle(async (req) => {
  await service.setPrices(req.body?.prices || req.body || {});
  return service.planCatalog();
}));

router.get('/xp-config', ...requireStudentAdmin, handle(() => service.getXpConfig()));
router.put('/xp-config', ...requireStudentAdmin, handle(async (req) => service.setXpConfig(req.body || {})));
router.post('/xp-config/reset-all', ...requireStudentAdmin, handle(() => service.resetAllStudentsXp()));

router.get('/codes', ...requireStudentAdmin, handle((req) => service.listCodes({
  status: String(req.query.status || ''),
  plan: String(req.query.plan || ''),
  q: String(req.query.q || ''),
})));
router.post('/codes', ...requireStudentAdmin, handle((req) => service.generateCodes({
  plan: String(req.body?.plan || ''),
  quantity: req.body?.quantity,
  note: req.body?.note,
  actor: actorOf(req),
})));
router.post('/codes/:id/revoke', ...requireStudentAdmin, handle((req) => service.revokeCode(req.params.id)));
router.get('/codes/export.csv', ...requireStudentAdmin, async (req, res) => {
  try {
    const { codes } = await service.listCodes({
      status: String(req.query.status || ''),
      plan: String(req.query.plan || ''),
      q: String(req.query.q || ''),
      limit: 2000,
    });
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [
      ['Mã', 'Gói', 'Trạng thái', 'Lô', 'Ghi chú', 'Người dùng', 'Ngày dùng', 'Ngày tạo'].map(escape).join(','),
      ...codes.map((row) => [
        row.code,
        row.planLabel,
        { unused: 'Chưa dùng', used: 'Đã dùng', revoked: 'Đã thu hồi' }[row.status] || row.status,
        row.batchId,
        row.note,
        row.usedByName,
        row.usedAt ? new Date(row.usedAt).toISOString() : '',
        row.createdAt ? new Date(row.createdAt).toISOString() : '',
      ].map(escape).join(',')),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ma-kich-hoat.csv"');
    return res.send(`\uFEFF${lines.join('\n')}`);
  } catch (err) {
    return sendError(res, err);
  }
});

router.get('/students', authMiddleware, branchFilter, checkPermission(PERMISSIONS.MANAGE_STUDENTS), handle((req) => service.searchStudents(
  String(req.query.q || ''),
  req.branchFilter || {},
)));
router.get('/students/:id', ...requireStudentAdmin, handle((req) => service.studentHistory(req.params.id)));
router.put('/students/:id', ...requireStudentAdmin, async (req, res) => {
  try {
    const mode = String(req.body?.mode || 'extend');
    const data = await service.adminSetSubscription(req.params.id, {
      mode,
      plan: String(req.body?.plan || ''),
      expiresAt: req.body?.expiresAt || null,
      note: String(req.body?.note || '').slice(0, 200),
      customXp: req.body?.customXp != null ? Number(req.body.customXp) : null,
    }, actorOf(req));
    if (mode === 'free') {
      const io = req.app.get('io');
      if (io) io.to(String(req.params.id)).emit('free-portal-locked', { studentId: String(req.params.id) });
    }
    return res.json({ success: true, data });
  } catch (err) {
    return sendError(res, err);
  }
});

module.exports = router;
