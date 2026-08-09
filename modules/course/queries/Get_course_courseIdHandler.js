'use strict';
const assignmentApplicationService = require('../../services/CourseApplicationService');

class Get_course_courseIdHandler {
  async execute(query) {
    return await assignmentApplicationService.get_course_courseId(query);
  }
}
module.exports = Get_course_courseIdHandler;
