'use strict';
const Metrics = require('../observability/Metrics');

class FeatureFlagManager {
  static isEnabled(featureName) {
    Metrics.inc('feature_flag_check', { featureName });
    // Everything disabled by default
    return false; 
  }
}
module.exports = FeatureFlagManager;