const PermissionService = require('../../modules/rbac/permission.service');
const PolicyService = require('../../modules/rbac/policy.service');
const auditLogger = require('../logger/auditLogger');
const AuditEvents = require('../constants/auditEvents');
const logger = require('../logger/logger');

// =========================================================
// LEGACY COMPATIBILITY LAYER
// Handles authorization for users not yet migrated to RBAC.
// Preserves 100% backward compatibility without modifying
// any existing API contract or business logic.
// =========================================================

const Role = require('../../modules/roles/Role');
const Teacher = require('../../modules/teacher/models/Teacher');

/**
 * @private
 * Resolve permissions from legacy sources (DB roleId or teacher.permissions array).
 * Only called when RBAC resolution is unavailable.
 */
const _legacyResolvePermissions = async (user) => {
  if (!user) return [];
  // Super Admin legacy shortcut
  if (user.roleCode === 'SUPER_ADMIN' || user.adminRole === 'SUPER_ADMIN') return ['ALL'];

  // Try DB Role collection first
  if (user.roleId) {
    try {
      const role = await Role.findById(user.roleId).populate('permissions').lean();
      if (role && Array.isArray(role.permissions)) {
        return role.permissions.map(p => p.code || p);
      }
    } catch { /* fall through */ }
  }

  // Inline permissions array
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    return user.permissions;
  }

  // Last resort — load from Teacher model
  try {
    const dbUser = await Teacher.findById(user.id || user._id).select('adminRole permissions').lean();
    if (!dbUser) return [];
    if (dbUser.adminRole === 'SUPER_ADMIN') return ['ALL'];
    return Array.isArray(dbUser.permissions) ? dbUser.permissions : [];
  } catch {
    return [];
  }
};

/**
 * @private
 * Build standardized deny response payload.
 */
const _denyResponse = (res, req, { status = 403, message, reason, failedPolicy }) => {
  const store = require('../context/correlationContext').getStore();
  return res.status(status).json({
    success: false,
    message,
    reason,
    failedPolicy,
    requestId: store?.requestId || req?.requestId || undefined,
    correlationId: store?.correlationId || req?.correlationId || undefined,
  });
};

/**
 * @private
 * Fire a non-blocking audit denial event.
 */
const _auditDenial = (user, permission, reason, failedPolicy, req) => {
  try {
    auditLogger.log(
      user,
      AuditEvents.PERMISSION_DENIED,
      'Authorization',
      String(user?.id || user?._id || 'unknown'),
      {
        permission: Array.isArray(permission) ? permission.join(',') : permission,
        reason,
        failedPolicy: failedPolicy || null,
        branchId: user?.branchId || null,
        tenantId: user?.tenantId || null,
      },
      req
    ).catch(() => {});
  } catch {
    // Never throw from audit side effect
  }
};

// =========================================================
// NEW RBAC PIPELINE
// =========================================================

/**
 * @private
 * Run full RBAC + Policy pipeline check for a single permission.
 *
 * @returns {{ allowed: boolean, reason: string, failedPolicy?: string, usedLegacy: boolean }}
 */
const _evaluate = async (user, permission, req) => {
  // New RBAC permission resolution
  const rbacAllowed = await PermissionService.hasPermission(user, permission, { req });

  if (!rbacAllowed) {
    // Try legacy fallback before final DENY
    const legacyPerms = await _legacyResolvePermissions(user);
    const legacyAllowed = legacyPerms.includes('ALL') || legacyPerms.includes(permission);
    if (legacyAllowed) {
      logger.debug({ userId: user?.id, permission }, '[RBAC] Legacy fallback granted');
      return { allowed: true, reason: 'Legacy fallback', usedLegacy: true };
    }
    return { allowed: false, reason: `Missing required permission: ${permission}`, usedLegacy: false };
  }

  // RBAC passed — run Policy checks (contextual rules)
  const resource = req?.resource || null;
  const context = req?.policyContext || {};
  const policyResult = PolicyService.evaluate(user, resource, context);

  if (!policyResult.allowed) {
    return {
      allowed: false,
      reason: policyResult.reason,
      failedPolicy: policyResult.failedPolicy,
      usedLegacy: false,
    };
  }

  return { allowed: true, reason: 'RBAC + Policy passed', usedLegacy: false };
};

// =========================================================
// MIDDLEWARE EXPORTS
// =========================================================

/**
 * Authorize — require exact permission.
 *
 * @param {string} permission
 */
