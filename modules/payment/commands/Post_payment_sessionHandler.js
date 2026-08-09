'use strict';
const paymentApplicationService = require('../../services/PaymentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const PaymentPost_payment_sessionCompleted = require('../events/PaymentPost_payment_sessionCompleted');

class Post_payment_sessionHandler {
  async execute(command) {
    const result = await paymentApplicationService.post_payment_session(command);
    await eventBus.publish(new PaymentPost_payment_sessionCompleted(command));
    return result;
  }
}
module.exports = Post_payment_sessionHandler;
