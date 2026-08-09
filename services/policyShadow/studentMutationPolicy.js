/**
 * Policy shadow for live student MUTATION routes (Wave 6.4).
 * Mirrors routes/studentRoutes.js exactly — does not improve authz.
 *
 * Permission families (from live code):
 * - MANAGE_STUDENTS via checkPermission / userHasPermission
 * - MANAGE_FINANCE via checkPermission
 * - update hybrid: staff→MANAGE_STUDENTS; teacher→ALLOW (no ownership!); student→self
 * - exam_progress: student self OR admin/staff (no MANAGE_STUDENTS); teacher DENY
 * - lock_exam: staff→MANAGE_STUDENTS; teacher→teacherId|enrollments.teacherId; else DENY
 *
 * Branch: assertStudentBranchAccess when route uses it
 *   (!userBranchId → skip; missing student → 404 DENY; cross-branch → 403)
 */
const {
  STUDENT_WRITE_LIVE,
  FINANCE_WRITE_LIVE,
  actorHasLivePermission,
} = require('./livePermissionAdapter');

/** @typedef {'ALLOW'|'DENY'} Decision */

const ACTIONS = {
  create: { family: 'manage_students', branchAssert: false, resource: false },
  create_import: { family: 'manage_students', branchAssert: false, resource: false },
  update: { family: 'update_hybrid', branchAssert: true, resource: true },
  exam_progress: { family: 'exam_progress', branchAssert: true, resource: true },
  lock_exam: { family: 'lock_exam', branchAssert: true, resource: true },
  unlock_exam: { family: 'manage_students', branchAssert: true, resource: true },
  enrollment_create: { family: 'manage_students', branchAssert: true, resource: true },
  enrollment_settings: { family: 'manage_students', branchAssert: true, resource: true },
  enrollment_delete: { family: 'manage_students', branchAssert: true, resource: true },
  assign_teacher: { family: 'manage_students', branchAssert: true, resource: true },
  delete: { family: 'manage_students', branchAssert: true, resource: true },
  reset_today_attendance: { family: 'manage_students', branchAssert: true, resource: true },
  reset_history: { family: 'manage_students', branchAssert: true, resource: true },
  finance_price: { family: 'manage_finance', branchAssert: true, resource: true },
  finance_pay: { family: 'manage_finance', branchAssert: true, resource: true },
  finance_refund: { family: 'manage_finance', branchAssert: true, resource: true },
  enrollment_pay: { family: 'manage_finance', branchAssert: true, resource: true },
  finance_pay_teacher: { family: 'manage_finance', branchAssert: true, resource: true },
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

function teacherIdStr(v) {
  if (v == null) return '';
  return String(v._id || v);
}

/** lock-exam ownership (live): root teacherId OR any enrollments.teacherId (no status filter). */
function lockExamTeacherOwns(student, teacherId) {
  const uid = String(teacherId);
  if (teacherIdStr(student?.teacherId) === uid) return true;
  return (student?.enrollments || []).some((e) => teacherIdStr(e?.teacherId) === uid);
}

function evaluateCheckPermission(subject, livePermission) {
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
  if (!actorHasLivePermission(subject, livePermission)) {
    return {
      decision: 'DENY',
      reason: livePermission === FINANCE_WRITE_LIVE ? 'missing_manage_finance' : 'missing_manage_students',
      statusHint: 403,
    };
  }
  return {
    decision: 'ALLOW',
    reason: livePermission === FINANCE_WRITE_LIVE ? 'has_manage_finance' : 'has_manage_students',
    statusHint: 200,
  };
}

/**
 * PUT /:id hybrid (handler): staff need manage_students; teacher ALLOW without ownership;
 * student self only.
 */
function evaluateUpdateHybrid(subject, resourceStudent, resourceId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'hardcoded_admin', statusHint: 200 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'admin' || role === 'staff') {
    if (subject.adminRole === 'SUPER_ADMIN') {
      return { decision: 'ALLOW', reason: 'super_admin', statusHint: 200 };
    }
    if (!actorHasLivePermission(subject, STUDENT_WRITE_LIVE)) {
      return { decision: 'DENY', reason: 'missing_manage_students', statusHint: 403 };
    }
    return { decision: 'ALLOW', reason: 'has_manage_students', statusHint: 200 };
  }
  if (role === 'teacher') {
    // LEGACY: no ownership check on PUT /:id — preserve (security gap reported separately)
    return { decision: 'ALLOW', reason: 'teacher_put_no_ownership_check', statusHint: 200 };
  }
  if (role === 'student') {
    if (!resourceId || String(subject.id) !== String(resourceId)) {
      return { decision: 'DENY', reason: 'student_not_self', statusHint: 403 };
    }
    return { decision: 'ALLOW', reason: 'student_self', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'role_denied', statusHint: 403 };
}

/** PUT exam-progress: self student OR admin/staff (no MANAGE_STUDENTS). Teacher DENY. */
function evaluateExamProgress(subject, resourceId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'student' && String(subject.id) === String(resourceId)) {
    return { decision: 'ALLOW', reason: 'student_self', statusHint: 200 };
  }
  if (role === 'admin' || role === 'staff' || subject.id === 'admin') {
    return { decision: 'ALLOW', reason: 'staff_exam_progress', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'exam_progress_forbidden', statusHint: 403 };
}

/** PUT lock-exam */
function evaluateLockExam(subject, resourceStudent) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'admin' || role === 'staff' || subject.id === 'admin') {
    return evaluateCheckPermission(subject, STUDENT_WRITE_LIVE);
  }
  if (role === 'teacher') {
    // Missing resource: middleware assertStudentBranchAccess only 404s when userBranchId set.
    // Unbound teacher reaches handler 404 — authz layer must not DENY early.
    if (!resourceStudent) {
      return { decision: 'ALLOW', reason: 'teacher_ownership_pending_resource', statusHint: 200 };
    }
    if (!lockExamTeacherOwns(resourceStudent, subject.id)) {
      return { decision: 'DENY', reason: 'teacher_not_owner', statusHint: 403 };
    }
    return { decision: 'ALLOW', reason: 'teacher_owns_student', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'lock_exam_forbidden', statusHint: 403 };
}

