'use strict';
const transactionApplicationService = require('../../services/TransactionApplicationService');

class Get_teacher_teacherIdHandler {
  async execute(query) {
    return await transactionApplicationService.get_teacher_teacherId(query);
  }
}
module.exports = Get_teacher_teacherIdHandler;
