'use strict';
const employeeApplicationService = require('../../services/TeacherApplicationService');

class Get_statsHandler {
  async execute(query) {
    return await employeeApplicationService.get_stats(query);
  }
}
module.exports = Get_statsHandler;
