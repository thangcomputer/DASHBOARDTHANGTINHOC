const { getRedis } = require('../../config/redis');
const AppError = require('../errors/AppError');
const logger = require('../logger/logger');

/**
 * Reusable Redis-backed Rate Limiter middleware.
 * Fails open (bypasses check) if Redis is down or unavailable.
 *
 * @param {number} maxRequests - Maximum requests allowed within window (default: 100)
 * @param {number} windowSeconds - Time window in seconds (default: 60)
 */
const rateLimiter = (maxRequests = 100, windowSeconds = 60) => {
  return async (req, res, next) => {
    const client = getRedis();
    if (!client) {
      return next(); // Fail-open
    }

    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const key = `ratelimit:${ip}:${req.originalUrl || req.path}`;

    try {
      const requests = await client.incr(key);

      if (requests === 1) {
        await client.expire(key, windowSeconds);
      }

      if (requests > maxRequests) {
        return next(
          new AppError(
            'Bạn đang gửi quá nhiều yêu cầu lên máy chủ. Vui lòng thử lại sau ít phút.',
            429,
            'TOO_MANY_REQUESTS'
          )
        );
      }

      next();
    } catch (err) {
      logger.warn({ err: err.message }, 'Rate Limiter Redis check error');
      next(); // Fail-open
    }
  };
};

module.exports = rateLimiter;
