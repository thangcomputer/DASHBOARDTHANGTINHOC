/**
 * Policy shadow for LIVE /api/system-logs (Wave 6.16).
 * Legacy: authMiddleware + isAdmin (role admin|staff).
 * VIEW_LOGS exists in constants but is UNUSED on these routes — do not invent wiring.
 * Platform-wide list (action allowlist is DATA filter, not HTTP deny by branch/tenant).
 */
const ACTIONS = new Set(['list', 'create', 'delete']);

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
      dataScope: 'platform',
      permission: 'isAdmin',
    };
  }
  return { decision: 'DENY', reason: 'not_admin_staff_role', statusHint: 403, permission: 'isAdmin' };
}

function evaluateLegacySystemLog(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  const base = evaluateIsAdmin(subject);
  if (base.decision === 'DENY') return base;
  if (action === 'delete' && !ctx.log) {
    return {
      ...base,
      reason: 'missing_log_handler_404',
      dataScope: 'platform',
    };
  }
  // create: body.action allowlist is business 400 after authz — not HTTP 403
  return {
    ...base,
    reason: `${base.reason}_system_log`,
    dataScope: 'platform',
  };
}

function evaluatePolicySystemLog(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  void _untrusted.bodyUserId;
  void _untrusted.queryBranchId;
  // body.action is operation allowlist param — not actor identity
  void _untrusted.bodyAction;
  const legacy = evaluateLegacySystemLog(subject, action, ctx);
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
  evaluateIsAdmin,
  evaluateLegacySystemLog,
  evaluatePolicySystemLog,
  compareDecisions,
};
