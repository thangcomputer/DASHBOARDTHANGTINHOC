/**
 * Policy SHADOW for schedules. Always next(); never alters HTTP.
 */
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const Schedule = require('../models/Schedule');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacySchedule,
  evaluatePolicySchedule,
  compareDecisions,
} = require('../services/policyShadow/schedulePolicy');

function policyShadowSchedule(action) {
  return async (req, res, next) => {
    try {
      let actorDoc = null;
      if (req.user?.id && req.user.id !== 'admin') {
        actorDoc = await Teacher.findById(req.user.id)
          .select('adminRole permissions role assignedStudents')
          .lean();
      }
      const subject = buildSubject({
        user: req.user,
        actorDoc,
        userBranchId: req.userBranchId || null,
      });

      const ctx = {
        teacherId: req.params?.teacherId || null,
        studentId: req.params?.studentId || req.body?.studentId || null,
        targetStudent: null,
        assignedStudentIds: actorDoc?.assignedStudents || [],
        schedule: null,
      };

      if (action === 'create' || action === 'get_student') {
        const sid = action === 'get_student' ? req.params?.studentId : req.body?.studentId;
        if (sid) {
          ctx.targetStudent = await Student.findById(sid)
            .select('branchId teacherId enrollments')
            .lean();
          ctx.studentId = sid;
        }
      }
      if (action === 'update' || action === 'cancel') {
        ctx.schedule = await Schedule.findById(req.params?.scheduleId)
          .select('teacherId studentId branchId')
          .lean();
      }

      const untrusted = {
        bodyBranchId: req.body?.branchId,
        queryBranchId: req.query?.branchId || req.query?.branch_id,
        clientRole: req.body?.role,
        clientPermissions: req.body?.permissions,
        bodyTeacherId: req.body?.teacherId,
        bodyStudentId: req.body?.studentId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacySchedule(subject, action, ctx);
        policy = evaluatePolicySchedule(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `schedule_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            userBranchId: subject.userBranchId,
            resourceBranchId: ctx.schedule?.branchId
              ? String(ctx.schedule.branchId)
              : (ctx.targetStudent?.branchId ? String(ctx.targetStudent.branchId) : null),
            resourceType: 'schedule',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] schedule evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `schedule_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `schedule_${action}`,
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
            action: `schedule_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            userBranchId: subject.userBranchId,
            resourceType: 'schedule',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] schedule shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `schedule_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected schedule error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowSchedule };
