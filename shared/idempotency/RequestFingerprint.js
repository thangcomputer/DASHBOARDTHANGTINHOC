'use strict';
class RequestFingerprint {
  static create(req) { return `${req.correlationId}-${req.requestId}`; }
}
module.exports = RequestFingerprint;