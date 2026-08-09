/**
 * Policy SHADOW for SePay webhook only. Always next().
 * Must run AFTER verifySepaySignature. Does not re-verify, mutate finance, or emit.
 */
const logger = require('../config/logger');
const {
  buildSubject,
  evaluateLegacyWebhook,
  evaluatePolicyWebhook,
  compareDecisions,
} = require('../services/policyShadow/webhookPolicy');

function policyShadowWebhook(action) {
  return async (req, res, next) => {
    try {
      // SePay has no JWT actor — subject is empty / system provider context
      const subject = buildSubject({
        user: req.user || { id: 'sepay', role: 'system' },
        actorDoc: null,
        userBranchId: null,
      });

      // Trusted: only reached if Legacy verifySepaySignature called next()
      const ctx = {
        verificationStatus: req.sepayVerificationStatus || 'verified',
      };

      const untrusted = {
        bodyRole: req.body?.role,
        clientAdminRole: req.body?.adminRole,
        clientPermissions: req.body?.permissions,
        bodyUserId: req.body?.userId,
        bodyBranchId: req.body?.branchId,
        bodyTenantId: req.body?.tenantId,
        bodyProvider: req.body?.provider,
        spoofedSignature: req.headers?.['x-sepay-token'],
      };

      let legacy;
      let policy;
      let comparison = 'UNKNOWN';
      try {
        legacy = evaluateLegacyWebhook(subject, action, ctx);
        policy = evaluatePolicyWebhook(subject, action, ctx, untrusted);
        comparison = compareDecisions(legacy, policy);
      } catch (evalErr) {
        comparison = 'ERROR';
        logger.warn(
          {
            event: 'POLICY_SHADOW_ERROR',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `webhook_${action}`,
            userRole: subject.role,
            permission: 'sepay_provider',
            resourceType: 'webhook',
            err: evalErr.message,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_SHADOW] webhook evaluation error — legacy still authoritative',
        );
        req.policyShadow = { action: `webhook_${action}`, comparison: 'ERROR', error: evalErr.message };
        return next();
      }

      req.policyShadow = {
        action: `webhook_${action}`,
        comparison,
        legacyDecision: legacy.decision,
        policyDecision: policy.decision,
        legacyReason: legacy.reason,
        policyReason: policy.reason,
        verificationDecision: legacy.verificationDecision || null,
      };

      if (comparison === 'MISMATCH') {
        logger.warn(
          {
            event: 'POLICY_MISMATCH',
            route: req.originalUrl || req.path,
            method: req.method,
            action: `webhook_${action}`,
            userRole: subject.role,
            permission: 'sepay_provider',
            resourceType: 'webhook',
            legacyDecision: legacy.decision,
            policyDecision: policy.decision,
            legacyReason: legacy.reason,
            policyReason: policy.reason,
            verificationDecision: legacy.verificationDecision || null,
            requestId: req.requestId,
            correlationId: req.correlationId,
          },
          '[POLICY_MISMATCH] webhook shadow disagrees — HTTP unchanged',
        );
      }
    } catch (err) {
      logger.warn(
        {
          event: 'POLICY_SHADOW_ERROR',
          action: `webhook_${action}`,
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_SHADOW] unexpected webhook error — fail closed to legacy only',
      );
    }
    return next();
  };
}

module.exports = { policyShadowWebhook };
