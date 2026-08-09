'use strict';
const attendanceApplicationService = require('../../services/AttendanceApplicationService');

class Get_statsHandler {
  async execute(query) {
    return await attendanceApplicationService.get_stats(query);
  }
}
module.exports = Get_statsHandler;
