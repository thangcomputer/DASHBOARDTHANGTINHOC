'use strict';
const Invoice = require('../../models/Invoice');
const InvoicePayableSpecification = require('../../domain/specifications/InvoicePayableSpecification');
const AppError = require('../../../shared/errors/BusinessRuleError');

class PayInvoiceHandler {
  constructor(invoiceRepo, eventBus, outbox) {
    this.invoiceRepo = invoiceRepo;
    this.eventBus = eventBus;
    this.outbox = outbox;
  }
  
  async handle(command) {
    const { invoiceId, tenantId, branchId, traceId } = command;
    
    const invoiceData = await this.invoiceRepo.findById(invoiceId);
    if (!invoiceData) throw new AppError('NotFound', 'Invoice not found');
    
    const invoice = new Invoice(invoiceData);
    
    if (!InvoicePayableSpecification.isSatisfiedBy(invoice)) {
      throw new AppError('InvoiceClosed', 'Invoice is not payable.');
    }
    
    const event = invoice.markPaid();
    event.traceId = traceId;
    
    // Simulate transaction boundary
    await this.invoiceRepo.save(invoice);
    await this.outbox.saveEvent(event);
    await this.eventBus.publish(event);
    
    return { success: true, invoiceId: invoice.id };
  }
}
module.exports = PayInvoiceHandler;
