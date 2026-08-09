/**
 * Policy SHADOW for /api/workflows. Always next(); never advances / emits / syncs.
 */
const Teacher = require('../models/Teacher');
const WorkflowInstance = require('../models/WorkflowInstance');
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyWorkflow,
  evaluatePolicyWorkflow,
  compareDecisions,
} = require('../services/policyShadow/workflowPolicy');

function policyShadowWorkflow(action) {
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

      const ctx = { instance: null };
      if ((action === 'get' || action === 'advance') && req.params?.id) {
        if (/^[a-f0-9]{24}$/i.test(req.params.id)) {
          ctx.instance = await WorkflowInstance.findById(req.params.id)
            .select('_id status createdBy definitionKey')
            .lean();
        }
      }

      const untrusted = {
        bodyRole: req.body?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        bodyUserId: req.body?.userId,
        bodyOwnerId: req.body?.ownerId,
        bodyCreatedBy: req.body?.createdBy,
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId,
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyWorkflow(subject, action, ctx);
        policy = evaluatePolicyWorkflow(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `workflow_${action}`,
            policyName: 'workflowPolicy',
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'isAdmin',
            resourceType: 'workflow',
            resourceId: req.params?.id || null,
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] workflow evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `workflow_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `workflow_${action}`,
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
            action: `workflow_${action}`,
            policyName: 'workflowPolicy',
            userRole: subject.role,
            adminRole: subject.adminRole,
            permission: 'isAdmin',
            resourceType: 'workflow',
            resourceId: req.params?.id || null,
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] workflow shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `workflow_${action}`,
          policyName: 'workflowPolicy',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected workflow error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowWorkflow };
