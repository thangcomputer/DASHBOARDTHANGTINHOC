'use strict';
const employeeApplicationService = require('../../services/TeacherApplicationService');

class Get_rootHandler {
  async execute(query) {
    return await employeeApplicationService.get_root(query);
  }
}
module.exports = Get_rootHandler;
