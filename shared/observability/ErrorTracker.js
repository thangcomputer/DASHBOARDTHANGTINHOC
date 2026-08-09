'use strict';
const Logger = require('./Logger');
const RequestContext = require('./RequestContext');

class ErrorTracker {
  static track(err, metadata = {}) {
    const ctx = RequestContext.getContext();
    const type = this.classifyError(err);
    
    Logger.error(err.message, err, {
      ...metadata,
      errorType: type,
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      traceId: ctx.traceId
    });
  }

  static classifyError(err) {
    if (err.name === 'ValidationError') return 'Validation Error';
    if (err.code === 'PERMISSION_DENIED') return 'Authorization Error';
    if (err.name === 'MongoError' || err.name === 'MongoServerError') return 'Repository Error';
    if (err.isCommandError) return 'Command Error';
    if (err.isQueryError) return 'Query Error';
    return 'Unhandled Exception';
  }
}
module.exports = ErrorTracker;
