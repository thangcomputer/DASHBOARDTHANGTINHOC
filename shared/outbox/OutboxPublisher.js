'use strict';
class OutboxPublisher {
  constructor(store) { this.store = store; }
  async publish(eventType, payload) { return this.store.enqueue(eventType, payload); }
}
module.exports = OutboxPublisher;