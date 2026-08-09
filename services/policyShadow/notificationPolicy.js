/**
 * Policy shadow for LIVE notification routes (Wave 6.8).
 * Mirrors routes/notificationRoutes.js + middleware isAdmin (role admin|staff).
 */
const ACTIONS = new Set([
  'list',
  'count',
  'unread',
  'mark_read',
  'dismiss',
  'broadcast',
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

function evaluateAuthOnly(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  return { decision: 'ALLOW', reason: 'authenticated_self_scope', statusHint: 200 };
}

/** isAdmin middleware: role admin|staff only (no permission key). */
function evaluateBroadcast(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'admin' || role === 'staff') {
    return { decision: 'ALLOW', reason: 'is_admin_broadcast', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_admin_staff', statusHint: 403 };
}

function evaluateLegacyNotification(subject, action) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  if (action === 'broadcast') return evaluateBroadcast(subject);
  return evaluateAuthOnly(subject);
}

function evaluatePolicyNotification(subject, action, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.clientRole;
  void _untrusted.clientPermissions;
  void _untrusted.receivers;
  const legacy = evaluateLegacyNotification(subject, action);
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
  evaluateLegacyNotification,
  evaluatePolicyNotification,
  compareDecisions,
};
