const PaymentSessionRepository = require('./PaymentSessionRepository');
const PaymentSession = require('../models/PaymentSession');

class MongoPaymentSessionRepository extends PaymentSessionRepository {
  constructor() {
    super(PaymentSession);
  }
}

module.exports = MongoPaymentSessionRepository;
