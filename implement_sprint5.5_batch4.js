const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const workflowDir = path.join(rootDir, 'modules', 'workflow');

// Create directories
[
  'sagas', 'runtime', 'handlers', 'domain/specifications', 
  'domain/policies', 'events', 'repositories', 'projections'
].forEach(sub => {
  fs.mkdirSync(path.join(workflowDir, sub), { recursive: true });
});

// --- 1. Sagas ---
const enrollmentPaymentSaga = `'use strict';
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
`;
fs.writeFileSync(path.join(workflowDir, 'sagas', 'EnrollmentPaymentSaga.js'), enrollmentPaymentSaga);

const refundSaga = `'use strict';
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
`;
fs.writeFileSync(path.join(workflowDir, 'sagas', 'RefundSaga.js'), refundSaga);

// --- 2. Policies & Specifications ---
const refundPolicy = `'use strict';
const AppError = require('../../../shared/errors/BusinessRuleError');

class RefundPolicy {
  static check(invoice, requestedRefundAmount) {
    if (invoice.status !== 'PAID') {
      throw new AppError('RefundNotAllowed', 'Cannot refund an unpaid invoice.');
    }
    if (requestedRefundAmount > invoice.amount) {
      throw new AppError('RefundNotAllowed', 'Refund cannot exceed paid amount.');
    }
    return true;
  }
}
module.exports = RefundPolicy;
`;
fs.writeFileSync(path.join(workflowDir, 'domain', 'policies', 'RefundPolicy.js'), refundPolicy);

const paymentCompletedSpec = `'use strict';
class PaymentCompletedSpecification {
  isSatisfiedBy(payment) {
    return payment.status === 'COMPLETED' || payment.status === 'CONFIRMED';
  }
}
module.exports = new PaymentCompletedSpecification();
`;
fs.writeFileSync(path.join(workflowDir, 'domain', 'specifications', 'PaymentCompletedSpecification.js'), paymentCompletedSpec);

// --- 3. Workflow Runtime Steps ---
const workflowExecutor = `'use strict';
class WorkflowExecutor {
  constructor(metricsRegistry) {
    this.metrics = metricsRegistry;
  }
  
  async executeStep(step, context) {
    const start = Date.now();
    try {
      const result = await step.execute(context);
      this.metrics.increment('workflow_step_success');
      return result;
    } catch (error) {
      this.metrics.increment('workflow_step_failure');
      if (step.isRetryable) {
        throw new Error('RetryableError'); // triggers async retry
      }
      throw error;
    } finally {
      this.metrics.timing('workflow_step_duration', Date.now() - start);
    }
  }
}
module.exports = WorkflowExecutor;
`;
fs.writeFileSync(path.join(workflowDir, 'runtime', 'WorkflowExecutor.js'), workflowExecutor);

console.log('✅ Sprint 5.5 Batch 4 Cross-Domain Sagas & Workflow Automation Business Logic Implementation generated successfully.');
