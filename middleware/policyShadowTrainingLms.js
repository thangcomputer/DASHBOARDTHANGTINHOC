/**
 * Policy SHADOW for /api/training-lms and /api/training. Always next().
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyTraining,
  evaluatePolicyTraining,
  compareDecisions,
} = require('../services/policyShadow/trainingLmsPolicy');
const { resolveTeacherSubjectIds } = require('../utils/trainingSubjectAccess');
const { MANAGE_TRAINING_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function findCourseInSettings(settings, courseId) {
  const id = String(courseId);
  const teacherVideos = (settings?.trainingRawData && settings.trainingRawData.videos) || [];
  const studentVideos = (settings?.studentTrainingRawData && settings.studentTrainingRawData.videos) || [];
  return (
    teacherVideos.find((c) => String(c.id || c._id) === id)
    || studentVideos.find((c) => String(c.id || c._id) === id)
    || null
  );
}

function policyShadowTrainingLms(action) {
  return async (req, res, next) => {
    try {
      let actorDoc = null;
      if (req.user?.id && req.user.id !== 'admin') {
        actorDoc = await Teacher.findById(req.user.id)
          .select('adminRole permissions role subjectIds specialty')
          .lean();
      }
      const subject = buildSubject({
        user: req.user,
        actorDoc,
        userBranchId: req.userBranchId || null,
      });

      const ctx = {
        course: null,
        allowedSubjectIds: [],
      };

      if (action === 'lms_lessons') {
        try {
          const SystemSettings = require('../models/SystemSettings');
          const settings = await SystemSettings.findOne().lean();
          ctx.course = findCourseInSettings(settings || {}, req.params?.id);
        } catch {
          ctx.course = null;
        }
        if (String(subject.role || '').toLowerCase() === 'teacher') {
          ctx.allowedSubjectIds = resolveTeacherSubjectIds(actorDoc || {});
        }
      }

      const untrusted = {
        bodyBranchId: req.body?.branchId,
        clientRole: req.body?.role,
        clientPermissions: req.body?.permissions,
        bodyStudentId: req.body?.studentId,
        bodyTeacherId: req.body?.teacherId,
        bodyUserId: req.body?.userId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyTraining(subject, action, ctx);
        policy = evaluatePolicyTraining(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `training_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: MANAGE_TRAINING_LIVE,
            resourceType: 'training_lms',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] training-lms evaluation error — legacy still authoritative',
        );
        req.policyShadow = {
          action: `training_${action}`,
          comparison: 'ERROR',
          error: evalErr.message,
        };
        return next();
      }

      req.policyShadow = {
        action: `training_${action}`,
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
        policyStatusHint: policy.statusHint || (policy.decision === 'DENY' && !subject?.userId ? 401 : undefined),
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `training_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            resourceType: 'training_lms',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] training-lms shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `training_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected training-lms error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowTrainingLms };
