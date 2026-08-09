/**
 * Policy SHADOW for assignments. Always next(); never alters HTTP.
 */
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Assignment = require('../models/Assignment');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyAssignment,
  evaluatePolicyAssignment,
  compareDecisions,
} = require('../services/policyShadow/assignmentPolicy');
const { pickAssignmentCreate } = require('../utils/assignmentDto');

function policyShadowAssignment(action) {
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

      const ctx = {
        targetStudent: null,
        assignment: null,
        studentId: req.params?.studentId || null,
        bodyStudentId: req.body?.studentId || null,
      };

      if (action === 'create') {
        const payload = pickAssignmentCreate(req.body || {});
        if (payload.studentId) {
          ctx.targetStudent = await Student.findById(payload.studentId)
            .select('branchId teacherId enrollments')
            .lean();
        }
      } else if (action === 'update' || action === 'submit') {
        ctx.assignment = await Assignment.findById(req.params?.id)
          .select('teacherId studentId courseId')
          .lean();
        if (ctx.assignment?.studentId) {
          ctx.targetStudent = await Student.findById(ctx.assignment.studentId)
            .select('branchId teacherId enrollments')
            .lean();
        }
        if (action === 'update' && req.body?.studentId) {
          const sid = String(req.body.studentId);
          if (!ctx.targetStudent || String(ctx.assignment?.studentId) !== sid) {
            ctx.newTargetStudent = await Student.findById(sid)
              .select('branchId teacherId enrollments')
              .lean();
          }
        }
      }

      const untrusted = {
        bodyBranchId: req.body?.branchId,
        bodyTeacherId: req.body?.teacherId,
        bodyAssignedById: req.body?.assignedById,
        clientRole: req.body?.role,
        clientPermissions: req.body?.permissions,
        queryTenantId: req.query?.tenantId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyAssignment(subject, action, ctx);
        policy = evaluatePolicyAssignment(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `assignment_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            userBranchId: subject.userBranchId,
            resourceBranchId: ctx.targetStudent?.branchId
              ? String(ctx.targetStudent.branchId)
              : null,
            resourceType: 'assignment',
            legacyDecision: null,
            policyDecision: null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] assignment evaluation error — legacy still authoritative',
        );
        req.policyShadow = {
          action: `assignment_${action}`,
          comparison: 'ERROR',
          error: evalErr.message,
        };
        return next();
      }

      req.policyShadow = {
        action: `assignment_${action}`,
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
            action: `assignment_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            userBranchId: subject.userBranchId,
            resourceBranchId: ctx.targetStudent?.branchId
              ? String(ctx.targetStudent.branchId)
              : null,
            resourceType: 'assignment',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] assignment shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `assignment_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected assignment error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowAssignment };
