/**
 * Phase 7.8 — Controlled cutover gate for /api/ai ONLY.
 *
 * LEGACY (default): existing isAdmin remains HTTP authority.
 * POLICY (env opt-in): Policy decision is HTTP authority; Legacy isAdmin skipped.
 *
 * Fail-safe: helper throw / Policy ERROR / UNKNOWN / malformed → Legacy isAdmin.
 * Does not call AI providers, write DB, emit sockets, enqueue jobs, or mutate auth.
 * Rate limiting remains outside this gate (sensitiveFlowLimiter on routes).
 */
const logger = require('../config/logger');
const { isAdmin } = require('./auth');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

function denyAi(res, statusHint) {
  const status = statusHint === 401 ? 401 : 403;
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
 * @param {string} action - aiPolicy action key
 */
function aiCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('ai');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'ai',
          action: `ai_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] ai authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'ai';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'ai',
          action: `ai_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] ai using Legacy authority',
      );
      return isAdmin(req, res, next);
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
          family: 'ai',
          action: `ai_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] ai Policy unsafe — fallback Legacy isAdmin',
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
          family: 'ai',
          action: `ai_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] ai Policy ALLOW — Legacy isAdmin skipped',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'ai',
        action: `ai_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] ai Policy DENY',
    );
    return denyAi(res, statusHint);
  };
}

module.exports = {
  aiCutoverGate,
  denyAi,
};
