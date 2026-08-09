'use strict';
const Metrics = require('../observability/Metrics');

class AuthHardening {
  static logFailedLogin(userId, ip) {
    Metrics.inc('auth_failed_login', { userId: userId || 'unknown', ip: ip || 'unknown' });
  }
  static logSuspiciousTokenReplay(tokenId, ip) {
    Metrics.inc('auth_token_replay_attempt', { tokenId, ip });
  }
}
module.exports = AuthHardening;