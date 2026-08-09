'use strict';
const TransactionContext = require('../../../shared/transaction/TransactionContext');
const OutboxEvent = require('../../../shared/outbox/OutboxEvent');
const invoiceApplicationService = require('../services/InvoiceApplicationService');

class Post_rootHandler {
  async execute(command) {
    const tx = TransactionContext.current();
    if (!tx || !tx.session) {
      throw new Error('Post_rootHandler must be executed within a transaction context.');
    }

    // Set skipSideEffects to true for CQRS path to defer PDF generation to outbox subscriber
    const serviceData = {
      ...command,
      skipSideEffects: true
    };

    const result = await invoiceApplicationService.post_root(serviceData);

    if (result && result._status === 201 && result._body && result._body.success) {
      const invoice = result._body.data;
      
      await OutboxEvent.create([{
        eventType: 'InvoiceCreatedEvent',
        aggregateId: invoice._id,
        aggregateType: 'Invoice',
        payload: {
          invoiceId: invoice._id.toString(),
          maHoaDon: invoice.maHoaDon
        },
        status: 'PENDING'
      }], { session: tx.session });
    }

    return result;
  }
}

module.exports = Post_rootHandler;
