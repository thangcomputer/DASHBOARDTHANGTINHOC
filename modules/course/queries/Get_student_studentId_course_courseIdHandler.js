'use strict';
const assignmentApplicationService = require('../../services/CourseApplicationService');

class Get_student_studentId_course_courseIdHandler {
  async execute(query) {
    return await assignmentApplicationService.get_student_studentId_course_courseId(query);
  }
}
module.exports = Get_student_studentId_course_courseIdHandler;
