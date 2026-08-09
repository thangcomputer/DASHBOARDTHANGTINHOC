'use strict';
const Metrics = require('../observability/Metrics');

class SecretManager {
  static getSecret(key) {
    Metrics.inc('secret_access', { key });
    return process.env[key];
  }
  static reload() {
    Metrics.inc('secret_reloaded');
  }
  static rotation() {
    Metrics.inc('secret_rotated');
  }
}
module.exports = SecretManager;