'use strict';
class BackoffStrategy {
  static exponential(attempt) { return Math.pow(2, attempt) * 1000; }
  static fixed(attempt, delay = 1000) { return delay; }
}
module.exports = BackoffStrategy;