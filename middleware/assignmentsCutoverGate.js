/**
 * Phase 7.23 — Controlled cutover gate for LIVE /api/assignments ONLY.
 *
 * LEGACY (default):
 *   All actions → auth (+ branchFilter on create/update) already applied; pass-through.
 *   Role / permission / ownership / graded-lock checks remain in handlers.
 *
 * POLICY (env opt-in): Policy decision is HTTP authority for mirrored authz.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/update/delete/submit/grade assignments, emit, notify, or mutate auth/finance.
 * Graded-submission lock remains handler-owned (not Policy HTTP DENY).
 */
const logger = require('../config/logger');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

function denyAssignments(res, statusHint, reason, action) {
  const r = String(reason || '');
  const a = String(action || '');
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
  if (r === 'role_cannot_create' || r === 'policy_role_cannot_create') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền tạo bài tập',
    });
  }
  if (r === 'role_cannot_update' || r === 'policy_role_cannot_update') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền chỉnh sửa bài tập',
    });
  }
  if (r === 'role_cannot_delete' || r === 'policy_role_cannot_delete') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền xóa bài tập',
    });
  }
  if (r === 'role_cannot_grade' || r === 'policy_role_cannot_grade') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền chấm điểm',
    });
  }
  if (
    r === 'missing_manage_students'
    || r === 'policy_missing_manage_students'
  ) {
    if (a === 'create') {
      return res.status(403).json({
        success: false,
        message: 'Thiếu quyền quản lý học viên để giao bài',
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Thiếu quyền quản lý học viên',
    });
  }
  if (r === 'cross_branch' || r === 'policy_cross_branch') {
    if (a === 'update') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền sửa bài tập học viên chi nhánh khác',
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Không có quyền giao bài cho học viên chi nhánh khác',
    });
  }
  if (
    r === 'cross_branch_new_student'
    || r === 'policy_cross_branch_new_student'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền gán học viên chi nhánh khác',
    });
  }
  if (r === 'teacher_not_owner' || r === 'policy_teacher_not_owner') {
    if (a === 'update') {
      return res.status(403).json({
        success: false,
        message: 'Không có quyền sửa bài tập học viên này',
      });
    }
    return res.status(403).json({
      success: false,
      message: 'Chỉ giao bài cho học viên mình phụ trách',
    });
  }
  if (
    r === 'teacher_not_assignment_owner'
    || r === 'policy_teacher_not_assignment_owner'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Chỉ sửa bài tập của chính bạn',
    });
  }
  if (r === 'student_not_self' || r === 'policy_student_not_self') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền xem bài tập của học viên khác',
    });
  }
  if (
    r === 'assignment_not_for_student'
    || r === 'policy_assignment_not_for_student'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Bài tập này không được giao cho bạn',
    });
  }
  if (r === 'assignment_unbound' || r === 'policy_assignment_unbound') {
    return res.status(403).json({
      success: false,
      message: 'Bài tập không gắn học viên. Vui lòng nhờ giảng viên giao lại bài.',
    });
  }
  if (r === 'submit_not_self' || r === 'policy_submit_not_self') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền nộp bài cho học viên khác',
    });
  }
  return res.status(403).json({
    success: false,
    message: 'Không có quyền',
  });
}

function legacyAssignmentsGate(_action, _req, _res, next) {
  return next();
}

/**
 * @param {string} action - assignmentPolicy action key
 */
function assignmentsCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('assignments');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'assignments',
          action: `assignment_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] assignments authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'assignments';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'assignments',
          action: `assignment_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] assignments using Legacy authority',
      );
      return legacyAssignmentsGate(action, req, res, next);
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
          family: 'assignments',
          action: `assignment_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] assignments Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyAssignmentsGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'assignments',
          action: `assignment_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] assignments Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'assignments',
        action: `assignment_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] assignments Policy DENY',
    );
    return denyAssignments(res, statusHint, reason, action);
  };
}

module.exports = {
  assignmentsCutoverGate,
  denyAssignments,
  legacyAssignmentsGate,
};
