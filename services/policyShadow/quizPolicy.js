/**
 * Policy shadow for LIVE quiz routes except admin/all (Wave 6.2 quizAdminReadPolicy).
 * Mirrors routes/quizRoutes.js write/list/submit — including weak auth-only create.
 */
const ACTIONS = new Set([
  'teacher_list',
  'create',
  'delete',
  'student_list',
  'get',
  'submit',
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

/**
 * Legacy create/teacher_list/get: authMiddleware only.
 * Delete: ownership enforced via findOneAndDelete → 404 (not 403) — auth ALLOW.
 * Submit/student_list: auth; handler 404 if Student missing.
 */
function evaluateAuthOnly(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  return { decision: 'ALLOW', reason: 'authenticated', statusHint: 200 };
}

function evaluateLegacyQuiz(subject, action) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  return evaluateAuthOnly(subject);
}

function evaluatePolicyQuiz(subject, action, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.clientRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyTeacherId;
  void _untrusted.targetStudentIds;
  const legacy = evaluateLegacyQuiz(subject, action);
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
  evaluateLegacyQuiz,
  evaluatePolicyQuiz,
  compareDecisions,
};
