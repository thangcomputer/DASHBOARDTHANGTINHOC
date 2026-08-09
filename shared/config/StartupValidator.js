'use strict';
const Metrics = require('../observability/Metrics');
const fs = require('fs');

class StartupValidator {
  static validateAll() {
    Metrics.inc('startup_validation_started');
    // Check required env vars
    const required = ['PORT', 'MONGO_URI', 'JWT_SECRET'];
    for (const req of required) {
      if (!process.env[req]) {
        Metrics.inc('startup_validation_failed', { reason: `Missing ${req}` });
        console.warn(`⚠️ [StartupValidator] Thiếu cấu hình quan trọng: ${req}`);
      }
    }
    // Check node version
    const version = process.version.match(/^v(\d+)/)[1];
    if (parseInt(version, 10) < 18) {
      console.warn('⚠️ [StartupValidator] Node.js version < 18.');
    }
    Metrics.inc('startup_validation_success');
  }
}
module.exports = StartupValidator;