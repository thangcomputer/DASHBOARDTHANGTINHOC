'use strict';
const RequestContext = require('./RequestContext');
const crypto = require('crypto');

class Tracer {
  static async startSpan(name, fn) {
    const parentContext = RequestContext.getContext();
    const spanContext = {
      ...parentContext,
      spanId: crypto.randomBytes(8).toString('hex'), // new span id
      parentSpanId: parentContext.spanId || null,
      operation: name
    };
    
    return await RequestContext.run(spanContext, async () => {
      const start = process.hrtime.bigint();
      const result = await fn();
      const end = process.hrtime.bigint();
      // duration unused, but could be logged if needed
      return result;
    });
  }
}
module.exports = Tracer;
