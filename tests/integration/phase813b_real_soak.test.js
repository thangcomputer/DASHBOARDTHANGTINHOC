/**
 * Phase 8.13B — Soak evidence accounting (not fake production traffic).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  EVIDENCE_CHANNEL,
  recordSoakObservation,
  resetSoakEvidenceForTests,
  snapshotSoakWindow,
  deltaSoakWindow,
  getSoakEvidenceStatus,
  getSoakEvidenceSnapshot,
  computeAndRecordStaticParity,
  isSoakWindowActive,
  dualCheckLiveStaffGate,
} = require('../../services/rbacParity');
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

describe('Phase 8.13B real soak accounting', { concurrency: false }, () => {
  it('flags default OFF; soak window inactive', () => {
    return withEnv({
      RBAC_PARITY_OBSERVE_ENABLED: null,
      RBAC_DUAL_CHECK_ENABLED: null,
      RBAC_SOAK_WINDOW_ACTIVE: null,
    }, () => {
      assert.equal(isSoakWindowActive(), false);
      assert.equal(getSoakEvidenceStatus().SOAK_EVIDENCE, 'NOT_AVAILABLE');
    });
  });

  it('RUNTIME channel observations without soak window → SOAK_EVIDENCE NOT_AVAILABLE', () => {
    resetSoakEvidenceForTests();
    return withEnv({ RBAC_SOAK_WINDOW_ACTIVE: 'false' }, () => {
      recordSoakObservation({
        channel: EVIDENCE_CHANNEL.RUNTIME,
        comparison: 'MATCH',
        permission: LIVE.MANAGE_HR,
      });
      const st = getSoakEvidenceStatus();
      assert.equal(st.SOAK_EVIDENCE, 'NOT_AVAILABLE');
      assert.equal(st.reason, 'soak_window_not_active');
      assert.ok(st.runtimeChannelRequests >= 1);
    });
  });

  it('SYNTHETIC cannot inflate RUNTIME', async () => {
    resetSoakEvidenceForTests();
    await withEnv({ RBAC_DUAL_CHECK_ENABLED: 'true' }, async () => {
      dualCheckLiveStaffGate(
        {
          user: {
            id: 'u1', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR],
          },
        },
        {
          liveDecision: 'ALLOW',
          livePermission: LIVE.MANAGE_HR,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
        },
      );
      // default channel is SYNTHETIC
      dualCheckLiveStaffGate(
        {
          user: {
            id: 'u1', role: 'staff', adminRole: 'STAFF', permissions: [],
          },
        },
        {
          liveDecision: 'ALLOW',
          livePermission: LIVE.MANAGE_HR,
        },
      );
    });
    const { channels } = getSoakEvidenceSnapshot();
    assert.ok(channels.SYNTHETIC.requests >= 1);
    assert.equal(channels.RUNTIME.requests, 0);
  });

  it('counters isolated across channels', () => {
    resetSoakEvidenceForTests();
    computeAndRecordStaticParity();
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.SYNTHETIC, comparison: 'MISMATCH' });
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });
    const { channels } = getSoakEvidenceSnapshot();
    assert.equal(channels.STATIC.match, 8);
    assert.equal(channels.SYNTHETIC.mismatch, 1);
    assert.equal(channels.RUNTIME.match, 1);
    assert.equal(channels.RUNTIME.mismatch, 0);
  });

  it('snapshot/delta calculation is correct', () => {
    resetSoakEvidenceForTests();
    const before = snapshotSoakWindow();
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });
    recordSoakObservation({
      channel: EVIDENCE_CHANNEL.RUNTIME,
      comparison: 'MISMATCH',
      mismatchReason: 'ROLE_MISMATCH',
    });
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'UNSUPPORTED' });
    const after = snapshotSoakWindow();
    const d = deltaSoakWindow(before, after);
    assert.equal(d.requests, 4);
    assert.equal(d.match, 2);
    assert.equal(d.mismatch, 1);
    assert.equal(d.unsupported, 1);
    assert.equal(d.mismatchReasons.ROLE_MISMATCH, 1);
  });

  it('finalDecision remains LIVE on synthetic dual-check', async () => {
    await withEnv({ RBAC_DUAL_CHECK_ENABLED: 'true' }, () => {
      const out = dualCheckLiveStaffGate(
        {
          user: {
            id: 'u1', role: 'staff', adminRole: 'STAFF', permissions: [],
          },
        },
        {
          liveDecision: 'ALLOW',
          livePermission: LIVE.MANAGE_HR,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
        },
      );
      assert.equal(out.finalDecision, 'ALLOW');
      assert.equal(out.finalDecision, out.liveDecision);
      assert.equal(out.comparison, 'MISMATCH');
    });
  });

  it('Enterprise errors remain fail-safe', async () => {
    await withEnv({ RBAC_DUAL_CHECK_ENABLED: 'true' }, () => {
      const parity = require('../../services/rbacParity/compareLiveEnterprise');
      const orig = parity.enterpriseStaffPermissionDecision;
      parity.enterpriseStaffPermissionDecision = () => { throw new Error('813b boom'); };
      try {
        const out = dualCheckLiveStaffGate(
          {
            user: {
              id: 'u1', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR],
            },
          },
          {
            liveDecision: 'ALLOW',
            livePermission: LIVE.MANAGE_HR,
            evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
          },
        );
        assert.equal(out, null);
      } finally {
        parity.enterpriseStaffPermissionDecision = orig;
      }
    });
  });

  it('artifact from soak script exists when previously executed', () => {
    const artifact = path.join(__dirname, '../../artifacts/rbac-soak-813b.json');
    if (!fs.existsSync(artifact)) {
      // harness may not have been run in this CI shard — skip soft
      return;
    }
    const j = JSON.parse(fs.readFileSync(artifact, 'utf8'));
    assert.equal(j.phase, '8.13B');
    assert.equal(j.RUNTIME_ENVIRONMENT, 'LOCAL');
    assert.ok(j.soakDelta);
    assert.ok(Object.prototype.hasOwnProperty.call(j, 'ENTERPRISE_PRIMARY_READY'));
  });

  it('.env.example defaults remain OFF', () => {
    const envEx = fs.readFileSync(path.join(__dirname, '../../.env.example'), 'utf8');
    assert.ok(envEx.includes('RBAC_PARITY_OBSERVE_ENABLED=false'));
    assert.ok(envEx.includes('RBAC_DUAL_CHECK_ENABLED=false'));
    assert.ok(envEx.includes('RBAC_SOAK_WINDOW_ACTIVE=false'));
    assert.ok(!envEx.match(/RBAC_SOAK_WINDOW_ACTIVE=true/));
  });
});
