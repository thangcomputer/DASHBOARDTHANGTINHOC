'use strict';
const transactionApplicationService = require('../../services/TransactionApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const TransactionDelete_idCompleted = require('../events/TransactionDelete_idCompleted');

class Delete_idHandler {
  async execute(command) {
    const result = await transactionApplicationService.delete_id(command);
    await eventBus.publish(new TransactionDelete_idCompleted(command));
    return result;
  }
}
module.exports = Delete_idHandler;
