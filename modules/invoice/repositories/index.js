const MongoInvoiceRepository = require('./MongoInvoiceRepository');

module.exports = {
  invoiceRepository: new MongoInvoiceRepository(),
};
