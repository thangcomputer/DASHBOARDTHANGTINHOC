'use strict';

const logger = require('../logger/logger');

class ValidationMetrics {
  static logSuccess(domain, schemaName, durationMs) {
    logger.info({
      type: 'metric',
      metric: 'validation_success_total',
      domain,
      schemaName,
      duration_ms: durationMs
    }, `Validation succeeded for ${schemaName}`);
  }

  static logFailure(domain, schemaName, durationMs, errors) {
    logger.warn({
      type: 'metric',
      metric: 'validation_failed_total',
      domain,
      schemaName,
      duration_ms: durationMs,
      error_count: errors.length
    }, `Validation failed for ${schemaName}`);
  }
}

module.exports = ValidationMetrics;
