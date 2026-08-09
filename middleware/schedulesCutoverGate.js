/**
 * Phase 7.21 — Controlled cutover gate for LIVE /api/schedules ONLY.
 *
 * LEGACY (default):
 *   All actions → auth (+ branchFilter on list/stats) already applied; pass-through.
 *   Role / ownership / teacher-student checks remain in handlers.
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/update/delete schedules, emit, notify, or mutate auth/finance.
 */
const logger = require('../config/logger');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

function denySchedules(res, statusHint, reason) {
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
  if (r === 'role_denied' || r === 'policy_role_denied') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền xem lịch',
    });
  }
  if (
    r === 'not_self_or_staff'
    || r === 'policy_not_self_or_staff'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xem lịch của người khác',
    });
  }
  if (
    r === 'student_not_self'
    || r === 'policy_student_not_self'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xem lịch của học viên khác',
    });
  }
  if (
    r === 'teacher_not_owner'
    || r === 'policy_teacher_not_owner'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xem lịch học viên này',
    });
  }
  if (
    r === 'role_cannot_create'
    || r === 'policy_role_cannot_create'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền tạo lịch học',
    });
  }
  if (
    r === 'role_cannot_update'
    || r === 'policy_role_cannot_update'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền chỉnh sửa lịch học',
    });
  }
  if (
    r === 'teacher_not_schedule_owner'
    || r === 'policy_teacher_not_schedule_owner'
    || r === 'student_not_self_schedule'
    || r === 'policy_student_not_self_schedule'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bạn chỉ được chỉnh sửa lịch của chính mình',
    });
  }
  if (
    r === 'role_cannot_delete'
    || r === 'policy_role_cannot_delete'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền xóa lịch học',
    });
  }
  if (
    r === 'role_cannot_cancel'
    || r === 'policy_role_cannot_cancel'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bạn không có quyền hủy lịch học',
    });
  }
  if (
    r === 'history_denied'
    || r === 'policy_history_denied'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền xem lịch sử lịch dạy này',
    });
  }
  return res.status(403).json({
    success: false,
    message: 'Không có quyền',
  });
}

function legacySchedulesGate(_action, _req, _res, next) {
  return next();
}

/**
 * @param {string} action - schedulePolicy action key
 */
function schedulesCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('schedules');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'schedules',
          action: `schedule_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] schedules authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'schedules';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'schedules',
          action: `schedule_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] schedules using Legacy authority',
      );
      return legacySchedulesGate(action, req, res, next);
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
          family: 'schedules',
          action: `schedule_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] schedules Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacySchedulesGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'schedules',
          action: `schedule_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] schedules Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'schedules',
        action: `schedule_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] schedules Policy DENY',
    );
    return denySchedules(res, statusHint, reason);
  };
}

module.exports = {
  schedulesCutoverGate,
  denySchedules,
  legacySchedulesGate,
};
