'use strict';
class InboxStore {
  constructor() { this.processed = new Set(); }
  async isProcessed(id) { return this.processed.has(id); }
  async markProcessed(id) { this.processed.add(id); }
}
module.exports = InboxStore;