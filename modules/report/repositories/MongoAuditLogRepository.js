const AuditLogRepository = require('./AuditLogRepository');
const AuditLog = require('../models/AuditLog');

class MongoAuditLogRepository extends AuditLogRepository {
  constructor() {
    super(AuditLog);
  }
}

module.exports = MongoAuditLogRepository;
