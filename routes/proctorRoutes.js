const express = require('express');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middleware/auth');
const proctorAudit = require('../services/proctorAuditService');

/**
 * POST /api/proctor/events — thí sinh/GV gửi batch sự kiện giám sát (JWT).
 * Không nhận video/frame.
 */
router.post('/events', authMiddleware, async (req, res) => {
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
router.get('/events/me', authMiddleware, async (req, res) => {
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
 */
router.get('/events/:userId', authMiddleware, isAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 100;
    const data = await proctorAudit.listEventsForUser(req.params.userId, { limit });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
