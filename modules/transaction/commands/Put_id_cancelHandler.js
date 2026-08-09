'use strict';
const transactionApplicationService = require('../../services/TransactionApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const TransactionPut_id_cancelCompleted = require('../events/TransactionPut_id_cancelCompleted');

class Put_id_cancelHandler {
  async execute(command) {
    const result = await transactionApplicationService.put_id_cancel(command);
    await eventBus.publish(new TransactionPut_id_cancelCompleted(command));
    return result;
  }
}
module.exports = Put_id_cancelHandler;
