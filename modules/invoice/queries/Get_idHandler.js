'use strict';
const invoiceApplicationService = require('../services/InvoiceApplicationService');

class Get_idHandler {
  async execute(query) {
    return await invoiceApplicationService.get_id(query);
  }
}
module.exports = Get_idHandler;
