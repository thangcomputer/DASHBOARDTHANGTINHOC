/**
 * Policy shadow for LIVE /api/backups (Wave 6.14).
 * Legacy: authMiddleware + isSuperAdmin. Platform-wide. No branch/tenant/ownership HTTP gates.
 */
const ACTIONS = new Set(['stats', 'list', 'create', 'download', 'delete']);

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

/** Mirrors middleware isSuperAdmin. */
function evaluateIsSuperAdmin(subject) {
  if (subject?.id === 'admin') {
    return { decision: 'ALLOW', reason: 'hardcoded_admin', statusHint: 200 };
  }
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'missing_actor_id', statusHint: 403 };
  }
  if (subject.adminRole === 'SUPER_ADMIN') {
    return { decision: 'ALLOW', reason: 'super_admin', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_super_admin', statusHint: 403 };
}

function evaluateLegacyBackup(subject, action) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  const base = evaluateIsSuperAdmin(subject);
  if (base.decision === 'DENY') return base;
  return {
    ...base,
    reason: `${base.reason}_backup_platform`,
    dataScope: 'none',
    ownership: 'none',
  };
}

function evaluatePolicyBackup(subject, action, _ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  const legacy = evaluateLegacyBackup(subject, action);
  if (legacy.decision === 'DENY') {
    return {
      ...legacy,
      reason: legacy.reason.startsWith('policy_') ? legacy.reason : `policy_${legacy.reason}`,
    };
  }
  return { ...legacy, reason: 'policy_allow', dataScope: legacy.dataScope, ownership: legacy.ownership };
}

function compareDecisions(legacy, policy) {
  if (!legacy || !policy) return 'UNKNOWN';
  if (legacy.decision === policy.decision) return 'MATCH';
  return 'MISMATCH';
}

module.exports = {
  ACTIONS,
  buildSubject,
  evaluateLegacyBackup,
  evaluatePolicyBackup,
  compareDecisions,
};
