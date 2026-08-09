const TransactionRepository = require('./TransactionRepository');
const Transaction = require('../models/Transaction');

class MongoTransactionRepository extends TransactionRepository {
  constructor() {
    super(Transaction);
  }
}

module.exports = MongoTransactionRepository;
