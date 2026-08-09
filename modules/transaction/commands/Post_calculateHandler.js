'use strict';
const transactionApplicationService = require('../../services/TransactionApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const TransactionPost_calculateCompleted = require('../events/TransactionPost_calculateCompleted');

class Post_calculateHandler {
  async execute(command) {
    const result = await transactionApplicationService.post_calculate(command);
    await eventBus.publish(new TransactionPost_calculateCompleted(command));
    return result;
  }
}
module.exports = Post_calculateHandler;
