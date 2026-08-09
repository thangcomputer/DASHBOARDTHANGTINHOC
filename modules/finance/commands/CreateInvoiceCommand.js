'use strict';

class CreateInvoiceCommand {
  constructor(payload) {
    this.studentId = payload.studentId;
    this.branchId = payload.branchId;
    this.courseId = payload.courseId;
    this.amount = payload.amount;
    this.paidAmount = payload.paidAmount;
    this.paymentMethod = payload.paymentMethod;
    this.createdBy = payload.createdBy;
    this.type = payload.type || 'tuition';
    this.status = payload.status || 'paid';
  }
}

module.exports = CreateInvoiceCommand;
