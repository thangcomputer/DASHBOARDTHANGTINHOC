'use strict';

const express = require('express');
const CallHistory = require('../models/CallHistory');
const { authMiddleware } = require('../middleware/auth');
const { getMessagingRole } = require('../utils/messagingRoles');
const { canViewConversation } = require('../services/messagingPolicy');
const logger = require('../config/logger');

const router = express.Router();
router.use(authMiddleware);

router.get('/history', async (req, res) => {
  const userId = String(req.user?.id || req.user?._id || '');
  const role = getMessagingRole(req.user);
  if (!userId || !['student', 'teacher'].includes(role)) {
    return res.status(403).json({ success: false, message: 'Chỉ giảng viên và học viên có thể xem lịch sử cuộc gọi.' });
  }

  const requestedLimit = Number.parseInt(String(req.query.limit || ''), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const conversationId = String(req.query.conversationId || '').trim();
  if (conversationId && !canViewConversation(req.user, conversationId).allowed) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền xem lịch sử cuộc gọi của cuộc trò chuyện này.' });
  }

  try {
    const conversationFilter = conversationId ? { conversationId } : {};
    const calls = await CallHistory.find({
      ...conversationFilter,
      $or: [
        { callerId: userId, callerRole: role },
        { peerId: userId, peerRole: role },
      ],
    })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();

    return res.json({
      success: true,
      data: calls.map((call) => {
        const outgoing = call.callerId === userId && call.callerRole === role;
        return {
          callId: call.callId,
          conversationId: call.conversationId,
          direction: outgoing ? 'outgoing' : 'incoming',
          participantId: outgoing ? call.peerId : call.callerId,
          participantRole: outgoing ? call.peerRole : call.callerRole,
          participantName: outgoing ? call.peerName : call.callerName,
          status: call.status,
          startedAt: call.startedAt,
          durationSeconds: call.durationSeconds,
          reason: call.reason,
        };
      }),
    });
  } catch (error) {
    logger.error({ err: error.message, userId, role }, 'Call history lookup failed');
    return res.status(500).json({ success: false, message: 'Không thể tải lịch sử cuộc gọi.' });
  }
});

module.exports = router;
