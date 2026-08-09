const FinanceDailySnapshotRepository = require('./FinanceDailySnapshotRepository');
const FinanceDailySnapshot = require('../models/FinanceDailySnapshot');

class MongoFinanceDailySnapshotRepository extends FinanceDailySnapshotRepository {
  constructor() {
    super(FinanceDailySnapshot);
  }
}

module.exports = MongoFinanceDailySnapshotRepository;
