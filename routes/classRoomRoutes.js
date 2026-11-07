const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { assertCanJoin, issueTicket, TICKET_MS, userKey } = require('../services/classRoom');

const router = express.Router();

router.post('/ticket', authMiddleware, async (req, res) => {
  try {
    const scheduleId = String(req.body?.scheduleId || '').trim();
    if (!scheduleId) return res.status(400).json({ success: false, message: 'Thiếu buổi học' });
    const { role } = await assertCanJoin(req.user, scheduleId);
    const ticket = issueTicket({
      userId: userKey(req.user),
      role,
      name: req.user.name || '',
      scheduleId,
    });
    return res.json({ success: true, ticket, expiresInMs: TICKET_MS, scheduleId });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Không vào được phòng học' });
  }
});

module.exports = router;
