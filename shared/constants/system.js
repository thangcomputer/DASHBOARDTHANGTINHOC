/**
 * General System Configuration Constants and Invariants.
 */
const SYSTEM = {
  PAGINATION: {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
  },
  TOKEN: {
    ACCESS_EXPIRY: '15m',
    REFRESH_EXPIRY: '7d',
  },
  CACHE: {
    DEFAULT_TTL: 300, // 5 minutes
    LONG_TTL: 3600,   // 1 hour
  },
  SECURITY: {
    SALT_ROUNDS: 12,
    MAX_LOGIN_ATTEMPTS: 5,
    LOCK_TIME: 2 * 60 * 60 * 1000, // 2 hours
  },
};

module.exports = SYSTEM;
