'use strict';
const attendanceApplicationService = require('../../services/AttendanceApplicationService');

class Get_history_teacherIdHandler {
  async execute(query) {
    return await attendanceApplicationService.get_history_teacherId(query);
  }
}
module.exports = Get_history_teacherIdHandler;
