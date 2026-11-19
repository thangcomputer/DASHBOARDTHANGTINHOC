const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const MobilePushToken = require('../models/MobilePushToken');
const { DEFAULT_NOTIFICATION_PREFERENCES } = require('../models/MobilePushToken');
const logger = require('../config/logger');

const router = express.Router();
const EXPO_TOKEN_PATTERN = /^(ExpoPushToken|ExponentPushToken)\[[^\]]+\]$/;
const BOOLEAN_PREFERENCE_KEYS = [
  'scheduleReminders',
  'scheduleChanges',
  'messages',
  'calls',
  'adminAnnouncements',
  'assignmentsAndQuizzes',
  'financeAndCourses',
];
const ALLOWED_REMINDER_OFFSETS = new Set([1440, 60, 15]);

function normalizePreferences(raw = {}) {
  const base = {
    scheduleReminders: true,
    scheduleChanges: true,
    messages: true,
    calls: true,
    adminAnnouncements: true,
    assignmentsAndQuizzes: true,
    financeAndCourses: true,
    reminderOffsetsMinutes: [...DEFAULT_NOTIFICATION_PREFERENCES.reminderOffsetsMinutes],
  };
  if (!raw || typeof raw !== 'object') return base;
  for (const key of BOOLEAN_PREFERENCE_KEYS) {
    if (typeof raw[key] === 'boolean') base[key] = raw[key];
  }
  if (Array.isArray(raw.reminderOffsetsMinutes)) {
    const clean = [...new Set(
      raw.reminderOffsetsMinutes
        .map((n) => Number(n))
        .filter((n) => ALLOWED_REMINDER_OFFSETS.has(n)),
    )].sort((a, b) => b - a);
    base.reminderOffsetsMinutes = clean;
  }
  return base;
}

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
    const existingAny = await MobilePushToken.findOne({ userId: String(id), role })
      .select('preferences')
      .lean();
    const inheritedPrefs = normalizePreferences(existingAny?.preferences || {});

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
          preferences: inheritedPrefs,
          updatedAt: new Date(),
        },
      },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    return res.json({ success: true, preferences: inheritedPrefs });
  } catch (error) {
    logger.error({ err: error }, '[MOBILE_PUSH] Token registration failed');
    return res.status(500).json({ success: false, message: 'Không thể đăng ký thiết bị nhận thông báo.' });
  }
});

router.get('/preferences', authMiddleware, async (req, res) => {
  const { id, role } = req.user || {};
  if (!id || !['student', 'teacher'].includes(role)) {
    return res.status(403).json({ success: false, message: 'Chỉ học viên và giảng viên mới có cài đặt thông báo mobile.' });
  }
  try {
    const doc = await MobilePushToken.findOne({ userId: String(id), role })
      .sort({ updatedAt: -1 })
      .select('preferences')
      .lean();
    return res.json({ success: true, data: normalizePreferences(doc?.preferences || {}) });
  } catch (error) {
    logger.error({ err: error }, '[MOBILE_PUSH] Preferences load failed');
    return res.status(500).json({ success: false, message: 'Không thể tải cài đặt thông báo.' });
  }
});

router.put('/preferences', authMiddleware, async (req, res) => {
  const { id, role } = req.user || {};
  if (!id || !['student', 'teacher'].includes(role)) {
    return res.status(403).json({ success: false, message: 'Chỉ học viên và giảng viên mới có cài đặt thông báo mobile.' });
  }
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const updates = {};
  for (const key of BOOLEAN_PREFERENCE_KEYS) {
    if (key in body) {
      if (typeof body[key] !== 'boolean') {
        return res.status(400).json({ success: false, message: `Trường ${key} phải là boolean.` });
      }
      updates[`preferences.${key}`] = body[key];
    }
  }
  if ('reminderOffsetsMinutes' in body) {
    if (!Array.isArray(body.reminderOffsetsMinutes)) {
      return res.status(400).json({ success: false, message: 'reminderOffsetsMinutes phải là mảng số.' });
    }
    const clean = [...new Set(
      body.reminderOffsetsMinutes
        .map((n) => Number(n))
        .filter((n) => ALLOWED_REMINDER_OFFSETS.has(n)),
    )].sort((a, b) => b - a);
    updates['preferences.reminderOffsetsMinutes'] = clean;
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ success: false, message: 'Không có cài đặt hợp lệ để cập nhật.' });
  }

  try {
    await MobilePushToken.updateMany(
      { userId: String(id), role },
      { $set: { ...updates, updatedAt: new Date() } },
    );
    const updatedDoc = await MobilePushToken.findOne({ userId: String(id), role })
      .sort({ updatedAt: -1 })
      .select('preferences')
      .lean();
    const data = normalizePreferences(updatedDoc?.preferences || body);
    const io = req.app?.get?.('io');
    if (io) {
      io.to(String(id)).emit('notification:preferences-updated', data);
    }
    return res.json({ success: true, data, message: 'Đã lưu cài đặt thông báo.' });
  } catch (error) {
    logger.error({ err: error }, '[MOBILE_PUSH] Preferences update failed');
    return res.status(500).json({ success: false, message: 'Không thể lưu cài đặt thông báo.' });
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
module.exports.normalizePreferences = normalizePreferences;
