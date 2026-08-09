'use strict';
const transactionApplicationService = require('../../services/TransactionApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const TransactionPost_rootCompleted = require('../events/TransactionPost_rootCompleted');

class Post_rootHandler {
  async execute(command) {
    const result = await transactionApplicationService.post_root(command);
    await eventBus.publish(new TransactionPost_rootCompleted(command));
    return result;
  }
}
module.exports = Post_rootHandler;
