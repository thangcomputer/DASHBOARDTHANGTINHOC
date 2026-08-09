const { getRedis } = require('../../config/redis');
const logger = require('../logger/logger');

const cache = {
  get: async (key) => {
    const client = getRedis();
    if (!client) return null;
    try {
      const data = await client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      logger.warn({ key, err: err.message }, 'Cache get error');
      return null;
    }
  },

  set: async (key, val, ttlSeconds = 300) => {
    const client = getRedis();
    if (!client) return false;
    try {
      const strVal = JSON.stringify(val);
      await client.set(key, strVal, 'EX', ttlSeconds);
      return true;
    } catch (err) {
      logger.warn({ key, err: err.message }, 'Cache set error');
      return false;
    }
  },

  del: async (key) => {
    const client = getRedis();
    if (!client) return false;
    try {
      await client.del(key);
      return true;
    } catch (err) {
      logger.warn({ key, err: err.message }, 'Cache del error');
      return false;
    }
  },

  clearPattern: async (pattern) => {
    const client = getRedis();
    if (!client) return false;
    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(keys);
      }
      return true;
    } catch (err) {
      logger.warn({ pattern, err: err.message }, 'Cache clearPattern error');
      return false;
    }
  },
};

module.exports = cache;
