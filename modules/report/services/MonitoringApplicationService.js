'use strict';
const monitoring = require('./monitoringService');
const logger = require('./../../../config/logger');

// GET /api/monitoring/health - chi tiet hon /healthz

class MonitoringApplicationService {
  async get_health() {
    const health = monitoring.getHealth();
    return {
      _status: health.ok ? 200 : 503,
      _body: { success: true, data: health },
    };
  }

  async get_metrics() {
    return { _status: 200, _body: { success: true, data: monitoring.getMetrics() } };
  }

  async get_overview() {
    return { _status: 200, _body: { success: true, data: monitoring.getOverview() } };
  }

  async post_metrics_reset(data) {
    try {
      const currentUser = data.currentUser || data.user;
      const isSuperAdmin = currentUser?.id === 'admin' || currentUser?.adminRole === 'SUPER_ADMIN';
      if (!data.policyAuthoritative && !isSuperAdmin) {
        return { _status: 403, _body: { success: false, message: 'Chi Super Admin' } };
      }
      const metrics = monitoring.resetMetrics();
      logger.info({ by: currentUser?.id }, '[Monitoring] metrics reset');
      return { _status: 200, _body: { success: true, message: 'Da reset metrics', data: metrics } };
    } catch (err) {
      logger.error('[MONITORING] metrics reset:', err);
      return { _status: 500, _body: { success: false, message: err.message } };
    }
  }

}

module.exports = new MonitoringApplicationService();
