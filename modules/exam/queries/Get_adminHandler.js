'use strict';
const evaluationApplicationService = require('../../services/EvaluationApplicationService');

class Get_adminHandler {
  async execute(query) {
    return await evaluationApplicationService.get_admin(query);
  }
}
module.exports = Get_adminHandler;
