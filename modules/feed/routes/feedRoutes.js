const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const feedController = require('../controllers/FeedController');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const logger = require('../../../config/logger');

const feedDir = path.join(__dirname, '..', 'uploads', 'feed');
if (!fs.existsSync(feedDir)) fs.mkdirSync(feedDir, { recursive: true });

const feedStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, feedDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, 'feed_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + ext);
  },
});

const uploadFeed = multer({
  storage: feedStorage,
  limits: { fileSize: 5 * 1024 * 1024, files: 6 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Chi cho phep file anh'));
  },
});

router.post('/upload', authMiddleware, (req, res) => {
  uploadFeed.array('images', 6)(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ success: false, message: err.code === 'LIMIT_FILE_SIZE' ? 'Anh qua lon (toi da 5MB)' : err.message });
    }
    if (err) return res.status(400).json({ success: false, message: err.message });
    try {
      const files = req.files || [];
      if (!files.length) return res.status(400).json({ success: false, message: 'Khong co anh' });
      const urls = files.map((f) => '/uploads/feed/' + f.filename);
      return res.json({ success: true, urls });
    } catch (e) {
      logger.error('[FEED] upload error', e);
      return res.status(500).json({ success: false, message: 'Loi upload' });
    }
  });
});

router.get('/', authMiddleware, feedController.get_root);
router.post('/', authMiddleware, feedController.post_root);
router.put('/:id', authMiddleware, feedController.put_id);
router.delete('/:id', authMiddleware, feedController.delete_id);
router.post('/:id/like', authMiddleware, feedController.post_id_like);
router.post('/:id/react', authMiddleware, feedController.post_id_react);
router.post('/:id/comments', authMiddleware, feedController.post_id_comments);
router.delete('/:id/comments/:commentId', authMiddleware, feedController.delete_id_comments_commentId);

module.exports = router;