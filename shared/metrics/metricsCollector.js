/**
 * Proxy metrics collector to services/metricsCollector.js
 * Ensures single source of truth and backward compatibility.
 */
const { metricsCollector, MetricsCollector, normalizePath } = require('../../modules/report/services/metricsCollector');

module.exports = {
  metricsCollector,
  MetricsCollector,
  normalizePath,
};
