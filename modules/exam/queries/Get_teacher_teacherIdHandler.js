'use strict';
const evaluationApplicationService = require('../../services/EvaluationApplicationService');

class Get_teacher_teacherIdHandler {
  async execute(query) {
    return await evaluationApplicationService.get_teacher_teacherId(query);
  }
}
module.exports = Get_teacher_teacherIdHandler;
