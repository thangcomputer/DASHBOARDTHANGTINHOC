const MongoTeacherRepository = require('./MongoTeacherRepository');
const MongoTeacherAssignmentSegmentRepository = require('./MongoTeacherAssignmentSegmentRepository');

module.exports = {
  teacherRepository: new MongoTeacherRepository(),
  teacherAssignmentSegmentRepository: new MongoTeacherAssignmentSegmentRepository()
};
