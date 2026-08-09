const express = require('express');
const router = express.Router();
const proctorController = require('../controllers/ProctorController');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny, authorizeAll } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const proctorAudit = require('../services/proctorAuditService');

/**
 * POST /api/proctor/events — thí sinh/GV gửi batch sự kiện giám sát (JWT).
 * Không nhận video/frame.
 */
router.post('/events', authMiddleware,proctorController.post_events);

/**
 * GET /api/proctor/events/me — sự kiện của chính mình
 */
router.get('/events/me', authMiddleware,proctorController.get_events_me);

/**
 * GET /api/proctor/events/:userId — admin xem nhật ký thí sinh/GV
 */
router.get('/events/:userId', authMiddleware, authorize(NEW_PERMISSIONS.EXAM_MANAGE),proctorController.get_events_userId);

module.exports = router;
