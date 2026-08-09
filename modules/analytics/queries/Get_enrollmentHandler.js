'use strict';
const analyticsApplicationService = require('../../services/AnalyticsApplicationService');

class Get_enrollmentHandler {
  async execute(query) {
    return await analyticsApplicationService.get_enrollment(query);
  }
}
module.exports = Get_enrollmentHandler;
