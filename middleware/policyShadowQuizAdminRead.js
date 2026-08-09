/**
 * Policy SHADOW middleware for GET /api/quizzes/admin/all.
 * Never alters HTTP outcome — legacy guards remain authoritative.
 *
 * Placement:
 *   authMiddleware → branchFilter → policyShadowQuizAdminRead()
 *   → checkPermission(MANAGE_TRAINING) → handler (teacher-branch data scope)
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyQuizAdminRead,
  evaluatePolicyQuizAdminRead,
  compareDecisions,
} = require('../services/policyShadow/quizAdminReadPolicy');
const { QUIZ_ADMIN_READ_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function policyShadowQuizAdminRead() {
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
        queryBranchId: req.query?.branch_id || req.query?.branchId,
        queryTenantId: req.query?.tenantId || req.query?.tenant_id,
        bodyTenantId: req.body?.tenantId,
        clientRole: req.body?.role || req.query?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        clientTeacherId: req.body?.teacherId || req.query?.teacherId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';

      try {
        legacy = evaluateLegacyQuizAdminRead(subject);
        policy = evaluatePolicyQuizAdminRead(subject, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: 'quiz_admin_read',
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: QUIZ_ADMIN_READ_LIVE,
            userBranchId: subject.userBranchId,
            resourceBranchId: null,
            resourceType: 'quiz',
            legacyDecision: null,
            policyDecision: null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] quiz admin evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: 'quiz_admin_read', comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: 'quiz_admin_read',
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
        policyStatusHint: policy.statusHint,
        legacyStatusHint: legacy.statusHint,
        legacyScope: legacy.scope,
        policyScope: policy.scope,
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: 'quiz_admin_read',
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: QUIZ_ADMIN_READ_LIVE,
            userBranchId: subject.userBranchId,
            resourceBranchId: null,
            resourceType: 'quiz',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            legacyScopeMode: legacy.scope?.mode,
            policyScopeMode: policy.scope?.mode,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] quiz admin shadow disagrees with legacy — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: 'quiz_admin_read',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected quiz admin error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowQuizAdminRead };
