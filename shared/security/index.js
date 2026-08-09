'use strict';
const SecurityHeaders = require('./SecurityHeaders');
const CorsHardening = require('./CorsHardening');
const RateLimiter = require('./RateLimiter');
const { requestTimeout, safeJsonParser, urlEncodedParser, hppProtection } = require('./AttackProtection');

module.exports = {
  globalSecurityMiddleware: [
    requestTimeout,
    SecurityHeaders,
    CorsHardening,
    RateLimiter,
    safeJsonParser,
    urlEncodedParser,
    hppProtection
  ]
};