/**
 * Policy SHADOW for student mutations. Always next(); never alters HTTP/DB/filters.
 *
 * Placement:
 *   authMiddleware → branchFilter → policyShadowStudentMutation(action)
 *   → legacy checkPermission / assertStudentBranchAccess / handler checks
 */
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyStudentMutation,
  evaluatePolicyStudentMutation,
  compareDecisions,
  ACTIONS,
} = require('../services/policyShadow/studentMutationPolicy');
const {
  STUDENT_WRITE_LIVE,
  FINANCE_WRITE_LIVE,
} = require('../services/policyShadow/livePermissionAdapter');

function policyShadowStudentMutation(action) {
  return async (req, res, next) => {
    try {
      const def = ACTIONS[action];
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

      let resourceStudent = null;
      const resourceId = req.params?.id || null;
      if (def?.resource && resourceId) {
        resourceStudent = await Student.findById(resourceId)
          .select('branchId teacherId enrollments.teacherId')
          .lean();
      }

      const ctx = { resourceId };
      const untrusted = {
        bodyBranchId: req.body?.branchId,
        queryBranchId: req.query?.branch_id || req.query?.branchId,
        queryTenantId: req.query?.tenantId || req.query?.tenant_id,
        bodyTenantId: req.body?.tenantId,
        clientRole: req.body?.role || req.query?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        spoofTeacherId: req.body?.teacherId,
        spoofOwnerId: req.body?.ownerId,
        spoofStudentId: req.body?.studentId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';

      try {
        legacy = evaluateLegacyStudentMutation(subject, action, resourceStudent, ctx);
        policy = evaluatePolicyStudentMutation(subject, action, resourceStudent, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `student_mutation_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission:
              def?.family === 'manage_finance' ? FINANCE_WRITE_LIVE : STUDENT_WRITE_LIVE,
            userBranchId: subject.userBranchId,
            resourceBranchId: resourceStudent?.branchId
              ? String(resourceStudent.branchId)
              : null,
            resourceType: 'student',
            legacyDecision: null,
            policyDecision: null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] student mutation evaluation error — legacy still authoritative',
        );
        req.policyShadow = {
          action: `student_mutation_${action}`,
          comparison: 'ERROR',
          error: evalErr.message,
        };
        return next();
      }

      req.policyShadow = {
        action: `student_mutation_${action}`,
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
            action: `student_mutation_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission:
              def?.family === 'manage_finance' ? FINANCE_WRITE_LIVE : STUDENT_WRITE_LIVE,
            userBranchId: subject.userBranchId,
            resourceBranchId: resourceStudent?.branchId
              ? String(resourceStudent.branchId)
              : null,
            resourceType: 'student',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] student mutation shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `student_mutation_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected student mutation error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowStudentMutation };
