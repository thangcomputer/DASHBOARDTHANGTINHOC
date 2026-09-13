/**
 * uploadsAuth — Bảo vệ /uploads (trừ asset brand công khai).
 * Chấp nhận: Authorization Bearer | query access_token
 */
const jwt = require('jsonwebtoken');
const blacklist = require('./tokenBlacklist');
const logger = require('../config/logger');
const FileAsset = require('../models/FileAsset');

/** Thư mục công khai (logo, popup marketing, avatar) — không cần đăng nhập */
const PUBLIC_UPLOAD_PREFIXES = [
  '/logo/',
  '/favicon/',
  '/popup/',
  '/images/',
  '/avatars/', // ảnh đại diện — <img> không gửi Bearer → cần public giống /images/
  '/invoice_logo/',
  '/feed/',
  '/blog/', // ảnh/file tin tức — cần public để <img> trong HTML hiển thị
  '/center-info/', // logo/banner/gallery Thông tin trung tâm — <img> không gửi Bearer
];

function isPublicUploadPath(urlPath) {
  const p = String(urlPath || '').split('?')[0];
  const normalized = p.startsWith('/') ? p : `/${p}`;
  // express.static mounts at /uploads so req.path is relative like /messages/...
  return PUBLIC_UPLOAD_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

function canReadCertificationSubmission(asset, payload) {
  if (!asset || asset.relatedType !== 'certification_submission') return true;
  const role = String(payload?.role || '').toLowerCase();
  const userId = String(payload?.id || payload?.userId || payload?._id || '');
  if (new Set(['admin', 'staff', 'teacher']).has(role)) return true;
  return Boolean(userId) && String(asset.uploadedBy) === userId;
}

async function uploadsAuthMiddleware(req, res, next) {
  try {
    if (isPublicUploadPath(req.path)) return next();

    const header = req.header('Authorization') || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token.trim() : '';
    const token = bearer || queryToken;

    if (!token) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(401).json({ success: false, message: 'Cần đăng nhập để tải tệp này' });
    }

    if (await blacklist.isBlacklisted(token)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(401).json({ success: false, code: 'TOKEN_REVOKED', message: 'Phiên đã hết hạn' });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const asset = await FileAsset.findOne({
      url: `/uploads${req.path}`,
      status: 'active',
    }).select('uploadedBy relatedType expiresAt').lean();
    if (asset?.expiresAt && new Date(asset.expiresAt).getTime() <= Date.now()) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ success: false, message: 'Tệp không còn khả dụng' });
    }
    if (!canReadCertificationSubmission(asset, payload)) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(403).json({ success: false, message: 'Bạn không có quyền tải tệp này' });
    }
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token hết hạn' });
    }
    logger.warn('[UPLOADS] auth failed:', err.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(401).json({ success: false, message: 'Token không hợp lệ' });
  }
}

module.exports = {
  uploadsAuthMiddleware,
  isPublicUploadPath,
  canReadCertificationSubmission,
  PUBLIC_UPLOAD_PREFIXES,
};
