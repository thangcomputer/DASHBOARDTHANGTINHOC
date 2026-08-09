/**
 * Policy SHADOW for /api/auth. Always next().
 * Never issues tokens, verifies passwords, CAPTCHA, TOTP, OAuth, or mutates sessions.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyAuth,
  evaluatePolicyAuth,
  compareDecisions,
  PUBLIC_ACTIONS,
} = require('../services/policyShadow/authPolicy');

function policyShadowAuth(action) {
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
        bodyActorId: req.body?.actorId,
        bodyOwnerId: req.body?.ownerId,
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyAuth(subject, action);
        policy = evaluatePolicyAuth(subject, action, {}, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `auth_${action}`,
            policyName: 'authPolicy',
            userRole: subject.role || null,
            adminRole: subject.adminRole,
            permission: PUBLIC_ACTIONS.has(action) ? 'PUBLIC' : 'auth_or_role_gate',
            resourceType: 'auth',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] auth evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `auth_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `auth_${action}`,
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `auth_${action}`,
            policyName: 'authPolicy',
            userRole: subject.role || null,
            adminRole: subject.adminRole,
            permission: PUBLIC_ACTIONS.has(action) ? 'PUBLIC' : 'auth_or_role_gate',
            resourceType: 'auth',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] auth shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `auth_${action}`,
          policyName: 'authPolicy',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected auth error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowAuth };
