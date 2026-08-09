const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const { authorize } = require('../../../shared/middleware/authorize');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const notificationController = require('../controllers/NotificationController');

// GET /api/notifications
router.get('/', authMiddleware, notificationController.listForUser);
router.get('/count', authMiddleware, notificationController.countUnread);
router.get('/unread', authMiddleware, notificationController.getUnread);

// POST / PUT
router.put('/:id/read', authMiddleware, notificationController.markAsRead);
router.post('/mark-all-read', authMiddleware, notificationController.markAllAsRead);
router.post('/fcm-token', authMiddleware, notificationController.pushFCMToken);

// Broadcast
router.post('/broadcast', authMiddleware, authorize(NEW_PERMISSIONS.SYSTEM_BROADCAST), notificationController.createBroadcast);

module.exports = router;
