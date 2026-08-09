'use strict';
const invoiceApplicationService = require('../services/InvoiceApplicationService');

class Get_statsHandler {
  async execute(query) {
    return await invoiceApplicationService.get_stats(query);
  }
}
module.exports = Get_statsHandler;
