const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const MobilePushToken = require('../models/MobilePushToken');
const logger = require('../config/logger');

const router = express.Router();
const EXPO_TOKEN_PATTERN = /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/;

router.post('/', authMiddleware, async (req, res) => {
  const { id, role } = req.user || {};
  const { token, platform, projectId = '', soundEnabled = true } = req.body || {};
  if (!req.sessionId || !id || !['student', 'teacher'].includes(role)) {
    return res.status(403).json({ success: false, message: 'Yêu cầu phiên đăng nhập mobile hợp lệ.' });
  }
  if (typeof token !== 'string' || token.length > 200 || !EXPO_TOKEN_PATTERN.test(token)) {
    return res.status(400).json({ success: false, message: 'Expo push token không hợp lệ.' });
  }
  if (!['ios', 'android'].includes(platform)) {
    return res.status(400).json({ success: false, message: 'Nền tảng thiết bị không hợp lệ.' });
  }
  if (typeof projectId !== 'string' || projectId.length > 100 || typeof soundEnabled !== 'boolean') {
    return res.status(400).json({ success: false, message: 'Thông tin cấu hình push không hợp lệ.' });
  }

  try {
    await MobilePushToken.findOneAndUpdate(
      { token },
      {
        $set: {
          userId: String(id),
          role,
          sessionId: String(req.sessionId),
          platform,
          projectId,
          soundEnabled,
          enabled: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, '[MOBILE_PUSH] Token registration failed');
    return res.status(500).json({ success: false, message: 'Không thể đăng ký thiết bị nhận thông báo.' });
  }
});

router.delete('/', authMiddleware, async (req, res) => {
  const { id, role } = req.user || {};
  const { token } = req.body || {};
  if (!req.sessionId || !id || !['student', 'teacher'].includes(role)) {
    return res.status(403).json({ success: false, message: 'Yêu cầu phiên đăng nhập mobile hợp lệ.' });
  }
  if (typeof token !== 'string' || token.length > 200 || !EXPO_TOKEN_PATTERN.test(token)) {
    return res.status(400).json({ success: false, message: 'Expo push token không hợp lệ.' });
  }
  try {
    await MobilePushToken.deleteOne({
      token,
      userId: String(id),
      role,
      sessionId: String(req.sessionId),
    });
    return res.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, '[MOBILE_PUSH] Token removal failed');
    return res.status(500).json({ success: false, message: 'Không thể hủy đăng ký thiết bị.' });
  }
});

module.exports = router;
