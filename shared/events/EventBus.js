'use strict';

/**
 * In-process event bus for outbox-dispatched domain events.
 * Subscribers must be idempotent (at-least-once delivery).
 */
class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  subscribe(eventName, handler) {
    if (!eventName || typeof handler?.handle !== 'function') {
      throw new Error('EventBus.subscribe requires eventName and handler.handle()');
    }
    const list = this._handlers.get(eventName) || [];
    list.push(handler);
    this._handlers.set(eventName, list);
  }

  async publish(event) {
    const name = event?.eventName || event?.eventType;
    const handlers = this._handlers.get(name) || [];
    for (const h of handlers) {
      await h.handle(event);
    }
  }
}

const eventBus = new EventBus();
module.exports = { EventBus, eventBus };
