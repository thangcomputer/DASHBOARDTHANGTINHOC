'use strict';
const RequestContext = require('./RequestContext');

class LoggerService {
  static formatMessage(level, message, metadata = {}, err = null) {
    const ctx = RequestContext.getContext();
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      requestId: ctx.requestId || null,
      correlationId: ctx.correlationId || null,
      traceId: ctx.traceId || null,
      tenantId: ctx.tenantId || null,
      branchId: ctx.branchId || null,
      userId: ctx.userId || null,
      module: metadata.module || null,
      operation: metadata.operation || null,
      duration: metadata.duration || null,
      status: metadata.status || null,
      error: err ? { message: err.message, stack: err.stack, code: err.code } : null,
      message,
      metadata
    });
  }

  static info(message, metadata = {}) {
    console.log(this.formatMessage('info', message, metadata));
  }
  
  static warn(message, metadata = {}) {
    console.warn(this.formatMessage('warn', message, metadata));
  }
  
  static error(message, err = null, metadata = {}) {
    console.error(this.formatMessage('error', message, metadata, err));
  }
}
module.exports = LoggerService;
