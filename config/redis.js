/**
 * Redis client tùy chọn — bật khi có REDIS_URL trong .env.
 * Dùng chung cho token blacklist + query cache. Không có REDIS_URL → null.
 */
const logger = require('./logger');

let client = null;

function getRedis() {
  if (!process.env.REDIS_URL) return null;
  if (client) return client;

  try {
    const Redis = require('ioredis');
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
      // Khi Redis down: KHÔNG xếp hàng lệnh (tránh treo request 10–20s)
      enableOfflineQueue: false,
      connectTimeout: 2000,
      commandTimeout: 500,
      // Blip Redis không được crash Node — tự reconnect với backoff
      retryStrategy(times) {
        if (times > 30) return Math.min(times * 200, 10000);
        return Math.min(times * 150, 3000);
      },
      reconnectOnError(err) {
        const msg = String(err?.message || '');
        return msg.includes('READONLY') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT');
      },
    });
    client.on('connect', () => logger.info('Redis connected'));
    client.on('error', (err) => {
      // Tránh spam log khi Redis tạm down — chỉ warn
      logger.warn({ err: err.message }, 'Redis error');
    });
    return client;
  } catch (err) {
    logger.warn({ err: err.message }, 'Redis unavailable');
    client = null;
    return null;
  }
}

function isRedisEnabled() {
  return Boolean(process.env.REDIS_URL);
}

function isRedisReady() {
  return Boolean(client && client.status === 'ready');
}

async function closeRedis() {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    try { client.disconnect(); } catch { /* ignore */ }
  }
  client = null;
}

/** @deprecated dùng getRedis() */
async function getRedisClient() {
  return getRedis();
}

module.exports = {
  getRedis,
  getRedisClient,
  isRedisEnabled,
  isRedisReady,
  closeRedis,
};
