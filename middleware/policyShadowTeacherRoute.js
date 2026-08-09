/**
 * Policy SHADOW for remaining teacher routes (Wave 6.5).
 * Always next(); never alters HTTP/DB. Score/approve/reject stay on policyShadowTeacherWrite.
 */
const Teacher = require('../models/Teacher');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyTeacherRoute,
  evaluatePolicyTeacherRoute,
  compareDecisions,
  ACTIONS,
} = require('../services/policyShadow/teacherRoutePolicy');
const { TEACHER_WRITE_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function policyShadowTeacherRoute(action) {
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

      let resourceTeacher = null;
      const resourceId = req.params?.id || null;
      if (def?.needsResource && resourceId) {
        resourceTeacher = await Teacher.findById(resourceId).select('branchId').lean();
      } else if (def?.branchAssert && resourceId) {
        resourceTeacher = await Teacher.findById(resourceId).select('branchId').lean();
      }
      // get_one / update_profile need resource for branch even when needsResource
      if ((action === 'get_one' || action === 'update_profile') && resourceId && !resourceTeacher) {
        resourceTeacher = await Teacher.findById(resourceId).select('branchId').lean();
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
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';

      try {
        legacy = evaluateLegacyTeacherRoute(subject, action, resourceTeacher, ctx);
        policy = evaluatePolicyTeacherRoute(subject, action, resourceTeacher, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `teacher_route_${action}`,
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
          '[POLICY_SHADOW] teacher route evaluation error — legacy still authoritative',
        );
        req.policyShadow = {
          action: `teacher_route_${action}`,
          comparison: 'ERROR',
          error: evalErr.message,
        };
        return next();
      }

      req.policyShadow = {
        action: `teacher_route_${action}`,
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
            action: `teacher_route_${action}`,
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
          '[POLICY_MISMATCH] teacher route shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `teacher_route_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected teacher route error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowTeacherRoute };
