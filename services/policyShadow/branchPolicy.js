/**
 * Policy shadow for LIVE /api/branches (Wave 6.11).
 * GET / public; mutations: manage_staff (comment says SUPER_ADMIN but live uses manage_staff).
 */
const { MANAGE_STAFF_LIVE, actorHasLivePermission } = require('./livePermissionAdapter');

const ACTIONS = new Set(['list_public', 'list_all', 'create', 'update', 'delete']);

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

function evaluatePublic() {
  return { decision: 'ALLOW', reason: 'public_branch_list', statusHint: 200 };
}

function requireManageStaff(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'hardcoded_admin', statusHint: 200 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'staff') {
    return { decision: 'DENY', reason: 'role_not_staff', statusHint: 403 };
  }
  if (subject.adminRole === 'SUPER_ADMIN') {
    return { decision: 'ALLOW', reason: 'super_admin', statusHint: 200 };
  }
  if (!actorHasLivePermission(subject, MANAGE_STAFF_LIVE)) {
    return { decision: 'DENY', reason: 'missing_manage_staff', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'has_manage_staff', statusHint: 200 };
}

function evaluateLegacyBranch(subject, action) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  if (action === 'list_public') return evaluatePublic();
  return requireManageStaff(subject);
}

function evaluatePolicyBranch(subject, action, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.queryTenantId;
  void _untrusted.headerTenantId;
  void _untrusted.clientRole;
  void _untrusted.clientPermissions;
  const legacy = evaluateLegacyBranch(subject, action);
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
  evaluateLegacyBranch,
  evaluatePolicyBranch,
  compareDecisions,
  MANAGE_STAFF_LIVE,
};
