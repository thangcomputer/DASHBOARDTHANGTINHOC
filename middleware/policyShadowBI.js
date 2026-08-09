/**
 * Policy SHADOW for /api/bi. Always next(); never alters HTTP or biService aggregates.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyBI,
  evaluatePolicyBI,
  compareDecisions,
} = require('../services/policyShadow/biPolicy');
const {
  FINANCE_WRITE_LIVE,
  VIEW_BRANCH_REVENUE_LIVE,
} = require('../services/policyShadow/livePermissionAdapter');

function policyShadowBI(action) {
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

      const ctx = {
        trustedBranchFilter: req.branchFilter ? { ...req.branchFilter } : {},
        queryBranch: req.query?.branchId || req.query?.branch_id || null,
      };

      const untrusted = {
        queryBranchId: req.query?.branchId || req.query?.branch_id,
        bodyBranchId: req.body?.branchId,
        queryTenantId: req.query?.tenantId || req.query?.tenant_id,
        bodyTenantId: req.body?.tenantId,
        headerTenantId: req.headers?.['x-tenant-id'],
        clientRole: req.body?.role || req.query?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyBI(subject, action, ctx);
        policy = evaluatePolicyBI(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `bi_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: `${FINANCE_WRITE_LIVE}|${VIEW_BRANCH_REVENUE_LIVE}`,
            userBranchId: subject.userBranchId,
            resourceType: 'bi',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] bi evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `bi_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `bi_${action}`,
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
        policyStatusHint: policy.statusHint,
        legacyStatusHint: legacy.statusHint,
        dataScope: legacy.dataScope || null,
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `bi_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: `${FINANCE_WRITE_LIVE}|${VIEW_BRANCH_REVENUE_LIVE}`,
            userBranchId: subject.userBranchId,
            resourceType: 'bi',
            dataScope: legacy.dataScope || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] bi shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `bi_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected bi error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowBI };
