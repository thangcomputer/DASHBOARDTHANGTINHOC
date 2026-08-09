const TeacherRepository = require('./TeacherRepository');
const Teacher = require('../models/Teacher');
const TransactionContext = require('../../../shared/transaction/TransactionContext');

class MongoTeacherRepository extends TeacherRepository {
  constructor() {
    super(Teacher);
  }

  _getSession(options = {}) {
    if (options.session !== undefined) {
      return options.session;
    }
    const tx = TransactionContext.current();
    return tx ? (tx.session || tx) : undefined;
  }

  async create(data, options = {}) {
    options.session = this._getSession(options);
    return super.create(data, options);
  }
}

module.exports = MongoTeacherRepository;
