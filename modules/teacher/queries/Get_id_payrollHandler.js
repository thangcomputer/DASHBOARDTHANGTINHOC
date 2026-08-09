'use strict';
const employeeApplicationService = require('../../services/TeacherApplicationService');

class Get_id_payrollHandler {
  async execute(query) {
    return await employeeApplicationService.get_id_payroll(query);
  }
}
module.exports = Get_id_payrollHandler;
