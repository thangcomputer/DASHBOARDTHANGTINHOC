const TeacherAssignmentSegmentRepository = require('./TeacherAssignmentSegmentRepository');
const TeacherAssignmentSegment = require('../models/TeacherAssignmentSegment');

class MongoTeacherAssignmentSegmentRepository extends TeacherAssignmentSegmentRepository {
  constructor() {
    super(TeacherAssignmentSegment);
  }
}

module.exports = MongoTeacherAssignmentSegmentRepository;
