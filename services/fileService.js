/**
 * File service — upload theo category, registry FileAsset, xoa / purge het han.
 */
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const FileAsset = require('../models/FileAsset');
const logger = require('../config/logger');

const UPLOADS_ROOT = path.join(__dirname, '..', 'uploads');

const CATEGORIES = {
  messages: {
    dir: 'messages',
    maxBytes: 50 * 1024 * 1024,
    exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.7z', '.txt', '.mp4', '.webm', '.mp3', '.wav'],
    retentionDays: () => Math.max(1, Number(process.env.MESSAGE_FILE_RETENTION_DAYS) || 10),
  },
  assignments: {
    dir: 'assignments',
    maxBytes: 3 * 1024 * 1024,
    exts: ['.zip', '.rar', '.tar', '.7z', '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.jpg', '.jpeg', '.png'],
    retentionDays: null,
  },
  training: {
    dir: 'training',
    maxBytes: 25 * 1024 * 1024,
    exts: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar'],
    retentionDays: null,
  },
  invoices: {
    dir: 'invoices',
    maxBytes: 5 * 1024 * 1024,
    exts: ['.pdf'],
    retentionDays: null,
  },
  images: {
    dir: 'images',
    maxBytes: 5 * 1024 * 1024,
    exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    retentionDays: null,
  },
  general: {
    dir: 'general',
    maxBytes: 10 * 1024 * 1024,
    exts: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.rar', '.jpg', '.jpeg', '.png', '.txt'],
    retentionDays: null,
  },
  popup: {
    dir: 'popup',
    maxBytes: 5 * 1024 * 1024,
    exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    retentionDays: null,
  },
  signature: {
    dir: 'signature',
    maxBytes: 2 * 1024 * 1024,
    exts: ['.jpg', '.jpeg', '.png', '.webp'],
    retentionDays: null,
  },
  logo: {
    dir: 'logo',
    maxBytes: 2 * 1024 * 1024,
    exts: ['.jpg', '.jpeg', '.png', '.webp', '.svg'],
    retentionDays: null,
  },
};

function ensureDir(dir) {
  const full = path.join(UPLOADS_ROOT, dir);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
  return full;
}

function safeOriginalBase(name) {
  const ext = path.extname(name || '');
  const base = path.basename(name || 'file', ext).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return base || 'file';
}

function getCategoryConfig(category) {
  const key = String(category || 'general').toLowerCase();
  return CATEGORIES[key] ? { key, ...CATEGORIES[key] } : null;
}

function createUploader(category) {
  const cfg = getCategoryConfig(category);
  if (!cfg) {
    const err = new Error('Category khong hop le');
    err.status = 400;
    throw err;
  }
  ensureDir(cfg.dir);
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(UPLOADS_ROOT, cfg.dir)),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      const useExt = cfg.exts.includes(ext) ? ext : '';
      const base = safeOriginalBase(file.originalname);
      cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + '-' + base + useExt);
    },
  });
  return multer({
    storage,
    limits: { fileSize: cfg.maxBytes },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase();
      if (!cfg.exts.includes(ext)) {
        return cb(new Error('Dinh dang file khong duoc phep cho category ' + cfg.key));
      }
      cb(null, true);
    },
  });
}

