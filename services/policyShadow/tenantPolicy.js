/**
 * Policy shadow for LIVE /api/tenants (Wave 6.13).
 * Legacy gate: authMiddleware + isSuperAdmin ONLY.
 * No permission from constants/permissions.js — do not invent manage_tenants.
 * No branchFilter on these routes. No per-tenant ownership.
 * Cross-tenant: SUPER can access any tenant (list/get/stats/update/assign).
 * Missing resource → handler 404 after authz ALLOW.
 */
const ACTIONS = new Set([
  'list',
  'meta_branches',
  'stats',
  'get',
  'create',
  'update',
  'assign_branch',
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

/**
 * Mirrors middleware/auth.js isSuperAdmin:
 * - id === 'admin' → ALLOW
 * - DB adminRole === SUPER_ADMIN → ALLOW
 * - else → DENY 403 (including missing id / HIGH / STAFF / SUPPORT / teacher / student)
 * Note: unauthenticated usually 401 via authMiddleware first; isSuperAdmin itself uses 403 when !id.
 */
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

function evaluateLegacyTenant(subject, action, _ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  const base = evaluateIsSuperAdmin(subject);
  if (base.decision === 'DENY') return base;
  // All tenant CRUD/list share the same SUPER gate; no resource ownership / branch HTTP deny
  return {
    ...base,
    reason: `${base.reason}_tenant_platform`,
    dataScope: 'none',
    ownership: 'none',
  };
}

function evaluatePolicyTenant(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyUserId;
  void _untrusted.bodyTenantId;
  void _untrusted.queryTenantId;
  void _untrusted.bodyBranchId;
  void _untrusted.queryBranchId;
  void ctx.resourceTenant;
  void ctx.paramsId;
  const legacy = evaluateLegacyTenant(subject, action, ctx);
  if (legacy.decision === 'DENY') {
    return {
      ...legacy,
      reason: legacy.reason.startsWith('policy_') ? legacy.reason : `policy_${legacy.reason}`,
    };
  }
  return {
    ...legacy,
    reason: 'policy_allow',
    dataScope: legacy.dataScope,
    ownership: legacy.ownership,
  };
}

function compareDecisions(legacy, policy) {
  if (!legacy || !policy) return 'UNKNOWN';
  if (legacy.decision === policy.decision) return 'MATCH';
  return 'MISMATCH';
}

module.exports = {
  ACTIONS,
  buildSubject,
  evaluateIsSuperAdmin,
  evaluateLegacyTenant,
  evaluatePolicyTenant,
  compareDecisions,
};
