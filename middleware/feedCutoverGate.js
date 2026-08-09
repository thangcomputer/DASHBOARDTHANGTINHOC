/**
 * Phase 7.17 — Controlled cutover gate for LIVE /api/feed ONLY.
 *
 * LEGACY (default):
 *   - All actions → auth already applied on routes; pass-through.
 *     Ownership for delete_post / delete_comment remains in the handler.
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/update/delete posts, emit feed_room events, notify, or mutate auth.
 */
const logger = require('../config/logger');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

function denyFeed(res, statusHint, reason) {
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
    r === 'not_post_owner_or_admin'
    || r === 'policy_not_post_owner_or_admin'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Ban khong co quyen xoa bai nay',
    });
  }
  if (
    r === 'not_comment_owner_or_admin'
    || r === 'policy_not_comment_owner_or_admin'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Ban khong co quyen xoa binh luan nay',
    });
  }
  return res.status(403).json({
    success: false,
    message: 'Ban khong co quyen thuc hien thao tac nay',
  });
}

function legacyFeedGate(_action, _req, _res, next) {
  return next();
}

/**
 * @param {string} action - feedPolicy action key
 */
function feedCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('feed');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'feed',
          action: `feed_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] feed authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'feed';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'feed',
          action: `feed_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] feed using Legacy authority',
      );
      return legacyFeedGate(action, req, res, next);
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
          family: 'feed',
          action: `feed_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] feed Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyFeedGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'feed',
          action: `feed_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] feed Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'feed',
        action: `feed_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] feed Policy DENY',
    );
    return denyFeed(res, statusHint, reason);
  };
}

module.exports = {
  feedCutoverGate,
  denyFeed,
  legacyFeedGate,
};
