'use strict';
const config = require('../../config/cache');
const Metrics = require('../observability/Metrics');

class MemoryCacheProvider {
  constructor() { this.store = new Map(); }
  async get(key) { return this.store.get(key); }
  async set(key, value, ttl) { this.store.set(key, value); } // TTL omitted for brevity in mock
}

class RedisCacheProvider {
  async get(key) { return null; /* Readiness only */ }
  async set(key, value, ttl) {}
}

class CacheManager {
  constructor() {
    this.provider = config.provider === 'redis' ? new RedisCacheProvider() : new MemoryCacheProvider();
  }
  
  async get(key) {
    if (!config.enabled) return null;
    const val = await this.provider.get(key);
    if (val) Metrics.inc('cache_hit');
    else Metrics.inc('cache_miss');
    return val;
  }
  
  async set(key, value, ttl = config.defaultTTL) {
    if (!config.enabled) return;
    await this.provider.set(key, value, ttl);
  }
}
module.exports = new CacheManager();