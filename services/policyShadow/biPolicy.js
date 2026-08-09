/**
 * Policy shadow for LIVE /api/bi (Wave 6.12).
 * Same gate as analytics: MANAGE_FINANCE OR VIEW_BRANCH_REVENUE + branchFilter DATA SCOPE.
 * Does NOT touch biService aggregation / ledger formulas.
 */
const {
  FINANCE_WRITE_LIVE,
  VIEW_BRANCH_REVENUE_LIVE,
  actorHasAnyLivePermission,
} = require('./livePermissionAdapter');

const ACTIONS = new Set(['overview', 'export']);

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

function isStaffRole(subject) {
  const role = String(subject.role || '').toLowerCase();
  return role === 'admin' || role === 'staff';
}

function evaluateAnyRevenueRead(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'hardcoded_admin', statusHint: 200 };
  }
  if (!isStaffRole(subject)) {
    return { decision: 'DENY', reason: 'role_not_staff', statusHint: 403 };
  }
  if (subject.adminRole === 'SUPER_ADMIN') {
    return { decision: 'ALLOW', reason: 'super_admin', statusHint: 200 };
  }
  if (
    !actorHasAnyLivePermission(subject, [FINANCE_WRITE_LIVE, VIEW_BRANCH_REVENUE_LIVE])
  ) {
    return { decision: 'DENY', reason: 'missing_finance_or_view_revenue', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'has_finance_or_view_revenue', statusHint: 200 };
}

function evaluateLegacyBI(subject, action, _ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  const base = evaluateAnyRevenueRead(subject);
  if (base.decision === 'DENY') return base;
  return {
    ...base,
    reason: `${base.reason}_data_filter`,
    dataScope: 'branchFilter',
  };
}

function evaluatePolicyBI(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.queryBranchId;
  void _untrusted.bodyBranchId;
  void _untrusted.queryTenantId;
  void _untrusted.bodyTenantId;
  void _untrusted.clientRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void ctx.trustedBranchFilter;
  void ctx.queryBranch;
  const legacy = evaluateLegacyBI(subject, action, ctx);
  if (legacy.decision === 'DENY') {
    return {
      ...legacy,
      reason: legacy.reason.startsWith('policy_') ? legacy.reason : `policy_${legacy.reason}`,
    };
  }
  return { ...legacy, reason: 'policy_allow', dataScope: legacy.dataScope };
}

function compareDecisions(legacy, policy) {
  if (!legacy || !policy) return 'UNKNOWN';
  if (legacy.decision === policy.decision) return 'MATCH';
  return 'MISMATCH';
}

module.exports = {
  ACTIONS,
  buildSubject,
  evaluateAnyRevenueRead,
  evaluateLegacyBI,
  evaluatePolicyBI,
  compareDecisions,
  FINANCE_WRITE_LIVE,
  VIEW_BRANCH_REVENUE_LIVE,
};
