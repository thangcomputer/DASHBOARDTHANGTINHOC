'use strict';
const Metrics = require('../observability/Metrics');

class ConfigurationManager {
  static get(key) {
    Metrics.inc('config_access', { key });
    return process.env[key];
  }
}
module.exports = ConfigurationManager;