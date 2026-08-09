/**
 * Policy shadow for LIVE /api/evaluations (Wave 6.15).
 * No checkPermission — VIEW_EVALUATIONS exists in constants but is UNUSED on live routes.
 * Mirror weak Legacy role/ownership gates exactly.
 */
const ACTIONS = new Set([
  'admin_list',
  'teacher_ratings',
  'create',
  'mark_read',
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

/** GET /admin — handler: role admin|staff only (no VIEW_EVALUATIONS). */
function evaluateAdminList(subject) {
  const auth = evaluateAuthOnly(subject);
  if (auth.decision === 'DENY') return auth;
  const role = String(subject.role || '').toLowerCase();
  if (role === 'admin' || role === 'staff') {
    return { decision: 'ALLOW', reason: 'admin_staff_role', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_admin_staff', statusHint: 403 };
}

/**
 * GET /teacher/:teacherId — auth only; any authenticated user may read any teacherId.
 * P2 weak Legacy — mirrored.
 */
function evaluateTeacherRatings(subject) {
  return evaluateAuthOnly(subject);
}

/**
 * POST / — student may only submit for self; teacher/staff/admin have no studentId gate.
 * body.studentId is operation param for non-students (Legacy trusts it for write).
 */
function evaluateCreate(subject, ctx) {
  const auth = evaluateAuthOnly(subject);
  if (auth.decision === 'DENY') return auth;
  const role = String(subject.role || '').toLowerCase();
  if (role === 'student') {
    if (String(subject.id) !== String(ctx.bodyStudentId || '')) {
      return { decision: 'DENY', reason: 'student_not_self', statusHint: 403 };
    }
    return { decision: 'ALLOW', reason: 'student_self', statusHint: 200 };
  }
  return { decision: 'ALLOW', reason: 'non_student_create_unscoped', statusHint: 200 };
}

/**
 * POST /:id/read — admin|staff|teacher; teacher must own targetTeacherId; missing → 404 after role OK.
 */
function evaluateMarkRead(subject, ctx) {
  const auth = evaluateAuthOnly(subject);
  if (auth.decision === 'DENY') return auth;
  const role = String(subject.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'staff' && role !== 'teacher') {
    return { decision: 'DENY', reason: 'role_cannot_mark_read', statusHint: 403 };
  }
  if (!ctx.evaluation) {
    return { decision: 'ALLOW', reason: 'missing_eval_handler_404', statusHint: 200 };
  }
  if (role === 'teacher' && String(ctx.evaluation.targetTeacherId) !== String(subject.id)) {
    return { decision: 'DENY', reason: 'teacher_not_target', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'mark_read_ok', statusHint: 200 };
}

function evaluateLegacyEvaluation(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  switch (action) {
    case 'admin_list':
      return evaluateAdminList(subject);
    case 'teacher_ratings':
      return evaluateTeacherRatings(subject);
    case 'create':
      return evaluateCreate(subject, ctx);
    case 'mark_read':
      return evaluateMarkRead(subject, ctx);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

function evaluatePolicyEvaluation(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  void _untrusted.bodyTeacherId;
  void _untrusted.bodyUserId;
  // bodyStudentId for create is operation input mirrored via ctx.bodyStudentId from trusted request path
  const legacy = evaluateLegacyEvaluation(subject, action, ctx);
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
  evaluateLegacyEvaluation,
  evaluatePolicyEvaluation,
  compareDecisions,
};
