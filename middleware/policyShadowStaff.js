/**
 * Policy SHADOW for /api/staff. Always next(); never alters HTTP.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyStaff,
  evaluatePolicyStaff,
  compareDecisions,
} = require('../services/policyShadow/staffPolicy');
const { MANAGE_STAFF_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function policyShadowStaff(action) {
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

      const ctx = {};
      if (action === 'create') {
        // Operation parameter (requested target role), not actor identity
        ctx.requestedAdminRole = req.body?.adminRole || 'STAFF';
      }
      if (action === 'update' || action === 'delete') {
        if (req.params?.id) {
          ctx.target = await Teacher.findById(req.params.id).select('adminRole').lean();
        }
        if (action === 'update' && ctx.target && req.body?.adminRole) {
          ctx.roleChanging = ctx.target.adminRole !== req.body.adminRole;
        }
      }

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyStaff(subject, action, ctx);
        policy = evaluatePolicyStaff(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `staff_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: MANAGE_STAFF_LIVE,
            resourceType: 'staff',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] staff evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `staff_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `staff_${action}`,
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
            action: `staff_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: MANAGE_STAFF_LIVE,
            resourceType: 'staff',
            resourceId: req.params?.id || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] staff shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `staff_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected staff error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowStaff };
