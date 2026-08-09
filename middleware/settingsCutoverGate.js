/**
 * Phase 7.19 — Controlled cutover gate for LIVE /api/settings ONLY.
 *
 * LEGACY (default) — action-aware:
 *   - public_read → pass-through (no auth)
 *   - auth_only → pass-through (auth already applied)
 *   - system_read / system_write / reset → checkPermission(SYSTEM_SETTINGS)
 *   - training_write → checkPermission(MANAGE_TRAINING)
 *   - student_training_write → checkPermission(MANAGE_STUDENT_TRAINING)
 *   - training_upload → checkAnyPermission(MANAGE_TRAINING, MANAGE_STUDENT_TRAINING)
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not mutate settings, cache, emit SYSTEM_RESET, wipe data, or mutate auth/finance.
 * reset-data SUPER_ADMIN + password remain handler-owned (400), not middleware 403.
 */
const logger = require('../config/logger');
const { checkPermission, checkAnyPermission } = require('./auth');
const { PERMISSIONS } = require('../constants/permissions');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

const SYSTEM_ACTIONS = new Set(['system_read', 'system_write', 'reset']);
const checkSystemSettings = checkPermission(PERMISSIONS.SYSTEM_SETTINGS);
const checkManageTraining = checkPermission(PERMISSIONS.MANAGE_TRAINING);
const checkManageStudentTraining = checkPermission(PERMISSIONS.MANAGE_STUDENT_TRAINING);
const checkTrainingUpload = checkAnyPermission(
  PERMISSIONS.MANAGE_TRAINING,
  PERMISSIONS.MANAGE_STUDENT_TRAINING,
);

function denySettings(res, statusHint, reason) {
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

function legacySettingsGate(action, req, res, next) {
  if (action === 'public_read' || action === 'auth_only') {
    return next();
  }
  if (SYSTEM_ACTIONS.has(action)) {
    return checkSystemSettings(req, res, next);
  }
  if (action === 'training_write') {
    return checkManageTraining(req, res, next);
  }
  if (action === 'student_training_write') {
    return checkManageStudentTraining(req, res, next);
  }
  if (action === 'training_upload') {
    return checkTrainingUpload(req, res, next);
  }
  return next();
}

/**
 * @param {string} action - settingsPolicy action key
 */
function settingsCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('settings');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'settings',
          action: `settings_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] settings authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'settings';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'settings',
          action: `settings_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] settings using Legacy authority',
      );
      return legacySettingsGate(action, req, res, next);
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
          family: 'settings',
          action: `settings_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] settings Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacySettingsGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'settings',
          action: `settings_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] settings Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'settings',
        action: `settings_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] settings Policy DENY',
    );
    return denySettings(res, statusHint, reason);
  };
}

module.exports = {
  settingsCutoverGate,
  denySettings,
  legacySettingsGate,
  SYSTEM_ACTIONS,
};
