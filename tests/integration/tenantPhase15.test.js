/**
 * Phase 15 — Multi-tenant deepen (Mongo) / defer Postgres.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  mergeTenantIntoBranchFilter,
  canApplyTenantHeader,
  assertTenantIsolation,
  branchBelongsToTenant,
  POSTGRES_OPTIONAL,
} = require('../../utils/tenantScope');
const tenantService = require('../../services/tenantService');

test('POSTGRES_OPTIONAL is deferred (no migrate in Phase 15)', () => {
  assert.equal(POSTGRES_OPTIONAL.enabled, false);
  assert.ok(POSTGRES_OPTIONAL.stackNow.includes('mongodb'));
});

test('canApplyTenantHeader: only Super Admin / hardcoded admin', () => {
  assert.equal(canApplyTenantHeader({ userId: 'admin' }), true);
  assert.equal(canApplyTenantHeader({ adminRole: 'SUPER_ADMIN' }), true);
  assert.equal(canApplyTenantHeader({ adminRole: 'STAFF', userId: 'x' }), false);
  assert.equal(canApplyTenantHeader({}), false);
});

test('mergeTenantIntoBranchFilter isolates to tenant branches', () => {
  const ids = ['b1', 'b2'];
  const open = mergeTenantIntoBranchFilter({}, ids);
  assert.deepEqual(open.branchId.$in, ids);

  const ok = mergeTenantIntoBranchFilter({ branchId: 'b1' }, ids);
  assert.equal(ok.branchId, 'b1');

  const denied = mergeTenantIntoBranchFilter({ branchId: 'b9' }, ids);
  assert.equal(denied.branchId, null);

  const intersect = mergeTenantIntoBranchFilter({ branchId: { $in: ['b1', 'b9'] } }, ids);
  assert.deepEqual(intersect.branchId.$in, ['b1']);
});

test('assertTenantIsolation: no overlapping branches', () => {
  assert.doesNotThrow(() => assertTenantIsolation(['a1', 'a2'], ['b1', 'b2']));
  assert.throws(() => assertTenantIsolation(['a1', 'x'], ['x', 'b2']), /isolation/i);
});

test('branchBelongsToTenant', () => {
  assert.equal(branchBelongsToTenant('b1', ['b1', 'b2']), true);
  assert.equal(branchBelongsToTenant('b9', ['b1']), false);
});

test('tenantService exports sync + backfill', () => {
  assert.equal(typeof tenantService.syncTenantIdForBranch, 'function');
  assert.equal(typeof tenantService.backfillTenantIdsFromBranches, 'function');
  assert.equal(typeof tenantService.assertBranchBelongsToTenant, 'function');
  assert.equal(tenantService.DEFAULT_CODE, 'MAIN');
});

test('auth branchFilter sets adminRole before tenant scope', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../middleware/auth.js'), 'utf8');
  assert.ok(src.includes('req.user.adminRole = user.adminRole'));
  assert.ok(src.includes('canApplyTenantHeader'));
  assert.ok(src.includes('mergeTenantIntoBranchFilter'));
  assert.ok(src.includes('INVALID_TENANT'));
});

test('ADR 0007 + backfill route exist; no Prisma migrate', () => {
  assert.ok(fs.existsSync(path.join(__dirname, '../../docs/adr/0007-multi-tenant-deepen.md')));
  const routes = fs.readFileSync(path.join(__dirname, '../../routes/tenantRoutes.js'), 'utf8');
  assert.ok(routes.includes('backfill-tenant-ids'));
  assert.ok(routes.includes('backfillTenantIdsFromBranches'));
  // không kéo Prisma vào phase này
  const pkg = fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8');
  assert.equal(pkg.includes('"prisma"'), false);
});
