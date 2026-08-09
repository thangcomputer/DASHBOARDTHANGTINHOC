/**
 * Policy shadow for LIVE /api/builder (Wave 6.18).
 * Most routes: authMiddleware + isAdmin (role admin|staff).
 * Public: form_get (published), form_submit.
 * form_submit_auth: auth only.
 * No MANAGE_BUILDER. No project ownership. Branch/tenant: ignored.
 */
const ACTIONS = new Set([
  'form_list',
  'form_get',
  'form_create',
  'form_update',
  'form_delete',
  'form_submit',
  'form_submit_auth',
  'form_submissions',
  'form_submissions_export',
  'report_sources',
  'report_list',
  'report_create',
  'report_update',
  'report_delete',
  'report_run',
  'report_export',
]);

const ADMIN_ACTIONS = new Set([
  'form_list',
  'form_create',
  'form_update',
  'form_delete',
  'form_submissions',
  'form_submissions_export',
  'report_sources',
  'report_list',
  'report_create',
  'report_update',
  'report_delete',
  'report_run',
  'report_export',
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

function evaluateIsAdmin(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  const role = String(subject.role || '').toLowerCase();
  if (role === 'admin' || role === 'staff') {
    return {
      decision: 'ALLOW',
      reason: 'role_admin_or_staff',
      statusHint: 200,
      dataScope: 'none',
      branch: 'ignored',
      tenant: 'ignored',
      ownership: 'none_any_admin',
    };
  }
  return { decision: 'DENY', reason: 'not_admin_staff_role', statusHint: 403 };
}

function isAdminLike(subject) {
  if (!subject?.id) return false;
  if (subject.id === 'admin') return true;
  const role = String(subject.role || '').toLowerCase();
  return role === 'admin' || role === 'staff';
}

/**
 * GET /forms/:idOrSlug — published public; draft/admin path returns 404 (not 403) for others.
 * ctx.form: { status } | null (null = missing → ALLOW handler 404).
 */
function evaluateFormGet(subject, ctx = {}) {
  if (!ctx.form) {
    return {
      decision: 'ALLOW',
      reason: 'missing_form_handler_404',
      statusHint: 200,
      branch: 'ignored',
      tenant: 'ignored',
    };
  }
  if (ctx.form.status === 'published') {
    return {
      decision: 'ALLOW',
      reason: 'public_published_form',
      statusHint: 200,
      dataScope: 'none',
      branch: 'ignored',
      tenant: 'ignored',
    };
  }
  // draft / archived — Legacy hides with HTTP 404 for non-admin
  if (isAdminLike(subject)) {
    return {
      decision: 'ALLOW',
      reason: 'admin_draft_form',
      statusHint: 200,
      ownership: 'none_any_admin',
    };
  }
  return {
    decision: 'DENY',
    reason: 'unpublished_form_hidden_404',
    statusHint: 404,
  };
}

function evaluateFormSubmit() {
  return {
    decision: 'ALLOW',
    reason: 'public_submit',
    statusHint: 200,
    branch: 'ignored',
    tenant: 'ignored',
    ownership: 'none',
  };
}

function evaluateFormSubmitAuth(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  return {
    decision: 'ALLOW',
    reason: 'authenticated_submit',
    statusHint: 200,
    branch: 'ignored',
    tenant: 'ignored',
  };
}

function evaluateLegacyBuilder(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  if (action === 'form_get') return evaluateFormGet(subject, ctx);
  if (action === 'form_submit') return evaluateFormSubmit();
  if (action === 'form_submit_auth') return evaluateFormSubmitAuth(subject);
  if (ADMIN_ACTIONS.has(action)) {
    const base = evaluateIsAdmin(subject);
    if (base.decision === 'DENY') return base;
    if (
      ['form_update', 'form_delete', 'form_submissions', 'form_submissions_export'].includes(action)
      && ctx.formMissing
    ) {
      return { ...base, reason: 'missing_form_handler_404', statusHint: 200 };
    }
    if (
      ['report_update', 'report_delete', 'report_run', 'report_export'].includes(action)
      && ctx.reportMissing
    ) {
      return { ...base, reason: 'missing_report_handler_404', statusHint: 200 };
    }
    return base;
  }
  return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
}

function evaluatePolicyBuilder(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyUserId;
  void _untrusted.bodyOwnerId;
  void _untrusted.bodyCreatedBy;
  void _untrusted.bodySubmittedBy;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  const legacy = evaluateLegacyBuilder(subject, action, ctx);
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
  ADMIN_ACTIONS,
  buildSubject,
  evaluateLegacyBuilder,
  evaluatePolicyBuilder,
  compareDecisions,
};
