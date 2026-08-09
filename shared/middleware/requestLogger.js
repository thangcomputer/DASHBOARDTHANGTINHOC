const logger = require('../logger/logger');

/**
 * Reusable HTTP Request Logger middleware using Pino.
 */
const requestLogger = (req, res, next) => {
  const start = Date.now();

  // Attach a unique request ID if available
  req.id = req.headers['x-request-id'] || `req_${Math.random().toString(36).substr(2, 9)}`;

  // Once response completes, log the details
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(
      {
        req: {
          id: req.id,
          method: req.method,
          url: req.originalUrl || req.path,
          ip: req.ip || req.socket.remoteAddress,
        },
        res: {
          statusCode: res.statusCode,
        },
        duration: `${duration}ms`,
      },
      'HTTP Request Completed'
    );
  });

  next();
};

module.exports = requestLogger;
