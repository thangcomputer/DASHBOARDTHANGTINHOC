/**
 * Cache-aside: Redis khi co REDIS_URL, khong thi in-memory Map (TTL).
 * Khong throw — loi Redis luon fallback memory / miss.
 */
const { getRedis } = require('../config/redis');

const PREFIX = 'cms:';
const memory = new Map(); // key -> { value, expiresAt }

let memoryCleaner = null;

function ensureMemoryCleaner() {
  if (memoryCleaner) return;
  memoryCleaner = setInterval(() => {
    const now = Date.now();
    for (const [k, e] of memory.entries()) {
      if (e.expiresAt && e.expiresAt <= now) memory.delete(k);
    }
  }, 60_000);
  if (typeof memoryCleaner.unref === 'function') memoryCleaner.unref();
}

function fullKey(key) {
  return key.startsWith(PREFIX) ? key : PREFIX + key;
}

function memoryGet(key) {
  const e = memory.get(key);
  if (!e) return undefined;
  if (e.expiresAt && e.expiresAt <= Date.now()) {
    memory.delete(key);
    return undefined;
  }
  return e.value;
}

function memorySet(key, value, ttlSeconds) {
  ensureMemoryCleaner();
  memory.set(key, {
    value,
    expiresAt: Date.now() + Math.max(1, ttlSeconds) * 1000,
  });
}

function memoryDel(key) {
  memory.delete(key);
}

function memoryDelByPrefix(prefix) {
  for (const k of memory.keys()) {
    if (k.startsWith(prefix)) memory.delete(k);
  }
}

async function get(key) {
  const k = fullKey(key);
  const redis = getRedis();
  if (redis) {
    try {
      const raw = await redis.get(k);
      if (raw != null) return JSON.parse(raw);
    } catch {
      /* fall through */
    }
  }
  return memoryGet(k);
}

async function set(key, value, ttlSeconds = 60) {
  const k = fullKey(key);
  const ttl = Math.max(1, Number(ttlSeconds) || 60);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(k, JSON.stringify(value), 'EX', ttl);
      return;
    } catch {
      /* fall through to memory */
    }
  }
  memorySet(k, value, ttl);
}

async function del(key) {
  const k = fullKey(key);
  memoryDel(k);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(k);
    } catch {
      /* ignore */
    }
  }
}

/** Xoa moi key bat dau bang prefix (sau khi gan cms:) */
async function delByPrefix(prefix) {
  const p = fullKey(prefix);
  memoryDelByPrefix(p);
  const redis = getRedis();
  if (!redis) return;

  try {
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', p + '*', 'COUNT', 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  } catch {
    /* ignore */
  }
}

/**
 * Cache-aside: tra ve cache neu co, khong thi goi fn va luu.
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<any>} fn
 */
async function wrap(key, ttlSeconds, fn) {
  const hit = await get(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  if (value !== undefined && value !== null) {
    await set(key, value, ttlSeconds);
  }
  return value;
}

/** Chi dung trong test */
function _resetMemoryForTests() {
  memory.clear();
}

module.exports = {
  PREFIX,
  get,
  set,
  del,
  delByPrefix,
  wrap,
  _resetMemoryForTests,
};