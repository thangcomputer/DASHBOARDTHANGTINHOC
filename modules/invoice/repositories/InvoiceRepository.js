const BaseRepository = require('../../../shared/repositories/BaseRepository');

class InvoiceRepository extends BaseRepository {
  async aggregateInvoiceTotals(match) { throw new Error('Not implemented'); }
}

module.exports = InvoiceRepository;
