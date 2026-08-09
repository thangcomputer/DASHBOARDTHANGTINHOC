/**
 * Phase 7.6 — Controlled cutover gate for /api/tenants ONLY.
 *
 * LEGACY (default): existing isSuperAdmin remains HTTP authority.
 * POLICY (env opt-in): Policy decision is HTTP authority; Legacy isSuperAdmin skipped.
 *
 * Fail-safe: helper throw / Policy ERROR / UNKNOWN / malformed → Legacy isSuperAdmin.
 * Does not create/update/assign tenants, write DB, emit sockets, or mutate auth.
 */
const logger = require('../config/logger');
const { isSuperAdmin } = require('./auth');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

function denyTenant(res, statusHint) {
  const status = statusHint === 401 ? 401 : 403;
  if (status === 401) {
    return res.status(401).json({
      success: false,
      message: 'Không có token, truy cập bị từ chối',
    });
  }
  return res.status(403).json({
    success: false,
    message: 'Quyền truy cập bị từ chối: Chỉ Super Admin mới có quyền này',
  });
}

/**
 * @param {string} action - tenantPolicy action key
 */
function tenantsCutoverGate(action) {
  return async (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('tenants');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'tenants',
          action: `tenant_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] tenants authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'tenants';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'tenants',
          action: `tenant_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] tenants using Legacy authority',
      );
      return isSuperAdmin(req, res, next);
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
          family: 'tenants',
          action: `tenant_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] tenants Policy unsafe — fallback Legacy isSuperAdmin',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return isSuperAdmin(req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'tenants',
          action: `tenant_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] tenants Policy ALLOW — Legacy isSuperAdmin skipped',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'tenants',
        action: `tenant_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] tenants Policy DENY',
    );
    return denyTenant(res, statusHint);
  };
}

module.exports = {
  tenantsCutoverGate,
  denyTenant,
};
