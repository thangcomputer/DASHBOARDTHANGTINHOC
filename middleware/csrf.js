/**
 * Double-submit CSRF cookie for mutating /api requests.
 * Browser must send cookie csrf_token + header X-CSRF-Token.
 */
const crypto = require('crypto');

const COOKIE_NAME = 'csrf_token';
const HEADER_NAME = 'x-csrf-token';

const SKIP_PREFIXES = [
  '/api/webhooks',
  '/healthz',
];

function shouldSkip(req) {
  const url = req.originalUrl || req.url || '';
  if (SKIP_PREFIXES.some((p) => url.startsWith(p))) return true;
  // CSRF token endpoint itself
  if (url.startsWith('/api/auth/csrf-token')) return true;
  return false;
}

function issueCsrfToken(res) {
  const token = crypto.randomBytes(32).toString('hex');
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
  });
  return token;
}

function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (shouldSkip(req)) return next();

  const cookieToken = req.cookies?.[COOKIE_NAME];
  const headerToken = req.get(HEADER_NAME);
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      code: 'CSRF_INVALID',
      message: 'CSRF token không hợp lệ. Tải lại trang và thử lại.',
    });
  }
  return next();
}

module.exports = {
  COOKIE_NAME,
  HEADER_NAME,
  issueCsrfToken,
  csrfProtection,
};