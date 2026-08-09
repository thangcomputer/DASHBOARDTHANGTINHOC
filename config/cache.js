'use strict';
module.exports = {
  enabled: process.env.CACHE_ENABLED !== 'false',
  provider: process.env.CACHE_PROVIDER || 'memory',
  defaultTTL: parseInt(process.env.CACHE_DEFAULT_TTL, 10) || 60 * 5, // 5 minutes
  compression: true,
  stampedeProtection: true,
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
};