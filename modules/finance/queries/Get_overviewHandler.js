'use strict';
const biApplicationService = require('../../services/BiApplicationService');

class Get_overviewHandler {
  async execute(query) {
    return await biApplicationService.get_overview(query);
  }
}
module.exports = Get_overviewHandler;
