'use strict';
class RefundSaga {
  constructor(commandBus) {
    this.commandBus = commandBus;
  }
  
  async handleRefundRequested(event) {
    const { payload, traceId } = event;
    // Refund Requested -> Enrollment Cancelled
    await this.commandBus.dispatch({
      type: 'CancelEnrollmentCommand',
      payload: { enrollmentId: payload.enrollmentId },
      traceId
    });
    // Reverse Invoice
    await this.commandBus.dispatch({
      type: 'ReverseInvoiceCommand',
      payload: { invoiceId: payload.invoiceId },
      traceId
    });
    // Release Inventory
    if (payload.inventoryId) {
      await this.commandBus.dispatch({
        type: 'ReleaseInventoryCommand',
        payload: { inventoryId: payload.inventoryId, amount: payload.amount },
        traceId
      });
    }
    // Saga Completed event is emitted by the last handler or a SagaCoordinator
  }
}
module.exports = RefundSaga;
