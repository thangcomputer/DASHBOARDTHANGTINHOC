'use strict';
const invoiceApplicationService = require('../services/InvoiceApplicationService');

class Get_rootHandler {
  async execute(query) {
    return await invoiceApplicationService.get_root(query);
  }
}
module.exports = Get_rootHandler;
