/**
 * Policy shadow for remaining LIVE teacher routes (Wave 6.5).
 * Wave 6 already covers score/approve/reject via teacherMutationPolicy.
 * This module mirrors routes/teacherRoutes.js exactly — no authz redesign.
 */
const {
  TEACHER_WRITE_LIVE,
  FINANCE_WRITE_LIVE,
  actorHasLivePermission,
  PERMISSIONS,
} = require('./livePermissionAdapter');

const VIEW_TEACHERS_LIVE = PERMISSIONS.VIEW_TEACHERS;
const MANAGE_TRAINING_LIVE = PERMISSIONS.MANAGE_TRAINING;

const ACTIONS = {
  list: { needsResource: false, branchAssert: false },
  stats_summary: { needsResource: false, branchAssert: false },
  get_one: { needsResource: true, branchAssert: true },
  update_profile: { needsResource: true, branchAssert: true },
  create: { needsResource: false, branchAssert: false },
  delete: { needsResource: false, branchAssert: false },
  upload_practical: { needsResource: false, branchAssert: false },
  submit_practical: { needsResource: true, branchAssert: false },
  finance_self: { needsResource: false, branchAssert: false },
  finance_pending: { needsResource: false, branchAssert: false },
  finance_pay_flexible: { needsResource: false, branchAssert: false },
  finance_pay_all: { needsResource: false, branchAssert: false },
};

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

/** checkPermission semantics for a live permission key */
function evaluateCheckPermission(subject, livePermission) {
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
  if (!actorHasLivePermission(subject, livePermission)) {
    return { decision: 'DENY', reason: `missing_${livePermission}`, statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: `has_${livePermission}`, statusHint: 200 };
}

/** superAdminOnlyTeacher middleware — Super hoặc HIGH_ADMIN */
function evaluateSuperAdminOnly(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'hardcoded_admin', statusHint: 200 };
  }
  if (subject.adminRole === 'SUPER_ADMIN') {
    return { decision: 'ALLOW', reason: 'super_admin', statusHint: 200 };
  }
  if (subject.adminRole === 'HIGH_ADMIN') {
    return { decision: 'ALLOW', reason: 'high_admin', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'super_admin_only', statusHint: 403 };
}

