/**
 * Policy shadow for LIVE /api/feed (Wave 6.17).
 * Auth-only for list/create/upload/react/comment.
 * Delete post/comment: adminLike OR ownership (Legacy helpers mirrored).
 * No MANAGE_FEED permission. No branch/tenant.
 */
const ACTIONS = new Set([
  'list',
  'create',
  'upload',
  'delete_post',
  'update_post',
  'like',
  'react',
  'comment',
  'delete_comment',
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

function normalizeRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'staff') return 'staff';
  if (r === 'admin') return 'admin';
  if (r === 'teacher') return 'teacher';
  return 'student';
}

function isSuperAdminUser(subject) {
  if (!subject) return false;
  const uid = String(subject.id || subject._id || '');
  const adminRole = String(subject.adminRole || '').toUpperCase();
  return uid === 'admin' || adminRole === 'SUPER_ADMIN';
}

function isHighAdminUser(subject) {
  if (!subject) return false;
  const adminRole = String(subject.adminRole || '').toUpperCase();
  return adminRole === 'HIGH_ADMIN';
}

function isSuperAdminAuthor(authorId, authorAdminRole, authorRole) {
  const uid = String(authorId || '');
  const aRole = String(authorAdminRole || '').toUpperCase();
  return uid === 'admin' || aRole === 'SUPER_ADMIN';
}

/** Mirrors feedRoutes isAdminLike. */
function isAdminLike(subject) {
  const r = normalizeRole(subject?.role);
  return r === 'admin'
    || r === 'staff'
    || isSuperAdminUser(subject)
    || isHighAdminUser(subject);
}

function canEditPost(subject, post) {
  if (!subject || !post) return false;
  if (isSuperAdminUser(subject)) return true;
  return String(post.authorId) === String(subject.id || subject._id);
}

function evaluateAuthOnly(subject) {
  if (!subject?.id) {
    return { decision: 'DENY', reason: 'unauthenticated', statusHint: 401 };
  }
  return { decision: 'ALLOW', reason: 'authenticated', statusHint: 200 };
}

function canDeletePost(subject, post) {
  if (!subject || !post) return false;
  const isPostAuthor = String(post.authorId) === String(subject.id || subject._id);
  const isPostFromSuper = isSuperAdminAuthor(post.authorId, post.authorAdminRole, post.authorRole);

  // 1. Bài của Super Admin: CHỈ Super Admin mới xóa được
  if (isPostFromSuper) {
    return isSuperAdminUser(subject);
  }

  // 2. Tác giả tự xóa bài của mình
  if (isPostAuthor) return true;

  // 3. Super Admin và High Admin xóa được bài của người khác
  if (isSuperAdminUser(subject) || isHighAdminUser(subject)) return true;

  // 4. Người khác không được xóa bài của người khác
  return false;
}

function canDeleteComment(subject, post, comment) {
  if (!subject || !comment) return false;
  const isCommentAuthor = String(comment.authorId) === String(subject.id || subject._id);
  const isCommentFromSuper = isSuperAdminAuthor(comment.authorId, comment.authorAdminRole, comment.authorRole);

  // 1. Bình luận của Super Admin: CHỈ Super Admin mới xóa được (không ai khác được xóa)
  if (isCommentFromSuper) {
    return isSuperAdminUser(subject);
  }

  // 2. Tác giả tự xóa bình luận của chính mình
  if (isCommentAuthor) return true;

  // 3. Super Admin và High Admin xóa được bình luận của tất cả mọi người
  if (isSuperAdminUser(subject) || isHighAdminUser(subject)) return true;

  // 4. Chủ bài viết (nếu không phải comment của Super Admin) có thể xóa comment trong bài mình
  if (post && String(post.authorId) === String(subject.id || subject._id)) return true;

  // 5. Người khác không được xóa bình luận của người khác
  return false;
}

function evaluateUpdatePost(subject, ctx) {
  const auth = evaluateAuthOnly(subject);
  if (auth.decision === 'DENY') return auth;
  if (!ctx.post) {
    return { decision: 'ALLOW', reason: 'missing_post_handler_404', statusHint: 200 };
  }
  if (!canEditPost(subject, ctx.post)) {
    return { decision: 'DENY', reason: 'not_post_author_or_super_admin', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'update_post_ok', statusHint: 200 };
}

function evaluateDeletePost(subject, ctx) {
  const auth = evaluateAuthOnly(subject);
  if (auth.decision === 'DENY') return auth;
  if (!ctx.post) {
    return { decision: 'ALLOW', reason: 'missing_post_handler_404', statusHint: 200 };
  }
  if (!canDeletePost(subject, ctx.post)) {
    return { decision: 'DENY', reason: 'not_post_owner_or_admin', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'delete_post_ok', statusHint: 200 };
}

function evaluateDeleteComment(subject, ctx) {
  const auth = evaluateAuthOnly(subject);
  if (auth.decision === 'DENY') return auth;
  if (!ctx.post) {
    return { decision: 'ALLOW', reason: 'missing_post_handler_404', statusHint: 200 };
  }
  if (!ctx.comment) {
    return { decision: 'ALLOW', reason: 'missing_comment_handler_404', statusHint: 200 };
  }
  if (!canDeleteComment(subject, ctx.post, ctx.comment)) {
    return { decision: 'DENY', reason: 'not_comment_owner_or_admin', statusHint: 403 };
  }
  return { decision: 'ALLOW', reason: 'delete_comment_ok', statusHint: 200 };
}

function evaluateLegacyFeed(subject, action, ctx = {}) {
  if (!ACTIONS.has(action)) {
    return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
  switch (action) {
    case 'list':
    case 'create':
    case 'upload':
    case 'like':
    case 'react':
    case 'comment':
      return evaluateAuthOnly(subject);
    case 'update_post':
      return evaluateUpdatePost(subject, ctx);
    case 'delete_post':
      return evaluateDeletePost(subject, ctx);
    case 'delete_comment':
      return evaluateDeleteComment(subject, ctx);
    default:
      return { decision: 'DENY', reason: 'unknown_action', statusHint: 403 };
  }
}

function evaluatePolicyFeed(subject, action, ctx = {}, _untrusted = {}) {
  void _untrusted.bodyRole;
  void _untrusted.clientAdminRole;
  void _untrusted.clientPermissions;
  void _untrusted.bodyAuthorId;
  void _untrusted.bodyAuthorAvatar;
  void _untrusted.bodyBranchId;
  void _untrusted.bodyTenantId;
  void _untrusted.bodyUserId;
  const legacy = evaluateLegacyFeed(subject, action, ctx);
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
  evaluateLegacyFeed,
  evaluatePolicyFeed,
  compareDecisions,
  isAdminLike,
  canEditPost,
  canDeletePost,
  canDeleteComment,
};
