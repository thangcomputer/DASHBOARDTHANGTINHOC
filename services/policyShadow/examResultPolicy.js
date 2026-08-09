/**
 * Policy shadow for LIVE exam-result routes (Wave 6.7).
 * Mirrors routes/examResultRoutes.js authorizeExamMutation / branchAllows / list gates.
 */
const { studentMatchesTeacher } = require('../enrollmentService');
const {
  STUDENT_WRITE_LIVE,
  STUDENT_TRAINING_LIVE,
  QUIZ_ADMIN_READ_LIVE,
  actorHasLivePermission,
  actorHasAnyLivePermission,
} = require('./livePermissionAdapter');

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

/** Exact live branchAllows */
function branchAllows(userBranchId, subjectBranchId) {
  if (!userBranchId) return { decision: 'ALLOW', reason: 'no_user_branch_scope' };
  if (!subjectBranchId) {
    return { decision: 'DENY', reason: 'subject_branch_unknown', statusHint: 403 };
  }
  if (String(subjectBranchId) !== String(userBranchId)) {
    return { decision: 'DENY', reason: 'cross_branch', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'branch_ok' };
}

function staffCanManageExam(subject, type) {
  if (subject.id === 'admin') return true;
  if (subject.adminRole === 'SUPER_ADMIN') return true;
  if (type === 'teacher') {
    return actorHasLivePermission(subject, QUIZ_ADMIN_READ_LIVE);
  }
  return (
    actorHasLivePermission(subject, STUDENT_WRITE_LIVE)
    || actorHasLivePermission(subject, STUDENT_TRAINING_LIVE)
  );
}

function staffCanListExam(subject) {
  if (subject.id === 'admin' || subject.adminRole === 'SUPER_ADMIN') return true;
  return actorHasAnyLivePermission(subject, [
    STUDENT_WRITE_LIVE,
    STUDENT_TRAINING_LIVE,
    QUIZ_ADMIN_READ_LIVE,
  ]);
}

/**
 * @param {object} subject
 * @param {object} doc - { type, studentId, teacherId }
 * @param {object|null} student - DB student for ownership (when type=student)
 * @param {string|null} subjectBranchId
 */
function evaluateExamMutation(subject, doc, student, subjectBranchId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const br = branchAllows(subject.userBranchId, subjectBranchId);
  if (br.decision === 'DENY') {
    return { decision: 'DENY', reason: br.reason, statusHint: br.statusHint || 403, branch: br };
  }

  const role = String(subject.role || '').toLowerCase();
  if (role === 'student') {
    return { decision: 'DENY', reason: 'student_cannot_mutate_exam', statusHint: 403, branch: br };
  }
  if (role === 'teacher') {
    if (doc?.type === 'teacher') {
      if (String(doc.teacherId) !== String(subject.id)) {
        return { decision: 'DENY', reason: 'teacher_not_self_exam', statusHint: 403, branch: br };
      }
      return { decision: 'ALLOW', reason: 'teacher_self_exam', statusHint: 200, branch: br };
    }
    if (!student || !studentMatchesTeacher(student, subject.id)) {
      return { decision: 'DENY', reason: 'teacher_not_owner', statusHint: 403, branch: br };
    }
    return { decision: 'ALLOW', reason: 'teacher_owns_student', statusHint: 200, branch: br };
  }
  if (role === 'admin' || role === 'staff') {
    if (!staffCanManageExam(subject, doc?.type)) {
      return { decision: 'DENY', reason: 'missing_exam_manage_permission', statusHint: 403, branch: br };
    }
    return { decision: 'ALLOW', reason: 'staff_exam_manage', statusHint: 200, branch: br };
  }
  return { decision: 'DENY', reason: 'role_denied', statusHint: 403, branch: br };
}

function evaluateExamList(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'student' || role === 'teacher') {
    return { decision: 'ALLOW', reason: 'list_scoped_role', statusHint: 200 };
  }
  if (role === 'admin' || role === 'staff' || subject.id === 'admin') {
    if (!staffCanListExam(subject)) {
      return { decision: 'DENY', reason: 'missing_exam_list_permission', statusHint: 403 };
    }
    return { decision: 'ALLOW', reason: 'staff_exam_list', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'role_denied', statusHint: 403 };
}

function evaluateExamDelete(subject, subjectBranchId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  // Live: checkAnyPermission(MANAGE_STUDENTS|MANAGE_STUDENT_TRAINING|MANAGE_TRAINING) — no role gate
  if (
    !actorHasAnyLivePermission(subject, [
      STUDENT_WRITE_LIVE,
      STUDENT_TRAINING_LIVE,
      QUIZ_ADMIN_READ_LIVE,
    ])
  ) {
    return { decision: 'DENY', reason: 'missing_exam_delete_permission', statusHint: 403 };
  }
  const br = branchAllows(subject.userBranchId, subjectBranchId);
  if (br.decision === 'DENY') {
    return { decision: 'DENY', reason: br.reason, statusHint: br.statusHint || 403, branch: br };
  }
  return { decision: 'ALLOW', reason: 'exam_delete_ok', statusHint: 200, branch: br };
}

function evaluateLegacyExam(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  if (action === 'list') return evaluateExamList(subject);
  if (action === 'delete') {
    // Permission gate first (mirrors checkAnyPermission). Missing doc → handler 404.
    if (!subject?.id) {
      return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
    }
    if (
      !actorHasAnyLivePermission(subject, [
        STUDENT_WRITE_LIVE,
        STUDENT_TRAINING_LIVE,
        QUIZ_ADMIN_READ_LIVE,
      ])
    ) {
      return { decision: 'DENY', reason: 'missing_exam_delete_permission', statusHint: 403 };
    }
    if (!ctx.doc) {
      return { decision: 'ALLOW', reason: 'missing_exam_handler_404', statusHint: 200 };
    }
    return evaluateExamDelete(subject, ctx.subjectBranchId);
  }
  // create/update: missing update target → handler 404 (authz not applied)
  if (action === 'update' && !ctx.doc) {
    if (!subject?.id) {
      return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
    }
    return { decision: 'ALLOW', reason: 'missing_exam_handler_404', statusHint: 200 };
  }
  return evaluateExamMutation(subject, ctx.doc || {}, ctx.student || null, ctx.subjectBranchId);
}

function evaluatePolicyExam(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.queryBranchId;
  void _untrusted.clientRole;
  void _untrusted.clientPermissions;
  void _untrusted.spoofTeacherId;
  void _untrusted.spoofStudentId;
  const legacy = evaluateLegacyExam(subject, action, ctx);
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
  branchAllows,
  evaluateExamMutation,
  evaluateExamList,
  evaluateExamDelete,
  evaluateLegacyExam,
  evaluatePolicyExam,
  compareDecisions,
  staffCanManageExam,
};
