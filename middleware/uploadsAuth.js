/**
 * uploadsAuth — Bảo vệ /uploads (trừ asset brand công khai).
 * Chấp nhận: Authorization Bearer | query access_token
 */
const jwt = require('jsonwebtoken');
const blacklist = require('./tokenBlacklist');
const logger = require('../config/logger');

/** Thư mục công khai (logo, popup marketing) — không cần đăng nhập */
const PUBLIC_UPLOAD_PREFIXES = [
  '/logo/',
  '/favicon/',
  '/popup/',
  '/images/',
  '/invoice_logo/',
  '/feed/',
];

function isPublicUploadPath(urlPath) {
  const p = String(urlPath || '').split('?')[0];
  const normalized = p.startsWith('/') ? p : `/${p}`;
  // express.static mounts at /uploads so req.path is relative like /messages/...
  return PUBLIC_UPLOAD_PREFIXES.some((prefix) => normalized === prefix.slice(0, -1) || normalized.startsWith(prefix));
}

async function uploadsAuthMiddleware(req, res, next) {
  try {
    if (isPublicUploadPath(req.path)) return next();

    const header = req.header('Authorization') || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const queryToken = typeof req.query.access_token === 'string' ? req.query.access_token.trim() : '';
    const token = bearer || queryToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Cần đăng nhập để tải tệp này' });
    }

    if (await blacklist.isBlacklisted(token)) {
      return res.status(401).json({ success: false, code: 'TOKEN_REVOKED', message: 'Phiên đã hết hạn' });
    }

    jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, code: 'TOKEN_EXPIRED', message: 'Token hết hạn' });
    }
    logger.warn('[UPLOADS] auth failed:', err.message);
    return res.status(401).json({ success: false, message: 'Token không hợp lệ' });
  }
}

module.exports = { uploadsAuthMiddleware, isPublicUploadPath, PUBLIC_UPLOAD_PREFIXES };
