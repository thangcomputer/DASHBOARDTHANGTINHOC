/**
 * Phase 7.18 — Controlled cutover gate for LIVE /api/files ONLY.
 *
 * LEGACY (default):
 *   - upload → requireUploadCategoryPermission (open cats / training any / SYSTEM_SETTINGS)
 *   - categories → pass-through (auth already applied)
 *   - stats / list / purge_expired → checkPermission(SYSTEM_SETTINGS)
 *   - delete → pass-through (ownership remains in fileService.deleteById)
 *
 * POLICY (env opt-in): Policy decision is HTTP authority.
 * Fail-safe: ERROR / UNKNOWN / malformed → Legacy path above.
 * Does not upload/delete/stream files, write storage, emit, queue, or mutate auth.
 */
const logger = require('../config/logger');
const { checkPermission, checkAnyPermission } = require('./auth');
const { PERMISSIONS } = require('../constants/permissions');
const {
  AUTHORITY,
  getAuthorizationAuthority,
} = require('../services/policyShadow/cutoverAuthority');

const OPEN_UPLOAD_CATEGORIES = new Set(['messages', 'assignments', 'avatars']);
const SETTINGS_ACTIONS = new Set(['stats', 'list', 'purge_expired']);

const checkSystemSettings = checkPermission(PERMISSIONS.SYSTEM_SETTINGS);
const checkTrainingUpload = checkAnyPermission(
  PERMISSIONS.MANAGE_TRAINING,
  PERMISSIONS.MANAGE_STUDENT_TRAINING,
  PERMISSIONS.SYSTEM_SETTINGS,
);

function denyFiles(res, statusHint, reason) {
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
    r === 'not_file_owner'
    || r === 'policy_not_file_owner'
  ) {
    return res.status(403).json({
      success: false,
      message: 'Khong co quyen xoa file nay',
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

function requireUploadCategoryPermission(req, res, next) {
  const category = String(req.query.category || req.body?.category || 'general').toLowerCase();
  if (OPEN_UPLOAD_CATEGORIES.has(category)) return next();
  if (category === 'training') {
    return checkTrainingUpload(req, res, next);
  }
  return checkSystemSettings(req, res, next);
}

function legacyFilesGate(action, req, res, next) {
  if (action === 'upload') {
    return requireUploadCategoryPermission(req, res, next);
  }
  if (SETTINGS_ACTIONS.has(action)) {
    return checkSystemSettings(req, res, next);
  }
  // categories + delete: auth already applied; ownership in service for delete
  return next();
}

/**
 * @param {string} action - filePolicy action key
 */
function filesCutoverGate(action) {
  return (req, res, next) => {
    let authority = AUTHORITY.LEGACY;
    try {
      authority = getAuthorizationAuthority('files');
    } catch (err) {
      authority = AUTHORITY.LEGACY;
      logger.warn(
        {
          event: 'POLICY_CUTOVER_FALLBACK',
          family: 'files',
          action: `file_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: 'authority_helper_throw',
          err: err.message,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] files authority helper failed — Legacy gate',
      );
    }

    req.authzAuthority = authority;
    req.authzFamily = 'files';

    if (authority !== AUTHORITY.POLICY) {
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'files',
          action: `file_${action}`,
          authority: AUTHORITY.LEGACY,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] files using Legacy authority',
      );
      return legacyFilesGate(action, req, res, next);
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
          family: 'files',
          action: `file_${action}`,
          authority: AUTHORITY.LEGACY,
          reason: comparison === 'ERROR' ? 'policy_eval_error' : 'policy_unknown_or_malformed',
          comparison: comparison || null,
          policyDecision: decision || null,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] files Policy unsafe — fallback Legacy',
      );
      req.authzAuthority = AUTHORITY.LEGACY;
      req.policyAuthoritative = false;
      return legacyFilesGate(action, req, res, next);
    }

    if (decision === 'ALLOW') {
      req.policyAuthoritative = true;
      logger.info(
        {
          event: 'POLICY_CUTOVER_AUTHORITY',
          family: 'files',
          action: `file_${action}`,
          authority: AUTHORITY.POLICY,
          policyDecision: 'ALLOW',
          policyReason: reason,
          requestId: req.requestId,
          correlationId: req.correlationId,
        },
        '[POLICY_CUTOVER] files Policy ALLOW',
      );
      return next();
    }

    req.policyAuthoritative = true;
    logger.info(
      {
        event: 'POLICY_CUTOVER_AUTHORITY',
        family: 'files',
        action: `file_${action}`,
        authority: AUTHORITY.POLICY,
        policyDecision: 'DENY',
        policyReason: reason,
        requestId: req.requestId,
        correlationId: req.correlationId,
      },
      '[POLICY_CUTOVER] files Policy DENY',
    );
    return denyFiles(res, statusHint, reason);
  };
}

module.exports = {
  filesCutoverGate,
  denyFiles,
  legacyFilesGate,
  requireUploadCategoryPermission,
  OPEN_UPLOAD_CATEGORIES,
  SETTINGS_ACTIONS,
};
