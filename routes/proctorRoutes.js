const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { policyShadowProctor } = require('../middleware/policyShadowProctor');
const { proctorCutoverGate } = require('../middleware/proctorCutoverGate');
const proctorAudit = require('../services/proctorAuditService');

/** Phase 7.24: policyShadowProctor → proctorCutoverGate */
function proctorGuard(action) {
  return [policyShadowProctor(action), proctorCutoverGate(action)];
}

/**
 * POST /api/proctor/events — thí sinh/GV gửi batch sự kiện giám sát (JWT).
 * Không nhận video/frame.
 */
router.post('/events', authMiddleware, ...proctorGuard('events_ingest'), async (req, res) => {
  try {
    const events = req.body?.events;
    if (!Array.isArray(events)) {
      return res.status(400).json({ success: false, message: 'events phải là mảng' });
    }
    const result = await proctorAudit.ingestEvents({
      user: req.user,
      events,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      tenantId: req.tenantId || req.user?.tenantId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Lỗi ghi audit' });
  }
});

/**
 * GET /api/proctor/events/me — sự kiện của chính mình
 */
router.get('/events/me', authMiddleware, ...proctorGuard('events_me'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const data = await proctorAudit.listEventsForUser(req.user.id, { limit });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/proctor/events/:userId — admin xem nhật ký thí sinh/GV
 * Legacy fallback: isAdmin inside proctorCutoverGate(events_user).
 */
router.get(
  '/events/:userId',
  authMiddleware,
  ...proctorGuard('events_user'),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit, 10) || 100;
      const data = await proctorAudit.listEventsForUser(req.params.userId, { limit });
      res.json({ success: true, data });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },
);

module.exports = router;
