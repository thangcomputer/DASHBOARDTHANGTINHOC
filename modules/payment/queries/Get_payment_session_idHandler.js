'use strict';
const paymentApplicationService = require('../../services/PaymentApplicationService');

class Get_payment_session_idHandler {
  async execute(query) {
    return await paymentApplicationService.get_payment_session_id(query);
  }
}
module.exports = Get_payment_session_idHandler;
