'use strict';
const mongoose = require('mongoose');
const MongoTransaction = require('./MongoTransaction');
class TransactionFactory {
  async begin() {
    // Return a dummy object if disconnected during tests
    if (mongoose.connection.readyState !== 1) return new MongoTransaction(null);
    const session = await mongoose.startSession();
    session.startTransaction();
    return new MongoTransaction(session);
  }
}
module.exports = TransactionFactory;