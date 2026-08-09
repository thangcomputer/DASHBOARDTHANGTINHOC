/**
 * Policy shadow for LIVE /api/courses (Wave 6.10).
 * Writes: auth + requireInternalToken + SYSTEM_SETTINGS.
 * Reads (list/get/stats): PUBLIC — no auth.
 * MANAGE_TRAINING unused on this router.
 */
const {
  SYSTEM_SETTINGS_LIVE,
  actorHasLivePermission,
} = require('./livePermissionAdapter');

const ACTIONS = new Set([
  'list',
  'get',
  'stats',
  'create',
  'update',
  'price',
  'delete',
  'restore',
  'seed',
]);

function buildSubject({ user, actorDoc, userBranchId, tokenAudience }) {
  return {
    id: String(user?.id || user?._id || ''),
    role: String(user?.role || actorDoc?.role || ''),
    adminRole: actorDoc?.adminRole || user?.adminRole || null,
    permissions: Array.isArray(actorDoc?.permissions)
      ? actorDoc.permissions
      : (Array.isArray(user?.permissions) ? user.permissions : []),
    userBranchId: userBranchId != null && userBranchId !== '' ? String(userBranchId) : null,
    tokenAudience: tokenAudience || null,
  };
}

function evaluatePublic() {
  return { decision: 'ALLOW', reason: 'public_catalog', statusHint: 200 };
}

/** Mirrors courseWriteGuard: auth + internal audience + SYSTEM_SETTINGS. */
function evaluateCourseWrite(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.tokenAudience !== 'internal') {
    return { decision: 'DENY', reason: 'internal_token_required', statusHint: 403 };
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
  if (!actorHasLivePermission(subject, SYSTEM_SETTINGS_LIVE)) {
    return { decision: 'DENY', reason: 'missing_system_settings', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'has_system_settings', statusHint: 200 };
}

function evaluateLegacyCourse(subject, action) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  if (action === 'list' || action === 'get' || action === 'stats') {
    return evaluatePublic();
  }
  return evaluateCourseWrite(subject);
}

function evaluatePolicyCourse(subject, action, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.clientRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyTenantId;
  const legacy = evaluateLegacyCourse(subject, action);
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
  evaluateLegacyCourse,
  evaluatePolicyCourse,
  compareDecisions,
  evaluateCourseWrite,
  SYSTEM_SETTINGS_LIVE,
};
