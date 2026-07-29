/**
 * Session payroll API (Phase 13).
 */
const express = require('express');
const router = express.Router();
const { authMiddleware, branchFilter, checkPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const {
  previewStudentSessionPayroll,
  previewTeacherPendingPayroll,
  payTeacherSessions,
  simulateReassignPayrollOwnership,
} = require('../services/sessionPayrollService');
const logger = require('../config/logger');

// GET /api/payroll/students/:studentId/split — preview ownership sau đổi GV
router.get(
  '/students/:studentId/split',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_FINANCE),
  async (req, res) => {
    try {
      const rate = Number(req.query.ratePerSession) || 0;
      const data = await previewStudentSessionPayroll(req.params.studentId, {
        ratePerSession: rate,
        courseName: req.query.course || null,
      });
      return res.json({ success: true, data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ success: false, message: err.message });
    }
  },
);

// GET /api/payroll/teachers/:teacherId/pending
router.get(
  '/teachers/:teacherId/pending',
  authMiddleware,
  checkPermission(PERMISSIONS.MANAGE_FINANCE),
  async (req, res) => {
    try {
      const data = await previewTeacherPendingPayroll(req.params.teacherId);
      return res.json({ success: true, data });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({ success: false, message: err.message });
    }
  },
);

// PUT /api/payroll/teachers/:teacherId/pay — session payroll (ownership-safe)
router.put(
  '/teachers/:teacherId/pay',
  authMiddleware,
  branchFilter,
  checkPermission(PERMISSIONS.MANAGE_FINANCE),
  async (req, res) => {
    try {
      const { sessionsCount, amount, note } = req.body || {};
      const idempotencyKey = String(
        req.headers['idempotency-key'] || req.body?.idempotencyKey || '',
      ).trim() || null;

      const result = await payTeacherSessions({
        teacherId: req.params.teacherId,
        sessionsCount,
        amount,
        note,
        idempotencyKey,
        actor: { id: req.user.id, role: req.user.role, name: req.user.name },
        reqMeta: {
          ip: req.ip || '',
          userAgent: req.headers['user-agent'] || '',
          branchId: req.userBranchId || null,
        },
        io: req.app.get('io'),
      });

      return res.json({
        success: true,
        message: result.idempotent
          ? 'Giao dịch đã tồn tại (idempotent)'
          : `Thanh toán thành công ${result.paidSessions} buổi`,
        data: result,
      });
    } catch (err) {
      const status = err.status || 500;
      logger.error('[PAYROLL] pay:', err);
      return res.status(status).json({
        success: false,
        message: err.message,
        code: err.code,
      });
    }
  },
);

// POST /api/payroll/simulate-split — debug/fixture 8/12 (no DB)
router.post(
  '/simulate-split',
  authMiddleware,
  checkPermission(PERMISSIONS.MANAGE_FINANCE),
  async (req, res) => {
    try {
      const {
        teacherA = 'teacherA',
        teacherB = 'teacherB',
        completedByA = 8,
        completedByB = 12,
        ratePerSession = 100000,
      } = req.body || {};
      const data = simulateReassignPayrollOwnership({
        teacherA,
        teacherB,
        completedByA: Number(completedByA) || 8,
        scheduledByB: Number(completedByB) || 12,
        ratePerSession: Number(ratePerSession) || 0,
      });
      return res.json({ success: true, data });
    } catch (err) {
      return res.status(400).json({ success: false, message: err.message });
    }
  },
);

module.exports = router;
