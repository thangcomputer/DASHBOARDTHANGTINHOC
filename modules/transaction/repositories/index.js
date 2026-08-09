const MongoTransactionRepository = require('./MongoTransactionRepository');

module.exports = {
  transactionRepository: new MongoTransactionRepository(),
};
