/**
 * Phase 7.11 — Controlled cutover gate for /api/courses ONLY.
 *
 * LEGACY (default):
 *   - list/get/stats → public (pass-through)
 *   - writes → requireInternalToken + checkPermission('system_settings')
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 *
 * Fail-safe: helper throw / Policy ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/update/delete/seed courses, notify, audit, write DB, or mutate auth.
 */
const logger = require('../config/logger');
const { requireInternalToken, checkPermission } = require('./auth');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

const WRITE_ACTIONS = new Set([
  'create',
  'update',
  'price',
  'delete',
  'restore',
  'seed',
]);

const checkSystemSettings = checkPermission('system_settings');

function denyCourse(res, statusHint, reason) {
  if (statusHint === 401 || reason === 'unauthenticated' || reason === 'policy_unauthenticated') {
    return res.status(401).json({ success: false, message: 'Chưa xác thực' });
  }
  if (reason === 'internal_token_required' || reason === 'policy_internal_token_required') {
    return res.status(403).json({
      success: false,
      code: 'INTERNAL_TOKEN_REQUIRED',
      message: 'Token không hợp lệ cho khu vực quản trị. Vui lòng đăng nhập qua cổng nội bộ (/admin/login).',
    });
  }
  if (reason === 'role_not_staff' || reason === 'policy_role_not_staff') {
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

/** Legacy path: public reads pass through; writes keep internal token + SYSTEM_SETTINGS. */
function legacyCourseGate(action, req, res, next) {
  if (!WRITE_ACTIONS.has(action)) {
    return next();
  }
  return requireInternalToken(req, res, () => checkSystemSettings(req, res, next));
}

/**
 * @param {string} action - coursePolicy action key
 */
function coursesCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('courses');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'courses',
          action: `course_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] courses authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'courses';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'courses',
          action: `course_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] courses using Legacy authority',
      );
      return legacyCourseGate(action, req, res, next);
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
          family: 'courses',
          action: `course_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] courses Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyCourseGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'courses',
          action: `course_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] courses Policy ALLOW — Legacy write gate skipped',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'courses',
        action: `course_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        statusHint: statusHint || 403,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] courses Policy DENY',
    );
    return denyCourse(res, statusHint, reason);
  };
}

module.exports = {
  coursesCutoverGate,
  denyCourse,
  legacyCourseGate,
  WRITE_ACTIONS,
};
