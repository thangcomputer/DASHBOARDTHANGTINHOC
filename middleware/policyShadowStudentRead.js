/**
 * Policy SHADOW middleware for LIVE student READ routes.
 * Never alters HTTP outcome — legacy guards/handlers remain authoritative.
 *
 * Placement (list/stats):
 *   authMiddleware → branchFilter → policyShadowStudentRead(action)
 *   → requireManageStudentsUnlessTeacher → handler
 *
 * Placement (get_one / full_detail):
 *   authMiddleware → branchFilter → policyShadowStudentRead(action) → handler
 *
 * Does not modify req.user, req.userBranchId, query, or filters.
 * Phase 7.35: get_one + full_detail evaluation-only (NO cutover).
 */
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyStudentRead,
  evaluatePolicyStudentRead,
  compareDecisions,
  GET_BY_ID,
} = require('../services/policyShadow/studentReadPolicy');
const { STUDENT_READ_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function policyShadowStudentRead(action) {
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

      const trustedCtx = {
        trustedBranchFilter: req.branchFilter ? { ...req.branchFilter } : {},
        queryBranchId: req.query?.branch_id,
        queryTeacherId: req.query?.teacherId,
      };

      let resourceStudent = null;
      const resourceId = req.params?.id || null;
      if (GET_BY_ID.has(action) && resourceId) {
        try {
          resourceStudent = await Student.findById(resourceId)
            .select('branchId teacherId enrollments')
            .lean();
        } catch (_castErr) {
          resourceStudent = null;
        }
        trustedCtx.resourceStudent = resourceStudent;
        trustedCtx.resourceId = resourceId;
      }

      const untrusted = {
        bodyBranchId: req.body?.branchId,
        queryTenantId: req.query?.tenantId || req.query?.tenant_id,
        bodyTenantId: req.body?.tenantId,
        clientRole: req.body?.role || req.query?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        spoofTeacherId: req.body?.teacherId,
        spoofStudentId: req.body?.studentId || req.query?.studentId,
        queryBranchId: req.query?.branchId || req.query?.branch_id,
        bodyStudentId: req.body?.studentId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';

      try {
        legacy = evaluateLegacyStudentRead(subject, action, trustedCtx);
        policy = evaluatePolicyStudentRead(subject, action, trustedCtx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `student_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: STUDENT_READ_LIVE,
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
          '[POLICY_SHADOW] student read evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `student_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `student_${action}`,
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
        legacyScope: legacy.scope,
        policyScope: policy.scope,
        policyStatusHint: policy.statusHint,
        legacyStatusHint: legacy.statusHint,
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `student_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: STUDENT_READ_LIVE,
            userBranchId: subject.userBranchId,
            resourceBranchId: resourceStudent?.branchId
              ? String(resourceStudent.branchId)
              : null,
            resourceType: 'student',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            legacyScopeMode: legacy.scope?.mode,
            policyScopeMode: policy.scope?.mode,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] student read shadow disagrees with legacy — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `student_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected student read error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowStudentRead };
