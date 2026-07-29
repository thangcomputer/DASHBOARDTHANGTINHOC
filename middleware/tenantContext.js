const tenantService = require('../services/tenantService');
const Tenant = require('../models/Tenant');
const logger = require('../config/logger');
const { mergeTenantIntoBranchFilter, canApplyTenantHeader } = require('../utils/tenantScope');

async function tenantContext(req, res, next) {
  try {
    req.tenant = null;
    req.tenantScope = null;

    if (!canApplyTenantHeader({
      userId: req.user?.id,
      adminRole: req.user?.adminRole,
    })) {
      return next();
    }

    const raw =
      req.headers['x-tenant-id'] ||
      req.query.tenant_id ||
      req.query.tenantId ||
      '';

    if (!raw || raw === 'all' || raw === 'default') {
      return next();
    }

    const tenant = await Tenant.findById(raw).lean().catch(() => null);
    if (!tenant) {
      logger.warn({ raw }, '[tenantContext] ignore missing tenant');
      return next();
    }
    if (tenant.status === 'suspended') {
      return res.status(400).json({
        success: false,
        message: 'X-Tenant-Id / tenant_id không hợp lệ hoặc đã bị khóa',
        code: 'INVALID_TENANT',
      });
    }

    const branchIds = await tenantService.resolveBranchIdsForTenant(tenant._id);
    req.tenant = tenant;
    req.tenantScope = {
      tenantId: tenant._id,
      branchIds,
    };
    return next();
  } catch (err) {
    logger.error({ err: err.message }, '[tenantContext]');
    return res.status(500).json({ success: false, message: 'Loi tenant context' });
  }
}

/**
 * Ap dung tenantScope len req.branchFilter (goi sau branchFilter).
 */
function applyTenantToBranchFilter(req, res, next) {
  try {
    if (!req.tenantScope?.branchIds) return next();
    req.branchFilter = mergeTenantIntoBranchFilter(
      req.branchFilter || {},
      req.tenantScope.branchIds,
    );
    return next();
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Loi tenant filter' });
  }
}

/** Compose: tenantContext roi branchFilter roi applyTenant */
function tenantAwareBranchFilter(branchFilterMw) {
  return [tenantContext, branchFilterMw, applyTenantToBranchFilter];
}

module.exports = {
  tenantContext,
  applyTenantToBranchFilter,
  tenantAwareBranchFilter,
};