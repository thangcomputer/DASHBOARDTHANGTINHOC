/**
 * Rate limiter in-memory (single-server). Production lớn → Redis.
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, max = 30, message = 'Quá nhiều request. Thử lại sau.' } = {}) {
  const hits = new Map(); // ip → { count, resetAt }

  setInterval(() => {
    const now = Date.now();
    for (const [ip, v] of hits.entries()) {
      if (v.resetAt <= now) hits.delete(ip);
    }
  }, 60_000).unref?.();

  return (req, res, next) => {
    if (process.env.NODE_ENV === 'development') return next();

    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;
    if (entry.count > max) {
      return res.status(429).json({ success: false, message });
    }
    next();
  };
}

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Quá nhiều lần thử. Vui lòng chờ 15 phút.',
});

const strictAuthLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 12,
  message: 'Quá nhiều lần đăng nhập. Thử lại sau 15 phút.',
});

module.exports = { authLimiter, strictAuthLimiter, createRateLimiter };
