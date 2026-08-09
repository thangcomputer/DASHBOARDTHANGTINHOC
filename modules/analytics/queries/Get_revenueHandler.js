'use strict';
const analyticsApplicationService = require('../../services/AnalyticsApplicationService');

class Get_revenueHandler {
  async execute(query) {
    return await analyticsApplicationService.get_revenue(query);
  }
}
module.exports = Get_revenueHandler;
