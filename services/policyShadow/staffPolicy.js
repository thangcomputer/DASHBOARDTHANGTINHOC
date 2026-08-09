/**
 * Policy shadow for LIVE /api/staff (Wave 6.11).
 * Middleware: checkPermission(manage_staff).
 * Handler: SUPER/HIGH creation & mutation gates (mirrored).
 */
const { MANAGE_STAFF_LIVE, actorHasLivePermission } = require('./livePermissionAdapter');

const ACTIONS = new Set(['list', 'create', 'update', 'delete']);

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

function isRootSuperAdmin(subject) {
  return subject.id === 'admin';
}
function isSuperAdmin(subject) {
  return subject.id === 'admin' || subject.adminRole === 'SUPER_ADMIN';
}

/** Mirrors checkPermission(manage_staff). */
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

function evaluateList(subject) {
  return requireManageStaff(subject);
}

function evaluateCreate(subject, ctx) {
  const base = requireManageStaff(subject);
  if (base.decision === 'DENY') return base;
  const requested = String(ctx.requestedAdminRole || 'STAFF');
  if (requested === 'SUPER_ADMIN' && !isRootSuperAdmin(subject)) {
    return { decision: 'DENY', reason: 'only_root_creates_super', statusHint: 403 };
  }
  if (requested === 'HIGH_ADMIN' && !isSuperAdmin(subject)) {
    return { decision: 'DENY', reason: 'only_super_creates_high', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'staff_create_ok', statusHint: 200 };
}

function evaluateUpdate(subject, ctx) {
  const base = requireManageStaff(subject);
  if (base.decision === 'DENY') return base;
  if (!ctx.target) {
    return { decision: 'ALLOW', reason: 'missing_staff_handler_404', statusHint: 200 };
  }
  if (ctx.target.adminRole === 'SUPER_ADMIN' && !isRootSuperAdmin(subject)) {
    return { decision: 'DENY', reason: 'only_root_edits_super', statusHint: 403 };
  }
  if (ctx.target.adminRole === 'HIGH_ADMIN' && !isSuperAdmin(subject)) {
    return { decision: 'DENY', reason: 'only_super_edits_high', statusHint: 403 };
  }
  if (ctx.roleChanging && !isRootSuperAdmin(subject)) {
    return { decision: 'DENY', reason: 'only_root_changes_role', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'staff_update_ok', statusHint: 200 };
}

function evaluateDelete(subject, ctx) {
  const base = requireManageStaff(subject);
  if (base.decision === 'DENY') return base;
  // Self-delete → handler 400 after authz ALLOW
  if (!ctx.target) {
    return { decision: 'ALLOW', reason: 'missing_staff_handler_404', statusHint: 200 };
  }
  if (ctx.target.adminRole === 'SUPER_ADMIN' && !isRootSuperAdmin(subject)) {
    return { decision: 'DENY', reason: 'only_root_deletes_super', statusHint: 403 };
  }
  if (ctx.target.adminRole === 'HIGH_ADMIN' && !isSuperAdmin(subject)) {
    return { decision: 'DENY', reason: 'only_super_deletes_high', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'staff_delete_ok', statusHint: 200 };
}

function evaluateLegacyStaff(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  switch (action) {
    case 'list':
      return evaluateList(subject);
    case 'create':
      return evaluateCreate(subject, ctx);
    case 'update':
      return evaluateUpdate(subject, ctx);
    case 'delete':
      return evaluateDelete(subject, ctx);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

function evaluatePolicyStaff(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  const legacy = evaluateLegacyStaff(subject, action, ctx);
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
  evaluateLegacyStaff,
  evaluatePolicyStaff,
  compareDecisions,
  requireManageStaff,
  MANAGE_STAFF_LIVE,
};
