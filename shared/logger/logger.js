const pino = require('pino');
const correlationContext = require('../context/correlationContext');

const isProd = process.env.NODE_ENV === 'production';

const logger = pino({
  level: process.env.LOG_LEVEL || (isProd ? 'info' : 'debug'),
  mixin() {
    const store = correlationContext.getStore();
    if (store) {
      return {
        requestId: store.requestId,
        correlationId: store.correlationId,
      };
    }
    return {};
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      '*.password',
      '*.token',
      '*.refreshToken',
      '*.accessToken',
      '*.JWT_SECRET',
      '*.JWT_REFRESH_SECRET',
    ],
    censor: '[REDACTED]',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
});

module.exports = logger;
