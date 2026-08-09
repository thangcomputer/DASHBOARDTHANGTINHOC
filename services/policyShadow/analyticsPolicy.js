/**
 * Policy shadow for LIVE /api/analytics (Wave 6.12).
 * Middleware: checkAnyPermission(MANAGE_FINANCE, VIEW_BRANCH_REVENUE) + branchFilter.
 * Branch/tenant are DATA SCOPE (not HTTP DENY) for revenue/enrollment.
 * GET /branches: handler IGNORES branchFilter (weak legacy — mirrored as ALLOW after perm).
 * Does NOT touch ledger/aggregation formulas.
 */
const {
  FINANCE_WRITE_LIVE,
  VIEW_BRANCH_REVENUE_LIVE,
  actorHasAnyLivePermission,
} = require('./livePermissionAdapter');

const ACTIONS = new Set(['revenue', 'enrollment', 'branches']);

/** Actions that apply req.branchFilter (+ optional query branch) as DATA filter. */
const DATA_FILTER_ACTIONS = new Set(['revenue', 'enrollment']);
/** Handler ignores branchFilter — returns all-branch aggregates (P2 preserved). */
const HANDLER_IGNORES_BRANCH_FILTER = new Set(['branches']);

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

/**
 * Mirrors checkAnyPermission(MANAGE_FINANCE, VIEW_BRANCH_REVENUE).
 * BranchFilter is NOT part of HTTP decision.
 */
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

function evaluateLegacyAnalytics(subject, action, _ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  const base = evaluateAnyRevenueRead(subject);
  if (base.decision === 'DENY') return base;
  if (DATA_FILTER_ACTIONS.has(action)) {
    return {
      ...base,
      reason: `${base.reason}_data_filter`,
      dataScope: 'branchFilter',
    };
  }
  if (HANDLER_IGNORES_BRANCH_FILTER.has(action)) {
    return {
      ...base,
      reason: `${base.reason}_handler_ignores_branch_filter`,
      dataScope: 'none',
    };
  }
  return base;
}

function evaluatePolicyAnalytics(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.queryBranchId;
  void _untrusted.bodyBranchId;
  void _untrusted.queryTenantId;
  void _untrusted.bodyTenantId;
  void _untrusted.clientRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  // query branchId is a DATA FILTER param when unbound — not actor identity
  void ctx.trustedBranchFilter;
  void ctx.queryBranch;
  const legacy = evaluateLegacyAnalytics(subject, action, ctx);
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
  DATA_FILTER_ACTIONS,
  HANDLER_IGNORES_BRANCH_FILTER,
  buildSubject,
  evaluateAnyRevenueRead,
  evaluateLegacyAnalytics,
  evaluatePolicyAnalytics,
  compareDecisions,
  FINANCE_WRITE_LIVE,
  VIEW_BRANCH_REVENUE_LIVE,
};
