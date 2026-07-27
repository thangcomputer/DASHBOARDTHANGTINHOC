/**
 * General API rate limit — skips /api/auth/* (already limited there).
 *
 * KEY STRATEGY: Decode JWT token (without verify — just for rate limiting identity)
 * so each authenticated user has their own quota, even if multiple users share the same IP.
 * Falls back to IP for unauthenticated requests.
 *
 * Dashboard admin loads many parallel GETs; default budget is high for logged-in users.
 */
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const jsonMessage = (message) => ({ success: false, code: 'RATE_LIMITED', message });

function parseMax(name, fallback) {
  const n = parseInt(process.env[name] || String(fallback), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Lấy userId từ Bearer token (decode nhanh, không verify)
 * để mỗi người dùng có quota riêng — tránh share theo IP.
 */
function resolveKey(req) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (token) {
      const decoded = jwt.decode(token); // Không verify, chỉ lấy payload
      const uid = decoded && (decoded._id || decoded.id || decoded.sub);
      if (uid) return `u:${String(uid)}`;
    }
  } catch (_) { /* ignore */ }
  // Fallback: IP (request chưa đăng nhập) — ipKeyGenerator bắt buộc với express-rate-limit v8 + IPv6
  return `ip:${ipKeyGenerator(req.ip)}`;
}

function isAuthenticated(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') && auth.length > 20;
}

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // User đã login: budget cao (dashboard sync). Anonymous: thấp hơn (chống spam).
  max: (req) => (
    isAuthenticated(req)
      ? parseMax('RATE_LIMIT_API_MAX', 20000)
      : parseMax('RATE_LIMIT_API_ANON_MAX', 300)
  ),
  keyGenerator: resolveKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (req.method === 'GET' && req.originalUrl.startsWith('/api/settings/web')) return true;
    if (req.method === 'GET' && req.originalUrl === '/api/branches') return true;
    if (req.method === 'GET' && (req.originalUrl === '/api/health' || req.originalUrl === '/api/healthz')) return true;
    return false;
  },
  message: jsonMessage('Quá nhiều yêu cầu API. Vui lòng thử lại sau.'),
});

function apiRateLimitUnlessAuth(req, res, next) {
  // Local/dev: tắt rate limit để debug & test UI không bị 429
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  if (env !== 'production') return next();

  if (req.originalUrl.startsWith('/api/auth')) return next();
  if (req.originalUrl.startsWith('/api/webhooks')) return next();
  return generalApiLimiter(req, res, next);
}

module.exports = { generalApiLimiter, apiRateLimitUnlessAuth };
