/**
 * Policy SHADOW middleware for teacher score/approve/reject.
 * Never alters HTTP outcome — legacy guards remain authoritative.
 *
 * Placement:
 *   authMiddleware → branchFilter → policyShadowTeacherWrite(action)
 *   → checkPermission(MANAGE_TEACHERS) → assertTeacherBranchAccess → handler
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyTeacherWrite,
  evaluatePolicyTeacherWrite,
  compareDecisions,
} = require('../services/policyShadow/teacherMutationPolicy');
const { TEACHER_WRITE_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function policyShadowTeacherWrite(action) {
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

      let resourceTeacher = null;
      if (req.params?.id) {
        resourceTeacher = await Teacher.findById(req.params.id).select('branchId').lean();
      }

      const untrusted = {
        bodyBranchId: req.body?.branchId,
        queryBranchId: req.query?.branch_id || req.query?.branchId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';

      try {
        legacy = evaluateLegacyTeacherWrite(subject, resourceTeacher);
        policy = evaluatePolicyTeacherWrite(subject, resourceTeacher, action, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: TEACHER_WRITE_LIVE,
            userBranchId: subject.userBranchId,
            resourceBranchId: resourceTeacher?.branchId
              ? String(resourceTeacher.branchId)
              : null,
            resourceType: 'teacher',
            legacyDecision: null,
            policyDecision: null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action,
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
            action,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: TEACHER_WRITE_LIVE,
            userBranchId: subject.userBranchId,
            resourceBranchId: resourceTeacher?.branchId
              ? String(resourceTeacher.branchId)
              : null,
            resourceType: 'teacher',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] shadow disagrees with legacy — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowTeacherWrite };
