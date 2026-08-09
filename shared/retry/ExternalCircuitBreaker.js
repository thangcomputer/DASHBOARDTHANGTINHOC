'use strict';
const CircuitBreaker = require('./CircuitBreaker');
const Metrics = require('../observability/Metrics');

class ExternalCircuitBreaker {
  constructor(name) {
    this.name = name;
    this.breaker = new CircuitBreaker();
  }
  async execute(fn) {
    if (this.breaker.state === 'OPEN') {
      Metrics.inc('circuit_breaker_open', { target: this.name });
      throw new Error('Circuit Breaker OPEN for ' + this.name);
    }
    try {
      const res = await fn();
      this.breaker.recordSuccess();
      return res;
    } catch(e) {
      this.breaker.recordFailure();
      Metrics.inc('circuit_breaker_failure', { target: this.name });
      throw e;
    }
  }
}
module.exports = ExternalCircuitBreaker;