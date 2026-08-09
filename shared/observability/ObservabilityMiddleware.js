'use strict';
const RequestContext = require('./RequestContext');
const Logger = require('./Logger');
const Metrics = require('./Metrics');
const ErrorTracker = require('./ErrorTracker');
const crypto = require('crypto');

function observabilityMiddleware(req, res, next) {
  const initialContext = {
    requestId: req.headers['x-request-id'] || crypto.randomUUID(),
    correlationId: req.headers['x-correlation-id'] || crypto.randomUUID(),
    traceId: req.headers['x-trace-id'] || crypto.randomUUID(),
    tenantId: req.headers['x-tenant-id'] || null,
    branchId: req.headers['x-branch-id'] || null,
    userId: req.user ? (req.user.id || req.user._id) : null,
    sessionId: req.headers['x-session-id'] || null
  };

  RequestContext.run(initialContext, () => {
    Metrics.inc('http_requests_total', { method: req.method, path: req.path });
    const start = process.hrtime.bigint();
    
    // Attach listener to capture finish
    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000;
      Metrics.observe('http_request_duration_ms', { method: req.method, path: req.path, status: res.statusCode }, duration);
      
      if (res.statusCode >= 500) {
        Logger.error('HTTP Request Failed', null, { method: req.method, path: req.path, status: res.statusCode, duration });
      } else {
        Logger.info('HTTP Request Finished', { method: req.method, path: req.path, status: res.statusCode, duration });
      }
    });

    next();
  });
}

function globalErrorHandler(err, req, res, _next) {
  ErrorTracker.track(err, { method: req.method, path: req.path });
  res.status(err.status || 500).json({ success: false, message: 'Internal Server Error', errorId: RequestContext.getContext().requestId });
}

module.exports = { observabilityMiddleware, globalErrorHandler };
