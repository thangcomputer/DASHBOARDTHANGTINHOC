/**
 * Policy SHADOW for /api/system-logs. Always next(); never alters HTTP/DB.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacySystemLog,
  evaluatePolicySystemLog,
  compareDecisions,
} = require('../services/policyShadow/systemLogsPolicy');

function policyShadowSystemLog(action) {
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

      const ctx = { log: null };
      if (action === 'delete' && req.params?.id) {
        try {
          const SystemLog = require('../models/SystemLog');
          ctx.log = await SystemLog.findById(req.params.id).select('_id').lean();
        } catch {
          ctx.log = null;
        }
      }

      const untrusted = {
        bodyRole: req.body?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId,
        bodyUserId: req.body?.user_id || req.body?.userId,
        bodyAction: req.body?.action,
        queryBranchId: req.query?.branchId || req.query?.branch_id,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacySystemLog(subject, action, ctx);
        policy = evaluatePolicySystemLog(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `system_log_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'isAdmin',
            resourceType: 'system_log',
            resourceId: req.params?.id || null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] system_log evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `system_log_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `system_log_${action}`,
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
            action: `system_log_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'isAdmin',
            resourceType: 'system_log',
            resourceId: req.params?.id || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] system_log shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `system_log_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected system_log error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowSystemLog };
