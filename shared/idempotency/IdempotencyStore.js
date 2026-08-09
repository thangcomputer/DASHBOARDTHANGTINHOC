'use strict';
class IdempotencyStore {
  constructor() { this.cache = new Map(); }
  async get(key) { return this.cache.get(key); }
  async save(key, data, ttl = 86400) { this.cache.set(key, data); }
}
module.exports = IdempotencyStore;