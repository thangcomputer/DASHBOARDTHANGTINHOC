/**
 * Policy shadow for LIVE /api/proctor (Wave 6.15).
 * events/ingest + events/me: auth-only.
 * events/:userId: isAdmin (role admin|staff).
 * ingest binds userId from JWT actor — not client spoof.
 */
const ACTIONS = new Set(['events_ingest', 'events_me', 'events_user']);

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

function evaluateAuthOnly(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  return { decision: 'ALLOW', reason: 'authenticated', statusHint: 200 };
}

/** Mirrors isAdmin — role admin OR staff. */
function evaluateIsAdmin(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'admin' || role === 'staff') {
    return { decision: 'ALLOW', reason: 'role_admin_or_staff', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_admin_staff_role', statusHint: 403 };
}

function evaluateLegacyProctor(subject, action) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  if (action === 'events_user') return evaluateIsAdmin(subject);
  return evaluateAuthOnly(subject);
}

function evaluatePolicyProctor(subject, action, _ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyUserId;
  void _untrusted.paramsUserId;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  const legacy = evaluateLegacyProctor(subject, action);
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
  evaluateLegacyProctor,
  evaluatePolicyProctor,
  compareDecisions,
};
