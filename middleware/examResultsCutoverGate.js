/**
 * Phase 7.30 — Controlled cutover gate for LIVE /api/exam-results ONLY.
 *
 * LEGACY (default):
 *   list/create/update → pass-through (authorizeExamMutation / list gates remain handler-owned).
 *   delete → checkAnyPermission(MANAGE_STUDENTS|MANAGE_STUDENT_TRAINING|MANAGE_TRAINING);
 *            handler retains branchAllows.
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not create/update/delete exam results, notify, emit, or audit.
 * Mutations / notifications / realtime remain handler-owned.
 */
const logger = require('../config/logger');
const { checkAnyPermission } = require('./auth');
const { PERMISSIONS } = require('../constants/permissions');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

const legacyDeletePermission = checkAnyPermission(
  PERMISSIONS.MANAGE_STUDENTS,
  PERMISSIONS.MANAGE_STUDENT_TRAINING,
  PERMISSIONS.MANAGE_TRAINING,
);

function denyExamResults(res, statusHint, reason) {
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
  if (r === 'subject_branch_unknown' || r === 'policy_subject_branch_unknown') {
    return res.status(403).json({
      success: false,
      message: 'Không xác định được chi nhánh của kết quả thi',
    });
  }
  if (r === 'cross_branch' || r === 'policy_cross_branch') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền thao tác kết quả thi chi nhánh khác',
    });
  }
  if (r === 'student_cannot_mutate_exam' || r === 'policy_student_cannot_mutate_exam') {
    return res.status(403).json({
      success: false,
      message: 'Học viên không được tạo/sửa kết quả thi',
    });
  }
  if (r === 'teacher_not_self_exam' || r === 'policy_teacher_not_self_exam') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ ghi nhận kết quả thi của chính bạn',
    });
  }
  if (r === 'teacher_not_owner' || r === 'policy_teacher_not_owner') {
    return res.status(403).json({
      success: false,
      message: 'Chỉ thao tác kết quả thi học viên mình phụ trách',
    });
  }
  if (r === 'missing_exam_manage_permission' || r === 'policy_missing_exam_manage_permission') {
    return res.status(403).json({
      success: false,
      message: 'Thiếu quyền quản lý kết quả thi',
    });
  }
  if (r === 'missing_exam_list_permission' || r === 'policy_missing_exam_list_permission') {
    return res.status(403).json({
      success: false,
      message: 'Thiếu quyền xem kết quả thi',
    });
  }
  if (r === 'role_denied' || r === 'policy_role_denied') {
    return res.status(403).json({
      success: false,
      message: 'Không có quyền',
    });
  }
  // delete missing permission + generic
  return res.status(403).json({
    success: false,
    message: '403 Forbidden: Bạn không có quyền thực hiện thao tác này. Liên hệ Super Admin để được cấp quyền.',
  });
}

function legacyExamResultsGate(action, req, res, next) {
  if (action === 'delete') {
    return legacyDeletePermission(req, res, next);
  }
  return next();
}

/**
 * @param {string} action - examResultPolicy action key
 */
function examResultsCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('exam-results');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'exam-results',
          action: `exam_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] exam-results authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'exam-results';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'exam-results',
          action: `exam_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] exam-results using Legacy authority',
      );
      return legacyExamResultsGate(action, req, res, next);
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
          family: 'exam-results',
          action: `exam_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] exam-results Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyExamResultsGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'exam-results',
          action: `exam_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] exam-results Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'exam-results',
        action: `exam_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] exam-results Policy DENY',
    );
    return denyExamResults(res, statusHint, reason);
  };
}

module.exports = {
  examResultsCutoverGate,
  denyExamResults,
  legacyExamResultsGate,
};
