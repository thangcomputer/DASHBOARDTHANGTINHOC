/**
 * Tenant scope helpers (Phase 15) — pure / testable.
 * Tenant = tổ chức bao Branch; Branch = đơn vị vận hành.
 * Không migrate Postgres trong phase này.
 */

/**
 * Gộp tenant branchIds vào branchFilter hiện có.
 * @returns {{ branchId: any } | { branchId: null }}
 */
function mergeTenantIntoBranchFilter(branchFilter = {}, tenantBranchIds = []) {
  const ids = (tenantBranchIds || []).map((id) => String(id));
  const idObjs = tenantBranchIds || [];

  if (!ids.length) {
    // Tenant không có chi nhánh → không thấy dữ liệu
    return { branchId: null };
  }

  const existing = branchFilter?.branchId;

  if (existing == null || existing === undefined) {
    return { branchId: { $in: idObjs.length ? idObjs : ids } };
  }

  if (existing.$in) {
    const filtered = existing.$in.filter((x) => ids.includes(String(x)));
    return { branchId: { $in: filtered.length ? filtered : [null] } };
  }

  // single branchId
  if (!ids.includes(String(existing))) {
    return { branchId: null };
  }
  return { branchId: existing };
}

/** Non-super không được dùng X-Tenant-Id để mở rộng quyền */
function canApplyTenantHeader({ userId, adminRole } = {}) {
  return userId === 'admin' || adminRole === 'SUPER_ADMIN';
}

/**
 * Isolation: branch của tenant A không nằm trong scope tenant B.
 */
function assertTenantIsolation(tenantABranchIds, tenantBBranchIds) {
  const setB = new Set((tenantBBranchIds || []).map(String));
  for (const id of tenantABranchIds || []) {
    if (setB.has(String(id))) {
      const err = new Error('Tenant isolation violated: overlapping branchIds');
      err.code = 'TENANT_ISOLATION';
      throw err;
    }
  }
  return true;
}

function branchBelongsToTenant(branchId, tenantBranchIds) {
  if (!branchId) return false;
  return (tenantBranchIds || []).map(String).includes(String(branchId));
}

/**
 * Optional Postgres — Phase 15 chỉ ADR/stub, không chạy migrate.
 */
const POSTGRES_OPTIONAL = Object.freeze({
  enabled: false,
  reason: 'Multi-branch + ledger + RBAC trên Mongo đã cứng; PG chỉ khi ADR riêng + dual-write plan',
  stackNow: 'mongodb+mongoose',
  stackFuture: 'optional postgresql+prisma',
});

module.exports = {
  mergeTenantIntoBranchFilter,
  canApplyTenantHeader,
  assertTenantIsolation,
  branchBelongsToTenant,
  POSTGRES_OPTIONAL,
};
