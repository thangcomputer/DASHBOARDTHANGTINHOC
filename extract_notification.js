const fs = require('fs');
const path = require('path');

const notifDir = path.join(__dirname, 'modules/notification');
const controllersDir = path.join(notifDir, 'controllers');
const servicesDir = path.join(notifDir, 'services');
if (!fs.existsSync(controllersDir)) fs.mkdirSync(controllersDir, { recursive: true });
if (!fs.existsSync(servicesDir)) fs.mkdirSync(servicesDir, { recursive: true });

// NotificationController.js
const notifControllerCode = `
const notificationService = require('../services/NotificationApplicationService');

class NotificationController {
  async listForUser(req, res) {
    try {
      const { page, limit, type, unreadOnly } = req.query;
      const result = await notificationService.listForUser(req.currentUser, {
        page,
        limit,
        type,
        unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
      });
      res.json({ success: true, ...result });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }

  async countUnread(req, res) {
    try {
      const count = await notificationService.countUnread(req.currentUser);
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }

  async getUnread(req, res) {
    try {
      const result = await notificationService.listForUser(req.currentUser, { page: 1, limit: 50 });
      res.json({ success: true, data: result.data, count: result.unread });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }

  async markAsRead(req, res) {
    try {
      const result = await notificationService.markAsRead(req.params.id, req.currentUser);
      if (!result) return res.status(404).json({ success: false, message: 'Không tìm thấy hoặc không có quyền' });
      res.json({ success: true, message: 'Đã đánh dấu đọc' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }

  async markAllAsRead(req, res) {
    try {
      await notificationService.markAllAsRead(req.currentUser);
      res.json({ success: true, message: 'Đã đánh dấu tất cả là đã đọc' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }

  async pushFCMToken(req, res) {
    try {
      const { token, deviceId, platform } = req.body;
      if (!token || !deviceId) {
        return res.status(400).json({ success: false, message: 'Thiếu token hoặc deviceId' });
      }
      await notificationService.registerFCMToken(req.currentUser, token, deviceId, platform);
      res.json({ success: true, message: 'Token updated' });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }

  async createBroadcast(req, res) {
    try {
      const { title, message, url, branches, roles } = req.body;
      if (!title || !message) {
        return res.status(400).json({ success: false, message: 'Thiếu tiêu đề hoặc nội dung' });
      }
      const notif = await notificationService.createBroadcast({
        title, message, url, branches, roles,
        senderId: req.currentUser.id, senderName: req.currentUser.name
      });
      res.status(201).json({ success: true, message: 'Đã gửi thông báo hệ thống', data: notif });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
}

module.exports = new NotificationController();
`;
fs.writeFileSync(path.join(controllersDir, 'NotificationController.js'), notifControllerCode);

// NotificationApplicationService.js is just a rename of notificationCenter.js for now, since notificationCenter.js is already doing service layer work
const centerCode = fs.readFileSync(path.join(servicesDir, 'notificationCenter.js'), 'utf8');
fs.writeFileSync(path.join(servicesDir, 'NotificationApplicationService.js'), centerCode);

// notificationRoutes.js
const notifRoutesCode = `const express = require('express');
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
`;
fs.writeFileSync(path.join(notifDir, 'routes', 'notificationRoutes.js'), notifRoutesCode);

console.log('Notification extracted successfully.');
