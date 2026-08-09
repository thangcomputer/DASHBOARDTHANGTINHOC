'use strict';
const RequestContext = require('./RequestContext');
// Native Shim representing the SDK foundation 
class OpenTelemetrySDK {
  static getTracer(name) {
    return {
      startSpan: (spanName, options = {}) => {
        const ctx = RequestContext.getContext();
        return {
          spanContext: () => ({
            traceId: ctx.traceId,
            spanId: ctx.spanId
          }),
          setAttribute: () => {},
          end: () => {}
        };
      }
    };
  }
}
module.exports = OpenTelemetrySDK;
