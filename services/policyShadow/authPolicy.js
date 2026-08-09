/**
 * Policy shadow for LIVE /api/auth (Wave 6.19).
 *
 * Architecture note: repo uses services/policyShadow/* (no shared/policies/).
 *
 * Policy evaluates ROUTE ACCESS authorization only.
 * Does NOT verify passwords, JWT crypto, refresh rotation, CAPTCHA, TOTP, OAuth.
 * Those remain Legacy-owned. Public routes → AUTH=PUBLIC → ALLOW.
 * No invented MANAGE_AUTH / VIEW_AUTH permissions.
 */
const ACTIONS = new Set([
  // Public (AUTH=PUBLIC)
  'csrf_token',
  'captcha',
  'refresh',
  'check_role',
  'google',
  'google_callback',
  'zalo',
  'zalo_callback',
  'login',
  'login_public',
  'login_internal',
  'mfa_verify',
  'logout',
  'register_teacher',
  'forgot_password_request',
  'forgot_password_verify',
  'reset_password_request',
  // Auth-required
  'mfa_setup',
  'mfa_enable',
  'mfa_disable',
  'mfa_status',
  'change_password',
  'me',
  'avatar',
  'admin_generate_otp',
  'admin_reset_password',
  'admin_profile',
]);

const PUBLIC_ACTIONS = new Set([
  'csrf_token',
  'captcha',
  'refresh',
  'check_role',
  'google',
  'google_callback',
  'zalo',
  'zalo_callback',
  'login',
  'login_public',
  'login_internal',
  'mfa_verify',
  'logout',
  'register_teacher',
  'forgot_password_request',
  'forgot_password_verify',
  'reset_password_request',
]);

const AUTH_ONLY_ACTIONS = new Set([
  'change_password',
  'me',
  'avatar',
]);

const INTERNAL_MFA_ACTIONS = new Set([
  'mfa_setup',
  'mfa_enable',
  'mfa_disable',
  'mfa_status',
]);

const ADMIN_STAFF_ACTIONS = new Set([
  'admin_generate_otp',
  'admin_reset_password',
  'admin_profile',
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

function evaluatePublic() {
  return {
    decision: 'ALLOW',
    reason: 'auth_public',
    statusHint: 200,
    auth: 'PUBLIC',
    branch: 'ignored',
    tenant: 'ignored',
    ownership: 'none',
    dataScope: 'none',
  };
}

function evaluateAuthOnly(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  return {
    decision: 'ALLOW',
    reason: 'authenticated_self',
    statusHint: 200,
    auth: 'REQUIRED',
    branch: 'ignored',
    tenant: 'ignored',
    ownership: 'self',
    dataScope: 'none',
  };
}

/** Mirrors handler: id==='admin' OR role admin|staff */
function evaluateInternalMfa(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  if (subject.id === 'admin') {
    return {
      decision: 'ALLOW',
      reason: 'hardcoded_admin_mfa',
      statusHint: 200,
      auth: 'REQUIRED',
      branch: 'ignored',
      tenant: 'ignored',
    };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'admin' || role === 'staff') {
    return {
      decision: 'ALLOW',
      reason: 'internal_admin_or_staff_mfa',
      statusHint: 200,
      auth: 'REQUIRED',
      branch: 'ignored',
      tenant: 'ignored',
    };
  }
  return { decision: 'DENY', reason: 'mfa_internal_only', statusHint: 403 };
}

/** Mirrors handler: role admin|staff (hardcoded admin has role admin) */
function evaluateAdminStaff(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'admin' || role === 'staff') {
    return {
      decision: 'ALLOW',
      reason: 'role_admin_or_staff',
      statusHint: 200,
      auth: 'REQUIRED',
      branch: 'ignored',
      tenant: 'ignored',
      ownership: 'none_target_is_operation_param',
    };
  }
  return { decision: 'DENY', reason: 'not_admin_staff_role', statusHint: 403 };
}

function evaluateLegacyAuth(subject, action, _ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  if (PUBLIC_ACTIONS.has(action)) return evaluatePublic();
  if (AUTH_ONLY_ACTIONS.has(action)) return evaluateAuthOnly(subject);
  if (INTERNAL_MFA_ACTIONS.has(action)) return evaluateInternalMfa(subject);
  if (ADMIN_STAFF_ACTIONS.has(action)) return evaluateAdminStaff(subject);
  return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
}

/**
 * Policy ignores untrusted actor-identity spoofs.
 * body.role / body.userId on login/forgot/admin may be OPERATION PARAMS in Legacy —
 * they are not used as actor identity here.
 */
function evaluatePolicyAuth(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyUserId;
  void _untrusted.bodyActorId;
  void _untrusted.bodyOwnerId;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  const legacy = evaluateLegacyAuth(subject, action, ctx);
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
  PUBLIC_ACTIONS,
  AUTH_ONLY_ACTIONS,
  INTERNAL_MFA_ACTIONS,
  ADMIN_STAFF_ACTIONS,
  buildSubject,
  evaluateLegacyAuth,
  evaluatePolicyAuth,
  compareDecisions,
};
