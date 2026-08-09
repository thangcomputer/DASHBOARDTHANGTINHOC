'use strict';
class RetryPolicy {
  constructor(maxRetries, strategy) { this.maxRetries = maxRetries; this.strategy = strategy; }
}
module.exports = RetryPolicy;