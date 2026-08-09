'use strict';
class SagaContext {
  constructor(transactionId, state) {
    this.transactionId = transactionId;
    this.state = state || {};
  }
}
module.exports = SagaContext;