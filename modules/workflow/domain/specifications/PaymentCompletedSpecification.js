'use strict';
class PaymentCompletedSpecification {
  isSatisfiedBy(payment) {
    return payment.status === 'COMPLETED' || payment.status === 'CONFIRMED';
  }
}
module.exports = new PaymentCompletedSpecification();
