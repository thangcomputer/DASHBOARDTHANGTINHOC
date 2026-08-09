const MongoAuditLogRepository = require('./MongoAuditLogRepository');
const MongoBackupJobRepository = require('./MongoBackupJobRepository');
const MongoReportDefinitionRepository = require('./MongoReportDefinitionRepository');
const MongoSystemLogRepository = require('./MongoSystemLogRepository');

module.exports = {
  auditLogRepository: new MongoAuditLogRepository(),
  backupJobRepository: new MongoBackupJobRepository(),
  reportDefinitionRepository: new MongoReportDefinitionRepository(),
  systemLogRepository: new MongoSystemLogRepository(),
};
