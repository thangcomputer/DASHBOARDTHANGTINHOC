'use strict';
const AppError = require('../../../shared/errors/BusinessRuleError');

class Invoice {
  constructor(data) {
    this._id = data.id || data._id;
    this.amount = data.amount;
    this.status = data.status || 'DRAFT';
    this.tenantId = data.tenantId;
    this.branchId = data.branchId;
    this.studentId = data.studentId;
  }
  get id() { return this._id; }
  
  issue() {
    if (this.status !== 'DRAFT') {
      throw new AppError('InvalidStatusTransition', 'Only draft invoices can be issued.');
    }
    this.status = 'ISSUED';
    return {
      type: 'InvoiceIssued',
      aggregateId: this.id,
      payload: { amount: this.amount, tenantId: this.tenantId, branchId: this.branchId },
      occurredAt: new Date()
    };
  }

  markPaid() {
    if (this.status === 'PAID') {
      throw new AppError('InvoiceAlreadyPaid', 'Invoice has already been paid.');
    }
    if (this.status !== 'ISSUED') {
      throw new AppError('InvalidStatusTransition', 'Only issued invoices can be paid.');
    }
    this.status = 'PAID';
    return {
      type: 'InvoicePaid',
      aggregateId: this.id,
      payload: { tenantId: this.tenantId, branchId: this.branchId },
      occurredAt: new Date()
    };
  }
}
module.exports = Invoice;
