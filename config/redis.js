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
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
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
