/**
 * Policy shadow for LIVE /api/files (Wave 6.14).
 * Gates: auth; open upload categories; training any-perm; SYSTEM_SETTINGS; delete ownership in service.
 */
const {
  SYSTEM_SETTINGS_LIVE,
  MANAGE_TRAINING_LIVE,
  STUDENT_TRAINING_LIVE,
  actorHasLivePermission,
  actorHasAnyLivePermission,
} = require('./livePermissionAdapter');

const OPEN_UPLOAD_CATEGORIES = new Set(['messages', 'assignments', 'avatars']);

const ACTIONS = new Set([
  'upload',
  'stats',
  'categories',
  'list',
  'purge_expired',
  'delete',
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

/** Mirrors requireUploadCategoryPermission + auth. */
function evaluateUpload(subject, ctx) {
  const auth = evaluateAuthOnly(subject);
  if (auth.decision === 'DENY') return auth;
  const category = String(ctx.category || 'general').toLowerCase();
  if (OPEN_UPLOAD_CATEGORIES.has(category)) {
    return { decision: 'ALLOW', reason: 'open_upload_category', statusHint: 200 };
  }
  if (category === 'training') {
    return requireAnyStaffPermission(subject, [
      MANAGE_TRAINING_LIVE,
      STUDENT_TRAINING_LIVE,
      SYSTEM_SETTINGS_LIVE,
    ]);
  }
  return requireStaffPermission(subject, SYSTEM_SETTINGS_LIVE);
}

/**
 * Mirrors fileService.deleteById authz (after auth).
 * canManage = admin id | SUPER | permissions includes system_settings (no role check).
 * Empty uploadedBy → ALLOW (weak legacy).
 */
function evaluateDelete(subject, ctx) {
  const auth = evaluateAuthOnly(subject);
  if (auth.decision === 'DENY') return auth;
  if (!ctx.asset) {
    return { decision: 'ALLOW', reason: 'missing_file_handler_404', statusHint: 200 };
  }
  // Mirrors deleteById: no admin/staff role requirement for system_settings bypass
  const canManage = subject.id === 'admin'
    || subject.adminRole === 'SUPER_ADMIN'
    || (Array.isArray(subject.permissions) && subject.permissions.includes(SYSTEM_SETTINGS_LIVE));
  if (canManage) {
    return { decision: 'ALLOW', reason: 'file_manage_or_super', statusHint: 200 };
  }
  if (!ctx.asset.uploadedBy) {
    return { decision: 'ALLOW', reason: 'unowned_file_legacy_allow', statusHint: 200 };
  }
  if (String(ctx.asset.uploadedBy) === String(subject.id)) {
    return { decision: 'ALLOW', reason: 'file_owner', statusHint: 200 };
  }
  return { decision: 'DENY', reason: 'not_file_owner', statusHint: 403 };
}

function evaluateLegacyFile(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  switch (action) {
    case 'upload':
      return evaluateUpload(subject, ctx);
    case 'categories':
      return evaluateAuthOnly(subject);
    case 'stats':
    case 'list':
    case 'purge_expired':
      return requireStaffPermission(subject, SYSTEM_SETTINGS_LIVE);
    case 'delete':
      return evaluateDelete(subject, ctx);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

function evaluatePolicyFile(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyUserId;
  void _untrusted.bodyOwnerId;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  void _untrusted.queryUploadedBy;
  const legacy = evaluateLegacyFile(subject, action, ctx);
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
  OPEN_UPLOAD_CATEGORIES,
  buildSubject,
  evaluateLegacyFile,
  evaluatePolicyFile,
  compareDecisions,
  SYSTEM_SETTINGS_LIVE,
};
