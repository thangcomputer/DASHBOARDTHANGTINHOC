'use strict';
const paymentApplicationService = require('../../services/PaymentApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const PaymentPost_create_sessionCompleted = require('../events/PaymentPost_create_sessionCompleted');

class Post_create_sessionHandler {
  async execute(command) {
    const result = await paymentApplicationService.post_create_session(command);
    await eventBus.publish(new PaymentPost_create_sessionCompleted(command));
    return result;
  }
}
module.exports = Post_create_sessionHandler;
