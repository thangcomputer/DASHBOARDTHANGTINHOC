const AssignmentRepository = require('./AssignmentRepository');
const Assignment = require('../models/Assignment');

class MongoAssignmentRepository extends AssignmentRepository {
  constructor() {
    super(Assignment);
  }
}

module.exports = MongoAssignmentRepository;
