/**
 * Phase 7.28 — Controlled cutover gate for LIVE /api/staff ONLY.
 *
 * LEGACY (default):
 *   checkPermission('manage_staff') — retained here.
 *   SUPER/HIGH create/update/delete gates remain handler-owned on Legacy path.
 *
 * POLICY (env opt-in): Policy decision is HTTP authority (incl. SUPER/HIGH mirrors).
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/update/delete staff accounts, hash passwords, or mutate auth/finance.
 * Account mutations and password hashing remain handler-owned.
 */
const logger = require('../config/logger');
const { checkPermission } = require('./auth');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

const legacyManageStaff = checkPermission('manage_staff');

function denyStaff(res, statusHint, reason) {
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
  if (r === 'only_root_creates_super' || r === 'policy_only_root_creates_super') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ Admin Super (Hệ thống) mới được phép tạo thêm tài khoản Super Admin.',
    });
  }
  if (r === 'only_super_creates_high' || r === 'policy_only_super_creates_high') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ Super Admin mới được phép tạo tài khoản Admin cấp cao.',
    });
  }
  if (r === 'only_root_edits_super' || r === 'policy_only_root_edits_super') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ Admin Super mới được chỉnh sửa tài khoản Super Admin.',
    });
  }
  if (r === 'only_super_edits_high' || r === 'policy_only_super_edits_high') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ Super Admin mới được chỉnh sửa tài khoản Admin cấp cao.',
    });
  }
  if (r === 'only_root_changes_role' || r === 'policy_only_root_changes_role') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ Admin Super mới có quyền thăng/hạ quyền Admin Cấp Cao.',
    });
  }
  if (r === 'only_root_deletes_super' || r === 'policy_only_root_deletes_super') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ Admin Super mới được xóa tài khoản Super Admin.',
    });
  }
  if (r === 'only_super_deletes_high' || r === 'policy_only_super_deletes_high') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ Super Admin mới được xóa tài khoản Admin cấp cao.',
    });
  }
  return res.status(403).json({
    success: false,
    message: '403 Forbidden: Bạn không có quyền thực hiện thao tác này. Liên hệ Super Admin để được cấp quyền.',
  });
}

function legacyStaffGate(_action, req, res, next) {
  return legacyManageStaff(req, res, next);
}

/**
 * @param {string} action - staffPolicy action key
 */
function staffCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('staff');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'staff',
          action: `staff_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] staff authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'staff';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'staff',
          action: `staff_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] staff using Legacy authority',
      );
      return legacyStaffGate(action, req, res, next);
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
          family: 'staff',
          action: `staff_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] staff Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyStaffGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'staff',
          action: `staff_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] staff Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'staff',
        action: `staff_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] staff Policy DENY',
    );
    return denyStaff(res, statusHint, reason);
  };
}

module.exports = {
  staffCutoverGate,
  denyStaff,
  legacyStaffGate,
};
