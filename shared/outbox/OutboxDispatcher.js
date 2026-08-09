'use strict';
class OutboxDispatcher {
  constructor(bus) { this.bus = bus; }
  async dispatch(event) { return this.bus.publish(event); }
}
module.exports = OutboxDispatcher;