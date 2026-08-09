'use strict';
const attendanceApplicationService = require('../../services/AttendanceApplicationService');

class Get_rootHandler {
  async execute(query) {
    return await attendanceApplicationService.get_root(query);
  }
}
module.exports = Get_rootHandler;
