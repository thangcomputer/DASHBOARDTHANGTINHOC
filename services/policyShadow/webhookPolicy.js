/**
 * Policy shadow for LIVE /api/webhooks (Wave 6.16).
 *
 * JWT payment-session / payment-status routes already shadowed by financePolicy (Wave 6.6).
 * This module covers SePay provider gate ONLY — observational, no re-verify crypto,
 * no ledger/session/invoice writes, no socket emit.
 *
 * ctx.verificationStatus (trusted, set after Legacy verifySepaySignature next()):
 *   'verified' | 'dev_skip' | 'invalid_signature' | 'missing_signature'
 *   | 'invalid_api_key' | 'not_configured_production' | 'invalid_credentials'
 */
const ACTIONS = new Set(['sepay']);

function buildSubject({ user, actorDoc, userBranchId }) {
  return {
    id: String(user?.id || user?._id || ''),
    role: String(user?.role || actorDoc?.role || ''),
    adminRole: actorDoc?.adminRole || user?.adminRole || null,
    permissions: Array.isArray(actorDoc?.permissions)
      ? actorDoc.permissions
      : (Array.isArray(user?.permissions) ? user.permissions : []),
    userBranchId: userBranchId != null && userBranchId !== '' ? String(userBranchId) : null,
  };
}

/**
 * Mirror verifySepaySignature outcomes as authorization decisions.
 * Does NOT perform HMAC/API key crypto — uses trusted ctx from Legacy gate / tests.
 */
function evaluateSepayVerification(ctx = {}) {
  const status = ctx.verificationStatus || 'unknown';
  switch (status) {
    case 'verified':
      return {
        decision: 'ALLOW',
        reason: 'sepay_verified',
        statusHint: 200,
        verificationDecision: 'verified',
        permission: 'sepay_provider',
      };
    case 'dev_skip':
      return {
        decision: 'ALLOW',
        reason: 'sepay_dev_skip_no_keys',
        statusHint: 200,
        verificationDecision: 'dev_skip',
        permission: 'sepay_provider',
      };
    case 'not_configured_production':
      return {
        decision: 'DENY',
        reason: 'sepay_not_configured',
        statusHint: 503,
        verificationDecision: 'not_configured',
        permission: 'sepay_provider',
      };
    case 'missing_signature':
      return {
        decision: 'DENY',
        reason: 'sepay_missing_signature',
        statusHint: 401,
        verificationDecision: 'missing_signature',
        permission: 'sepay_provider',
      };
    case 'invalid_signature':
      return {
        decision: 'DENY',
        reason: 'sepay_invalid_signature',
        statusHint: 401,
        verificationDecision: 'invalid_signature',
        permission: 'sepay_provider',
      };
    case 'invalid_api_key':
      return {
        decision: 'DENY',
        reason: 'sepay_invalid_api_key',
        statusHint: 401,
        verificationDecision: 'invalid_api_key',
        permission: 'sepay_provider',
      };
    case 'invalid_credentials':
      return {
        decision: 'DENY',
        reason: 'sepay_invalid_credentials',
        statusHint: 401,
        verificationDecision: 'invalid_credentials',
        permission: 'sepay_provider',
      };
    default:
      return {
        decision: 'DENY',
        reason: 'sepay_unknown_verification',
        statusHint: 401,
        verificationDecision: 'unknown',
        permission: 'sepay_provider',
      };
  }
}

function evaluateLegacyWebhook(subject, action, ctx = {}) {
  void subject;
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  if (action === 'sepay') {
    return evaluateSepayVerification(ctx);
  }
  return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
}

function evaluatePolicyWebhook(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyUserId;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  void _untrusted.bodyProvider;
  void _untrusted.spoofedSignature;
  // Never trust client signature/secret fields as actor — only ctx.verificationStatus
  const legacy = evaluateLegacyWebhook(subject, action, ctx);
  if (legacy.decision === 'DENY') {
    return {
      ...legacy,
      reason: legacy.reason.startsWith('policy_') ? legacy.reason : `policy_${legacy.reason}`,
    };
  }
  return { ...legacy, reason: 'policy_allow', verificationDecision: legacy.verificationDecision };
}

function compareDecisions(legacy, policy) {
  if (!legacy || !policy) return 'UNKNOWN';
  if (legacy.decision === policy.decision) return 'MATCH';
  return 'MISMATCH';
}

module.exports = {
  ACTIONS,
  buildSubject,
  evaluateSepayVerification,
  evaluateLegacyWebhook,
  evaluatePolicyWebhook,
  compareDecisions,
};
