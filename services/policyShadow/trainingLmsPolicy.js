/**
 * Policy shadow for LIVE /api/training-lms + /api/training (Wave 6.10).
 * Lessons: teacher subject specialty gate; overview uses data filter (HTTP ALLOW).
 * Progress writes: auth-only (JWT userId). Admin progress: MANAGE_TRAINING.
 */
const {
  MANAGE_TRAINING_LIVE,
  actorHasLivePermission,
} = require('./livePermissionAdapter');
const { itemMatchesSubjectIds } = require('../../utils/trainingSubjectAccess');

const ACTIONS = new Set([
  'lms_courses',
  'lms_lessons',
  'lms_complete_lesson',
  'lms_progress_me',
  'lms_teacher_overview',
  'lms_save_watch',
  'lms_admin_progress',
  'lms_qa_list',
  'lms_qa_create',
  'lms_qa_answer',
  'guide_list',
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

function evaluateAuthOnly(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  return { decision: 'ALLOW', reason: 'authenticated', statusHint: 200 };
}

/**
 * GET lessons: non-teacher authenticated ALLOW; teacher must match subjectIds.
 * Missing course → handler 404 (ALLOW after auth).
 */
function evaluateLmsLessons(subject, ctx) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (!ctx.course) {
    return { decision: 'ALLOW', reason: 'missing_course_handler_404', statusHint: 200 };
  }
  if (String(subject.role || '').toLowerCase() === 'teacher') {
    const allowed = ctx.allowedSubjectIds || [];
    if (!itemMatchesSubjectIds(ctx.course, allowed)) {
      return { decision: 'DENY', reason: 'teacher_subject_mismatch', statusHint: 403 };
    }
  }
  return { decision: 'ALLOW', reason: 'lms_lessons_ok', statusHint: 200 };
}

/** teacher/overview: specialty is DATA FILTER — HTTP auth only. */
function evaluateTeacherOverview(subject) {
  return evaluateAuthOnly(subject);
}

function evaluateAdminProgress(subject) {
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
  if (!actorHasLivePermission(subject, MANAGE_TRAINING_LIVE)) {
    return { decision: 'DENY', reason: 'missing_manage_training', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'has_manage_training', statusHint: 200 };
}

function evaluateLegacyTraining(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  switch (action) {
    case 'lms_courses':
    case 'lms_complete_lesson':
    case 'lms_progress_me':
    case 'lms_save_watch':
    case 'lms_qa_list':
    case 'lms_qa_create':
    case 'lms_qa_answer':
    case 'guide_list':
      return evaluateAuthOnly(subject);
    case 'lms_teacher_overview':
      return evaluateTeacherOverview(subject);
    case 'lms_lessons':
      return evaluateLmsLessons(subject, ctx);
    case 'lms_admin_progress':
      return evaluateAdminProgress(subject);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

function evaluatePolicyTraining(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.clientRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyStudentId;
  void _untrusted.bodyTeacherId;
  void _untrusted.bodyUserId;
  const legacy = evaluateLegacyTraining(subject, action, ctx);
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
  evaluateLegacyTraining,
  evaluatePolicyTraining,
  compareDecisions,
  evaluateLmsLessons,
  evaluateAdminProgress,
};
