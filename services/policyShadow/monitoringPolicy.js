/**
 * Policy shadow for LIVE /api/monitoring (Wave 6.14).
 * Middleware: isAdmin (role admin|staff). Reset adds handler SUPER check.
 */
const ACTIONS = new Set(['health', 'metrics', 'overview', 'metrics_reset']);

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

/** Mirrors isAdmin — JWT role admin OR staff (name is misleading). */
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

function evaluateMetricsReset(subject) {
  const base = evaluateIsAdmin(subject);
  if (base.decision === 'DENY') return base;
  if (subject.id === 'admin' || subject.adminRole === 'SUPER_ADMIN') {
    return { decision: 'ALLOW', reason: 'super_metrics_reset', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'metrics_reset_super_only', statusHint: 403 };
}

function evaluateLegacyMonitoring(subject, action) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  if (action === 'metrics_reset') return evaluateMetricsReset(subject);
  return evaluateIsAdmin(subject);
}

function evaluatePolicyMonitoring(subject, action, _ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  const legacy = evaluateLegacyMonitoring(subject, action);
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
  evaluateLegacyMonitoring,
  evaluatePolicyMonitoring,
  compareDecisions,
};
