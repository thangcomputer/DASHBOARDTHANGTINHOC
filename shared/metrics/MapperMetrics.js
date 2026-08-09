'use strict';

const logger = require('../logger/logger');

class MapperMetrics {
  static logExecution(domain, mapperName, durationMs) {
    logger.info({
      type: 'metric',
      metric: 'mapper_execution_total',
      domain,
      mapperName,
      duration_ms: durationMs
    }, `Mapper executed for ${mapperName}`);
  }
}

module.exports = MapperMetrics;
