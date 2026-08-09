/**
 * RBAC-S2 — Data Scope observe middleware.
 * Never alters HTTP outcome. Logs design scope vs optional dual-check hint.
 *
 * Placement: after authMiddleware (and branchFilter when present).
 */
'use strict';

const logger = require('../config/logger');
const {
  resolveDataScope,
  assertInScope,
} = require('../shared/security/authorization/dataScope');

/**
 * @param {string} resource e.g. 'student' | 'message' | 'ticket'
 * @param {object} [opts]
 * @param {boolean} [opts.listMode=true]
 */
function dataScopeObserve(resource, opts = {}) {
  const listMode = opts.listMode !== false;
  return (req, res, next) => {
    try {
      const actor = {
        id: req.user?.id,
        role: req.user?.role,
        adminRole: req.user?.adminRole,
        branchCode: req.user?.branchCode || req.userBranchId || null,
        branchId: req.userBranchId || req.user?.branchId || null,
      };
      const scope = resolveDataScope(actor);
      const check = assertInScope(actor, resource, null, {
        listMode,
        branchCode: actor.branchCode,
      });

      req.dataScopeObserve = {
        resource,
        scope,
        inScope: check.inScope,
        reason: check.reason,
        listMode,
      };

      logger.info('[DATA_SCOPE_OBSERVE]', {
        resource,
        path: req.originalUrl || req.path,
        method: req.method,
        actorId: actor.id ? String(actor.id).slice(-8) : null,
        role: actor.role || null,
        adminRole: actor.adminRole || null,
        scope,
        inScope: check.inScope,
        reason: check.reason,
        // Never deny from this middleware
        httpAuthority: 'LIVE_UNCHANGED',
      });
    } catch (err) {
      logger.warn('[DATA_SCOPE_OBSERVE] error (ignored)', {
        message: err?.message || String(err),
      });
    }
    return next();
  };
}

module.exports = { dataScopeObserve };
