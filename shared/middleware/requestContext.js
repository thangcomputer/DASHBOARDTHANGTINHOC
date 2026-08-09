const crypto = require('crypto');
const correlationContext = require('../context/correlationContext');

const uuidv4 = () => {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
};

/**
 * Middleware to establish Request ID and Correlation ID context.
 */
const requestContext = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || uuidv4();
  const requestId = uuidv4();

  req.requestId = requestId;
  req.correlationId = correlationId;
  req.id = requestId; // legacy compatibility mapping for older request-id logic

  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);

  correlationContext.run({ requestId, correlationId }, () => {
    next();
  });
};

module.exports = requestContext;
