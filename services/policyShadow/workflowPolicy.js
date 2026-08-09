/**
 * Policy shadow for LIVE /api/workflows (Wave 6.18).
 * Legacy gate: authMiddleware + isAdmin (role admin|staff).
 * No MANAGE_WORKFLOWS. No creator ownership on get/advance.
 * Branch/tenant: ignored. Advance side effects stay in Legacy only.
 */
const ACTIONS = new Set([
  'definitions',
  'list',
  'sync',
  'get',
  'create',
  'advance',
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
      ownership: 'none_any_admin',
    };
  }
  return { decision: 'DENY', reason: 'not_admin_staff_role', statusHint: 403 };
}

/**
 * get/advance: middleware ALLOW → handler 404 if missing (no ownership).
 */
function evaluateLegacyWorkflow(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  const base = evaluateIsAdmin(subject);
  if (base.decision === 'DENY') return base;
  if ((action === 'get' || action === 'advance') && !ctx.instance) {
    return { ...base, reason: 'missing_instance_handler_404', statusHint: 200 };
  }
  return base;
}

function evaluatePolicyWorkflow(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyUserId;
  void _untrusted.bodyOwnerId;
  void _untrusted.bodyCreatedBy;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  const legacy = evaluateLegacyWorkflow(subject, action, ctx);
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
  evaluateLegacyWorkflow,
  evaluatePolicyWorkflow,
  compareDecisions,
};
