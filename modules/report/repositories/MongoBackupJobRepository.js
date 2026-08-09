const BackupJobRepository = require('./BackupJobRepository');
const BackupJob = require('../models/BackupJob');

class MongoBackupJobRepository extends BackupJobRepository {
  constructor() {
    super(BackupJob);
  }
}

module.exports = MongoBackupJobRepository;
