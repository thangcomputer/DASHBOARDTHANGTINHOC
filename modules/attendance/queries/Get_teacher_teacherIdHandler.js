'use strict';
const attendanceApplicationService = require('../../services/AttendanceApplicationService');

class Get_teacher_teacherIdHandler {
  async execute(query) {
    return await attendanceApplicationService.get_teacher_teacherId(query);
  }
}
module.exports = Get_teacher_teacherIdHandler;
