'use strict';
const { AsyncLocalStorage } = require('async_hooks');
const crypto = require('crypto');

const asyncLocalStorage = new AsyncLocalStorage();

class RequestContext {
  static run(initialContext, fn) {
    const context = {
      requestId: initialContext.requestId || crypto.randomUUID(),
      correlationId: initialContext.correlationId || crypto.randomUUID(),
      traceId: initialContext.traceId || crypto.randomUUID(),
      spanId: initialContext.spanId || crypto.randomBytes(8).toString('hex'),
      tenantId: initialContext.tenantId || null,
      branchId: initialContext.branchId || null,
      userId: initialContext.userId || null,
      sessionId: initialContext.sessionId || null,
      ...initialContext
    };
    return asyncLocalStorage.run(context, fn);
  }

  static getContext() {
    return asyncLocalStorage.getStore() || {};
  }

  static set(key, value) {
    const store = asyncLocalStorage.getStore();
    if (store) store[key] = value;
  }
}
module.exports = RequestContext;
