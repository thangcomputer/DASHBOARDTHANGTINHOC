'use strict';
const studentApplicationService = require('../services/StudentApplicationService');

class Get_idHandler {
  async execute(query) {
    return await studentApplicationService.get_id(query);
  }
}
module.exports = Get_idHandler;
