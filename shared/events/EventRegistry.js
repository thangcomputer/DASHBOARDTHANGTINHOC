'use strict';
class EventRegistry {
  constructor() { this.subscribers = new Map(); }
  register(eventName, handler) {
    if (!this.subscribers.has(eventName)) this.subscribers.set(eventName, []);
    this.subscribers.get(eventName).push(handler);
  }
  unregister(eventName, handler) {
    const handlers = this.subscribers.get(eventName);
    if (handlers) {
      this.subscribers.set(eventName, handlers.filter(h => h !== handler));
    }
  }
  resolve(eventName) { return this.subscribers.get(eventName) || []; }
}
module.exports = EventRegistry;