/** isAdmin middleware: role admin|staff */
function evaluateIsAdmin(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (!isStaffRole(subject)) {
    return { decision: 'DENY', reason: 'not_admin_role', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'admin_or_staff_role', statusHint: 200 };
}

/** isTeacher middleware: teacher|admin|staff */
function evaluateIsTeacherMiddleware(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'teacher' || role === 'admin' || role === 'staff') {
    return { decision: 'ALLOW', reason: 'is_teacher_middleware', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_teacher_middleware', statusHint: 403 };
}

/** assertTeacherBranchAccess */
function evaluateTeacherBranch(subject, resourceTeacher) {
  if (!subject?.userBranchId) {
    return { decision: 'ALLOW', reason: 'no_user_branch_scope', statusHint: 200 };
  }
  if (!resourceTeacher) {
    return { decision: 'DENY', reason: 'teacher_not_found', statusHint: 404 };
  }
  const teacherBranch =
    resourceTeacher.branchId != null && resourceTeacher.branchId !== ''
      ? String(resourceTeacher.branchId)
      : null;
  if (teacherBranch && teacherBranch !== String(subject.userBranchId)) {
    return { decision: 'DENY', reason: 'cross_branch', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'branch_ok', statusHint: 200 };
}

function evaluateList(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'teacher' || role === 'student') {
    return { decision: 'DENY', reason: 'list_role_denied', statusHint: 403 };
  }
  // Legacy: any other authenticated role (admin/staff) — no VIEW_TEACHERS required
  if (!isStaffRole(subject) && subject.id !== 'admin') {
    return { decision: 'DENY', reason: 'list_role_denied', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'list_admin_staff', statusHint: 200 };
}

function evaluateGetOne(subject, resourceId, resourceTeacher) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'student') {
    return { decision: 'DENY', reason: 'student_denied', statusHint: 403 };
  }
  if (role === 'teacher') {
    if (String(subject.id) !== String(resourceId)) {
      return { decision: 'DENY', reason: 'teacher_not_self', statusHint: 403 };
    }
    return { decision: 'ALLOW', reason: 'teacher_self', statusHint: 200 };
  }
  if (!isStaffRole(subject) && subject.id !== 'admin') {
    return { decision: 'DENY', reason: 'get_role_denied', statusHint: 403 };
  }
  // staff/admin: branch check applied separately
  return { decision: 'ALLOW', reason: 'staff_get', statusHint: 200 };
}

/**
 * PUT /:id — teacher self OR staff with SUPER | manage_training | manage_teachers
 */
function evaluateUpdateProfile(subject, resourceId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  const isSelfEdit = String(subject.id) === String(resourceId) && role === 'teacher';
  if (isSelfEdit) {
    return { decision: 'ALLOW', reason: 'teacher_self_edit', statusHint: 200 };
  }
  if (!isStaffRole(subject) && subject.id !== 'admin') {
    return { decision: 'DENY', reason: 'update_role_denied', statusHint: 403 };
  }
  if (subject.id === 'admin' || subject.adminRole === 'SUPER_ADMIN') {
    return { decision: 'ALLOW', reason: 'super_or_hardcoded', statusHint: 200 };
  }
  const perms = Array.isArray(subject.permissions) ? subject.permissions : [];
  if (perms.includes(MANAGE_TRAINING_LIVE) || perms.includes(TEACHER_WRITE_LIVE)) {
    return { decision: 'ALLOW', reason: 'has_training_or_manage_teachers', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'missing_manage_training_or_teachers', statusHint: 403 };
}

function evaluateSubmitPractical(subject, resourceId) {
  const mid = evaluateIsTeacherMiddleware(subject);
  if (mid.decision === 'DENY') return mid;
  if (String(subject.id) !== String(resourceId)) {
    return { decision: 'DENY', reason: 'submit_not_self', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'submit_self', statusHint: 200 };
}

/**
 * GET finance: role === 'admin' OR self (legacy — staff role is NOT treated as admin).
 */
function evaluateFinanceSelf(subject, resourceId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (String(subject.role || '').toLowerCase() === 'admin' || subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'admin_role_finance', statusHint: 200 };
  }
  if (String(subject.id) === String(resourceId)) {
    return { decision: 'ALLOW', reason: 'finance_self', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'finance_forbidden', statusHint: 403 };
}

function evaluateCreate(subject) {
  const admin = evaluateIsAdmin(subject);
  if (admin.decision === 'DENY') return admin;
  return evaluateSuperAdminOnly(subject);
}

function evaluateDelete(subject) {
  return evaluateCreate(subject);
}

function evaluateFinancePay(subject) {
  const fin = evaluateCheckPermission(subject, FINANCE_WRITE_LIVE);
  if (fin.decision === 'DENY') return fin;
  return evaluateSuperAdminOnly(subject);
}

function evaluateFamily(subject, action, resourceTeacher, resourceId) {
  switch (action) {
    case 'list':
      return evaluateList(subject);
    case 'stats_summary':
      return evaluateCheckPermission(subject, VIEW_TEACHERS_LIVE);
    case 'get_one':
      return evaluateGetOne(subject, resourceId, resourceTeacher);
    case 'update_profile':
      return evaluateUpdateProfile(subject, resourceId);
    case 'create':
      return evaluateCreate(subject);
    case 'delete':
      return evaluateDelete(subject);
    case 'upload_practical':
      return evaluateIsTeacherMiddleware(subject);
    case 'submit_practical':
      return evaluateSubmitPractical(subject, resourceId);
    case 'finance_self':
      return evaluateFinanceSelf(subject, resourceId);
    case 'finance_pending':
      return evaluateCheckPermission(subject, FINANCE_WRITE_LIVE);
    case 'finance_pay_flexible':
    case 'finance_pay_all':
      return evaluateFinancePay(subject);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

function evaluateLegacyTeacherRoute(subject, action, resourceTeacher, ctx = {}) {
  if (!ACTIONS[action]) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403, permission: null, branch: null };
  }
  const resourceId = ctx.resourceId != null ? String(ctx.resourceId) : null;
  const def = ACTIONS[action];
  const permission = evaluateFamily(subject, action, resourceTeacher, resourceId);
  if (permission.decision === 'DENY') {
    return {
      decision: 'DENY',
      reason: permission.reason,
      statusHint: permission.statusHint,
      permission,
      branch: null,
      action,
    };
  }
  if (def.branchAssert) {
    // get_one: branch only for staff; missing resource is handler 404 (not middleware 403)
    const role = String(subject.role || '').toLowerCase();
    if (action === 'get_one' && role === 'teacher') {
      return {
        decision: 'ALLOW',
        reason: 'legacy_allow',
        statusHint: 200,
        permission,
        branch: { decision: 'ALLOW', reason: 'self_skip_branch' },
        action,
      };
    }
    if (action === 'get_one' && !resourceTeacher) {
      return {
        decision: 'ALLOW',
        reason: 'legacy_allow',
        statusHint: 200,
        permission,
        branch: { decision: 'ALLOW', reason: 'get_one_missing_is_handler_404' },
        action,
      };
    }
    const branch = evaluateTeacherBranch(subject, resourceTeacher);
    if (branch.decision === 'DENY') {
      return {
        decision: 'DENY',
        reason: branch.reason,
        statusHint: branch.statusHint,
        permission,
        branch,
        action,
      };
    }
    return {
      decision: 'ALLOW',
      reason: 'legacy_allow',
      statusHint: 200,
      permission,
      branch,
      action,
    };
  }
  return {
    decision: 'ALLOW',
    reason: 'legacy_allow',
    statusHint: 200,
    permission,
    branch: { decision: 'ALLOW', reason: 'no_branch_assert' },
    action,
  };
}

function evaluatePolicyTeacherRoute(subject, action, resourceTeacher, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.queryBranchId;
  void _untrusted.queryTenantId;
  void _untrusted.bodyTenantId;
  void _untrusted.clientRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;

  const legacy = evaluateLegacyTeacherRoute(subject, action, resourceTeacher, ctx);
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

/** List data-scope: branch-bound includes null-branch teachers (legacy filter). */
function listScopeIncludesTeacher(trustedBranchFilter, teacherBranchId) {
  const bf = trustedBranchFilter || {};
  if (bf.branchId?.$in) {
    const got =
      teacherBranchId != null && teacherBranchId !== '' ? String(teacherBranchId) : null;
    if (got === null) return true;
    return bf.branchId.$in.map(String).includes(got);
  }
  if (bf.branchId != null && bf.branchId !== '') {
    const got =
      teacherBranchId != null && teacherBranchId !== '' ? String(teacherBranchId) : null;
    if (got === null) return true;
    return got === String(bf.branchId);
  }
  return true;
}

module.exports = {
  ACTIONS,
  VIEW_TEACHERS_LIVE,
  MANAGE_TRAINING_LIVE,
  TEACHER_WRITE_LIVE,
  FINANCE_WRITE_LIVE,
  buildSubject,
  evaluateLegacyTeacherRoute,
  evaluatePolicyTeacherRoute,
  compareDecisions,
  evaluateTeacherBranch,
  evaluateSuperAdminOnly,
  listScopeIncludesTeacher,
};
