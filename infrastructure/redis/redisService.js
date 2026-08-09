const config = require('../../config/appConfig');
const logger = require('../../shared/logger/logger');

let client = null;

/**
 * Initialize and return Redis Client instance.
 */
function getRedis() {
  if (!config.redis.url) return null;
  if (client) return client;

  try {
    const Redis = require('ioredis');
    client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy(times) {
        if (times > 30) return Math.min(times * 200, 10000);
        return Math.min(times * 150, 3000);
      },
      reconnectOnError(err) {
        const msg = String(err?.message || '');
        return msg.includes('READONLY') || msg.includes('ECONNRESET') || msg.includes('ETIMEDOUT');
      },
    });

    client.on('connect', () => logger.info('✅ Kết nối Redis thành công.'));
    client.on('error', (err) => {
      logger.warn({ err: err.message }, '⚠️  Lỗi kết nối Redis.');
    });

    return client;
  } catch (err) {
    logger.warn({ err: err.message }, '⚠️  Không thể khởi tạo Redis.');
    client = null;
    return null;
  }
}

function isRedisEnabled() {
  return Boolean(config.redis.url);
}

function isRedisReady() {
  return Boolean(client && client.status === 'ready');
}

async function closeRedis() {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    try {
      client.disconnect();
    } catch { /* ignore */ }
  }
  client = null;
}

module.exports = {
  getRedis,
  isRedisEnabled,
  isRedisReady,
  closeRedis,
};
