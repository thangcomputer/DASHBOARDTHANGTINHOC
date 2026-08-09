/**
 * Phase 7.2 — Controlled cutover gate for /api/monitoring ONLY.
 *
 * LEGACY (default): existing isAdmin remains HTTP authority.
 * POLICY (env opt-in): Policy decision is HTTP authority; Legacy isAdmin skipped.
 *
 * Fail-safe: helper throw / Policy ERROR / UNKNOWN / malformed → Legacy isAdmin.
 * Does not mutate DB, sockets, tokens, or CQRS.
 */
const logger = require('../config/logger');
const { isAdmin } = require('./auth');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

function denyMonitoring(res, statusHint, reason) {
  const status = statusHint === 401 ? 401 : 403;
  if (reason === 'metrics_reset_super_only' || reason === 'policy_metrics_reset_super_only') {
    return res.status(403).json({ success: false, message: 'Chi Super Admin' });
  }
  if (status === 401) {
    return res.status(401).json({
      success: false,
      message: 'Không có token, truy cập bị từ chối',
    });
  }
  return res.status(403).json({
    success: false,
    message: 'Quyền truy cập bị từ chối: Yêu cầu quyền Admin',
  });
}

/**
 * @param {string} action - monitoringPolicy action key
 */
function monitoringCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('monitoring');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'monitoring',
          action: `monitoring_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] monitoring authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'monitoring';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'monitoring',
          action: `monitoring_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] monitoring using Legacy authority',
      );
      return isAdmin(req, res, next);
    }

    // ── Policy-primary path ──────────────────────────────────────────────────
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
          family: 'monitoring',
          action: `monitoring_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] monitoring Policy unsafe — fallback Legacy isAdmin',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return isAdmin(req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'monitoring',
          action: `monitoring_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] monitoring Policy ALLOW — Legacy isAdmin skipped',
      );
      return next();
    }

    // DENY — Policy is sole HTTP authority (do not also run isAdmin)
    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'monitoring',
        action: `monitoring_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] monitoring Policy DENY',
    );
    return denyMonitoring(res, statusHint, reason);
  };
}

module.exports = {
  monitoringCutoverGate,
  denyMonitoring,
};
