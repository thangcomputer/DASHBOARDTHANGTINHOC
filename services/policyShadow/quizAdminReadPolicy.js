/**
 * Policy shadow evaluator for GET /api/quizzes/admin/all.
 * READ-ONLY decision — does not authorize HTTP.
 *
 * Reproduces live legacy rules:
 * - checkPermission(MANAGE_TRAINING)
 * - SUPER_ADMIN / hardcoded admin bypass
 * - HIGH_ADMIN / STAFF / SUPPORT: must hold manage_training
 * - non-admin/staff roles: DENY
 * - Data scope (handler): if req.userBranchId set → quizzes whose teacherId
 *   is in teachers with branchId === userBranchId OR branchId === null
 * - No userBranchId → unscoped (all quizzes)
 * - Client branchId/tenantId ignored for both authz and scope
 */
const { QUIZ_ADMIN_READ_LIVE, actorHasLivePermission } = require('./livePermissionAdapter');

/**
 * @typedef {'ALLOW'|'DENY'} Decision
 * @typedef {{ decision: Decision, reason: string, statusHint?: number }} EvalResult
 * @typedef {{
 *   mode: 'unscoped'|'teacher_branch',
 *   userBranchId: string|null,
 *   includeNullTeacherBranch: boolean,
 * }} DataScope
 */

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
 * Legacy-equivalent permission (checkPermission(MANAGE_TRAINING)).
 * @returns {EvalResult}
 */
function evaluateLegacyPermission(subject) {
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
  if (!actorHasLivePermission(subject, QUIZ_ADMIN_READ_LIVE)) {
    return { decision: 'DENY', reason: 'missing_manage_training', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'has_manage_training', statusHint: 200 };
}

/**
 * Legacy data-scope descriptor (handler filter). Not an HTTP DENY gate.
 * @returns {DataScope}
 */
function evaluateLegacyDataScope(subject) {
  if (!subject?.userBranchId) {
    return {
      mode: 'unscoped',
      userBranchId: null,
      includeNullTeacherBranch: true,
    };
  }
  return {
    mode: 'teacher_branch',
    userBranchId: String(subject.userBranchId),
    includeNullTeacherBranch: true,
  };
}

/**
 * Whether a quiz created by a teacher with given branchId is visible under scope.
 * Mirrors: Teacher.find({ $or: [{ branchId: userBranchId }, { branchId: null }] })
 */
function scopeIncludesTeacherBranch(scope, teacherBranchId) {
  if (!scope || scope.mode === 'unscoped') return true;
  const tb =
    teacherBranchId != null && teacherBranchId !== ''
      ? String(teacherBranchId)
      : null;
  if (tb === null) return !!scope.includeNullTeacherBranch;
  return tb === String(scope.userBranchId);
}

/**
 * Combined legacy decision for quiz admin read (HTTP authz + scope descriptor).
 */
function evaluateLegacyQuizAdminRead(subject) {
  const permission = evaluateLegacyPermission(subject);
  const scope = evaluateLegacyDataScope(subject);
  if (permission.decision === 'DENY') {
    return {
      decision: 'DENY',
      reason: permission.reason,
      statusHint: permission.statusHint,
      permission,
      scope,
    };
  }
  return {
    decision: 'ALLOW',
    reason: 'legacy_allow',
    statusHint: 200,
    permission,
    scope,
  };
}

/**
 * Policy shadow — must MATCH evaluateLegacyQuizAdminRead.
 * Ignores untrusted client branch/tenant/role hints.
 */
function evaluatePolicyQuizAdminRead(subject, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.queryBranchId;
  void _untrusted.queryTenantId;
  void _untrusted.bodyTenantId;
  void _untrusted.clientRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.clientTeacherId;

  const permission = evaluateLegacyPermission(subject);
  const scope = evaluateLegacyDataScope(subject);
  if (permission.decision === 'DENY') {
    return {
      decision: 'DENY',
      reason: `policy_${permission.reason}`,
      statusHint: permission.statusHint,
      requiredPermission: QUIZ_ADMIN_READ_LIVE,
      permission,
      scope,
    };
  }
  return {
    decision: 'ALLOW',
    reason: 'policy_allow',
    statusHint: 200,
    requiredPermission: QUIZ_ADMIN_READ_LIVE,
    permission,
    scope,
  };
}

function scopesEqual(a, b) {
  if (!a || !b) return false;
  return (
    a.mode === b.mode &&
    String(a.userBranchId || '') === String(b.userBranchId || '') &&
    !!a.includeNullTeacherBranch === !!b.includeNullTeacherBranch
  );
}

function compareDecisions(legacy, policy) {
  if (!legacy || !policy) return 'UNKNOWN';
  if (legacy.decision !== policy.decision) return 'MISMATCH';
  if (!scopesEqual(legacy.scope, policy.scope)) return 'MISMATCH';
  return 'MATCH';
}

module.exports = {
  QUIZ_ADMIN_READ_LIVE,
  buildSubject,
  evaluateLegacyPermission,
  evaluateLegacyDataScope,
  evaluateLegacyQuizAdminRead,
  evaluatePolicyQuizAdminRead,
  scopeIncludesTeacherBranch,
  compareDecisions,
};
