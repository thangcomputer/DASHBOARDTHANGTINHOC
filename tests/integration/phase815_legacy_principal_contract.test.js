/**
 * Phase 8.15 — LEGACY_PRINCIPAL contract for bare JWT admin/staff.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const { PERMISSIONS: LIVE } = require('../../constants/permissions');
const ROLES = require('../../shared/constants/roles');
const { resolveEnterpriseRoleContract } = require('../../shared/constants/roleAliasContract');
const {
  COMPARISON,
  dualCheckLiveStaffGate,
  evaluateEnterpriseShadow,
  resolveRole,
  EVIDENCE_CHANNEL,
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

describe('Phase 8.15 LEGACY_PRINCIPAL resolution', { concurrency: false }, () => {
  it('Case1: JWT admin + null adminRole + manage_hr → LEGACY_PRINCIPAL MATCH', async () => {
    await withDual(() => {
      const actor = {
        id: 'u-bare', role: 'admin', adminRole: null, permissions: [LIVE.MANAGE_HR],
      };
      const rr = resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: null });
      assert.equal(rr.type, 'LEGACY_PRINCIPAL');
      assert.equal(rr.enterpriseRole, null);
      const out = dualCheckLiveStaffGate({ user: actor }, {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.roleType, 'LEGACY_PRINCIPAL');
      assert.equal(out.finalDecision, 'ALLOW');
    });
  });

  it('Case2: JWT admin + SUPER_ADMIN', () => {
    const r = resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: 'SUPER_ADMIN' });
    assert.equal(r.enterpriseRole, ROLES.SUPER_ADMIN);
    assert.equal(r.type, 'ALIAS');
  });

  it('Case3: JWT admin + HIGH_ADMIN', () => {
    const r = resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: 'HIGH_ADMIN' });
    assert.equal(r.enterpriseRole, ROLES.HIGH_ADMIN);
  });

  it('Case4: JWT staff + STAFF → ADMIN_STAFF', () => {
    const r = resolveEnterpriseRoleContract({ jwtRole: 'staff', adminRole: 'STAFF' });
    assert.equal(r.enterpriseRole, ROLES.ADMIN_STAFF);
  });

  it('Case5: JWT staff + SUPPORT → SUPPORT_AGENT', () => {
    const r = resolveEnterpriseRoleContract({ jwtRole: 'staff', adminRole: 'SUPPORT' });
    assert.equal(r.enterpriseRole, ROLES.SUPPORT_AGENT);
  });

  it('Case6: id=admin LEGACY_ROOT unchanged', () => {
    const r = resolveEnterpriseRoleContract({ userId: 'admin', jwtRole: 'admin' });
    assert.equal(r.type, 'LEGACY_ROOT');
    assert.equal(r.enterpriseRole, ROLES.SUPER_ADMIN);
  });

  it('Case7: bare admin NOT SUPER_ADMIN', () => {
    assert.notEqual(
      resolveEnterpriseRoleContract({ jwtRole: 'admin' }).enterpriseRole,
      ROLES.SUPER_ADMIN,
    );
  });

  it('Case8: bare admin NOT ADMIN_STAFF', () => {
    assert.notEqual(
      resolveEnterpriseRoleContract({ jwtRole: 'admin' }).enterpriseRole,
      ROLES.ADMIN_STAFF,
    );
  });

  it('Case9: branch/ownership for bare admin remains LIVE-aligned', async () => {
    await withDual(() => {
      const actor = {
        id: 'u-bare', role: 'admin', adminRole: null, permissions: [LIVE.MANAGE_HR],
      };
      const same = dualCheckLiveStaffGate({ user: actor }, {
        liveDecision: 'ALLOW',
        livePermission: LIVE.MANAGE_HR,
        scopeOk: true,
        ownershipOk: true,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(same.comparison, COMPARISON.MATCH);
      const cross = dualCheckLiveStaffGate({ user: actor }, {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_HR,
        scopeOk: false,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(cross.comparison, COMPARISON.MATCH);
      assert.equal(cross.finalDecision, 'DENY');
    });
  });

  it('Case10: bare admin without permission DENY MATCH; not role escalation', async () => {
    await withDual(() => {
      const actor = {
        id: 'u-bare', role: 'admin', adminRole: null, permissions: [],
      };
      const ent = evaluateEnterpriseShadow(actor, { livePermission: LIVE.MANAGE_FINANCE });
      assert.equal(ent.decision, 'DENY');
      assert.equal(ent.legacyPrincipal, true);
      const out = dualCheckLiveStaffGate({ user: actor }, {
        liveDecision: 'DENY',
        livePermission: LIVE.MANAGE_FINANCE,
        evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
      });
      assert.equal(out.comparison, COMPARISON.MATCH);
      assert.equal(out.finalDecision, 'DENY');
    });
  });

  it('resolveRole mirrors contract LEGACY_PRINCIPAL', () => {
    const r = resolveRole({ id: 'x', role: 'staff', adminRole: null });
    assert.equal(r.type, 'LEGACY_PRINCIPAL');
    assert.equal(r.enterpriseRole, null);
  });
});
