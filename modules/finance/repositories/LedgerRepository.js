const BaseRepository = require('../../../shared/repositories/BaseRepository');

class LedgerRepository extends BaseRepository {
  async aggregateTotalsByType(match) { throw new Error('Not implemented'); }
  async aggregateTotalsByDateAndBranch(match) { throw new Error('Not implemented'); }
  async aggregateRevenueByCourse(match, limit) { throw new Error('Not implemented'); }
  async aggregateNetRevenueByDay(match) { throw new Error('Not implemented'); }
}

module.exports = LedgerRepository;
