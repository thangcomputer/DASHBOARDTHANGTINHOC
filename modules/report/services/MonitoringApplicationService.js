'use strict';
const monitoring = require('./monitoringService');
const logger = require('./../../../config/logger');

const guard = [authMiddleware, authorize(NEW_PERMISSIONS.SETTINGS_UPDATE)];
// GET /api/monitoring/health — chi tiet hon /healthz

class MonitoringApplicationService {
  async get_health(data) {}

  async get_metrics(data) {}

  async get_overview(data) {}

  async post_metrics_reset(data) {}

}

module.exports = new MonitoringApplicationService();
