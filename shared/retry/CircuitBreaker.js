'use strict';
class CircuitBreaker {
  constructor() { this.state = 'CLOSED'; }
  recordSuccess() { this.state = 'CLOSED'; }
  recordFailure() { this.state = 'OPEN'; }
}
module.exports = CircuitBreaker;