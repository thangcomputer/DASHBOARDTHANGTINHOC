const express = require('express');
const router = express.Router();
const SystemLog = require('../models/SystemLog');
const { authMiddleware } = require('../middleware/auth');
const { policyShadowSystemLog } = require('../middleware/policyShadowSystemLog');
const { systemLogsCutoverGate } = require('../middleware/systemLogsCutoverGate');
const {
  SYSTEM_LOG_VISIBLE_ACTIONS,
  isVisibleSystemLogAction,
} = require('../constants/systemLogActions');

/**
 * Phase 7.7 — Controlled cutover for /api/system-logs ONLY.
 *
 * Default / not allowlisted:
 *   auth → policyShadowSystemLog → Legacy isAdmin (via systemLogsCutoverGate) → handler
 *
 * Opt-in Policy-primary:
 *   POLICY_CUTOVER_ENABLED=true
 *   POLICY_CUTOVER_ROUTES=…,system-logs
 *
 * Rollback: remove system-logs from ROUTES (keep backups,monitoring,tenants) or ENABLED=false.
 * Legacy isAdmin retained inside systemLogsCutoverGate. Handlers retain all mutations.
 * Permission taxonomy view-logs keys are NOT HTTP gates on these routes (parity with Legacy).
 */
const guard = (action) => [
  authMiddleware,
  policyShadowSystemLog(action),
  systemLogsCutoverGate(action),
];

// GET /api/system-logs — chỉ các hành động trong allowlist
router.get('/', guard('list'), async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const skip = (page - 1) * limit;

    const filter = { action: { $in: SYSTEM_LOG_VISIBLE_ACTIONS } };

    const [totalLogs, logs] = await Promise.all([
      SystemLog.countDocuments(filter),
      SystemLog.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total: totalLogs,
        page,
        pages: Math.ceil(totalLogs / limit) || 1,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi lấy System Logs: ' + error.message });
  }
});

// POST /api/system-logs — ghi tay (xuất báo cáo client-side, …)
router.post('/', guard('create'), async (req, res) => {
  try {
    const action = String(req.body?.action || '').trim();
    if (!isVisibleSystemLogAction(action)) {
      return res.status(400).json({
        success: false,
        message: 'Hành động không thuộc nhật ký hệ thống được phép ghi',
      });
    }

    const amount = Number(req.body?.amount);
    const log = await SystemLog.create({
      user_id: String(req.user?.id || req.user?._id || 'admin'),
      name: String(req.user?.name || 'Admin'),
      role: String(req.user?.role || 'admin'),
      adminRole: req.user?.adminRole || null,
      branchCode: req.user?.branchCode || '',
      action,
      category: String(req.body?.category || 'finance'),
      target: String(req.body?.target || 'client-export'),
      method: 'POST',
      message: String(req.body?.message || action).slice(0, 500),
      amount: Number.isFinite(amount) && amount !== 0 ? amount : 0,
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.ip
        || 'unknown',
      device: '',
      userAgent: String(req.headers['user-agent'] || '').slice(0, 500),
    });

    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/system-logs/:id
router.delete('/:id', guard('delete'), async (req, res) => {
  try {
    const deleted = await SystemLog.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy nhật ký' });
    }
    res.json({ success: true, message: 'Đã xóa nhật ký' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
