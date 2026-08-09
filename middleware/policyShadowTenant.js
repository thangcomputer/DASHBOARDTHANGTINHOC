/**
 * Policy SHADOW for /api/tenants. Always next(); never alters HTTP.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyTenant,
  evaluatePolicyTenant,
  compareDecisions,
} = require('../services/policyShadow/tenantPolicy');

function policyShadowTenant(action) {
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
        paramsId: req.params?.id || null,
        resourceTenant: null,
      };

      const untrusted = {
        bodyRole: req.body?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        bodyUserId: req.body?.userId,
        bodyTenantId: req.body?.tenantId,
        queryTenantId: req.query?.tenantId || req.query?.tenant_id,
        bodyBranchId: req.body?.branchId,
        queryBranchId: req.query?.branchId || req.query?.branch_id,
        headerTenantId: req.headers?.['x-tenant-id'],
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyTenant(subject, action, ctx);
        policy = evaluatePolicyTenant(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `tenant_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'isSuperAdmin',
            userBranchId: subject.userBranchId,
            resourceType: 'tenant',
            resourceId: req.params?.id || null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] tenant evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `tenant_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `tenant_${action}`,
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
            action: `tenant_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'isSuperAdmin',
            userBranchId: subject.userBranchId,
            resourceType: 'tenant',
            resourceId: req.params?.id || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] tenant shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `tenant_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected tenant error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowTenant };
