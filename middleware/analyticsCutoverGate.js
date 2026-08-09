/**
 * Phase 7.27 — Controlled cutover gate for LIVE /api/analytics ONLY.
 *
 * LEGACY (default):
 *   checkAnyPermission(MANAGE_FINANCE, VIEW_BRANCH_REVENUE) — retained here.
 *   BranchFilter remains DATA SCOPE (applied before this gate).
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not invoke revenue/enrollment aggregation, mutate ledger/finance/auth, or write storage.
 * Aggregation remains handler-owned.
 */
const logger = require('../config/logger');
const { checkAnyPermission } = require('./auth');
const { PERMISSIONS } = require('../constants/permissions');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

const legacyAnalyticsPermission = checkAnyPermission(
  PERMISSIONS.MANAGE_FINANCE,
  PERMISSIONS.VIEW_BRANCH_REVENUE,
);

function denyAnalytics(res, statusHint, reason) {
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
  if (r === 'role_not_staff' || r === 'policy_role_not_staff') {
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

function legacyAnalyticsGate(_action, req, res, next) {
  return legacyAnalyticsPermission(req, res, next);
}

/**
 * @param {string} action - analyticsPolicy action key
 */
function analyticsCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('analytics');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'analytics',
          action: `analytics_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] analytics authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'analytics';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'analytics',
          action: `analytics_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] analytics using Legacy authority',
      );
      return legacyAnalyticsGate(action, req, res, next);
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
          family: 'analytics',
          action: `analytics_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] analytics Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyAnalyticsGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'analytics',
          action: `analytics_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] analytics Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'analytics',
        action: `analytics_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] analytics Policy DENY',
    );
    return denyAnalytics(res, statusHint, reason);
  };
}

module.exports = {
  analyticsCutoverGate,
  denyAnalytics,
  legacyAnalyticsGate,
};
