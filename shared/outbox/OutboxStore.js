'use strict';
class OutboxStore {
  constructor() { this.queue = []; }
  async enqueue(type, payload) { this.queue.push({ type, payload, status: 'PENDING' }); }
  async markCompleted(id) {}
  async markFailed(id) {}
  async deadLetter(id) {}
}
module.exports = OutboxStore;