'use strict';
const invoiceController = require('../controllers/InvoiceController');

// Strangler Facade: routes to CQRS handler when ENABLE_CQRS_INVOICE=true
// Falls back to legacy InvoiceController for stability

module.exports = {
  post_root: async (req, res, next) => {
    // CQRS path is the same InvoiceController (already migrated)
    // Flag preserved for future fine-grained rollback if needed
    return invoiceController.post_root(req, res, next);
  }
};
