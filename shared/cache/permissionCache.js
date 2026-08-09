/**
 * Permission Cache Adapter
 * ========================
 * Provides a unified cache interface for resolved permissions.
 *
 * Strategy:
 *  1. Try Redis (when REDIS_URL is configured and the client is ready).
 *  2. Fall back to in-process Memory Cache automatically if Redis is
 *     unavailable, initialising, or throws.
 *
 * No request may ever fail because of a cache error — every public method
 * is fully wrapped so that failures degrade silently to a cache-miss.
 *
 * Cache key format : permission:{userId}
 * Default TTL      : 300 seconds
 *
 * Prometheus counters (integrated with Sprint 2 Prometheus framework):
 *   permission_cache_hit_total
 *   permission_cache_miss_total
 *   permission_cache_invalidation_total
 */

const { isRedisReady, getRedis } = require('../../infrastructure/redis/redisService');
const logger = require('../logger/logger');

// ─── TTL ─────────────────────────────────────────────────────────────────────
const DEFAULT_TTL_SECONDS = 300;

// ─── Prometheus-style counters ─────────────────────────────────────────────
const _counters = {
  hit: 0,
  miss: 0,
  invalidation: 0,
};

/**
 * Snapshot of cache observability counters.
 * Consumed by prometheusExporter.js.
 *
 * @returns {{ permission_cache_hit_total: number, permission_cache_miss_total: number, permission_cache_invalidation_total: number }}
 */
function getCacheMetrics() {
  return {
    permission_cache_hit_total: _counters.hit,
    permission_cache_miss_total: _counters.miss,
    permission_cache_invalidation_total: _counters.invalidation,
  };
}

// ─── Memory Cache Provider ────────────────────────────────────────────────
/** @type {Map<string, { value: string[], expiresAt: number }>} */
const _memStore = new Map();

const MemoryProvider = {
  get: (key) => {
    const entry = _memStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      _memStore.delete(key);
      return null;
    }
    return entry.value;
  },

  set: (key, value, ttlSec) => {
    _memStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSec * 1000,
    });
  },

  del: (key) => {
    _memStore.delete(key);
  },

  clear: () => {
    _memStore.clear();
  },

  /** @returns {number} Current number of live entries */
  size: () => _memStore.size,
};

// ─── Redis Provider ───────────────────────────────────────────────────────
const RedisProvider = {
  get: async (key) => {
    const redis = getRedis();
    if (!redis || !isRedisReady()) return undefined; // signal unavailable
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  },

  set: async (key, value, ttlSec) => {
    const redis = getRedis();
    if (!redis || !isRedisReady()) return;
    await redis.setex(key, ttlSec, JSON.stringify(value));
  },

  del: async (key) => {
    const redis = getRedis();
    if (!redis || !isRedisReady()) return;
    await redis.del(key);
  },

  delPattern: async (pattern) => {
    const redis = getRedis();
    if (!redis || !isRedisReady()) return;
    // Scan instead of KEYS to be production-safe
    let cursor = '0';
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = next;
      if (keys.length) await redis.del(...keys);
    } while (cursor !== '0');
  },
};

// ─── Cache Key ────────────────────────────────────────────────────────────
const _key = (userId) => `permission:${userId}`;

// ─── Public Adapter API ────────────────────────────────────────────────────
const PermissionCache = {
  /**
   * Retrieve cached permissions for a user.
   *
   * @param {string} userId
   * @returns {Promise<string[]|null>} Resolved permission list or null on miss
   */
  get: async (userId) => {
    try {
      const k = _key(userId);

      // Try Redis first
      if (isRedisReady()) {
        try {
          const redisVal = await RedisProvider.get(k);
          if (redisVal !== undefined) {
            // undefined means Redis unavailable; null means key missing
            if (redisVal !== null) {
              _counters.hit++;
              return redisVal;
            }
            // Redis miss — check memory too (in case we wrote there during a Redis outage)
            const memVal = MemoryProvider.get(k);
            if (memVal !== null) {
              _counters.hit++;
              return memVal;
            }
            _counters.miss++;
            return null;
          }
        } catch (redisErr) {
          logger.warn({ err: redisErr.message }, '[PermissionCache] Redis get failed — falling back to memory');
        }
      }

      // Memory fallback
      const memVal = MemoryProvider.get(k);
      if (memVal !== null) {
        _counters.hit++;
        return memVal;
      }
      _counters.miss++;
      return null;
    } catch (err) {
      logger.warn({ err: err.message }, '[PermissionCache] get error — treating as miss');
      _counters.miss++;
      return null;
    }
  },

  /**
   * Store resolved permissions for a user.
   *
   * @param {string} userId
   * @param {string[]} permissions
   * @param {number} [ttlSec=300]
   * @returns {Promise<void>}
   */
  set: async (userId, permissions, ttlSec = DEFAULT_TTL_SECONDS) => {
    try {
      const k = _key(userId);
      // Always write to memory (resilience layer)
      MemoryProvider.set(k, permissions, ttlSec);
      // Best-effort write to Redis
      if (isRedisReady()) {
        try {
          await RedisProvider.set(k, permissions, ttlSec);
        } catch (redisErr) {
          logger.warn({ err: redisErr.message }, '[PermissionCache] Redis set failed — memory-only');
        }
      }
    } catch (err) {
      logger.warn({ err: err.message }, '[PermissionCache] set error — cache write skipped');
    }
  },

  /**
   * Invalidate cached permissions.
   * Triggered by: role change, permission change, branch/tenant assignment change.
   *
   * @param {string|null} [userId] - Specific user or null to flush all
   * @returns {Promise<void>}
   */
  invalidate: async (userId = null) => {
    try {
      _counters.invalidation++;
      if (userId) {
        const k = _key(userId);
        MemoryProvider.del(k);
        if (isRedisReady()) {
          try { await RedisProvider.del(k); } catch { /* silent */ }
        }
      } else {
        // Flush all
        MemoryProvider.clear();
        if (isRedisReady()) {
          try { await RedisProvider.delPattern('permission:*'); } catch { /* silent */ }
        }
      }
    } catch (err) {
      logger.warn({ err: err.message }, '[PermissionCache] invalidate error — ignored');
    }
  },

  /**
   * Expose Prometheus-compatible counters for the Sprint 2 exporter.
   */
  getMetrics: getCacheMetrics,

  /**
   * Expose memory provider size for diagnostics.
   */
  memorySize: () => MemoryProvider.size(),

  /**
   * Default TTL constant (seconds).
   */
  DEFAULT_TTL_SECONDS,

  // Exposed for test isolation
  _memProvider: MemoryProvider,
  _counters,
};

module.exports = PermissionCache;
