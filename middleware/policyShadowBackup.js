/**
 * Policy SHADOW for /api/backups. Always next(); never alters HTTP/backup engine.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyBackup,
  evaluatePolicyBackup,
  compareDecisions,
} = require('../services/policyShadow/backupPolicy');

function policyShadowBackup(action) {
  return async (req, res, next) => {
    try {
      let actorDoc = null;
      if (req.user?.id && req.user.id !== 'admin') {
        actorDoc = await Teacher.findById(req.user.id)
          .select('adminRole permissions role')
          .lean();
      }
      const subject = buildSubject({
        user: req.user || {},
        actorDoc,
        userBranchId: req.userBranchId || null,
      });

      const untrusted = {
        bodyRole: req.body?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyBackup(subject, action);
        policy = evaluatePolicyBackup(subject, action, {}, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `backup_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'isSuperAdmin',
            resourceType: 'backup',
            resourceId: req.params?.id || null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] backup evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `backup_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `backup_${action}`,
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
            action: `backup_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'isSuperAdmin',
            resourceType: 'backup',
            resourceId: req.params?.id || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] backup shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `backup_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected backup error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowBackup };
