'use strict';

/**
 * Phase 1 data-safety remediation — fail-closed kill switch for
 * POST /api/settings/reset-data (bulk deleteMany across Student/Finance/etc).
 *
 * Independent of RBAC (settingsGuard/checkPermission): even a valid
 * SUPER_ADMIN + correct phrase/password must not be able to wipe production
 * data unless this is explicitly opted into via env. Defaults closed.
 */
function isDestructiveResetAllowed(env = process.env) {
  const isProd = env.NODE_ENV === 'production';
  if (!isProd) return true;
  const flag = String(env.ALLOW_DESTRUCTIVE_RESET || '').toLowerCase();
  return flag === 'true' || flag === '1';
}

function destructiveResetGuard(req, res, next) {
  if (isDestructiveResetAllowed(process.env)) return next();
  return res.status(403).json({
    success: false,
    code: 'DESTRUCTIVE_RESET_DISABLED',
    message: 'Chức năng làm mới dữ liệu hệ thống đã bị vô hiệu hóa trên production.',
  });
}

module.exports = { destructiveResetGuard, isDestructiveResetAllowed };
