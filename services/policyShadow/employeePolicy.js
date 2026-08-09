/**
 * Policy shadow for LIVE /api/employees (Wave 6.11).
 * Middleware: MANAGE_HR + branchFilter (list = data filter).
 * Mutations: HTTP 403 on cross-branch when userBranchId set.
 */
const { MANAGE_HR_LIVE, actorHasLivePermission } = require('./livePermissionAdapter');

const ACTIONS = new Set([
  'list',
  'stats',
  'create',
  'update',
  'delete',
  'pay',
  'payroll',
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

function requireManageHr(subject) {
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
  if (!actorHasLivePermission(subject, MANAGE_HR_LIVE)) {
    return { decision: 'DENY', reason: 'missing_manage_hr', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'has_manage_hr', statusHint: 200 };
}

function evaluateListLike(subject) {
  // branchFilter scopes DATA — not HTTP DENY
  return requireManageHr(subject);
}

function evaluateCreate(subject) {
  return requireManageHr(subject);
}

function evaluateBranchMutation(subject, ctx) {
  const base = requireManageHr(subject);
  if (base.decision === 'DENY') return base;
  // Legacy: if (!emp) skip branch DENY → handler 404; if emp && String(branchId) !== userBranchId → 403
  if (!ctx.employee) {
    return { decision: 'ALLOW', reason: 'missing_employee_handler_404', statusHint: 200 };
  }
  if (subject.userBranchId && String(ctx.employee.branchId) !== String(subject.userBranchId)) {
    return { decision: 'DENY', reason: 'cross_branch', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'employee_mutation_ok', statusHint: 200 };
}

function evaluateLegacyEmployee(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  switch (action) {
    case 'list':
    case 'stats':
    case 'payroll':
      return evaluateListLike(subject);
    case 'create':
      return evaluateCreate(subject);
    case 'update':
    case 'delete':
    case 'pay':
      return evaluateBranchMutation(subject, ctx);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

function evaluatePolicyEmployee(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  void _untrusted.clientRole;
  void _untrusted.clientPermissions;
  const legacy = evaluateLegacyEmployee(subject, action, ctx);
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
  evaluateLegacyEmployee,
  evaluatePolicyEmployee,
  compareDecisions,
  MANAGE_HR_LIVE,
};
