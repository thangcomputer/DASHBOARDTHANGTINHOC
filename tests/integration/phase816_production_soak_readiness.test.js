/**
 * Phase 8.16 — Production soak readiness & evidence gate (audit tests).
 * Does NOT promote Enterprise. Does NOT claim production soak evidence.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  EVIDENCE_CHANNEL,
  resolveEvidenceChannel,
  recordSoakObservation,
  resetSoakEvidenceForTests,
  snapshotSoakWindow,
  deltaSoakWindow,
  getSoakEvidenceStatus,
  getSoakEvidenceSnapshot,
  computeAndRecordStaticParity,
  isSoakWindowActive,
  isRbacParityObserveEnabled,
  isRbacDualCheckEnabled,
  observeLiveStaffGate,
  dualCheckLiveStaffGate,
  MISMATCH_REASON,
  resolveRole,
  getParityMetricsSnapshot,
  resetParityMetricsForTests,
} = require('../../services/rbacParity');
const { resolveEnterpriseRoleContract } = require('../../shared/constants/roleAliasContract');
const { PERMISSIONS: LIVE } = require('../../constants/permissions');

async function withEnv(map, fn) {
  const prev = {};
  for (const [k, v] of Object.entries(map)) {
    prev[k] = process.env[k];
    if (v === undefined || v === null) delete process.env[k];
    else process.env[k] = String(v);
  }
  try {
    return await fn();
  } finally {
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

describe('Phase 8.16 production soak readiness gate', { concurrency: false }, () => {
  it('1 feature flags: missing / false / off → all OFF; true variants ON', () => {
    return withEnv({
      RBAC_PARITY_OBSERVE_ENABLED: null,
      RBAC_DUAL_CHECK_ENABLED: null,
      RBAC_SOAK_WINDOW_ACTIVE: null,
    }, () => {
      assert.equal(isRbacParityObserveEnabled(), false);
      assert.equal(isRbacDualCheckEnabled(), false);
      assert.equal(isSoakWindowActive(), false);
    }).then(() => withEnv({
      RBAC_PARITY_OBSERVE_ENABLED: 'false',
      RBAC_DUAL_CHECK_ENABLED: '0',
      RBAC_SOAK_WINDOW_ACTIVE: 'off',
    }, () => {
      assert.equal(isRbacParityObserveEnabled(), false);
      assert.equal(isRbacDualCheckEnabled(), false);
      assert.equal(isSoakWindowActive(), false);
    })).then(() => withEnv({
      RBAC_PARITY_OBSERVE_ENABLED: 'true',
      RBAC_DUAL_CHECK_ENABLED: '1',
      RBAC_SOAK_WINDOW_ACTIVE: 'yes',
    }, () => {
      assert.equal(isRbacParityObserveEnabled(), true);
      assert.equal(isRbacDualCheckEnabled(), true);
      assert.equal(isSoakWindowActive(), true);
    }));
  });

  it('2 .env.example defaults safely OFF (no true defaults)', () => {
    const envEx = fs.readFileSync(path.join(__dirname, '../../.env.example'), 'utf8');
    assert.match(envEx, /^RBAC_PARITY_OBSERVE_ENABLED=false$/m);
    assert.match(envEx, /^RBAC_DUAL_CHECK_ENABLED=false$/m);
    assert.match(envEx, /^RBAC_SOAK_WINDOW_ACTIVE=false$/m);
    assert.equal((envEx.match(/RBAC_SOAK_WINDOW_ACTIVE=true/g) || []).length, 0);
    assert.equal((envEx.match(/RBAC_DUAL_CHECK_ENABLED=true/g) || []).length, 0);
    assert.equal((envEx.match(/RBAC_PARITY_OBSERVE_ENABLED=true/g) || []).length, 0);
  });

  it('3 evidence channels: default SYNTHETIC; STATIC/SYNTHETIC ≠ RUNTIME; no contamination', () => {
    resetSoakEvidenceForTests();
    assert.equal(resolveEvidenceChannel({}), EVIDENCE_CHANNEL.SYNTHETIC);
    assert.equal(resolveEvidenceChannel({ evidenceChannel: 'bogus' }), EVIDENCE_CHANNEL.SYNTHETIC);
    computeAndRecordStaticParity();
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.SYNTHETIC, comparison: 'MATCH' });
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.SYNTHETIC, comparison: 'MISMATCH' });
    const { channels } = getSoakEvidenceSnapshot();
    assert.equal(channels.STATIC.match, 8);
    assert.ok(channels.SYNTHETIC.requests >= 2);
    assert.equal(channels.RUNTIME.requests, 0);
    return withEnv({ RBAC_SOAK_WINDOW_ACTIVE: 'true' }, () => {
      assert.equal(getSoakEvidenceStatus().SOAK_EVIDENCE, 'NOT_AVAILABLE');
      assert.equal(getSoakEvidenceStatus().reason, 'no_runtime_channel_observations');
    });
  });

  it('4 soak accounting: RUNTIME alone insufficient; window+RUNTIME → AVAILABLE; delta isolated', () => {
    resetSoakEvidenceForTests();
    return withEnv({ RBAC_SOAK_WINDOW_ACTIVE: 'false' }, () => {
      recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });
      assert.equal(getSoakEvidenceStatus().SOAK_EVIDENCE, 'NOT_AVAILABLE');
    }).then(() => withEnv({ RBAC_SOAK_WINDOW_ACTIVE: 'true' }, () => {
      resetSoakEvidenceForTests();
      const before = snapshotSoakWindow();
      recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });
      recordSoakObservation({
        channel: EVIDENCE_CHANNEL.RUNTIME,
        comparison: 'MISMATCH',
        mismatchReason: MISMATCH_REASON.PERMISSION_MISMATCH,
      });
      recordSoakObservation({ channel: EVIDENCE_CHANNEL.SYNTHETIC, comparison: 'MATCH' });
      const after = snapshotSoakWindow();
      const d = deltaSoakWindow(before, after);
      assert.equal(d.requests, 2);
      assert.equal(d.match, 1);
      assert.equal(d.mismatch, 1);
      assert.equal(d.mismatchReasons.PERMISSION_MISMATCH, 1);
      assert.equal(getSoakEvidenceStatus().SOAK_EVIDENCE, 'AVAILABLE');
      assert.equal(getSoakEvidenceSnapshot().channels.SYNTHETIC.match, 1);
    }));
  });

  it('5 observer / dual-check errors do not become fake MATCH; LIVE decision preserved', async () => {
    resetSoakEvidenceForTests();
    resetParityMetricsForTests();
    await withEnv({
      RBAC_PARITY_OBSERVE_ENABLED: 'true',
      RBAC_DUAL_CHECK_ENABLED: 'true',
    }, async () => {
      const parity = require('../../services/rbacParity/compareLiveEnterprise');
      const orig = parity.compareStaffLivePermission;
      parity.compareStaffLivePermission = () => { throw new Error('816 observe boom'); };
      try {
        const obs = observeLiveStaffGate(
          { user: { id: 'u1', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR] } },
          {
            liveDecision: 'ALLOW',
            livePermission: LIVE.MANAGE_HR,
            evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
          },
        );
        assert.equal(obs, null);
      } finally {
        parity.compareStaffLivePermission = orig;
      }

      const orig2 = parity.enterpriseStaffPermissionDecision;
      parity.enterpriseStaffPermissionDecision = () => { throw new Error('816 dual boom'); };
      try {
        const dual = dualCheckLiveStaffGate(
          { user: { id: 'u1', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR] } },
          {
            liveDecision: 'DENY',
            livePermission: LIVE.MANAGE_HR,
            evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
          },
        );
        assert.equal(dual, null);
      } finally {
        parity.enterpriseStaffPermissionDecision = orig2;
      }
    });
    const m = getParityMetricsSnapshot();
    assert.ok(m.rbac_parity_observer_error_total >= 1);
    assert.ok(m.rbac_dualcheck_error_total >= 1);
    const { channels } = getSoakEvidenceSnapshot();
    assert.ok(channels.SYNTHETIC.errors >= 1);
    assert.equal(channels.SYNTHETIC.match, 0);
  });

  it('6 finalDecision === liveDecision always (ALLOW and DENY)', async () => {
    await withEnv({ RBAC_DUAL_CHECK_ENABLED: 'true' }, () => {
      for (const live of ['ALLOW', 'DENY']) {
        const out = dualCheckLiveStaffGate(
          {
            user: {
              id: 'u1', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR],
            },
          },
          {
            liveDecision: live,
            livePermission: LIVE.MANAGE_HR,
            evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
          },
        );
        assert.equal(out.finalDecision, live);
        assert.equal(out.finalDecision, out.liveDecision);
      }
    });
  });

  it('7 LEGACY_PRINCIPAL intact: bare admin MATCH; no SUPER/STAFF flatten', async () => {
    const rr = resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: null });
    assert.equal(rr.type, 'LEGACY_PRINCIPAL');
    assert.equal(rr.enterpriseRole, null);
    assert.equal(resolveRole({ id: 'x', role: 'admin', adminRole: null }).type, 'LEGACY_PRINCIPAL');
    await withEnv({ RBAC_DUAL_CHECK_ENABLED: 'true' }, () => {
      const out = dualCheckLiveStaffGate(
        {
          user: {
            id: 'bare', role: 'admin', adminRole: null, permissions: [LIVE.MANAGE_HR],
          },
        },
        {
          liveDecision: 'ALLOW',
          livePermission: LIVE.MANAGE_HR,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
        },
      );
      assert.equal(out.comparison, 'MATCH');
      assert.equal(out.roleType, 'LEGACY_PRINCIPAL');
      assert.notEqual(out.role, 'SUPER_ADMIN');
      assert.notEqual(out.role, 'ADMIN_STAFF');
      assert.equal(out.finalDecision, 'ALLOW');
    });
  });

  it('8 mismatch taxonomy remains distinguishable (no generic MATCH override)', () => {
    const required = [
      'ROLE_MISMATCH',
      'PERMISSION_MISMATCH',
      'SCOPE_MISMATCH',
      'OWNERSHIP_MISMATCH',
      'ACTION_MISMATCH',
      'BUNDLE_MISMATCH',
      'ROOT_IDENTITY_MISMATCH',
      'UNKNOWN_CONTEXT',
      'OTHER',
    ];
    for (const k of required) {
      assert.equal(MISMATCH_REASON[k], k);
    }
  });

  it('9 LOCAL soak scripts/artifacts never labeled production; PRIMARY never YES from LOCAL', () => {
    for (const name of ['rbac-soak-813b.cjs', 'rbac-soak-814.cjs']) {
      const src = fs.readFileSync(path.join(__dirname, '../../scripts', name), 'utf8');
      assert.ok(src.includes("RUNTIME_ENVIRONMENT: 'LOCAL'"));
      assert.ok(!src.includes("RUNTIME_ENVIRONMENT: 'PRODUCTION'"));
      assert.ok(src.includes("ENTERPRISE_PRIMARY_READY: 'NO'"));
      assert.ok(!src.includes("primaryReady ? 'YES'"));
    }
    for (const art of ['rbac-soak-813b.json', 'rbac-soak-814.json']) {
      const p = path.join(__dirname, '../../artifacts', art);
      if (!fs.existsSync(p)) continue;
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      assert.equal(j.RUNTIME_ENVIRONMENT, 'LOCAL');
      assert.notEqual(j.RUNTIME_ENVIRONMENT, 'PRODUCTION');
      assert.equal(j.ENTERPRISE_PRIMARY_READY, 'NO');
      assert.ok(Object.prototype.hasOwnProperty.call(j, 'SOAK_EVIDENCE'));
      assert.ok(j.soakWindow || j.soakDelta);
    }
    // Phase 8.17 ships production orchestrator — must not auto-enable flags / PRIMARY
    const prodScript = path.join(__dirname, '../../scripts/rbac-soak-production.cjs');
    assert.equal(fs.existsSync(prodScript), true);
    const prodSrc = fs.readFileSync(prodScript, 'utf8');
    assert.ok(!prodSrc.includes("RBAC_PARITY_OBSERVE_ENABLED = 'true'"));
    assert.ok(!prodSrc.includes('ENTERPRISE_PRIMARY_READY: \'YES\''));
  });

  it('10 coverage matrix: critical gates covered in STATIC; production traffic still required', () => {
    resetSoakEvidenceForTests();
    const snap = computeAndRecordStaticParity();
    assert.equal(snap.mappedGateMatch, 8);
    assert.equal(snap.mappedGateMatchTarget, 8);
    // Dimensions still requiring real RUNTIME soak (documented gate — not claimed here)
    const requiresRuntimeSoak = {
      roles: ['SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF', 'SUPPORT_AGENT', 'TEACHER', 'STUDENT', 'LEGACY_PRINCIPAL', 'id=admin', 'unauthenticated'],
      branch: ['same', 'cross', 'null'],
      ownership: ['owner', 'non-owner', 'missing'],
      negative: ['permission_missing', 'wrong_role', 'wrong_branch', 'wrong_owner', 'unknown_mapping', 'bare_admin'],
    };
    assert.ok(requiresRuntimeSoak.roles.includes('LEGACY_PRINCIPAL'));
    assert.equal(getSoakEvidenceStatus().SOAK_EVIDENCE, 'NOT_AVAILABLE');
  });

  it('11 middleware tags RUNTIME only via explicit evidenceChannel (auth source check)', () => {
    const auth = fs.readFileSync(path.join(__dirname, '../../middleware/auth.js'), 'utf8');
    const runtimeTags = (auth.match(/evidenceChannel:\s*'RUNTIME'/g) || []).length;
    assert.ok(runtimeTags >= 4); // checkPermission + checkAnyPermission × observe/dual
    assert.ok(auth.includes('/* observer must never break LIVE auth */'));
    assert.ok(auth.includes('/* dual-check must never break LIVE auth */'));
    assert.ok(auth.includes('if (ok) next()'));
  });
});
