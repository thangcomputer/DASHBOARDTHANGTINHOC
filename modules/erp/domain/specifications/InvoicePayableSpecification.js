'use strict';
class InvoicePayableSpecification {
  isSatisfiedBy(invoice) {
    return invoice.status === 'ISSUED';
  }
}
module.exports = new InvoicePayableSpecification();
