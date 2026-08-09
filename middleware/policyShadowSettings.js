/**
 * Policy SHADOW for settings. Always next(); never alters HTTP/reset.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacySettings,
  evaluatePolicySettings,
  compareDecisions,
} = require('../services/policyShadow/settingsPolicy');
const { SYSTEM_SETTINGS_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function policyShadowSettings(action) {
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
        clientAdminRole: req.body?.adminRole,
        bodyPassword: req.body?.password ? '[redacted]' : undefined,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacySettings(subject, action);
        policy = evaluatePolicySettings(subject, action, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `settings_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: SYSTEM_SETTINGS_LIVE,
            userBranchId: subject.userBranchId,
            resourceType: 'settings',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] settings evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `settings_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `settings_${action}`,
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
        policyStatusHint: policy.statusHint,
        legacyStatusHint: legacy.statusHint,
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `settings_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            userBranchId: subject.userBranchId,
            resourceType: 'settings',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] settings shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `settings_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected settings error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowSettings };
