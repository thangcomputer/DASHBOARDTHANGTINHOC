'use strict';
class CommandRegistry {
  constructor() { this.handlers = new Map(); }
  register(commandName, handler) {
    if (this.handlers.has(commandName)) throw new Error(`Handler for ${commandName} already registered`);
    this.handlers.set(commandName, handler);
  }
  unregister(commandName) { this.handlers.delete(commandName); }
  resolve(commandName) {
    const handler = this.handlers.get(commandName);
    if (!handler) throw new Error(`No handler registered for ${commandName}`);
    return handler;
  }
}
module.exports = CommandRegistry;
