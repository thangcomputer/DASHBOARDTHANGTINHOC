'use strict';
class QueryRegistry {
  constructor() { this.handlers = new Map(); }
  register(queryName, handler) {
    if (this.handlers.has(queryName)) throw new Error(`Handler for ${queryName} already registered`);
    this.handlers.set(queryName, handler);
  }
  unregister(queryName) { this.handlers.delete(queryName); }
  resolve(queryName) {
    const handler = this.handlers.get(queryName);
    if (!handler) throw new Error(`No handler registered for ${queryName}`);
    return handler;
  }
}
module.exports = QueryRegistry;
