const express = require('express');
const multer = require('multer');
const router = express.Router();
const fileController = require('../controllers/FileController');
const { authMiddleware } = require('../../../shared/middleware/authMiddleware');
const { authorize, authorizeAny } = require('../../../shared/middleware/authorize');
const legacyMapping = require('../../../shared/constants/legacyPermissionMapping');
const NEW_PERMISSIONS = require('../../../shared/constants/permissions');
const { PERMISSIONS } = require('../../../constants/permissions');
const logger = require('../../../config/logger');
const fileService = require('../services/fileService');
const { normalizeMulterFile } = require('../../../utils/escapeRegex');

/** Category mọi role đã đăng nhập được upload (chat / bài tập / avatar). */
const OPEN_UPLOAD_CATEGORIES = new Set(['messages', 'assignments', 'avatars']);

function requireUploadCategoryPermission(req, res, next) {
  const category = String(req.query.category || req.body?.category || 'general').toLowerCase();
  if (OPEN_UPLOAD_CATEGORIES.has(category)) return next();
  if (category === 'training') {
    return authorizeAny(...legacyMapping.resolve(PERMISSIONS.MANAGE_TRAINING), ...legacyMapping.resolve(PERMISSIONS.MANAGE_STUDENT_TRAINING), ...legacyMapping.resolve(PERMISSIONS.SYSTEM_SETTINGS), ...legacyMapping.resolve())(req, res, next);
  }
  return authorizeAny(...legacyMapping.resolve(PERMISSIONS.SYSTEM_SETTINGS))(req, res, next);
}

function uploadMiddleware(req, res, next) {
  const category = String(req.query.category || req.body?.category || 'general').toLowerCase();
  let uploader;
  try {
    uploader = fileService.createUploader(category);
  } catch (err) {
    return res.status(err.status || 400).json({ success: false, message: err.message });
  }
  uploader.single('file')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        const cfg = fileService.getCategoryConfig(category);
        const mb = cfg ? Math.round(cfg.maxBytes / (1024 * 1024)) : '?';
        return res.status(400).json({ success: false, message: 'File qua lon (toi da ' + mb + 'MB)' });
      }
      return res.status(400).json({ success: false, message: err.message || 'Loi upload' });
    }
    req.fileCategory = category;
    next();
  });
}

// POST /api/files/upload?category=general
router.post('/upload', authMiddleware, requireUploadCategoryPermission, uploadMiddleware,fileController.post_upload);

// GET /api/files/stats
router.get('/stats', authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.SYSTEM_SETTINGS)),fileController.get_stats);

// GET /api/files/categories
router.get('/categories', authMiddleware, (req, res) => {
  const list = Object.entries(fileService.CATEGORIES).map(([key, cfg]) => ({
    key,
    maxBytes: cfg.maxBytes,
    maxLabel: fileService.formatBytes(cfg.maxBytes),
    exts: cfg.exts,
  }));
  res.json({ success: true, data: list });
});

// GET /api/files
router.get('/', authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.SYSTEM_SETTINGS)),fileController.get_root);

// POST /api/files/purge-expired
router.post('/purge-expired', authMiddleware, authorizeAny(...legacyMapping.resolve(PERMISSIONS.SYSTEM_SETTINGS)),fileController.post_purge_expired);

// DELETE /api/files/:id
router.delete('/:id', authMiddleware,fileController.delete_id);

module.exports = router;