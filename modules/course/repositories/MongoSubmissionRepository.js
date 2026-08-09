const SubmissionRepository = require('./SubmissionRepository');
const Submission = require('../models/Submission');

class MongoSubmissionRepository extends SubmissionRepository {
  constructor() {
    super(Submission);
  }
}

module.exports = MongoSubmissionRepository;
