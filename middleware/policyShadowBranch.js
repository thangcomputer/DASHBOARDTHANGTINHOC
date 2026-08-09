/**
 * Policy SHADOW for /api/branches. Always next(); never alters HTTP.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyBranch,
  evaluatePolicyBranch,
  compareDecisions,
} = require('../services/policyShadow/branchPolicy');
const { MANAGE_STAFF_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function policyShadowBranch(action) {
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
        bodyBranchId: req.body?.branchId,
        queryTenantId: req.query?.tenant_id,
        headerTenantId: req.headers?.['x-tenant-id'],
        clientRole: req.body?.role,
        clientPermissions: req.body?.permissions,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyBranch(subject, action);
        policy = evaluatePolicyBranch(subject, action, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `branch_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: MANAGE_STAFF_LIVE,
            resourceType: 'branch',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] branch evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `branch_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `branch_${action}`,
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
            action: `branch_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: MANAGE_STAFF_LIVE,
            resourceType: 'branch',
            resourceId: req.params?.id || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] branch shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `branch_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected branch error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowBranch };
