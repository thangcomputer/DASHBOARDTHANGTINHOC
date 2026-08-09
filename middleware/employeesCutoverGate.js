/**
 * Phase 7.29 — Controlled cutover gate for LIVE /api/employees ONLY.
 *
 * LEGACY (default):
 *   checkPermission(MANAGE_HR) — retained here.
 *   Cross-branch mutation checks remain handler-owned on Legacy path.
 *
 * POLICY (env opt-in): Policy decision is HTTP authority (incl. cross-branch mirrors).
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/update/delete HR records, write payroll logs, or emit sockets.
 * Mutations / payroll / realtime remain handler-owned.
 */
const logger = require('../config/logger');
const { checkPermission } = require('./auth');
const { PERMISSIONS } = require('../constants/permissions');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

const legacyManageHr = checkPermission(PERMISSIONS.MANAGE_HR);

function denyEmployees(res, statusHint, reason, action) {
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
  if (r === 'cross_branch' || r === 'policy_cross_branch') {
    if (action === 'update') {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền sửa nhân viên chi nhánh khác',
      });
    }
    if (action === 'delete') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền xóa nhân viên chi nhánh khác',
      });
    }
    if (action === 'pay') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền trả lương nhân viên chi nhánh khác',
      });
    }
  }
  return res.status(403).json({
    success: false,
    message: '403 Forbidden: Bạn không có quyền thực hiện thao tác này. Liên hệ Super Admin để được cấp quyền.',
  });
}

function legacyEmployeesGate(_action, req, res, next) {
  return legacyManageHr(req, res, next);
}

/**
 * @param {string} action - employeePolicy action key
 */
function employeesCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('employees');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'employees',
          action: `employee_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] employees authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'employees';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'employees',
          action: `employee_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] employees using Legacy authority',
      );
      return legacyEmployeesGate(action, req, res, next);
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
          family: 'employees',
          action: `employee_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] employees Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyEmployeesGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'employees',
          action: `employee_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] employees Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'employees',
        action: `employee_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] employees Policy DENY',
    );
    return denyEmployees(res, statusHint, reason, action);
  };
}

module.exports = {
  employeesCutoverGate,
  denyEmployees,
  legacyEmployeesGate,
};
