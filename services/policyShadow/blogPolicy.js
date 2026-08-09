/**
 * Policy shadow for LIVE /api/blog (Wave 6.17).
 * Router-level authMiddleware. Manage ops: MANAGE_BLOG.
 * Public list/detail: audience DATA FILTER / HTTP 403 on mismatch.
 * No branch/tenant. No author ownership on manage write (any manage_blog).
 */
const {
  MANAGE_BLOG_LIVE,
  actorHasLivePermission,
} = require('./livePermissionAdapter');

const ACTIONS = new Set([
  'list',
  'get',
  'manage_list',
  'manage_get',
  'manage_create',
  'manage_update',
  'manage_publish',
  'manage_hide',
  'manage_delete',
  'manage_upload',
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
  return { decision: 'ALLOW', reason: 'authenticated', statusHint: 200, dataScope: 'audience_filter' };
}

function isAdminSide(subject) {
  const role = String(subject.role || '').toLowerCase();
  return role === 'admin'
    || role === 'staff'
    || subject.adminRole === 'SUPER_ADMIN'
    || subject.adminRole === 'STAFF';
}

/** Mirrors checkPermission(MANAGE_BLOG) / userHasPermission for staff roles. */
function requireManageBlog(subject) {
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
  if (!actorHasLivePermission(subject, MANAGE_BLOG_LIVE)) {
    return { decision: 'DENY', reason: 'missing_manage_blog', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'has_manage_blog', statusHint: 200 };
}

function hasManageBlogBool(subject) {
  return requireManageBlog(subject).decision === 'ALLOW';
}

function evaluateList(subject) {
  return evaluateAuthOnly(subject);
}

/**
 * GET /posts/:slugOrId — ctx.post, ctx.manageQuery ('1' or not).
 */
function evaluateGet(subject, ctx) {
  const auth = evaluateAuthOnly(subject);
  if (auth.decision === 'DENY') return auth;
  if (!ctx.post) {
    return { decision: 'ALLOW', reason: 'missing_post_handler_404', statusHint: 200 };
  }
  if (ctx.manageQuery) {
    if (hasManageBlogBool(subject)) {
      return { decision: 'ALLOW', reason: 'manage_view', statusHint: 200 };
    }
    if (ctx.post.status === 'published') {
      return { decision: 'ALLOW', reason: 'manage_query_published_ok', statusHint: 200 };
    }
    return { decision: 'DENY', reason: 'draft_without_manage_blog', statusHint: 403 };
  }
  // published-only path (handler already filters status)
  if (isAdminSide(subject)) {
    return { decision: 'ALLOW', reason: 'admin_side_bypass_audience', statusHint: 200 };
  }
  const role = String(subject.role || '').toLowerCase();
  const aud = ctx.post.targetAudience || 'all';
  if (role === 'teacher' && aud === 'student') {
    return { decision: 'DENY', reason: 'audience_teacher_blocked', statusHint: 403 };
  }
  if (role === 'student' && aud === 'teacher') {
    return { decision: 'DENY', reason: 'audience_student_blocked', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'audience_ok', statusHint: 200 };
}

function evaluateManage(subject, action, ctx = {}) {
  const base = requireManageBlog(subject);
  if (base.decision === 'DENY') return base;
  if (['manage_get', 'manage_update', 'manage_publish', 'manage_hide', 'manage_delete'].includes(action)) {
    if (!ctx.post) {
      return { decision: 'ALLOW', reason: 'missing_post_handler_404', statusHint: 200 };
    }
  }
  return { ...base, ownership: 'none_any_manager' };
}

function evaluateLegacyBlog(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  switch (action) {
    case 'list':
      return evaluateList(subject);
    case 'get':
      return evaluateGet(subject, ctx);
    case 'manage_list':
    case 'manage_get':
    case 'manage_create':
    case 'manage_update':
    case 'manage_publish':
    case 'manage_hide':
    case 'manage_delete':
    case 'manage_upload':
      return evaluateManage(subject, action, ctx);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

function evaluatePolicyBlog(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyAuthorId;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  void _untrusted.bodyOwnerId;
  const legacy = evaluateLegacyBlog(subject, action, ctx);
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
  evaluateLegacyBlog,
  evaluatePolicyBlog,
  compareDecisions,
  MANAGE_BLOG_LIVE,
};
