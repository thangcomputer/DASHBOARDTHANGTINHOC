const express = require('express');
const multer = require('multer');
const router = express.Router();
const { authMiddleware, isAdmin } = require('../middleware/auth');
const logger = require('../config/logger');
const fileService = require('../services/fileService');

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
router.post('/upload', authMiddleware, uploadMiddleware, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Chua chon file' });
    }
    const asset = await fileService.registerUploadedFile(req.file, {
      category: req.fileCategory,
      uploadedBy: String(req.user.id || req.user._id || ''),
      uploadedByRole: req.user.role || '',
      relatedType: req.body?.relatedType || '',
      relatedId: req.body?.relatedId || '',
    });
    return res.status(201).json({
      success: true,
      message: 'Upload thanh cong',
      data: {
        id: asset._id,
        url: asset.url,
        fileUrl: asset.url,
        originalName: asset.originalName,
        size: asset.size,
        category: asset.category,
        expiresAt: asset.expiresAt,
      },
    });
  } catch (err) {
    logger.error('[FILES] upload:', err);
    return res.status(err.status || 500).json({ success: false, message: err.message || 'Loi server' });
  }
});

// GET /api/files/stats
router.get('/stats', authMiddleware, isAdmin, async (req, res) => {
  try {
    const stats = await fileService.getStats();
    res.json({
      success: true,
      data: {
        ...stats,
        totals: {
          ...stats.totals,
          totalSizeLabel: fileService.formatBytes(stats.totals.totalSize),
        },
        byCategory: stats.byCategory.map((r) => ({
          category: r._id,
          count: r.count,
          totalSize: r.totalSize,
          totalSizeLabel: fileService.formatBytes(r.totalSize),
        })),
      },
    });
  } catch (err) {
    logger.error('[FILES] stats:', err);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
});

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
router.get('/', authMiddleware, isAdmin, async (req, res) => {
  try {
    const { page, limit, category, status, q, uploadedBy } = req.query;
    const result = await fileService.listAssets({ page, limit, category, status, q, uploadedBy });
    res.json({
      success: true,
      data: result.data.map((f) => ({
        ...f,
        sizeLabel: fileService.formatBytes(f.size),
      })),
      pagination: result.pagination,
    });
  } catch (err) {
    logger.error('[FILES] list:', err);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
});

// POST /api/files/purge-expired
router.post('/purge-expired', authMiddleware, isAdmin, async (req, res) => {
  try {
    const result = await fileService.purgeExpired();
    res.json({ success: true, message: 'Da don ' + result.purged + ' file het han', data: result });
  } catch (err) {
    logger.error('[FILES] purge:', err);
    res.status(500).json({ success: false, message: 'Loi server' });
  }
});

// DELETE /api/files/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const asset = await fileService.deleteById(req.params.id, req.user);
    res.json({ success: true, message: 'Da xoa file', data: { id: asset._id, status: asset.status } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Loi server' });
  }
});

module.exports = router;