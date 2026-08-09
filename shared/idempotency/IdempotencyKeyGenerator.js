'use strict';
const crypto = require('crypto');
class IdempotencyKeyGenerator {
  generate(req) {
    const raw = `${req.method}:${req.url}:${req.userId}:${req.tenantId}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }
}
module.exports = IdempotencyKeyGenerator;