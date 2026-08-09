'use strict';
class OutboxPoller {
  constructor(store, dispatcher) { this.store = store; this.dispatcher = dispatcher; }
  async poll() { /* Polling logic */ }
}
module.exports = OutboxPoller;