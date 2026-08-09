/**
 * Policy shadow for LIVE settings routes (Wave 6.8).
 * Permission gates via constants/permissions.js. Reset SUPER/password stays in handler.
 */
const {
  SYSTEM_SETTINGS_LIVE,
  MANAGE_TRAINING_LIVE,
  STUDENT_TRAINING_LIVE,
  actorHasLivePermission,
  actorHasAnyLivePermission,
} = require('./livePermissionAdapter');

const ACTIONS = new Set([
  'system_read',
  'system_write',
  'training_write',
  'student_training_write',
  'training_upload',
  'auth_only',
  'reset',
  'public_read',
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

/** Mirrors checkPermission — admin/staff + perm (SUPER bypass). */
function requireStaffPermission(subject, livePerm) {
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
  if (!actorHasLivePermission(subject, livePerm)) {
    return { decision: 'DENY', reason: 'missing_permission', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'has_permission', statusHint: 200 };
}

function requireAnyStaffPermission(subject, livePerms) {
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
  if (!actorHasAnyLivePermission(subject, livePerms)) {
    return { decision: 'DENY', reason: 'missing_any_permission', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'has_any_permission', statusHint: 200 };
}

function evaluateAuthOnly(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  return { decision: 'ALLOW', reason: 'authenticated', statusHint: 200 };
}

function evaluatePublicRead() {
  return { decision: 'ALLOW', reason: 'public_read', statusHint: 200 };
}

/**
 * reset-data: middleware is SYSTEM_SETTINGS only.
 * SUPER_ADMIN + password are handler gates (400), not middleware 403 — do not DENY here.
 */
function evaluateLegacySettings(subject, action) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  switch (action) {
    case 'public_read':
      return evaluatePublicRead();
    case 'system_read':
    case 'system_write':
    case 'reset':
      return requireStaffPermission(subject, SYSTEM_SETTINGS_LIVE);
    case 'training_write':
      return requireStaffPermission(subject, MANAGE_TRAINING_LIVE);
    case 'student_training_write':
      return requireStaffPermission(subject, STUDENT_TRAINING_LIVE);
    case 'training_upload':
      return requireAnyStaffPermission(subject, [MANAGE_TRAINING_LIVE, STUDENT_TRAINING_LIVE]);
    case 'auth_only':
      return evaluateAuthOnly(subject);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

function evaluatePolicySettings(subject, action, _untrusted = {}) {
  void _untrusted.bodyBranchId;
  void _untrusted.clientRole;
  void _untrusted.clientPermissions;
  void _untrusted.clientAdminRole;
  void _untrusted.bodyPassword;
  const legacy = evaluateLegacySettings(subject, action);
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
  evaluateLegacySettings,
  evaluatePolicySettings,
  compareDecisions,
  SYSTEM_SETTINGS_LIVE,
};
