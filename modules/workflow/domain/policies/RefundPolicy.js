'use strict';
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
