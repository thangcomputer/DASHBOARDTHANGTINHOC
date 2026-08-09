const ScheduleRepository = require('./ScheduleRepository');
const Schedule = require('../models/Schedule');
const TransactionContext = require('../../../shared/transaction/TransactionContext');

class MongoScheduleRepository extends ScheduleRepository {
  constructor() {
    super(Schedule);
  }

  _getSession(options = {}) {
    if (options.session !== undefined) {
      return options.session;
    }
    const context = TransactionContext.current();
    return context?.session;
  }

  async create(data, options = {}) {
    return super.create(data, { ...options, session: this._getSession(options) });
  }

  async updateById(id, updateData, options = {}) {
    return super.updateById(id, updateData, { ...options, session: this._getSession(options) });
  }

  async deleteById(id, options = {}) {
    return super.deleteById(id, { ...options, session: this._getSession(options) });
  }

  async findMany(filter = {}, options = {}) {
    return super.findMany(filter, { ...options, session: this._getSession(options) });
  }

  async findOne(filter, options = {}) {
    return super.findOne(filter, { ...options, session: this._getSession(options) });
  }

  async count(filter = {}, options = {}) {
    return super.count(filter, { ...options, session: this._getSession(options) });
  }

  async findById(id, options = {}) {
    return super.findById(id, { ...options, session: this._getSession(options) });
  }
}

module.exports = MongoScheduleRepository;
