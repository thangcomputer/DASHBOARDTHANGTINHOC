'use strict';
const invoiceApplicationService = require('../services/InvoiceApplicationService');

class Get_id_pdfHandler {
  async execute(query) {
    return await invoiceApplicationService.get_id_pdf(query);
  }
}
module.exports = Get_id_pdfHandler;
