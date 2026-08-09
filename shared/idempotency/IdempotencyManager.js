'use strict';
class IdempotencyManager {
  constructor(store, generator) { this.store = store; this.generator = generator; }
  async execute(req, workFn) {
    const key = this.generator.generate(req);
    const existing = await this.store.get(key);
    if (existing) return existing;
    const result = await workFn();
    await this.store.save(key, result);
    return result;
  }
}
module.exports = IdempotencyManager;