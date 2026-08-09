
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
