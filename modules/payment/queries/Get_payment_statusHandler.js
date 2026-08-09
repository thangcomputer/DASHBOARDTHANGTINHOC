'use strict';
const paymentApplicationService = require('../../services/PaymentApplicationService');

class Get_payment_statusHandler {
  async execute(query) {
    return await paymentApplicationService.get_payment_status(query);
  }
}
module.exports = Get_payment_statusHandler;
