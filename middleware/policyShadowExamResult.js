/**
 * Policy SHADOW for exam-results. Always next(); never alters HTTP.
 */
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const ExamResult = require('../models/ExamResult');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyExam,
  evaluatePolicyExam,
  compareDecisions,
} = require('../services/policyShadow/examResultPolicy');
const { pickExamResultCreate } = require('../utils/examResultDto');

async function resolveSubjectBranchId(doc) {
  if (!doc) return null;
  if (doc.type === 'student' && doc.studentId) {
    const student = await Student.findById(doc.studentId)
      .select('branchId teacherId enrollments')
      .lean();
    return { branchId: student?.branchId || null, student };
  }
  if (doc.type === 'teacher' && doc.teacherId) {
    const teacher = await Teacher.findById(doc.teacherId).select('branchId').lean();
    return { branchId: teacher?.branchId || null, student: null };
  }
  return { branchId: null, student: null };
}

function policyShadowExamResult(action) {
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

      const ctx = { doc: null, student: null, subjectBranchId: null };
      if (action === 'create') {
        const data = pickExamResultCreate(req.body || {});
        ctx.doc = data;
        const resolved = await resolveSubjectBranchId(data);
        ctx.subjectBranchId = resolved.branchId;
        ctx.student = resolved.student;
      } else if (action === 'update' || action === 'delete') {
        const existing = await ExamResult.findById(req.params?.id)
          .select('type studentId teacherId')
          .lean();
        ctx.doc = existing;
        if (existing) {
          const resolved = await resolveSubjectBranchId(existing);
          ctx.subjectBranchId = resolved.branchId;
          ctx.student = resolved.student;
        }
      }

      const untrusted = {
        bodyBranchId: req.body?.branchId,
        queryBranchId: req.query?.branchId,
        clientRole: req.body?.role,
        clientPermissions: req.body?.permissions,
        spoofTeacherId: req.body?.teacherId,
        spoofStudentId: req.body?.studentId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyExam(subject, action, ctx);
        policy = evaluatePolicyExam(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `exam_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            userBranchId: subject.userBranchId,
            resourceBranchId: ctx.subjectBranchId ? String(ctx.subjectBranchId) : null,
            resourceType: 'examResult',
            legacyDecision: null,
            policyDecision: null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] exam evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `exam_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `exam_${action}`,
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
            action: `exam_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            userBranchId: subject.userBranchId,
            resourceBranchId: ctx.subjectBranchId ? String(ctx.subjectBranchId) : null,
            resourceType: 'examResult',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] exam shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `exam_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected exam error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowExamResult };
