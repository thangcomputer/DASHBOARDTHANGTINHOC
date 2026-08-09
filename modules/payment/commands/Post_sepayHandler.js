'use strict';
const paymentApplicationService = require('../../services/PaymentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const PaymentPost_sepayCompleted = require('../events/PaymentPost_sepayCompleted');

class Post_sepayHandler {
  async execute(command) {
    const result = await paymentApplicationService.post_sepay(command);
    await eventBus.publish(new PaymentPost_sepayCompleted(command));
    return result;
  }
}
module.exports = Post_sepayHandler;
