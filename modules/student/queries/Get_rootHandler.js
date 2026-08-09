'use strict';
const studentApplicationService = require('../services/StudentApplicationService');

class Get_rootHandler {
  async execute(query) {
    return await studentApplicationService.get_root(query);
  }
}
module.exports = Get_rootHandler;
