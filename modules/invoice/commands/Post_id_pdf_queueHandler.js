'use strict';
const invoiceApplicationService = require('../services/InvoiceApplicationService');
const { eventBus } = require('../../../shared/cqrs');
const InvoicePost_id_pdf_queueCompleted = require('../events/InvoicePost_id_pdf_queueCompleted');

class Post_id_pdf_queueHandler {
  async execute(command) {
    const result = await invoiceApplicationService.post_id_pdf_queue(command);
    await eventBus.publish(new InvoicePost_id_pdf_queueCompleted(command));
    return result;
  }
}
module.exports = Post_id_pdf_queueHandler;
