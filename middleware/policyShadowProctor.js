/**
 * Policy SHADOW for /api/proctor. Always next(); never alters audit writes.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyProctor,
  evaluatePolicyProctor,
  compareDecisions,
} = require('../services/policyShadow/proctorPolicy');

function policyShadowProctor(action) {
  return async (req, res, next) => {
    try {
      let actorDoc = null;
      if (req.user?.id && req.user.id !== 'admin' && req.user.role !== 'student') {
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
        bodyUserId: req.body?.userId,
        paramsUserId: req.params?.userId,
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId || req.body?.tenant_id,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyProctor(subject, action);
        policy = evaluatePolicyProctor(subject, action, {}, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `proctor_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: action === 'events_user' ? 'isAdmin' : 'auth_only',
            resourceType: 'proctor',
            resourceId: req.params?.userId || null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] proctor evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `proctor_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `proctor_${action}`,
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
            action: `proctor_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: action === 'events_user' ? 'isAdmin' : 'auth_only',
            resourceType: 'proctor',
            resourceId: req.params?.userId || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] proctor shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `proctor_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected proctor error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowProctor };
