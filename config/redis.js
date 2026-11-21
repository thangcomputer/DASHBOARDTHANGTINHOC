/**
 * Redis client tùy chọn - bật khi có REDIS_URL trong .env.
 * Dùng chung cho token blacklist + query cache. Không có REDIS_URL → null.
 */
const logger = require('./logger');

let client = null;
let cachedServerInfo = null;

function resolveRedisNamespace(env = process.env) {
  const explicit = String(env.REDIS_KEY_PREFIX || '').trim();
  if (explicit) {
    return explicit.endsWith(':') ? explicit : `${explicit}:`;
  }
  const nodeEnv = String(env.NODE_ENV || 'development').trim().toLowerCase();
  if (nodeEnv === 'production') return 'cms:prod:';
  if (nodeEnv === 'staging') return 'cms:staging:';
  if (nodeEnv === 'test') return 'cms:test:';
  return 'cms:';
}

function resolveBullMqPrefix(env = process.env) {
  const ns = resolveRedisNamespace(env).replace(/:+$/, '').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `bull-${ns || 'cms'}`;
}

function parseRedisMajorVersion(verStr) {
  const m = String(verStr || '').match(/^(\d+)\.(\d+)/);
  return m ? Number(m[1]) : null;
}

function resolveRedisUrl() {
  const enableRaw = String(process.env.ENABLE_REDIS ?? '').trim().toLowerCase();
  if (['0', 'false', 'off', 'no'].includes(enableRaw)) {
    return null;
  }
  const explicitUrl = String(process.env.REDIS_URL || '').trim();
  if (explicitUrl) return explicitUrl;
  if (['1', 'true', 'on', 'yes'].includes(enableRaw)) {
    const host = String(process.env.REDIS_HOST || '127.0.0.1').trim();
    const port = Number(process.env.REDIS_PORT || 6379);
    return `redis://${host}:${port}`;
  }
  return null;
}

function getRedis() {
  const redisUrl = resolveRedisUrl();
  if (!redisUrl) return null;
  if (client) return client;

  try {
    const Redis = require('ioredis');
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      lazyConnect: false,
      // Khi Redis down: KHÔNG xếp hàng lệnh (tránh treo request 10–20s)
      enableOfflineQueue: false,
      connectTimeout: 2000,
      commandTimeout: 500,
      // Blip Redis không được crash Node - tự reconnect với backoff
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
      // Tránh spam log khi Redis tạm down - chỉ warn
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
  return Boolean(resolveRedisUrl());
}

function isRedisReady() {
  return Boolean(client && client.status === 'ready');
}

async function ensureRedisReady(timeoutMs = 2000) {
  const r = getRedis();
  if (!r) return { enabled: false, ready: false, reason: 'disabled' };
  if (r.status === 'ready') return { enabled: true, ready: true, reason: 'ready' };
  return new Promise((resolve) => {
    let settled = false;
    const finish = (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      r.removeListener('ready', onReady);
      r.removeListener('error', onError);
      resolve(res);
    };
    const onReady = () => finish({ enabled: true, ready: true, reason: 'ready' });
    const onError = (err) => finish({ enabled: true, ready: false, reason: err?.message || 'error' });
    const timer = setTimeout(() => finish({ enabled: true, ready: r.status === 'ready', reason: 'timeout' }), timeoutMs);
    r.once('ready', onReady);
    r.once('error', onError);
  });
}

async function inspectRedisServerInfo(force = false) {
  if (cachedServerInfo && !force) return cachedServerInfo;
  const r = getRedis();
  if (!r || r.status !== 'ready') {
    return { available: false, version: null, majorVersion: null, bullMqCompatible: false, recommendedVersion: '7.x' };
  }
  try {
    const rawInfo = await r.info('server');
    const m = String(rawInfo || '').match(/redis_version:([^\r\n]+)/);
    const version = m ? m[1].trim() : null;
    const majorVersion = parseRedisMajorVersion(version);
    const bullMqCompatible = majorVersion !== null && majorVersion >= 5;
    cachedServerInfo = {
      available: true,
      version,
      majorVersion,
      bullMqCompatible,
      recommendedVersion: '7.x',
    };
    return cachedServerInfo;
  } catch {
    return { available: false, version: null, majorVersion: null, bullMqCompatible: false, recommendedVersion: '7.x' };
  }
}

function getCachedRedisServerInfo() {
  return cachedServerInfo;
}

async function closeRedis() {
  if (!client) return;
  try {
    await client.quit();
  } catch {
    try { client.disconnect(); } catch { /* ignore */ }
  }
  client = null;
  cachedServerInfo = null;
}

/** @deprecated dùng getRedis() */
async function getRedisClient() {
  return getRedis();
}

module.exports = {
  resolveRedisUrl,
  resolveRedisNamespace,
  resolveBullMqPrefix,
  parseRedisMajorVersion,
  getRedis,
  getRedisClient,
  isRedisEnabled,
  isRedisReady,
  ensureRedisReady,
  inspectRedisServerInfo,
  getCachedRedisServerInfo,
  closeRedis,
};
