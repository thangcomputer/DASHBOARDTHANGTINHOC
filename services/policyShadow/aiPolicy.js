/**
 * Policy shadow for LIVE /api/ai (Wave 6.18).
 * Legacy gate: authMiddleware + isAdmin (role admin|staff).
 * No AI permission invented. Branch/tenant/ownership: ignored.
 * sensitiveFlowLimiter is rate/business — not modeled as authz.
 */
const ACTIONS = new Set([
  'status',
  'quiz',
  'notification_draft',
  'summarize',
  'complete',
]);

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

/** Mirrors isAdmin — JWT role admin OR staff. */
function evaluateIsAdmin(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'admin' || role === 'staff') {
    return {
      decision: 'ALLOW',
      reason: 'role_admin_or_staff',
      statusHint: 200,
      dataScope: 'none',
      branch: 'ignored',
      tenant: 'ignored',
      ownership: 'none',
    };
  }
  return { decision: 'DENY', reason: 'not_admin_staff_role', statusHint: 403 };
}

function evaluateLegacyAi(subject, action) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  return evaluateIsAdmin(subject);
}

function evaluatePolicyAi(subject, action, _ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyUserId;
  void _untrusted.bodyOwnerId;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  const legacy = evaluateLegacyAi(subject, action);
  if (legacy.decision === 'DENY') {
    return {
      ...legacy,
      reason: legacy.reason.startsWith('policy_') ? legacy.reason : `policy_${legacy.reason}`,
    };
  }
  return { ...legacy, reason: 'policy_allow' };
}

function compareDecisions(legacy, policy) {
  if (!legacy || !policy) return 'UNKNOWN';
  if (legacy.decision === policy.decision) return 'MATCH';
  return 'MISMATCH';
}

module.exports = {
  ACTIONS,
  buildSubject,
  evaluateLegacyAi,
  evaluatePolicyAi,
  compareDecisions,
};
