/**
 * Phase 7.25 — Controlled cutover gate for LIVE /api/evaluations ONLY.
 *
 * LEGACY (default):
 *   All actions → auth already applied; pass-through.
 *   Role / ownership checks remain in handlers.
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/update evaluations, emit, notify, or mutate auth/finance.
 * Teacher rating aggregation / notify / realtime refresh remain handler-owned.
 */
const logger = require('../config/logger');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

function denyEvaluations(res, statusHint, reason) {
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
  if (r === 'not_admin_staff' || r === 'policy_not_admin_staff') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền truy cập',
    });
  }
  if (r === 'not_student' || r === 'policy_not_student') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền',
    });
  }
  if (r === 'student_not_self' || r === 'policy_student_not_self') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền gửi đánh giá thay người khác',
    });
  }
  if (
    r === 'role_cannot_mark_read'
    || r === 'policy_role_cannot_mark_read'
    || r === 'teacher_not_target'
    || r === 'policy_teacher_not_target'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền',
    });
  }
  return res.status(403).json({
    success: false,
    message: 'Không có quyền',
  });
}

function legacyEvaluationsGate(_action, _req, _res, next) {
  return next();
}

/**
 * @param {string} action - evaluationsPolicy action key
 */
function evaluationsCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('evaluations');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'evaluations',
          action: `evaluation_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] evaluations authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'evaluations';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'evaluations',
          action: `evaluation_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] evaluations using Legacy authority',
      );
      return legacyEvaluationsGate(action, req, res, next);
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
          family: 'evaluations',
          action: `evaluation_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] evaluations Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyEvaluationsGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'evaluations',
          action: `evaluation_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] evaluations Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'evaluations',
        action: `evaluation_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] evaluations Policy DENY',
    );
    return denyEvaluations(res, statusHint, reason);
  };
}

module.exports = {
  evaluationsCutoverGate,
  denyEvaluations,
  legacyEvaluationsGate,
};
