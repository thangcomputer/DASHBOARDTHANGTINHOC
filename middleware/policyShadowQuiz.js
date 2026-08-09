/**
 * Policy SHADOW for quiz write/list/submit (admin/all uses policyShadowQuizAdminRead).
 * Always next(); never alters HTTP.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyQuiz,
  evaluatePolicyQuiz,
  compareDecisions,
} = require('../services/policyShadow/quizPolicy');

function policyShadowQuiz(action) {
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
        clientRole: req.body?.role,
        clientPermissions: req.body?.permissions,
        bodyTeacherId: req.body?.teacherId,
        targetStudentIds: req.body?.targetStudentIds,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyQuiz(subject, action);
        policy = evaluatePolicyQuiz(subject, action, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `quiz_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            resourceType: 'quiz',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] quiz evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `quiz_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `quiz_${action}`,
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
            action: `quiz_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            resourceType: 'quiz',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] quiz shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `quiz_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected quiz error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowQuiz };
