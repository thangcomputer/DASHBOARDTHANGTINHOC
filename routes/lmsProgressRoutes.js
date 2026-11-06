'use strict';

const express = require('express');
const router = express.Router();
const { authMiddleware, checkPermission } = require('../middleware/auth');
const { PERMISSIONS } = require('../constants/permissions');
const logger = require('../config/logger');
const service = require('../services/lmsProgressService');

function requireStudentRole(req, res, next) {
  if (!req.user) return res.status(401).json({ success: false, message: 'Chưa xác thực' });
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Chỉ học viên được xem tiến độ này' });
  }
  return next();
}

const requireAdmin = [authMiddleware, checkPermission(PERMISSIONS.MANAGE_STUDENT_TRAINING)];

router.get('/settings', ...requireAdmin, async (req, res) => {
  try {
    return res.json({ success: true, data: await service.loadSettings() });
  } catch (err) {
    logger.error('[LMS_PROGRESS]', err);
    return res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
});

router.put('/settings', ...requireAdmin, async (req, res) => {
  try {
    const data = await service.saveSettings({
      videoRatio: req.body?.videoRatio,
      amounts: req.body?.amounts,
    });
    return res.json({ success: true, data });
  } catch (err) {
    logger.error('[LMS_PROGRESS]', err);
    return res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
});

router.get('/me', authMiddleware, requireStudentRole, async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;
    return res.json({ success: true, data: await service.learnerBundle(studentId, req.query.month) });
  } catch (err) {
    logger.error('[LMS_PROGRESS]', err);
    return res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
});

router.get('/leaderboard', authMiddleware, requireStudentRole, async (req, res) => {
  try {
    const studentId = req.user.id || req.user._id;
    return res.json({ success: true, data: await service.leaderboard(studentId, String(req.query.period || 'week')) });
  } catch (err) {
    logger.error('[LMS_PROGRESS]', err);
    return res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
});

module.exports = router;
