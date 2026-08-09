'use strict';
class InboxConsumer {
  constructor(store, handler) { this.store = store; this.handler = handler; }
  async consume(event) {
    if (await this.store.isProcessed(event.id)) return;
    await this.handler(event);
    await this.store.markProcessed(event.id);
  }
}
module.exports = InboxConsumer;