/**
 * Policy SHADOW for /api/employees. Always next(); never alters HTTP.
 */
const Teacher = require('../models/Teacher');
const Employee = require('../models/Employee');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyEmployee,
  evaluatePolicyEmployee,
  compareDecisions,
} = require('../services/policyShadow/employeePolicy');
const { MANAGE_HR_LIVE } = require('../services/policyShadow/livePermissionAdapter');

function policyShadowEmployee(action) {
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
      });

      const untrusted = {
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId,
        clientRole: req.body?.role,
        clientPermissions: req.body?.permissions,
      };

      const ctx = {};
      if (['update', 'delete', 'pay'].includes(action) && req.params?.id) {
        ctx.employee = await Employee.findById(req.params.id).select('branchId').lean();
      }

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyEmployee(subject, action, ctx);
        policy = evaluatePolicyEmployee(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `employee_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: MANAGE_HR_LIVE,
            resourceType: 'employee',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] employee evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `employee_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `employee_${action}`,
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
            action: `employee_${action}`,
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: MANAGE_HR_LIVE,
            resourceType: 'employee',
            resourceId: req.params?.id || null,
            branch: subject.userBranchId,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] employee shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `employee_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected employee error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowEmployee };
