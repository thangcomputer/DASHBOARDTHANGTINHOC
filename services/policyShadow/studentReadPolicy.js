/**
 * Policy shadow evaluator for LIVE student READ routes.
 * READ-ONLY — does not authorize HTTP.
 *
 * Live legacy (source: routes/studentRoutes.js):
 * - list/stats Middleware: requireManageStudentsUnlessTeacher
 *     teacher → ALLOW (no MANAGE_STUDENTS)
 *     else → checkPermission(MANAGE_STUDENTS)
 * - List data scope:
 *     branchFilter (+ optional ?branch_id when !userBranchId)
 *     teacher → { teacherId OR enrollments.teacherId } = req.user.id
 *     admin/staff → optional ?teacherId filter (data only, not authz)
 *     other roles → HTTP 403 in handler
 * - Stats data scope:
 *     branchFilter (+ optional ?branch_id when !userBranchId)
 *     NO teacher ownership filter (legacy)
 * - get_one / full_detail (handler-owned; NO MANAGE_STUDENTS middleware):
 *     missing resource → handler 404 (Policy ALLOW)
 *     branch: if userBranchId and student.branchId set and differ → DENY
 *     ALLOW if admin|staff OR student self OR teacher via studentMatchesTeacher
 *
 * List ownership query is NOT identical to studentMatchesTeacher
 * (list does not exclude cancelled/refunded enrollments).
 */
const { STUDENT_READ_LIVE, actorHasLivePermission } = require('./livePermissionAdapter');
const { studentMatchesTeacher } = require('../enrollmentService');

const LIST_STATS = new Set(['list', 'stats']);
const GET_BY_ID = new Set(['get_one', 'full_detail']);
const ACTIONS = new Set([...LIST_STATS, ...GET_BY_ID]);

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

function normalizeBranchFilter(bf) {
  if (!bf || typeof bf !== 'object') return {};
  const out = {};
  if (Object.prototype.hasOwnProperty.call(bf, 'branchId')) {
    out.branchId =
      bf.branchId != null && bf.branchId !== '' ? String(bf.branchId) : null;
  }
  return out;
}

function branchFilterKey(bf) {
  const n = normalizeBranchFilter(bf);
  if (!Object.prototype.hasOwnProperty.call(n, 'branchId')) return 'unscoped';
  return n.branchId === null ? 'branch:null' : `branch:${n.branchId}`;
}

/**
 * HTTP authz — requireManageStudentsUnlessTeacher + checkPermission(MANAGE_STUDENTS).
 */
function evaluateLegacyPermission(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'hardcoded_admin', statusHint: 200 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'teacher') {
    return { decision: 'ALLOW', reason: 'teacher_bypass_manage_students', statusHint: 200 };
  }
  if (role !== 'admin' && role !== 'staff') {
    return { decision: 'DENY', reason: 'role_not_staff', statusHint: 403 };
  }
  if (subject.adminRole === 'SUPER_ADMIN') {
    return { decision: 'ALLOW', reason: 'super_admin', statusHint: 200 };
  }
  if (!actorHasLivePermission(subject, STUDENT_READ_LIVE)) {
    return { decision: 'DENY', reason: 'missing_manage_students', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'has_manage_students', statusHint: 200 };
}

/**
 * Effective branch filter after legacy branchFilter + handler ?branch_id narrow.
 * Trusts server branchFilter / userBranchId; client branchId only applied when
 * !userBranchId (same as legacy handler / SUPER path).
 */
function effectiveBranchFilter(subject, trustedBranchFilter, queryBranchId) {
  const bf = normalizeBranchFilter(trustedBranchFilter);
  if (
    queryBranchId &&
    queryBranchId !== 'all' &&
    queryBranchId !== '' &&
    !subject.userBranchId
  ) {
    return { branchId: String(queryBranchId) };
  }
  return bf;
}

/**
 * Data-scope descriptor (not always an HTTP DENY).
 */
function evaluateLegacyDataScope(subject, action, ctx = {}) {
  const role = String(subject.role || '').toLowerCase();
  const trustedBf = ctx.trustedBranchFilter || {};
  const queryBranchId = ctx.queryBranchId;

  if (action === 'list') {
    if (role === 'teacher') {
      return {
        mode: 'teacher_ownership',
        teacherId: subject.id,
        branchFilter: effectiveBranchFilter(subject, trustedBf, queryBranchId),
        includeCancelledEnrollmentMatch: true,
      };
    }
    if (role === 'admin' || role === 'staff' || subject.id === 'admin') {
      return {
        mode: 'staff_branch',
        branchFilter: effectiveBranchFilter(subject, trustedBf, queryBranchId),
        optionalTeacherIdFilter: ctx.queryTeacherId ? String(ctx.queryTeacherId) : null,
      };
    }
    return {
      mode: 'handler_deny_role',
      branchFilter: {},
    };
  }

  // stats — legacy has no teacher ownership filter
  return {
    mode: 'stats_branch',
    branchFilter: effectiveBranchFilter(subject, trustedBf, queryBranchId),
    teacherOwnershipApplied: false,
  };
}

/**
 * GET /:id and GET /:id/full-detail — handler-owned authz (not MANAGE_STUDENTS).
 * Missing resource → ALLOW (handler 404). Does not strengthen Legacy.
 */
function evaluateLegacyGetById(subject, action, ctx = {}) {
  if (!subject?.id) {
    return {
      decision: 'DENY',
      reason: 'unauthenticated',
      statusHint: 401,
      permission: null,
      scope: { mode: 'get_by_id', action, access: 'unauthenticated' },
    };
  }
  const resourceStudent = ctx.resourceStudent || null;
  const resourceId = ctx.resourceId != null
    ? String(ctx.resourceId)
    : (resourceStudent?._id != null ? String(resourceStudent._id) : null);

  if (!resourceStudent) {
    return {
      decision: 'ALLOW',
      reason: 'missing_student_handler_404',
      statusHint: 200,
      permission: { decision: 'ALLOW', reason: 'defer_404' },
      scope: { mode: 'get_by_id', action, access: 'missing' },
    };
  }

  if (subject.userBranchId) {
    const studentBranch =
      resourceStudent.branchId != null && resourceStudent.branchId !== ''
        ? String(resourceStudent.branchId)
        : null;
    if (studentBranch && studentBranch !== String(subject.userBranchId)) {
      return {
        decision: 'DENY',
        reason: action === 'full_detail' ? 'cross_branch_full_detail' : 'cross_branch_get_one',
        statusHint: 403,
        permission: { decision: 'DENY', reason: 'cross_branch' },
        scope: { mode: 'get_by_id', action, access: 'cross_branch' },
      };
    }
  }

  const role = String(subject.role || '').toLowerCase();
  const studentId = resourceId || String(resourceStudent._id || '');
  const isSelf = role === 'student' && String(subject.id) === studentId;
  const isMyTeacher = role === 'teacher' && studentMatchesTeacher(resourceStudent, subject.id);
  const isAdminOrStaff = role === 'admin' || role === 'staff' || subject.id === 'admin';

  if (!isAdminOrStaff && !isSelf && !isMyTeacher) {
    return {
      decision: 'DENY',
      reason: 'view_denied',
      statusHint: 403,
      permission: { decision: 'DENY', reason: 'view_denied' },
      scope: { mode: 'get_by_id', action, access: 'denied' },
    };
  }

  let access = 'staff';
  if (isSelf) access = 'self';
  else if (isMyTeacher) access = 'teacher_owner';

  return {
    decision: 'ALLOW',
    reason: 'legacy_allow',
    statusHint: 200,
    permission: { decision: 'ALLOW', reason: access },
    scope: { mode: 'get_by_id', action, access },
  };
}

function evaluateLegacyStudentRead(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return {
      decision: 'DENY',
      reason: 'unknown_action',
      statusHint: 403,
      permission: null,
      scope: null,
    };
  }
  if (GET_BY_ID.has(action)) {
    return evaluateLegacyGetById(subject, action, ctx);
  }
  const permission = evaluateLegacyPermission(subject);
  const scope = evaluateLegacyDataScope(subject, action, ctx);
  if (permission.decision === 'DENY') {
    return {
      decision: 'DENY',
      reason: permission.reason,
      statusHint: permission.statusHint,
      permission,
      scope,
    };
  }
  if (action === 'list' && scope.mode === 'handler_deny_role') {
    return {
      decision: 'DENY',
      reason: 'handler_role_denied',
      statusHint: 403,
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

function evaluatePolicyStudentRead(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.queryTenantId;
  void _untrusted.bodyTenantId;
  void _untrusted.clientRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  // Spoofed teacherId/studentId must not become authz identity.
  // Trusted list ownership uses subject.id only; optional staff ?teacherId is data filter from query
  // but only when actor already ALLOW via MANAGE_STUDENTS (captured in scope.optionalTeacherIdFilter
  // from trusted query after permission ALLOW — not from body).
  void _untrusted.spoofTeacherId;
  void _untrusted.spoofStudentId;
  void _untrusted.queryBranchId;
  void _untrusted.bodyStudentId;

  if (GET_BY_ID.has(action)) {
    const legacy = evaluateLegacyGetById(subject, action, {
      resourceStudent: ctx.resourceStudent || null,
      resourceId: ctx.resourceId,
    });
    if (legacy.decision === 'DENY') {
      return {
        ...legacy,
        reason: legacy.reason.startsWith('policy_') ? legacy.reason : `policy_${legacy.reason}`,
        requiredPermission: null,
      };
    }
    return { ...legacy, reason: 'policy_allow', requiredPermission: null };
  }

  const trustedCtx = {
    trustedBranchFilter: ctx.trustedBranchFilter,
    queryBranchId: ctx.queryBranchId,
    queryTeacherId: ctx.queryTeacherId,
  };
  const permission = evaluateLegacyPermission(subject);
  const scope = evaluateLegacyDataScope(subject, action, trustedCtx);
  if (permission.decision === 'DENY') {
    return {
      decision: 'DENY',
      reason: `policy_${permission.reason}`,
      statusHint: permission.statusHint,
      requiredPermission: STUDENT_READ_LIVE,
      permission,
      scope,
    };
  }
  if (action === 'list' && scope.mode === 'handler_deny_role') {
    return {
      decision: 'DENY',
      reason: 'policy_handler_role_denied',
      statusHint: 403,
      requiredPermission: STUDENT_READ_LIVE,
      permission,
      scope,
    };
  }
  return {
    decision: 'ALLOW',
    reason: 'policy_allow',
    statusHint: 200,
    requiredPermission: STUDENT_READ_LIVE,
    permission,
    scope,
  };
}

function scopesEqual(a, b) {
  if (!a || !b) return false;
  if (a.mode !== b.mode) return false;
  if (a.mode === 'get_by_id') {
    return a.action === b.action && a.access === b.access;
  }
  if (branchFilterKey(a.branchFilter) !== branchFilterKey(b.branchFilter)) return false;
  if (String(a.teacherId || '') !== String(b.teacherId || '')) return false;
  if (!!a.teacherOwnershipApplied !== !!b.teacherOwnershipApplied) return false;
  if (String(a.optionalTeacherIdFilter || '') !== String(b.optionalTeacherIdFilter || '')) {
    return false;
  }
  return true;
}

function compareDecisions(legacy, policy) {
  if (!legacy || !policy) return 'UNKNOWN';
  if (legacy.decision !== policy.decision) return 'MISMATCH';
  if (!scopesEqual(legacy.scope, policy.scope)) return 'MISMATCH';
  return 'MATCH';
}

/** Mirrors GET /students teacher $or filter (does NOT exclude cancelled/refunded). */
function studentMatchesListTeacher(student, teacherId) {
  const tid = String(teacherId);
  const top = student?.teacherId;
  const topId = top != null ? String(top._id || top) : null;
  if (topId && topId === tid) return true;
  const enrollments = Array.isArray(student?.enrollments) ? student.enrollments : [];
  return enrollments.some((e) => {
    if (e?.teacherId == null) return false;
    return String(e.teacherId._id || e.teacherId) === tid;
  });
}

/** Whether student.branchId matches effective branchFilter (Mongo equality semantics). */
function studentMatchesBranchFilter(branchFilter, studentBranchId) {
  const bf = normalizeBranchFilter(branchFilter);
  if (!Object.prototype.hasOwnProperty.call(bf, 'branchId')) return true;
  const want = bf.branchId;
  const got =
    studentBranchId != null && studentBranchId !== '' ? String(studentBranchId) : null;
  if (want === null) return got === null;
  return got === want;
}

/**
 * Visibility under legacy list/stats scope descriptors.
 */
function scopeIncludesStudent(scope, student) {
  if (!scope) return false;
  if (scope.mode === 'teacher_ownership') {
    if (!studentMatchesListTeacher(student, scope.teacherId)) return false;
    // Teachers also push req.branchFilter when non-empty (usually {})
    return studentMatchesBranchFilter(scope.branchFilter, student.branchId);
  }
  if (scope.mode === 'staff_branch' || scope.mode === 'stats_branch') {
    if (!studentMatchesBranchFilter(scope.branchFilter, student.branchId)) return false;
    if (scope.optionalTeacherIdFilter) {
      return studentMatchesListTeacher(student, scope.optionalTeacherIdFilter);
    }
    return true;
  }
  return false;
}

module.exports = {
  ACTIONS,
  LIST_STATS,
  GET_BY_ID,
  STUDENT_READ_LIVE,
  buildSubject,
  evaluateLegacyPermission,
  evaluateLegacyDataScope,
  evaluateLegacyGetById,
  evaluateLegacyStudentRead,
  evaluatePolicyStudentRead,
  compareDecisions,
  studentMatchesListTeacher,
  studentMatchesBranchFilter,
  scopeIncludesStudent,
  normalizeBranchFilter,
};
