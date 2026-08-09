/**
 * Policy SHADOW for /api/evaluations. Always next(); never alters HTTP/realtime.
 */
const Teacher = require('../models/Teacher');
const Evaluation = require('../models/Evaluation');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyEvaluation,
  evaluatePolicyEvaluation,
  compareDecisions,
} = require('../services/policyShadow/evaluationsPolicy');

function policyShadowEvaluation(action) {
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
        bodyStudentId: req.body?.studentId,
        evaluation: null,
      };

      if (action === 'mark_read' && req.params?.id) {
        ctx.evaluation = await Evaluation.findById(req.params.id)
          .select('targetTeacherId type studentId')
          .lean();
      }

      const untrusted = {
        bodyRole: req.body?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId,
        bodyTeacherId: req.body?.targetTeacherId || req.body?.teacherId,
        bodyUserId: req.body?.userId,
        bodyStudentId: req.body?.studentId,
        paramsTeacherId: req.params?.teacherId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyEvaluation(subject, action, ctx);
        policy = evaluatePolicyEvaluation(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `evaluation_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'role_gate_only',
            resourceType: 'evaluation',
            resourceId: req.params?.id || null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] evaluation evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `evaluation_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `evaluation_${action}`,
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
            action: `evaluation_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'role_gate_only',
            resourceType: 'evaluation',
            resourceId: req.params?.id || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] evaluation shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `evaluation_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected evaluation error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowEvaluation };
