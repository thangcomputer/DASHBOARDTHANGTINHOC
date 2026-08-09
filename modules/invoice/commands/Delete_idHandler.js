'use strict';
const invoiceApplicationService = require('../services/InvoiceApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const InvoiceDelete_idCompleted = require('../events/InvoiceDelete_idCompleted');

class Delete_idHandler {
  async execute(command) {
    const result = await invoiceApplicationService.delete_id(command);
    await eventBus.publish(new InvoiceDelete_idCompleted(command));
    return result;
  }
}
module.exports = Delete_idHandler;
