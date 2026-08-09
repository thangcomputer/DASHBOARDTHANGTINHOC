const PayrollRepository = require('./PayrollRepository');
const PayrollLog = require('../models/PayrollLog');

class MongoPayrollRepository extends PayrollRepository {
  constructor() {
    super(PayrollLog);
  }
}

module.exports = MongoPayrollRepository;
