/**
 * Phase 7.10 — Controlled cutover gate for /api/builder ONLY.
 *
 * LEGACY (default):
 *   - admin actions → existing isAdmin
 *   - form_get / form_submit / form_submit_auth → no isAdmin (handler/public semantics)
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 *   - unpublished form_get DENY uses statusHint 404 (hide existence; never 403)
 *
 * Fail-safe: helper throw / Policy ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/update/submit forms, run reports, write DB, emit sockets, or mutate auth.
 * Soft JWT remains in policyShadowBuilder only (never mutates req.user here).
 */
const logger = require('../config/logger');
const { isAdmin } = require('./auth');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');
const { ADMIN_ACTIONS } = require('../services/policyShadow/builderPolicy');

function denyBuilder(res, statusHint, reason) {
  const status = statusHint === 401 ? 401 : (statusHint === 404 ? 404 : 403);
  if (status === 401) {
    return res.status(401).json({
      success: false,
      message: 'Không có token, truy cập bị từ chối',
    });
  }
  if (status === 404) {
    return res.status(404).json({
      success: false,
      message: 'Khong tim thay form',
    });
  }
  void reason;
  return res.status(403).json({
    success: false,
    message: 'Quyền truy cập bị từ chối: Yêu cầu quyền Admin',
  });
}

/** Legacy path for this action — admin routes use isAdmin; public/auth-only pass through. */
function legacyBuilderGate(action, req, res, next) {
  if (ADMIN_ACTIONS.has(action)) {
    return isAdmin(req, res, next);
  }
  return next();
}

/**
 * @param {string} action - builderPolicy action key
 */
function builderCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('builder');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'builder',
          action: `builder_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] builder authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'builder';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'builder',
          action: `builder_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] builder using Legacy authority',
      );
      return legacyBuilderGate(action, req, res, next);
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
          family: 'builder',
          action: `builder_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] builder Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyBuilderGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'builder',
          action: `builder_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] builder Policy ALLOW — Legacy gate skipped',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'builder',
        action: `builder_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        statusHint: statusHint || 403,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] builder Policy DENY',
    );
    return denyBuilder(res, statusHint, reason);
  };
}

module.exports = {
  builderCutoverGate,
  denyBuilder,
  legacyBuilderGate,
};
