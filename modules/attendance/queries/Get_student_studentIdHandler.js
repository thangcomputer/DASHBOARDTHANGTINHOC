'use strict';
const attendanceApplicationService = require('../../services/AttendanceApplicationService');

class Get_student_studentIdHandler {
  async execute(query) {
    return await attendanceApplicationService.get_student_studentId(query);
  }
}
module.exports = Get_student_studentIdHandler;
