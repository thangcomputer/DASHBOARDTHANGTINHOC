'use strict';
const studentApplicationService = require('../services/StudentApplicationService');

class Get_statsHandler {
  async execute(query) {
    return await studentApplicationService.get_stats(query);
  }
}
module.exports = Get_statsHandler;