const authorize = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.currentUser) {
        return _denyResponse(res, req, { status: 401, message: 'Not authorized' });
      }

      const result = await _evaluate(req.currentUser, permission, req);

      if (!result.allowed) {
        _auditDenial(req.currentUser, permission, result.reason, result.failedPolicy, req);
        return _denyResponse(res, req, {
          message: 'Access denied',
          reason: result.reason,
          failedPolicy: result.failedPolicy,
        });
      }

      return next();
    } catch (err) {
      logger.error({ err: err.message, permission }, '[authorize] Unexpected error');
      return res.status(500).json({ success: false, message: 'Server error during authorization' });
    }
  };
};

/**
 * AuthorizeAny — user must hold AT LEAST ONE of the listed permissions.
 *
 * @param {string[]} permissions
 */
const authorizeAny = (...permissions) => {
  const permList = permissions.flat();
  return async (req, res, next) => {
    try {
      if (!req.currentUser) {
        return _denyResponse(res, req, { status: 401, message: 'Not authorized' });
      }

      const rbacAllowed = await PermissionService.hasAnyPermission(req.currentUser, permList, { req });

      if (!rbacAllowed) {
        // Legacy fallback
        const legacyPerms = await _legacyResolvePermissions(req.currentUser);
        const legacyAllowed = legacyPerms.includes('ALL') || permList.some(p => legacyPerms.includes(p));
        if (!legacyAllowed) {
          _auditDenial(req.currentUser, permList, `Needs one of: ${permList.join(', ')}`, null, req);
          return _denyResponse(res, req, {
            message: 'Access denied',
            reason: `Missing required permission. Needs one of: ${permList.join(', ')}`,
          });
        }
      } else {
        // RBAC passed — run Policy check
        const policyResult = PolicyService.evaluate(req.currentUser, req.resource || null, req.policyContext || {});
        if (!policyResult.allowed) {
          _auditDenial(req.currentUser, permList, policyResult.reason, policyResult.failedPolicy, req);
          return _denyResponse(res, req, {
            message: 'Access denied',
            reason: policyResult.reason,
            failedPolicy: policyResult.failedPolicy,
          });
        }
      }

      return next();
    } catch (err) {
      logger.error({ err: err.message }, '[authorizeAny] Unexpected error');
      return res.status(500).json({ success: false, message: 'Server error during authorization' });
    }
  };
};

/**
 * AuthorizeAll — user must hold ALL of the listed permissions.
 *
 * @param {string[]} permissions
 */
const authorizeAll = (...permissions) => {
  const permList = permissions.flat();
  return async (req, res, next) => {
    try {
      if (!req.currentUser) {
        return _denyResponse(res, req, { status: 401, message: 'Not authorized' });
      }

      const rbacAllowed = await PermissionService.hasAllPermissions(req.currentUser, permList, { req });

      if (!rbacAllowed) {
        // Legacy fallback
        const legacyPerms = await _legacyResolvePermissions(req.currentUser);
        const legacyAllowed = legacyPerms.includes('ALL') || permList.every(p => legacyPerms.includes(p));
        if (!legacyAllowed) {
          _auditDenial(req.currentUser, permList, `Needs all of: ${permList.join(', ')}`, null, req);
          return _denyResponse(res, req, {
            message: 'Access denied',
            reason: `Missing required permissions. Needs all of: ${permList.join(', ')}`,
          });
        }
      } else {
        // RBAC passed — run Policy check
        const policyResult = PolicyService.evaluate(req.currentUser, req.resource || null, req.policyContext || {});
        if (!policyResult.allowed) {
          _auditDenial(req.currentUser, permList, policyResult.reason, policyResult.failedPolicy, req);
          return _denyResponse(res, req, {
            message: 'Access denied',
            reason: policyResult.reason,
            failedPolicy: policyResult.failedPolicy,
          });
        }
      }

      return next();
    } catch (err) {
      logger.error({ err: err.message }, '[authorizeAll] Unexpected error');
      return res.status(500).json({ success: false, message: 'Server error during authorization' });
    }
  };
};

/**
 * AuthorizeRole — legacy role check, preserved for backward compat.
 * TODO: Migrate callers to authorize(permission) and remove in future sprint.
 *
 * @param {...string} roleCodes
 */
const authorizeRole = (...roleCodes) => {
  return (req, res, next) => {
    if (!req.currentUser || !req.currentUser.roleCode) {
      return _denyResponse(res, req, { status: 401, message: 'Not authorized' });
    }
    if (!roleCodes.includes(req.currentUser.roleCode)) {
      return _denyResponse(res, req, {
        message: 'Access denied',
        reason: `Role ${req.currentUser.roleCode} is not authorized to access this route`,
      });
    }
    return next();
  };
};

module.exports = {
  authorize,
  authorizeAny,
  authorizeAll,
  authorizeRole,
};
