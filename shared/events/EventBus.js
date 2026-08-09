'use strict';
const OutboxPublisher = require('../outbox/OutboxPublisher');
const OutboxStore = require('../outbox/OutboxStore');

const outboxPublisher = new OutboxPublisher(new OutboxStore());

class EventBus {
  constructor(dispatcher, observabilityHooks = []) {
    this.dispatcher = dispatcher;
    this.hooks = observabilityHooks;
  }
  async publish(event) {
    for (const hook of this.hooks) if (hook.beforeExecute) await hook.beforeExecute(event);
    try {
      // Direct in-memory dispatch to handlers (called by OutboxWorker after transaction commit)
      await this.dispatcher.dispatch(event); 
      
      for (const hook of this.hooks) if (hook.afterExecute) await hook.afterExecute(event);
    } catch (err) {
      for (const hook of this.hooks) if (hook.onError) await hook.onError(event, err);
      throw err;
    }
  }
  subscribe(eventName, handler) { this.dispatcher.registry.register(eventName, handler); }
  unsubscribe(eventName, handler) { this.dispatcher.registry.unregister(eventName, handler); }
}
module.exports = EventBus;