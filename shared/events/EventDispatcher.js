'use strict';
class EventDispatcher {
  constructor(registry) { this.registry = registry; }
  async dispatch(event) {
    const handlers = this.registry.resolve(event.eventName);
    const promises = handlers.map(handler => handler.handle(event));
    await Promise.allSettled(promises);
  }
}
module.exports = EventDispatcher;
