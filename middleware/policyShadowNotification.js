/**
 * Policy SHADOW for notifications. Always next(); never alters HTTP.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyNotification,
  evaluatePolicyNotification,
  compareDecisions,
} = require('../services/policyShadow/notificationPolicy');

function policyShadowNotification(action) {
  return async (req, res, next) => {
    try {
      let actorDoc = null;
      if (req.user?.id && req.user.id !== 'admin') {
        actorDoc = await Teacher.findById(req.user.id)
          .select('adminRole permissions role')
          .lean();
      }
      const subject = buildSubject({
        user: req.user,
        actorDoc,
        userBranchId: req.userBranchId || null,
      });

      const untrusted = {
        bodyBranchId: req.body?.branchId,
        clientRole: req.body?.role,
        clientPermissions: req.body?.permissions,
        receivers: req.body?.receivers,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyNotification(subject, action);
        policy = evaluatePolicyNotification(subject, action, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `notification_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            resourceType: 'notification',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] notification evaluation error — legacy still authoritative',
        );
        req.policyShadow = {
          action: `notification_${action}`,
          comparison: 'ERROR',
          error: evalErr.message,
        };
        return next();
      }

      req.policyShadow = {
        action: `notification_${action}`,
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
        policyStatusHint: policy.statusHint,
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `notification_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            resourceType: 'notification',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] notification shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `notification_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected notification error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowNotification };
