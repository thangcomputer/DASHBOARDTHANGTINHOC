/**
 * Policy shadow for LIVE schedule routes (Wave 6.8).
 * Mirrors routes/scheduleRoutes.js — role/ownership gates (MANAGE_SCHEDULE unused live).
 */
const { studentMatchesTeacher } = require('../enrollmentService');

const ACTIONS = new Set([
  'list',
  'stats',
  'get_teacher',
  'get_student',
  'create',
  'update',
  'delete',
  'cancel',
  'history',
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

function isAdminOrStaff(subject) {
  const role = String(subject.role || '').toLowerCase();
  return role === 'admin' || role === 'staff';
}

/** Mirrors scheduleRoutes.teacherCanAccessStudent */
function teacherCanAccessStudent(student, teacherId, assignedStudentIds = []) {
  if (!student) return false;
  if (studentMatchesTeacher(student, teacherId)) return true;
  const assigned = (assignedStudentIds || []).map((id) => String(id));
  const sid = String(student._id || student.id || '');
  return assigned.includes(sid);
}

function evaluateListOrStats(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'teacher' || role === 'student' || isAdminOrStaff(subject)) {
    return { decision: 'ALLOW', reason: 'schedule_list_scoped', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'role_denied', statusHint: 403 };
}

function evaluateGetTeacher(subject, teacherId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (isAdminOrStaff(subject) || String(subject.id) === String(teacherId)) {
    return { decision: 'ALLOW', reason: 'get_teacher_ok', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_self_or_staff', statusHint: 403 };
}

function evaluateGetStudent(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  const studentId = ctx.studentId;
  if (role === 'student' && String(subject.id) !== String(studentId)) {
    return { decision: 'DENY', reason: 'student_not_self', statusHint: 403 };
  }
  if (role === 'teacher') {
    if (!teacherCanAccessStudent(ctx.targetStudent, subject.id, ctx.assignedStudentIds)) {
      return { decision: 'DENY', reason: 'teacher_not_owner', statusHint: 403 };
    }
    return { decision: 'ALLOW', reason: 'teacher_owns_student', statusHint: 200 };
  }
  if (role === 'student' || isAdminOrStaff(subject)) {
    return { decision: 'ALLOW', reason: 'get_student_ok', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'role_denied', statusHint: 403 };
}

function evaluateCreate(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (!['admin', 'staff', 'teacher'].includes(role)) {
    return { decision: 'DENY', reason: 'role_cannot_create', statusHint: 403 };
  }
  // Legacy: no branchFilter / no MANAGE_SCHEDULE on POST — staff may create any student
  if (role === 'teacher') {
    if (!teacherCanAccessStudent(ctx.targetStudent, subject.id, ctx.assignedStudentIds)) {
      return { decision: 'DENY', reason: 'teacher_not_owner', statusHint: 403 };
    }
  }
  return { decision: 'ALLOW', reason: 'schedule_create_ok', statusHint: 200 };
}

function evaluateUpdate(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  const isStaffSide = ['admin', 'staff', 'teacher'].includes(role);
  const isStudent = role === 'student';
  if (!isStaffSide && !isStudent) {
    return { decision: 'DENY', reason: 'role_cannot_update', statusHint: 403 };
  }
  if (!ctx.schedule) {
    return { decision: 'ALLOW', reason: 'missing_schedule_handler_404', statusHint: 200 };
  }
  if (role === 'teacher' && String(ctx.schedule.teacherId) !== String(subject.id)) {
    return { decision: 'DENY', reason: 'teacher_not_schedule_owner', statusHint: 403 };
  }
  if (isStudent) {
    const scheduleStudentId = ctx.schedule.studentId ? String(ctx.schedule.studentId) : '';
    if (!scheduleStudentId || scheduleStudentId !== String(subject.id)) {
      return { decision: 'DENY', reason: 'student_not_self_schedule', statusHint: 403 };
    }
    // Field restriction is business validation — authz self check is enough for shadow
  }
  return { decision: 'ALLOW', reason: 'schedule_update_ok', statusHint: 200 };
}

function evaluateDelete(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (!isAdminOrStaff(subject)) {
    return { decision: 'DENY', reason: 'role_cannot_delete', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'schedule_delete_ok', statusHint: 200 };
}

function evaluateCancel(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (!['admin', 'staff', 'teacher'].includes(role)) {
    return { decision: 'DENY', reason: 'role_cannot_cancel', statusHint: 403 };
  }
  if (!ctx.schedule) {
    return { decision: 'ALLOW', reason: 'missing_schedule_handler_404', statusHint: 200 };
  }
  if (role === 'teacher' && String(ctx.schedule.teacherId) !== String(subject.id)) {
    return { decision: 'DENY', reason: 'teacher_not_schedule_owner', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'schedule_cancel_ok', statusHint: 200 };
}

function evaluateHistory(subject, teacherId) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (isAdminOrStaff(subject) || String(subject.id) === String(teacherId)) {
    return { decision: 'ALLOW', reason: 'history_ok', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'history_denied', statusHint: 403 };
}

function evaluateLegacySchedule(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  switch (action) {
    case 'list':
    case 'stats':
      return evaluateListOrStats(subject);
    case 'get_teacher':
      return evaluateGetTeacher(subject, ctx.teacherId);
    case 'get_student':
      return evaluateGetStudent(subject, ctx);
    case 'create':
      return evaluateCreate(subject, ctx);
    case 'update':
      return evaluateUpdate(subject, ctx);
    case 'delete':
      return evaluateDelete(subject);
    case 'cancel':
      return evaluateCancel(subject, ctx);
    case 'history':
      return evaluateHistory(subject, ctx.teacherId);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

function evaluatePolicySchedule(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.queryBranchId;
  void _untrusted.clientRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyTeacherId;
  void _untrusted.bodyStudentId;
  const legacy = evaluateLegacySchedule(subject, action, ctx);
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
  teacherCanAccessStudent,
  evaluateLegacySchedule,
  evaluatePolicySchedule,
  compareDecisions,
};
