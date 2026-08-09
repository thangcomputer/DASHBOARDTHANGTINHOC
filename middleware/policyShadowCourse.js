/**
 * Policy SHADOW for /api/courses. Always next(); never alters HTTP.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyCourse,
  evaluatePolicyCourse,
  compareDecisions,
} = require('../services/policyShadow/coursePolicy');
const { SYSTEM_SETTINGS_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function policyShadowCourse(action) {
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
        tokenAudience: req.tokenAudience || null,
      });

      const untrusted = {
        bodyBranchId: req.body?.branchId,
        clientRole: req.body?.role,
        clientPermissions: req.body?.permissions,
        bodyTenantId: req.body?.tenantId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyCourse(subject, action);
        policy = evaluatePolicyCourse(subject, action, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `course_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: SYSTEM_SETTINGS_LIVE,
            resourceType: 'course',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] course evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `course_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `course_${action}`,
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
            action: `course_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            resourceType: 'course',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] course shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `course_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected course error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowCourse };
