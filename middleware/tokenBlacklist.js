/**
 * Token blacklist — TTL-based revocation (logout / refresh rotation).
 * Optional Redis (REDIS_URL) for multi-instance; otherwise in-memory Map.
 */

const crypto = require('crypto');
const { getRedis } = require('../config/redis');

function hashToken(token) {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

class TokenBlacklist {
  constructor() {
    this._store = new Map();
    this._cleaner = setInterval(() => {
      const now = Date.now();
      for (const [token, expiresAt] of this._store.entries()) {
        if (expiresAt <= now) this._store.delete(token);
      }
    }, 60_000);
    if (typeof this._cleaner.unref === 'function') this._cleaner.unref();
  }

  /**
   * @param {string} token
   * @param {number} ttlSeconds
   */
  async add(token, ttlSeconds = 28800) {
    if (!token) return;
    const ttlMs = Math.max(1, ttlSeconds) * 1000;
    const key = `jwtbl:${hashToken(token)}`;
    const redis = getRedis();

    if (redis) {
      try {
        await redis.set(key, '1', 'PX', ttlMs);
        return;
      } catch {
        /* fall through to memory */
      }
    }
    this._store.set(token, Date.now() + ttlMs);
  }

  /**
   * @param {string} token
   * @returns {Promise<boolean>}
   */
  async isBlacklisted(token) {
    if (!token) return false;
    const key = `jwtbl:${hashToken(token)}`;
    const redis = getRedis();

    if (redis) {
      try {
        const v = await redis.exists(key);
        return v === 1;
      } catch {
        // fall through to memory
      }
    }

    const expiresAt = this._store.get(token);
    if (!expiresAt) return false;
    if (expiresAt <= Date.now()) {
      this._store.delete(token);
      return false;
    }
    return true;
  }

  get size() {
    return this._store.size;
  }

  async close() {
    if (this._cleaner) clearInterval(this._cleaner);
  }
}

const singleton = new TokenBlacklist();
module.exports = singleton;
module.exports.TokenBlacklist = TokenBlacklist;
module.exports.hashToken = hashToken;
