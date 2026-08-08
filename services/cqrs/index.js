'use strict';

/**
 * Barrel export for CQRS services (flat layout — not a phantom modules/ mount).
 */
module.exports = {
  createTeacherCqrs: require('./createTeacherCqrs').createTeacherCqrs,
  createInvoiceCqrs: require('./createInvoiceCqrs').createInvoiceCqrs,
  payStudentCqrs: require('./payStudentCqrs').payStudentCqrs,
  refundStudentCqrs: require('./refundStudentCqrs').refundStudentCqrs,
  payEnrollmentCqrs: require('./payEnrollmentCqrs').payEnrollmentCqrs,
  addEnrollmentPaidCqrs: require('./addEnrollmentPaidCqrs').addEnrollmentPaidCqrs,
  cancelEnrollmentCqrs: require('./cancelEnrollmentCqrs').cancelEnrollmentCqrs,
  sepaySettleSessionCqrs: require('./sepaySettleCqrs').sepaySettleSessionCqrs,
  sepaySettleStudentCqrs: require('./sepaySettleCqrs').sepaySettleStudentCqrs,
  payTeacherFlexibleCqrs: require('./payTeacherFlexibleCqrs').payTeacherFlexibleCqrs,
  payTeacherAllCqrs: require('./payTeacherAllCqrs').payTeacherAllCqrs,
  confirmTransactionCqrs: require('./salaryTransactionCqrs').confirmTransactionCqrs,
  cancelTransactionCqrs: require('./salaryTransactionCqrs').cancelTransactionCqrs,
  voidLedgerCqrs: require('./salaryTransactionCqrs').voidLedgerCqrs,
  postDiscountCqrs: require('./postDiscountCqrs').postDiscountCqrs,
  createTuitionInvoice: require('./tuitionInvoice').createTuitionInvoice,
  nextInvoiceCode: require('./tuitionInvoice').nextInvoiceCode,
};
