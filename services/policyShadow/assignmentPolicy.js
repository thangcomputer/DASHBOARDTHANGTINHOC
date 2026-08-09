/**
 * Policy shadow for LIVE assignment routes (Wave 6.7).
 * Mirrors routes/assignmentRoutes.js — including weak delete (role-only).
 */
const { studentMatchesTeacher } = require('../enrollmentService');
const {
  STUDENT_WRITE_LIVE,
  actorHasLivePermission,
} = require('./livePermissionAdapter');

const ACTIONS = new Set([
  'create',
  'update',
  'delete',
  'get_course',
  'get_student',
  'submit',
  'grade',
  'upload',
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

function evaluateAssignmentCreate(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (!['admin', 'staff', 'teacher'].includes(role)) {
    return { decision: 'DENY', reason: 'role_cannot_create', statusHint: 403 };
  }
  if (role === 'admin' || role === 'staff') {
    if (!actorHasLivePermission(subject, STUDENT_WRITE_LIVE)) {
      return { decision: 'DENY', reason: 'missing_manage_students', statusHint: 403 };
    }
  }

  const student = ctx.targetStudent;
  if (student) {
    if (
      subject.userBranchId
      && student.branchId
      && String(student.branchId) !== String(subject.userBranchId)
    ) {
      return { decision: 'DENY', reason: 'cross_branch', statusHint: 403 };
    }
    if (role === 'teacher' && !studentMatchesTeacher(student, subject.id)) {
      return { decision: 'DENY', reason: 'teacher_not_owner', statusHint: 403 };
    }
  }
  return { decision: 'ALLOW', reason: 'assignment_create_ok', statusHint: 200 };
}

function evaluateAssignmentUpdate(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (!['admin', 'staff', 'teacher'].includes(role)) {
    return { decision: 'DENY', reason: 'role_cannot_update', statusHint: 403 };
  }
  if (role === 'admin' || role === 'staff') {
    if (!actorHasLivePermission(subject, STUDENT_WRITE_LIVE)) {
      return { decision: 'DENY', reason: 'missing_manage_students', statusHint: 403 };
    }
  }

  const existing = ctx.assignment;
  if (!existing) {
    return { decision: 'ALLOW', reason: 'missing_assignment_handler_404', statusHint: 200 };
  }
  if (role === 'teacher' && existing.teacherId && String(existing.teacherId) !== String(subject.id)) {
    return { decision: 'DENY', reason: 'teacher_not_assignment_owner', statusHint: 403 };
  }
  const student = ctx.targetStudent;
  if (student) {
    if (
      subject.userBranchId
      && student.branchId
      && String(student.branchId) !== String(subject.userBranchId)
    ) {
      return { decision: 'DENY', reason: 'cross_branch', statusHint: 403 };
    }
    if (role === 'teacher' && !studentMatchesTeacher(student, subject.id)) {
      return { decision: 'DENY', reason: 'teacher_not_owner', statusHint: 403 };
    }
  }
  const newStudent = ctx.newTargetStudent;
  if (newStudent) {
    if (
      subject.userBranchId
      && newStudent.branchId
      && String(newStudent.branchId) !== String(subject.userBranchId)
    ) {
      return { decision: 'DENY', reason: 'cross_branch_new_student', statusHint: 403 };
    }
  }
  return { decision: 'ALLOW', reason: 'assignment_update_ok', statusHint: 200 };
}

/** Legacy delete: role gate only — no MANAGE_STUDENTS, no ownership (preserved). */
function evaluateAssignmentDelete(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (!['admin', 'staff', 'teacher'].includes(role)) {
    return { decision: 'DENY', reason: 'role_cannot_delete', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'assignment_delete_role_only', statusHint: 200 };
}

function evaluateGetStudent(subject, studentId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'student' && String(subject.id) !== String(studentId)) {
    return { decision: 'DENY', reason: 'student_not_self', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'get_student_ok', statusHint: 200 };
}

function evaluateSubmit(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  const assignment = ctx.assignment;
  const bodyStudentId = ctx.bodyStudentId;
  if (assignment?.studentId && bodyStudentId
      && String(assignment.studentId) !== String(bodyStudentId)) {
    return { decision: 'DENY', reason: 'assignment_not_for_student', statusHint: 403 };
  }
  if (role === 'student' && !assignment?.studentId) {
    return { decision: 'DENY', reason: 'assignment_unbound', statusHint: 403 };
  }
  if (role === 'student' && String(subject.id) !== String(bodyStudentId)) {
    return { decision: 'DENY', reason: 'submit_not_self', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'submit_ok', statusHint: 200 };
}

function evaluateGrade(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (!['admin', 'staff', 'teacher'].includes(role)) {
    return { decision: 'DENY', reason: 'role_cannot_grade', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'grade_role_ok', statusHint: 200 };
}

function evaluateAuthenticated(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  return { decision: 'ALLOW', reason: 'authenticated', statusHint: 200 };
}

function evaluateLegacyAssignment(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  switch (action) {
    case 'create':
      return evaluateAssignmentCreate(subject, ctx);
    case 'update':
      return evaluateAssignmentUpdate(subject, ctx);
    case 'delete':
      return evaluateAssignmentDelete(subject);
    case 'get_course':
    case 'upload':
      return evaluateAuthenticated(subject);
    case 'get_student':
      return evaluateGetStudent(subject, ctx.studentId);
    case 'submit':
      return evaluateSubmit(subject, ctx);
    case 'grade':
      return evaluateGrade(subject);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

function evaluatePolicyAssignment(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTeacherId;
  void _untrusted.bodyAssignedById;
  void _untrusted.clientRole;
  void _untrusted.clientPermissions;
  void _untrusted.queryTenantId;
  const legacy = evaluateLegacyAssignment(subject, action, ctx);
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
  evaluateLegacyAssignment,
  evaluatePolicyAssignment,
  compareDecisions,
  evaluateAssignmentCreate,
  evaluateAssignmentUpdate,
  evaluateAssignmentDelete,
};
