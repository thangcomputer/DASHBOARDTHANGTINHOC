/**
 * Phase 7.22 — Controlled cutover gate for LIVE /api/quizzes ONLY.
 *
 * LEGACY (default):
 *   - teacher_list/create/delete/student_list/get/submit → auth already applied; pass-through
 *     (ownership on delete via findOneAndDelete → 404; handler-owned submit/list scope)
 *   - admin_read → checkPermission(MANAGE_TRAINING)
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/delete/submit quizzes, emit, notify, or mutate auth/finance.
 */
const logger = require('../config/logger');
const { checkPermission } = require('./auth');
const { PERMISSIONS } = require('../constants/permissions');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

const AUTH_ONLY_ACTIONS = new Set([
  'teacher_list',
  'create',
  'delete',
  'student_list',
  'get',
  'submit',
]);

const checkManageTraining = checkPermission(PERMISSIONS.MANAGE_TRAINING);

function denyQuizzes(res, statusHint, reason) {
  const r = String(reason || '');
  if (
    statusHint === 401
    || r === 'unauthenticated'
    || r === 'policy_unauthenticated'
  ) {
    return res.status(401).json({
      success: false,
      message: 'Không có token, truy cập bị từ chối',
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
  if (
    r === 'missing_manage_training'
    || r === 'policy_missing_manage_training'
  ) {
    return res.status(403).json({
      success: false,
      message: '403 Forbidden: Bạn không có quyền thực hiện thao tác này. Liên hệ Super Admin để được cấp quyền.',
    });
  }
  return res.status(403).json({
    success: false,
    message: '403 Forbidden: Bạn không có quyền thực hiện thao tác này. Liên hệ Super Admin để được cấp quyền.',
  });
}

function legacyQuizzesGate(action, req, res, next) {
  if (action === 'admin_read') {
    return checkManageTraining(req, res, next);
  }
  return next();
}

/**
 * @param {string} action - quizPolicy / quizAdminRead action key
 */
function quizzesCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('quizzes');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'quizzes',
          action: `quiz_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] quizzes authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'quizzes';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'quizzes',
          action: `quiz_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] quizzes using Legacy authority',
      );
      return legacyQuizzesGate(action, req, res, next);
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
          family: 'quizzes',
          action: `quiz_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] quizzes Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyQuizzesGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'quizzes',
          action: `quiz_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] quizzes Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'quizzes',
        action: `quiz_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] quizzes Policy DENY',
    );
    return denyQuizzes(res, statusHint, reason);
  };
}

module.exports = {
  quizzesCutoverGate,
  denyQuizzes,
  legacyQuizzesGate,
  AUTH_ONLY_ACTIONS,
};
