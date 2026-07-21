const express = require('express');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middleware/auth');
const logger = require('../config/logger');
const center = require('../services/notificationCenter');

// GET /api/notifications — danh sach phan trang (Notification Center)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page, limit, type, unreadOnly } = req.query;
    const result = await center.listForUser(req.user, {
      page,
      limit,
      type,
      unreadOnly: unreadOnly === '1' || unreadOnly === 'true',
    });
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('[NOTIFICATIONS] list error:', error);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
});

// GET /api/notifications/count — badge chua doc
router.get('/count', authMiddleware, async (req, res) => {
  try {
    const count = await center.countUnread(req.user);
    res.json({ success: true, count });
  } catch (error) {
    logger.error('[NOTIFICATIONS] count error:', error);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
});

// GET /api/notifications/unread — tuong thich cu (50 gan day + count)
router.get('/unread', authMiddleware, async (req, res) => {
  try {
    const result = await center.listForUser(req.user, { page: 1, limit: 50 });
    res.json({
      success: true,
      data: result.data,
      count: result.unread,
    });
  } catch (error) {
    logger.error('[NOTIFICATIONS] Get unread error:', error);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
});

// PUT /api/notifications/mark-read
router.put('/mark-read', authMiddleware, async (req, res) => {
  try {
    const data = await center.markRead(req.user, req.body || {});
    res.json({ success: true, message: 'Da danh dau doc', data });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Loi server' });
  }
});

// DELETE /api/notifications/:id — dismiss cho user hien tai
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const data = await center.dismiss(req.user, req.params.id);
    res.json({ success: true, message: 'Da an thong bao', data });
  } catch (error) {
    const status = error.status || 500;
    res.status(status).json({ success: false, message: error.message || 'Loi server' });
  }
});

// POST /api/notifications — admin broadcast
router.post('/', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { title, content, type = 'SYSTEM', receivers = 'ALL_ADMIN', path = '', payload = {} } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Thieu title hoac content' });
    }
    const t = String(type).toUpperCase();
    if (!center.VALID_TYPES.includes(t)) {
      return res.status(400).json({ success: false, message: 'type khong hop le' });
    }
    const io = req.app.get('io');
    const doc = await center.createAndEmit(io, {
      type: t,
      title: String(title).slice(0, 200),
      content: String(content).slice(0, 2000),
      sender_id: String(req.user.id || 'admin'),
      receivers,
      payload,
      link: path || '',
    });
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    logger.error('[NOTIFICATIONS] broadcast error:', error);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
});

module.exports = router;