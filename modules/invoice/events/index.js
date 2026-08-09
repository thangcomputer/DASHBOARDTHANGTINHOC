'use strict';
const { eventBus } = require('../../../shared/cqrs');
const { enqueueInvoicePdf } = require('../../../services/queue/jobQueue');

eventBus.subscribe('InvoicePost_rootCompleted', { handle: async (event) => console.log('[Invoice Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('InvoicePost_id_pdf_queueCompleted', { handle: async (event) => console.log('[Invoice Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('InvoicePost_id_emailCompleted', { handle: async (event) => console.log('[Invoice Event Handler]', event.eventName, 'processed successfully.') });
eventBus.subscribe('InvoiceDelete_idCompleted', { handle: async (event) => console.log('[Invoice Event Handler]', event.eventName, 'processed successfully.') });

// Outbox-driven subscriber for InvoiceCreatedEvent
eventBus.subscribe('InvoiceCreatedEvent', {
  handle: async (event) => {
    console.log('[Invoice Event Handler] InvoiceCreatedEvent received for aggregateId:', event.aggregateId);
    const invoiceId = event.payload.invoiceId;
    if (invoiceId) {
      await enqueueInvoicePdf({ invoiceId });
      console.log('[Invoice Event Handler] Successfully enqueued PDF generation for invoice:', invoiceId);
    }
  }
});
