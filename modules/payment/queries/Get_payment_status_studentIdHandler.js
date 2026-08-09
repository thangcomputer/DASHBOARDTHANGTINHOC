'use strict';
const paymentApplicationService = require('../../services/PaymentApplicationService');

class Get_payment_status_studentIdHandler {
  async execute(query) {
    return await paymentApplicationService.get_payment_status_studentId(query);
  }
}
module.exports = Get_payment_status_studentIdHandler;