function expiresAtFor(category) {
  const cfg = getCategoryConfig(category);
  if (!cfg || !cfg.retentionDays) return null;
  const days = typeof cfg.retentionDays === 'function' ? cfg.retentionDays() : cfg.retentionDays;
  if (!days) return null;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

/**
 * Dang ky file da upload (multer req.file) vao FileAsset.
 */
async function registerUploadedFile(file, {
  category = 'general',
  uploadedBy = '',
  uploadedByRole = '',
  relatedType = '',
  relatedId = '',
  expiresAt = undefined,
} = {}) {
  const cfg = getCategoryConfig(category);
  if (!cfg || !file) {
    const err = new Error('Thieu file hoac category');
    err.status = 400;
    throw err;
  }
  const diskPath = path.join(cfg.dir, file.filename).replace(/\\/g, '/');
  const url = '/uploads/' + diskPath;
  const asset = await FileAsset.create({
    filename: file.filename,
    originalName: file.originalname || file.filename,
    mimeType: file.mimetype || '',
    size: file.size || 0,
    category: cfg.key,
    url,
    diskPath,
    uploadedBy: String(uploadedBy || ''),
    uploadedByRole: String(uploadedByRole || ''),
    relatedType: String(relatedType || ''),
    relatedId: String(relatedId || ''),
    expiresAt: expiresAt === undefined ? expiresAtFor(cfg.key) : expiresAt,
    status: 'active',
  });
  return asset;
}

/**
 * Dang ky file da co tren disk (vd PDF hoa don sinh boi queue).
 */
async function registerExistingFile({
  category,
  filename,
  originalName,
  mimeType = 'application/octet-stream',
  size = 0,
  uploadedBy = 'system',
  uploadedByRole = 'system',
  relatedType = '',
  relatedId = '',
  expiresAt = null,
}) {
  const cfg = getCategoryConfig(category);
  if (!cfg) throw new Error('Category khong hop le');
  const diskPath = path.join(cfg.dir, filename).replace(/\\/g, '/');
  const full = path.join(UPLOADS_ROOT, diskPath);
  let fileSize = size;
  if (!fileSize && fs.existsSync(full)) {
    fileSize = fs.statSync(full).size;
  }
  return FileAsset.create({
    filename,
    originalName: originalName || filename,
    mimeType,
    size: fileSize,
    category: cfg.key,
    url: '/uploads/' + diskPath,
    diskPath,
    uploadedBy,
    uploadedByRole,
    relatedType,
    relatedId,
    expiresAt,
    status: 'active',
  });
}

function resolveDiskPath(asset) {
  return path.join(UPLOADS_ROOT, asset.diskPath);
}

async function deleteAsset(asset, { hard = true, finalStatus = 'deleted' } = {}) {
  if (!asset) return null;
  if (hard) {
    const full = resolveDiskPath(asset);
    try {
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch (err) {
      logger.warn({ err: err.message, path: asset.diskPath }, '[File] unlink failed');
    }
  }
  asset.status = finalStatus;
  asset.deletedAt = new Date();
  await asset.save();
  return asset;
}

async function deleteById(id, user) {
  const asset = await FileAsset.findById(id);
  if (!asset || asset.status === 'deleted') {
    const err = new Error('Khong tim thay file');
    err.status = 404;
    throw err;
  }
  const uid = String(user?.id || user?._id || '');
  const isAdmin = user?.role === 'admin' || user?.role === 'staff';
  if (!isAdmin && asset.uploadedBy && asset.uploadedBy !== uid) {
    const err = new Error('Khong co quyen xoa file nay');
    err.status = 403;
    throw err;
  }
  return deleteAsset(asset, { hard: true });
}

async function listAssets({
  page = 1,
  limit = 20,
  category,
  status = 'active',
  uploadedBy,
  q,
} = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (category && CATEGORIES[category]) filter.category = category;
  if (uploadedBy) filter.uploadedBy = String(uploadedBy);
  if (q) {
    const safe = String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').slice(0, 80);
    filter.$or = [
      { originalName: { $regex: safe, $options: 'i' } },
      { filename: { $regex: safe, $options: 'i' } },
    ];
  }
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
  const skip = (pageNum - 1) * limitNum;
  const [rows, total] = await Promise.all([
    FileAsset.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
    FileAsset.countDocuments(filter),
  ]);
  return {
    data: rows,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.max(1, Math.ceil(total / limitNum)),
    },
  };
}

async function getStats() {
  const byCategory = await FileAsset.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalSize: { $sum: '$size' },
      },
    },
    { $sort: { totalSize: -1 } },
  ]);
  const totals = byCategory.reduce(
    (acc, row) => {
      acc.count += row.count;
      acc.totalSize += row.totalSize;
      return acc;
    },
    { count: 0, totalSize: 0 },
  );
  return { byCategory, totals, categories: Object.keys(CATEGORIES) };
}

/**
 * Danh dau het han + xoa file tren disk.
 */
async function purgeExpired() {
  const now = new Date();
  const expired = await FileAsset.find({
    status: 'active',
    expiresAt: { $ne: null, $lte: now },
  }).limit(200);
  let purged = 0;
  for (const asset of expired) {
    try {
      await deleteAsset(asset, { hard: true, finalStatus: 'expired' });
      purged += 1;
    } catch (err) {
      logger.warn({ err: err.message, id: asset._id }, '[File] purge one failed');
    }
  }
  return { purged, scanned: expired.length };
}

function formatBytes(n) {
  const v = Number(n) || 0;
  if (v < 1024) return v + ' B';
  if (v < 1024 * 1024) return (v / 1024).toFixed(1) + ' KB';
  if (v < 1024 * 1024 * 1024) return (v / (1024 * 1024)).toFixed(1) + ' MB';
  return (v / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

module.exports = {
  CATEGORIES,
  UPLOADS_ROOT,
  getCategoryConfig,
  createUploader,
  registerUploadedFile,
  registerExistingFile,
  deleteById,
  deleteAsset,
  listAssets,
  getStats,
  purgeExpired,
  formatBytes,
  expiresAtFor,
};