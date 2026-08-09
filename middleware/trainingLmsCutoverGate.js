/**
 * Phase 7.13 — Controlled cutover gate for LIVE /api/training-lms ONLY
 * (trainingRoutes — NOT /api/training teaching guides).
 *
 * LEGACY (default):
 *   - most actions → auth already applied; pass-through (handler may 403 specialty)
 *   - lms_admin_progress → checkPermission(MANAGE_TRAINING)
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not mutate training progress, enroll, emit sockets, queue jobs, or mutate auth.
 */
const logger = require('../config/logger');
const { checkPermission } = require('./auth');
const { PERMISSIONS } = require('../constants/permissions');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

const ADMIN_PROGRESS_ACTION = 'lms_admin_progress';
const checkManageTraining = checkPermission(PERMISSIONS.MANAGE_TRAINING);

function denyTrainingLms(res, statusHint, reason) {
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
    r === 'teacher_subject_mismatch'
    || r === 'policy_teacher_subject_mismatch'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Khóa học này không thuộc chuyên môn của bạn',
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

/**
 * Legacy secondary gate after auth.
 * Specialty for lms_lessons remains in the handler (parity preserved via Policy DENY when primary).
 */
function legacyTrainingLmsGate(action, req, res, next) {
  if (action === ADMIN_PROGRESS_ACTION) {
    return checkManageTraining(req, res, next);
  }
  return next();
}

/**
 * @param {string} action - trainingLmsPolicy action key
 */
function trainingLmsCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('training-lms');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'training-lms',
          action: `training_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] training-lms authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'training-lms';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'training-lms',
          action: `training_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] training-lms using Legacy authority',
      );
      return legacyTrainingLmsGate(action, req, res, next);
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
          family: 'training-lms',
          action: `training_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] training-lms Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyTrainingLmsGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'training-lms',
          action: `training_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] training-lms Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'training-lms',
        action: `training_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] training-lms Policy DENY',
    );
    return denyTrainingLms(res, statusHint, reason);
  };
}

module.exports = {
  trainingLmsCutoverGate,
  denyTrainingLms,
  legacyTrainingLmsGate,
  ADMIN_PROGRESS_ACTION,
};
