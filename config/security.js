'use strict';
module.exports = {
  helmet: {
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
      useDefaults: true,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    } : false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  },
  cors: {
    credentials: true
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 1000, // per windowMs
    message: 'Too many requests from this IP, please try again later.'
  },
  payload: {
    jsonLimit: process.env.JSON_BODY_LIMIT || '50kb',
    urlEncodedLimit: process.env.URL_ENCODED_LIMIT || '50kb',
    timeoutMs: parseInt(process.env.REQUEST_TIMEOUT, 10) || 30000
  },
  auth: {
    clockTolerance: 30, // seconds
    maxFailedAttempts: 5
  }
};