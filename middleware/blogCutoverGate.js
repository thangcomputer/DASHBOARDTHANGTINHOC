/**
 * Phase 7.16 — Controlled cutover gate for LIVE /api/blog ONLY.
 *
 * LEGACY (default):
 *   - list/get → auth already applied (router.use); pass-through
 *     (audience / draft checks remain in handler on Legacy path)
 *   - manage_* → checkPermission(MANAGE_BLOG)
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/update/delete/publish posts, notify, emit, or mutate auth.
 */
const logger = require('../config/logger');
const { checkPermission } = require('./auth');
const { PERMISSIONS } = require('../constants/permissions');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

const MANAGE_ACTIONS = new Set([
  'manage_list',
  'manage_get',
  'manage_create',
  'manage_update',
  'manage_publish',
  'manage_hide',
  'manage_delete',
  'manage_upload',
]);

const checkManageBlog = checkPermission(PERMISSIONS.MANAGE_BLOG);

function denyBlog(res, statusHint, reason) {
  const r = String(reason || '');
  if (
    statusHint === 401
    || r === 'unauthenticated'
    || r === 'policy_unauthenticated'
  ) {
    return res.status(401).json({
      success: false,
      message: 'Chưa xác thực',
    });
  }
  if (
    r === 'audience_teacher_blocked'
    || r === 'policy_audience_teacher_blocked'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bài viết này dành cho Học viên',
    });
  }
  if (
    r === 'audience_student_blocked'
    || r === 'policy_audience_student_blocked'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bài viết này dành cho Giảng viên',
    });
  }
  if (
    r === 'draft_without_manage_blog'
    || r === 'policy_draft_without_manage_blog'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền xem bản nháp',
    });
  }
  if (
    r === 'role_not_staff'
    || r === 'policy_role_not_staff'
  ) {
    return res.status(403).json({
      success: false,
      message: '403 Forbidden: Yêu cầu quyền Admin/Staff',
    });
  }
  return res.status(403).json({
    success: false,
    message: '403 Forbidden: Bạn không có quyền thực hiện thao tác này. Liên hệ Super Admin để được cấp quyền.',
  });
}

function legacyBlogGate(action, req, res, next) {
  if (MANAGE_ACTIONS.has(action)) {
    return checkManageBlog(req, res, next);
  }
  return next();
}

/**
 * @param {string} action - blogPolicy action key
 */
function blogCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('blog');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'blog',
          action: `blog_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] blog authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'blog';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'blog',
          action: `blog_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] blog using Legacy authority',
      );
      return legacyBlogGate(action, req, res, next);
    }

    const shadow = req.policyShadow || {};
    const comparison = shadow.comparison;
    const decision = shadow.policyDecision;
    const reason = shadow.policyReason || '';
    const statusHint = shadow.policyStatusHint;

    if (
      comparison === 'ERROR'
      || comparison === 'UNKNOWN'
      || (decision !== 'ALLOW' && decision !== 'DENY')
    ) {
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'blog',
          action: `blog_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] blog Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyBlogGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'blog',
          action: `blog_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] blog Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'blog',
        action: `blog_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] blog Policy DENY',
    );
    return denyBlog(res, statusHint, reason);
  };
}

module.exports = {
  blogCutoverGate,
  denyBlog,
  legacyBlogGate,
  MANAGE_ACTIONS,
};
