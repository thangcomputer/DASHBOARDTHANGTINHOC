'use strict';
const logger = require('./../../../config/logger');
const fileService = require('./fileService');
const { normalizeMulterFile } = require('./../../../utils/escapeRegex');

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

class FileApplicationService {
  async post_upload(data) {
  try {
    if (!data.file) {
      return { _status: 400, _body: ({ success: false, message: 'Chua chon file' });
    }
    normalizeMulterFile(data.file);
    const asset = await fileService.registerUploadedFile(data.file, {
      category: data.fileCategory,
      uploadedBy: String(data.currentUser.id || data.currentUser._id || ''),
      uploadedByRole: data.currentUser.role || '',
      relatedType: data.body?.relatedType || '',
      relatedId: data.body?.relatedId || '',
    });
    return { _status: 201, _body: ({
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
}

  async get_stats(data) {
  try {
    const stats = await fileService.getStats();
    return { _status: 200, _body: ({
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
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

  async get_categories(data) {}

  async get_root(data) {
  try {
    const { page, limit, category, status, q, uploadedBy } = data.query;
    const result = await fileService.listAssets({ page, limit, category, status, q, uploadedBy });
    return { _status: 200, _body: ({
      success: true,
      data: result.data.map((f) => ({
        ...f,
        sizeLabel: fileService.formatBytes(f.size),
      })),
      pagination: result.pagination,
    });
  } catch (err) {
    logger.error('[FILES] list:', err);
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

  async post_purge_expired(data) {
  try {
    const result = await fileService.purgeExpired();
    return { _status: 200, _body: ({ success: true, message: 'Da don ' + result.purged + ' file het han', data: result });
  } catch (err) {
    logger.error('[FILES] purge:', err);
    return { _status: 500, _body: ({ success: false, message: 'Loi server' });
  }
}

  async delete_id(data) {
  try {
    const asset = await fileService.deleteById(data.id, data.currentUser);
    return { _status: 200, _body: ({ success: true, message: 'Da xoa file', data: { id: asset._id, status: asset.status } });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, message: err.message || 'Loi server' });
  }
}

}

module.exports = new FileApplicationService();
