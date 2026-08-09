const SystemLogRepository = require('./SystemLogRepository');
const SystemLog = require('../models/SystemLog');

class MongoSystemLogRepository extends SystemLogRepository {
  constructor() {
    super(SystemLog);
  }
}

module.exports = MongoSystemLogRepository;
