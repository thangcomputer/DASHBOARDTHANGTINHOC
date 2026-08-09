'use strict';
const analyticsApplicationService = require('../../services/AnalyticsApplicationService');

class Get_branchesHandler {
  async execute(query) {
    return await analyticsApplicationService.get_branches(query);
  }
}
module.exports = Get_branchesHandler;
