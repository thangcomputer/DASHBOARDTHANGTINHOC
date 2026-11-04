'use strict';

const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getMessagingRole } = require('../utils/messagingRoles');
const {
  DEFAULT_COMMUNICATION_PREFERENCES,
  getCommunicationPreferences,
  updateCommunicationPreferences,
} = require('../services/communicationPreferences');
const logger = require('../config/logger');

const router = express.Router();
const preferenceKeys = Object.keys(DEFAULT_COMMUNICATION_PREFERENCES);
router.use(authMiddleware);

function currentMessagingUser(req) {
  const userId = String(req.user?.id || req.user?._id || '');
  const userRole = getMessagingRole(req.user);
  return userId && ['student', 'teacher'].includes(userRole) ? { userId, userRole } : null;
}

router.get('/', async (req, res) => {
  const actor = currentMessagingUser(req);
  if (!actor) {
    return res.status(403).json({ success: false, message: 'Chỉ học viên và giảng viên mới có thể thay đổi tùy chọn liên lạc.' });
  }

  try {
    const data = await getCommunicationPreferences(actor.userId, actor.userRole);
    return res.json({ success: true, data });
  } catch (error) {
    logger.error({ err: error.message, userId: actor.userId, userRole: actor.userRole }, 'Communication preferences lookup failed');
    return res.status(500).json({ success: false, message: 'Không thể tải tùy chọn liên lạc.' });
  }
});

router.put('/', async (req, res) => {
  const actor = currentMessagingUser(req);
  if (!actor) {
    return res.status(403).json({ success: false, message: 'Chỉ học viên và giảng viên mới có thể thay đổi tùy chọn liên lạc.' });
  }

  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const keys = Object.keys(body);
  if (!keys.length || keys.some((key) => !preferenceKeys.includes(key))
      || keys.some((key) => typeof body[key] !== 'boolean')) {
    return res.status(400).json({ success: false, message: 'Tùy chọn liên lạc không hợp lệ.' });
  }

  const updates = Object.fromEntries(keys.map((key) => [key, body[key]]));
  try {
    const data = await updateCommunicationPreferences(actor.userId, actor.userRole, updates);
    return res.json({ success: true, data, message: 'Đã lưu tùy chọn liên lạc.' });
  } catch (error) {
    logger.error({ err: error.message, userId: actor.userId, userRole: actor.userRole }, 'Communication preferences update failed');
    return res.status(500).json({ success: false, message: 'Không thể lưu tùy chọn liên lạc.' });
  }
});

module.exports = router;
