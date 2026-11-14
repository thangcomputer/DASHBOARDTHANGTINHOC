/**
 * General API rate limit - skips /api/auth/* (already limited there).
 *
 * KEY STRATEGY: Decode JWT token (without verify - just for rate limiting identity)
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
 * Xác thực Bearer token (verify chữ ký JWT) để lấy userId cho rate-limit.
 * Token giả mạo / hết hạn sẽ fallback về rate-limit theo IP ẩn danh.
 */
function extractVerifiedTokenUserId(req) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const secret = process.env.JWT_SECRET;
    if (!token || !secret) return '';
    const decoded = jwt.verify(token, secret);
    const uid = decoded && (decoded._id || decoded.id || decoded.sub);
    return uid ? String(uid) : '';
  } catch (_) {
    return '';
  }
}

function resolveKey(req) {
  const uid = extractVerifiedTokenUserId(req);
  if (uid) return `u:${uid}`;
  // Fallback: IP (request chưa đăng nhập hoặc token không hợp lệ) - ipKeyGenerator bắt buộc với express-rate-limit v8 + IPv6
  return `ip:${ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1')}`;
}

function resolveNetworkIpKey(req) {
  return `netip:${ipKeyGenerator(req.ip || req.socket?.remoteAddress || '127.0.0.1')}`;
}

function isAuthenticated(req) {
  return Boolean(extractVerifiedTokenUserId(req));
}

function shouldSkipGeneralApi(req) {
  if (req.method !== 'GET') return false;
  const url = String(req.originalUrl || req.url || '');
  if (url.startsWith('/api/settings/web')) return true;
  if (url === '/api/branches') return true;
  if (url === '/api/health' || url === '/api/healthz') return true;
  return false;
}

/** Chống flood API ở mức độ toàn IP mạng (ngăn dùng nhiều tài khoản cùng 1 mạng để xả request) */
const apiIpNetworkLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: () => parseMax('RATE_LIMIT_API_IP_BURST_MAX', 180),
  keyGenerator: resolveNetworkIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipGeneralApi,
  message: jsonMessage('Lưu lượng truy cập từ mạng này tăng đột biến. Vui lòng thử lại sau vài giây.'),
});

/** Chống burst request trên từng tài khoản hoặc IP ẩn danh trong 10 giây */
const apiBurstLimiter = rateLimit({
  windowMs: 10 * 1000,
  max: (req) => (
    isAuthenticated(req)
      ? parseMax('RATE_LIMIT_API_BURST_MAX', 80)
      : parseMax('RATE_LIMIT_API_ANON_BURST_MAX', 30)
  ),
  keyGenerator: resolveKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipGeneralApi,
  message: jsonMessage('Thao tác quá nhanh. Vui lòng đợi vài giây rồi thử lại.'),
});

const generalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // User đã login: budget 3000/15p. Anonymous: 300/15p.
  max: (req) => (
    isAuthenticated(req)
      ? parseMax('RATE_LIMIT_API_MAX', 3000)
      : parseMax('RATE_LIMIT_API_ANON_MAX', 300)
  ),
  keyGenerator: resolveKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip: shouldSkipGeneralApi,
  message: jsonMessage('Quá nhiều yêu cầu API. Vui lòng thử lại sau.'),
});

function runLimiterChain(limiters, req, res, next) {
  let idx = 0;
  function step(err) {
    if (err) return next(err);
    const fn = limiters[idx++];
    if (!fn) return next();
    return fn(req, res, step);
  }
  return step();
}

function apiRateLimitUnlessAuth(req, res, next) {
  // Local/dev: tắt rate limit để debug & test UI không bị 429
  const env = (process.env.NODE_ENV || 'development').toLowerCase();
  if (env !== 'production') return next();

  const url = String(req.originalUrl || req.url || '');
  if (url.startsWith('/api/auth')) return next();
  if (url.startsWith('/api/webhooks')) return next();
  return runLimiterChain([apiIpNetworkLimiter, apiBurstLimiter, generalApiLimiter], req, res, next);
}

module.exports = {
  generalApiLimiter,
  apiBurstLimiter,
  apiIpNetworkLimiter,
  apiRateLimitUnlessAuth,
};
