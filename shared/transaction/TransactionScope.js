'use strict';
class TransactionScope {
  constructor(manager) { this.manager = manager; }
  async requireNew(fn) { return this.manager.execute(fn); }
}
module.exports = TransactionScope;