'use strict';
const { AsyncLocalStorage } = require('async_hooks');
const storage = new AsyncLocalStorage();
class TransactionContext {
  static run(tx, fn) { return storage.run(tx, fn); }
  static current() { return storage.getStore(); }
}
module.exports = TransactionContext;