const MongoCreditNoteRepository = require('./MongoCreditNoteRepository');
const MongoFinanceDailySnapshotRepository = require('./MongoFinanceDailySnapshotRepository');
const MongoLedgerRepository = require('./MongoLedgerRepository');
const MongoPayrollRepository = require('./MongoPayrollRepository');

module.exports = {
  creditNoteRepository: new MongoCreditNoteRepository(),
  financeDailySnapshotRepository: new MongoFinanceDailySnapshotRepository(),
  ledgerRepository: new MongoLedgerRepository(),
  payrollRepository: new MongoPayrollRepository(),
};
