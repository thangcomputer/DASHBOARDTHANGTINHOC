'use strict';
class RetryExecutor {
  constructor(policy) { this.policy = policy; }
  async execute(fn) {
    let attempts = 0;
    while (attempts < this.policy.maxRetries) {
      try { return await fn(); }
      catch (e) { attempts++; if (attempts >= this.policy.maxRetries) throw e; }
    }
  }
}
module.exports = RetryExecutor;