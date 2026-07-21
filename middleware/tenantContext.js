/**
 * tenantContext — gan req.tenant / req.tenantScope tu header/query.
 * Super Admin: X-Tenant-Id hoac ?tenant_id=
 * Khac: khong scope (dung branchFilter nhu cu)
 */
const tenantService = require('../services/tenantService');
const Tenant = require('../models/Tenant');
const logger = require('../config/logger');

async function tenantContext(req, res, next) {
  try {
    req.tenant = null;
    req.tenantScope = null;

    const isPlatformAdmin =
      req.user?.id === 'admin' || req.user?.adminRole === 'SUPER_ADMIN';

    if (!isPlatformAdmin) return next();

    const raw =
      req.headers['x-tenant-id'] ||
      req.query.tenant_id ||
      req.query.tenantId ||
      '';

    if (!raw || raw === 'all' || raw === 'default') {
      return next();
    }

    const tenant = await Tenant.findById(raw).lean();
    if (!tenant) {
      return res.status(400).json({ success: false, message: 'Tenant khong hop le' });
    }
    if (tenant.status === 'suspended') {
      return res.status(403).json({ success: false, message: 'Tenant dang bi tam dung' });
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

    const ids = req.tenantScope.branchIds;
    const idStrs = ids.map((id) => String(id));

    if (!req.branchFilter) req.branchFilter = {};

    if (req.branchFilter.branchId) {
      const bid = req.branchFilter.branchId;
      // ObjectId or string or $in
      if (bid.$in) {
        req.branchFilter.branchId = {
          $in: bid.$in.filter((x) => idStrs.includes(String(x))),
        };
      } else if (!idStrs.includes(String(bid))) {
        req.branchFilter = { branchId: null };
      }
    } else {
      req.branchFilter = { branchId: { $in: ids.length ? ids : [null] } };
    }
    return next();
  } catch {
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