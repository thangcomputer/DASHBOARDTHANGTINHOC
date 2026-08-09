/**
 * Phase 7.14 — Controlled cutover gate for LIVE /api/branches ONLY.
 *
 * LEGACY (default):
 *   - list_public → public pass-through (no auth)
 *   - list_all/create/update/delete → checkPermission('manage_staff')
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/update/delete branches, invalidate cache, or mutate auth.
 */
const logger = require('../config/logger');
const { checkPermission } = require('./auth');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

const ADMIN_ACTIONS = new Set(['list_all', 'create', 'update', 'delete']);
const checkManageStaff = checkPermission('manage_staff');

function denyBranches(res, statusHint, reason) {
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

function legacyBranchesGate(action, req, res, next) {
  if (ADMIN_ACTIONS.has(action)) {
    return checkManageStaff(req, res, next);
  }
  return next();
}

/**
 * @param {string} action - branchPolicy action key
 */
function branchesCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('branches');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'branches',
          action: `branch_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] branches authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'branches';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'branches',
          action: `branch_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] branches using Legacy authority',
      );
      return legacyBranchesGate(action, req, res, next);
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
          family: 'branches',
          action: `branch_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] branches Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyBranchesGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'branches',
          action: `branch_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] branches Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'branches',
        action: `branch_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] branches Policy DENY',
    );
    return denyBranches(res, statusHint, reason);
  };
}

module.exports = {
  branchesCutoverGate,
  denyBranches,
  legacyBranchesGate,
  ADMIN_ACTIONS,
};
