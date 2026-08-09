'use strict';
const AppError = require('../../../shared/errors/BusinessRuleError');

class EnrollmentPaymentSaga {
  constructor(commandBus, eventBus) {
    this.commandBus = commandBus;
    this.eventBus = eventBus;
  }

  async handleEnrollmentRequested(event) {
    // Lead Created -> Student Created -> Enrollment Requested
    const { payload, traceId } = event;
    try {
      // Transition to Invoice Issued
      await this.commandBus.dispatch({
        type: 'IssueInvoiceCommand',
        payload: { enrollmentId: payload.enrollmentId, amount: payload.amount },
        traceId
      });
    } catch (err) {
      await this.compensateEnrollment(payload.enrollmentId, traceId);
    }
  }

  async handleInvoicePaid(event) {
    const { payload, traceId } = event;
    try {
      // Payment Confirmed -> Enrollment Activated
      await this.commandBus.dispatch({
        type: 'ActivateEnrollmentCommand',
        payload: { invoiceId: payload.invoiceId, enrollmentId: payload.enrollmentId },
        traceId
      });
    } catch (err) {
      await this.compensatePayment(payload.invoiceId, traceId);
    }
  }

  async compensateEnrollment(enrollmentId, traceId) {
    await this.commandBus.dispatch({
      type: 'CancelEnrollmentCommand',
      payload: { enrollmentId },
      traceId
    });
  }

  async compensatePayment(invoiceId, traceId) {
    await this.commandBus.dispatch({
      type: 'ReverseInvoiceCommand',
      payload: { invoiceId },
      traceId
    });
  }
}
module.exports = EnrollmentPaymentSaga;
