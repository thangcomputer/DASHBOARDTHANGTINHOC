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

function issueCsrfToken(res, existingToken) {
  const token = /^[a-f0-9]{64}$/i.test(String(existingToken || ''))
    ? String(existingToken)
    : crypto.randomBytes(32).toString('hex');
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

  // Requests with explicit Bearer tokens are not vulnerable to CSRF attacks
  // because browsers never attach Authorization headers cross-origin automatically.
  const authHeader = req.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return next();
  }

  // Mobile client requests identified by custom header
  if (req.get('x-client-platform') === 'mobile' || req.get('x-mobile-app') === 'true') {
    return next();
  }

  // In non-production, allow requests from local dev origins (e.g. Expo web on localhost:8081)
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const origin = req.get('origin');
    if (origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return next();
    }
  }

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