function evaluateBranchAssert(subject, resourceStudent, needsResource) {
  if (!subject?.userBranchId) {
    return { decision: 'ALLOW', reason: 'no_user_branch_scope', statusHint: 200 };
  }
  if (needsResource && !resourceStudent) {
    return { decision: 'DENY', reason: 'student_not_found', statusHint: 404 };
  }
  if (!resourceStudent) {
    return { decision: 'ALLOW', reason: 'no_resource', statusHint: 200 };
  }
  const studentBranch =
    resourceStudent.branchId != null && resourceStudent.branchId !== ''
      ? String(resourceStudent.branchId)
      : null;
  if (studentBranch && studentBranch !== String(subject.userBranchId)) {
    return { decision: 'DENY', reason: 'cross_branch', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'branch_ok', statusHint: 200 };
}

function evaluateFamily(subject, family, resourceStudent, resourceId) {
  switch (family) {
    case 'manage_students':
      return evaluateCheckPermission(subject, STUDENT_WRITE_LIVE);
    case 'manage_finance':
      return evaluateCheckPermission(subject, FINANCE_WRITE_LIVE);
    case 'update_hybrid':
      return evaluateUpdateHybrid(subject, resourceStudent, resourceId);
    case 'exam_progress':
      return evaluateExamProgress(subject, resourceId);
    case 'lock_exam':
      return evaluateLockExam(subject, resourceStudent);
    default:
      return { decision: 'DENY', reason: 'unknown_family', statusHint: 403 };
  }
}

function evaluateLegacyStudentMutation(subject, action, resourceStudent, ctx = {}) {
  const def = ACTIONS[action];
  if (!def) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403, permission: null, branch: null };
  }
  const resourceId = ctx.resourceId != null ? String(ctx.resourceId) : null;
  const permission = evaluateFamily(subject, def.family, resourceStudent, resourceId);
  if (permission.decision === 'DENY') {
    return {
      decision: 'DENY',
      reason: permission.reason,
      statusHint: permission.statusHint,
      permission,
      branch: null,
      action,
      family: def.family,
    };
  }
  if (def.branchAssert) {
    const branch = evaluateBranchAssert(subject, resourceStudent, def.resource);
    if (branch.decision === 'DENY') {
      return {
        decision: 'DENY',
        reason: branch.reason,
        statusHint: branch.statusHint,
        permission,
        branch,
        action,
        family: def.family,
      };
    }
    return {
      decision: 'ALLOW',
      reason: 'legacy_allow',
      statusHint: 200,
      permission,
      branch,
      action,
      family: def.family,
    };
  }
  return {
    decision: 'ALLOW',
    reason: 'legacy_allow',
    statusHint: 200,
    permission,
    branch: { decision: 'ALLOW', reason: 'no_branch_assert' },
    action,
    family: def.family,
  };
}

function evaluatePolicyStudentMutation(subject, action, resourceStudent, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.queryBranchId;
  void _untrusted.queryTenantId;
  void _untrusted.bodyTenantId;
  void _untrusted.clientRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.spoofTeacherId;
  void _untrusted.spoofOwnerId;
  void _untrusted.spoofStudentId;

  const legacy = evaluateLegacyStudentMutation(subject, action, resourceStudent, ctx);
  if (legacy.decision === 'DENY') {
    return {
      ...legacy,
      reason: legacy.reason.startsWith('policy_') ? legacy.reason : `policy_${legacy.reason}`,
      requiredPermission:
        ACTIONS[action]?.family === 'manage_finance' ? FINANCE_WRITE_LIVE : STUDENT_WRITE_LIVE,
    };
  }
  return {
    ...legacy,
    reason: 'policy_allow',
    requiredPermission:
      ACTIONS[action]?.family === 'manage_finance' ? FINANCE_WRITE_LIVE : STUDENT_WRITE_LIVE,
  };
}

function compareDecisions(legacy, policy) {
  if (!legacy || !policy) return 'UNKNOWN';
  if (legacy.decision === policy.decision) return 'MATCH';
  return 'MISMATCH';
}

module.exports = {
  ACTIONS,
  STUDENT_WRITE_LIVE,
  FINANCE_WRITE_LIVE,
  buildSubject,
  evaluateCheckPermission,
  evaluateUpdateHybrid,
  evaluateExamProgress,
  evaluateLockExam,
  evaluateBranchAssert,
  evaluateLegacyStudentMutation,
  evaluatePolicyStudentMutation,
  compareDecisions,
  lockExamTeacherOwns,
};
