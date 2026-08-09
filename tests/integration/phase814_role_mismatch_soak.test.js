/**
 * Phase 8.14 (updated) + 8.15 — bare admin is LEGACY_PRINCIPAL (permission-bearing).
 * Still must NOT flatten to SUPER_ADMIN / ADMIN_STAFF.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS: LIVE } = require('../../constants/permissions');
const ENT = require('../../shared/constants/permissions');
const { resolveEnterpriseRoleContract } = require('../../shared/constants/roleAliasContract');
const ROLES = require('../../shared/constants/roles');
const {
  COMPARISON,
  dualCheckLiveStaffGate,
  evaluateEnterpriseShadow,
  annotateKnownLegacyMismatch,
  MISMATCH_CLASSIFICATION,
  MISMATCH_REASON,
  EVIDENCE_CHANNEL,
  resetSoakEvidenceForTests,
  getSoakEvidenceSnapshot,
  expandLivePermissionsToEnterprise,
} = require('../../services/rbacParity');

async function withDual(fn) {
  const prev = process.env.RBAC_DUAL_CHECK_ENABLED;
  process.env.RBAC_DUAL_CHECK_ENABLED = 'true';
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.RBAC_DUAL_CHECK_ENABLED;
    else process.env.RBAC_DUAL_CHECK_ENABLED = prev;
  }
}

describe('Phase 8.14/8.15 legacy principal contract', { concurrency: false }, () => {
  it('1 bare JWT admin + manage_hr → LEGACY_PRINCIPAL MATCH (not SUPER/STAFF)', async () => {
    await withDual(() => {
      const actor = {
        id: '507f1f77bcf86cd799439020',
        role: 'admin',
        adminRole: null,
        permissions: [LIVE.MANAGE_HR],
      };
      const rr = resolveEnterpriseRoleContract({
        jwtRole: 'admin', adminRole: null, userId: actor.id,
      });
      assert.equal(rr.type, 'LEGACY_PRINCIPAL');
      assert.equal(rr.enterpriseRole, null);

      const ent = evaluateEnterpriseShadow(actor, { livePermission: LIVE.MANAGE_HR });
      assert.equal(ent.decision, 'ALLOW');
      assert.equal(ent.legacyPrincipal, true);
      assert.equal(ent.enterpriseRole, null);

      const out = dualCheckLiveStaffGate({ user: actor }, {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.liveDecision, 'ALLOW');
      assert.equal(out.enterpriseDecision, 'ALLOW');
      assert.equal(out.finalDecision, 'ALLOW');
      assert.equal(out.roleType, 'LEGACY_PRINCIPAL');
      assert.notEqual(out.role, ROLES.SUPER_ADMIN);
      assert.notEqual(out.role, ROLES.ADMIN_STAFF);
    });
  });

  it('2 JWT admin + SUPER_ADMIN', async () => {
    await withDual(() => {
      const out = dualCheckLiveStaffGate({
        user: {
          id: 'sa', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [],
        },
      }, {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_TEACHERS,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.role, ROLES.SUPER_ADMIN);
    });
  });

  it('3 JWT admin + HIGH_ADMIN', async () => {
    await withDual(() => {
      assert.equal(
        resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: 'HIGH_ADMIN' }).enterpriseRole,
        ROLES.HIGH_ADMIN,
      );
    });
  });

  it('4 JWT staff + STAFF → ADMIN_STAFF', async () => {
    assert.equal(
      resolveEnterpriseRoleContract({ jwtRole: 'staff', adminRole: 'STAFF' }).enterpriseRole,
      ROLES.ADMIN_STAFF,
    );
  });

  it('5 JWT staff + SUPPORT → SUPPORT_AGENT', async () => {
    assert.equal(
      resolveEnterpriseRoleContract({ jwtRole: 'staff', adminRole: 'SUPPORT' }).enterpriseRole,
      ROLES.SUPPORT_AGENT,
    );
  });

  it('6 id=admin LEGACY_ROOT unchanged', async () => {
    await withDual(() => {
      const out = dualCheckLiveStaffGate({
        user: {
          id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', permissions: [],
        },
      }, {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_FINANCE,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(out.roleType, 'LEGACY_ROOT');
      assert.equal(out.comparison, COMPARISON.MATCH);
    });
  });

  it('7 bare admin must NOT silently become SUPER_ADMIN', () => {
    const bare = resolveEnterpriseRoleContract({ jwtRole: 'admin' });
    assert.equal(bare.enterpriseRole, null);
    assert.notEqual(bare.enterpriseRole, ROLES.SUPER_ADMIN);
  });

  it('8 bare admin must NOT silently become ADMIN_STAFF', () => {
    const bare = resolveEnterpriseRoleContract({ jwtRole: 'admin' });
    assert.notEqual(bare.enterpriseRole, ROLES.ADMIN_STAFF);
  });

  it('9 branch/ownership unchanged for LEGACY_PRINCIPAL', async () => {
    await withDual(() => {
      const actor = {
        id: 'u1', role: 'admin', adminRole: null, permissions: [LIVE.MANAGE_HR],
      };
      const cross = dualCheckLiveStaffGate({ user: actor }, {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_HR,
        scopeOk: false,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(cross.comparison, COMPARISON.MATCH);
      assert.equal(cross.finalDecision, 'DENY');
      const nonOwner = dualCheckLiveStaffGate({ user: actor }, {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_HR,
        ownershipOk: false,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(nonOwner.comparison, COMPARISON.MATCH);
    });
  });

  it('10 finance revenue/manage boundaries unchanged', () => {
    const held = expandLivePermissionsToEnterprise([LIVE.VIEW_BRANCH_REVENUE]);
    assert.ok(held.has(ENT.FINANCE_BRANCH_REVENUE_VIEW));
    assert.ok(!held.has(ENT.FINANCE_VIEW));
    const mgr = expandLivePermissionsToEnterprise([LIVE.MANAGE_FINANCE]);
    assert.ok(mgr.has(ENT.FINANCE_PAYMENT_CREATE));
    assert.ok(!mgr.has(ENT.FINANCE_BRANCH_REVENUE_VIEW));
  });

  it('annotateKnownLegacyMismatch still never converts to MATCH', () => {
    const payload = annotateKnownLegacyMismatch(
      {
        comparison: COMPARISON.MISMATCH,
        mismatchReason: MISMATCH_REASON.ROLE_MISMATCH,
      },
      { reason: 'role_unresolved_adminRole' },
      { role: 'admin', adminRole: null },
      { type: 'LEGACY_PRINCIPAL' },
    );
    assert.equal(payload.comparison, COMPARISON.MISMATCH);
    assert.equal(payload.mismatchClassification, MISMATCH_CLASSIFICATION.LEGACY_COMPATIBILITY);
  });

  it('SYNTHETIC isolation', async () => {
    resetSoakEvidenceForTests();
    await withDual(() => {
      dualCheckLiveStaffGate({
        user: {
          id: 'u1', role: 'admin', adminRole: null, permissions: [LIVE.MANAGE_HR],
        },
      }, {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
    });
    assert.equal(getSoakEvidenceSnapshot().channels.RUNTIME.requests, 0);
  });
});
