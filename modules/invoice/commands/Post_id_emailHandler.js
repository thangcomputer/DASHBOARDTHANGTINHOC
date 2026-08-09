'use strict';
const invoiceApplicationService = require('../services/InvoiceApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const InvoicePost_id_emailCompleted = require('../events/InvoicePost_id_emailCompleted');

class Post_id_emailHandler {
  async execute(command) {
    const result = await invoiceApplicationService.post_id_email(command);
    await eventBus.publish(new InvoicePost_id_emailCompleted(command));
    return result;
  }
}
module.exports = Post_id_emailHandler;
