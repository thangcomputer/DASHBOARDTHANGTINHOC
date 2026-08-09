/**
 * Phase 8.17 — Production soak orchestrator tests.
 * Does NOT enable production flags permanently.
 * Does NOT claim fake production evidence from LOCAL/SYNTHETIC/STATIC.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SOAK_ENV,
  PRODUCTION_SOAK_EVIDENCE,
  PRODUCTION_SOAK_RESULT,
  MAX_SOAK_DURATION_SECONDS,
  isProductionSoakActive,
  resolveSoakEnvironment,
  getProductionSoakFlagState,
  parseSoakDurationSeconds,
  classifyProductionSoak,
  sanitizeMismatchSample,
  buildProductionSoakArtifact,
  runProductionSoakOrchestrator,
  recordSoakObservation,
  resetSoakEvidenceForTests,
  snapshotSoakWindow,
  deltaSoakWindow,
  EVIDENCE_CHANNEL,
  dualCheckLiveStaffGate,
  observeLiveStaffGate,
  resolveRole,
  resetParityMetricsForTests,
  getParityMetricsSnapshot,
} = require('../../services/rbacParity');
const { PERMISSIONS: LIVE } = require('../../constants/permissions');
const { resolveEnterpriseRoleContract } = require('../../shared/constants/roleAliasContract');

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

function emptyDelta(extra = {}) {
  return {
    requests: 0,
    match: 0,
    mismatch: 0,
    unknown: 0,
    unsupported: 0,
    observer_errors: 0,
    dualcheck_errors: 0,
    mismatchReasons: {},
    newRuntimeMismatchSamples: [],
    ...extra,
  };
}

describe('Phase 8.17 production soak orchestrator', { concurrency: false }, () => {
  it('1 all flags OFF → inactive', () => withEnv({
    RBAC_PARITY_OBSERVE_ENABLED: 'false',
    RBAC_DUAL_CHECK_ENABLED: 'false',
    RBAC_SOAK_WINDOW_ACTIVE: 'false',
    RBAC_SOAK_ENVIRONMENT: 'PRODUCTION',
  }, () => {
    assert.equal(isProductionSoakActive(), false);
  }));

  it('2 missing flag → inactive', () => withEnv({
    RBAC_PARITY_OBSERVE_ENABLED: 'true',
    RBAC_DUAL_CHECK_ENABLED: 'true',
    RBAC_SOAK_WINDOW_ACTIVE: null,
    RBAC_SOAK_ENVIRONMENT: 'STAGING',
  }, () => {
    assert.equal(isProductionSoakActive(), false);
  }));

  it('3 observe OFF → inactive', () => withEnv({
    RBAC_PARITY_OBSERVE_ENABLED: 'false',
    RBAC_DUAL_CHECK_ENABLED: 'true',
    RBAC_SOAK_WINDOW_ACTIVE: 'true',
    RBAC_SOAK_ENVIRONMENT: 'PRODUCTION',
  }, () => {
    assert.equal(isProductionSoakActive(), false);
    assert.equal(getProductionSoakFlagState().observe, false);
  }));

  it('4 dual-check OFF → inactive', () => withEnv({
    RBAC_PARITY_OBSERVE_ENABLED: 'true',
    RBAC_DUAL_CHECK_ENABLED: 'off',
    RBAC_SOAK_WINDOW_ACTIVE: 'true',
    RBAC_SOAK_ENVIRONMENT: 'PRODUCTION',
  }, () => {
    assert.equal(isProductionSoakActive(), false);
  }));

  it('5 soak window OFF → inactive', () => withEnv({
    RBAC_PARITY_OBSERVE_ENABLED: 'true',
    RBAC_DUAL_CHECK_ENABLED: 'true',
    RBAC_SOAK_WINDOW_ACTIVE: '0',
    RBAC_SOAK_ENVIRONMENT: 'STAGING',
  }, () => {
    assert.equal(isProductionSoakActive(), false);
  }));

  it('6 invalid duration → reject', () => {
    assert.equal(parseSoakDurationSeconds({ SOAK_DURATION_SECONDS: 'NaN' }).ok, false);
    assert.equal(parseSoakDurationSeconds({ SOAK_DURATION_SECONDS: 'abc' }).ok, false);
    assert.equal(parseSoakDurationSeconds({ SOAK_DURATION_SECONDS: '1.5' }).ok, false);
    assert.equal(
      parseSoakDurationSeconds({ SOAK_DURATION_SECONDS: String(MAX_SOAK_DURATION_SECONDS + 1) }).ok,
      false,
    );
  });

  it('7 zero / missing duration → reject', () => {
    assert.equal(parseSoakDurationSeconds({ SOAK_DURATION_SECONDS: '0' }).ok, false);
    assert.equal(parseSoakDurationSeconds({ SOAK_DURATION_SECONDS: '-1' }).ok, false);
    assert.equal(parseSoakDurationSeconds({}).ok, false);
  });

  it('8 runtime channel required for AVAILABLE', () => {
    const c = classifyProductionSoak({
      environment: SOAK_ENV.PRODUCTION,
      flags: { observe: true, dualCheck: true, soakWindow: true },
      delta: emptyDelta(),
      active: true,
      durationSeconds: 60,
    });
    assert.equal(c.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.equal(c.reason, 'no_runtime_observations');
  });

  it('9 SYNTHETIC cannot become production evidence', () => {
    resetSoakEvidenceForTests();
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.SYNTHETIC, comparison: 'MATCH' });
    const c = classifyProductionSoak({
      environment: SOAK_ENV.STAGING,
      flags: { observe: true, dualCheck: true, soakWindow: true },
      delta: emptyDelta({ requests: 0, match: 0 }),
      active: true,
      durationSeconds: 10,
    });
    assert.equal(c.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.notEqual(c.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.AVAILABLE);
  });

  it('10 STATIC cannot become production evidence; LOCAL env INVALID', () => {
    assert.equal(resolveSoakEnvironment({ RBAC_SOAK_ENVIRONMENT: 'LOCAL' }), SOAK_ENV.LOCAL);
    const local = classifyProductionSoak({
      environment: SOAK_ENV.LOCAL,
      flags: { observe: true, dualCheck: true, soakWindow: true },
      delta: emptyDelta({ requests: 10, match: 10 }),
      active: false,
      durationSeconds: 10,
    });
    assert.equal(local.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.INVALID);
    const art = buildProductionSoakArtifact({
      environment: SOAK_ENV.PRODUCTION,
      flags: { observe: true, dualCheck: true, soakWindow: true },
      delta: emptyDelta({ requests: 5, match: 5 }),
      classification: {
        productionSoakActive: true,
        productionSoakEvidence: PRODUCTION_SOAK_EVIDENCE.AVAILABLE,
        productionSoakResult: PRODUCTION_SOAK_RESULT.PASS,
        errors: { observer: 0, dualCheck: 0 },
      },
    });
    assert.equal(art.coverage.channels.STATIC.countedAsProductionEvidence, false);
    assert.equal(art.coverage.channels.SYNTHETIC.countedAsProductionEvidence, false);
    assert.equal(art.enterprisePrimaryReady, false);
  });

  it('11 runtime delta calculated correctly', () => {
    resetSoakEvidenceForTests();
    const before = snapshotSoakWindow();
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.RUNTIME, comparison: 'MATCH' });
    recordSoakObservation({
      channel: EVIDENCE_CHANNEL.RUNTIME,
      comparison: 'MISMATCH',
      mismatchReason: 'PERMISSION_MISMATCH',
    });
    const after = snapshotSoakWindow();
    const d = deltaSoakWindow(before, after);
    assert.equal(d.requests, 2);
    assert.equal(d.match, 1);
    assert.equal(d.mismatch, 1);
    assert.equal(d.mismatchReasons.PERMISSION_MISMATCH, 1);
  });

  it('12 observer error → no false MATCH / INVALID evidence', async () => {
    resetSoakEvidenceForTests();
    resetParityMetricsForTests();
    await withEnv({ RBAC_PARITY_OBSERVE_ENABLED: 'true' }, async () => {
      const parity = require('../../services/rbacParity/compareLiveEnterprise');
      const orig = parity.compareStaffLivePermission;
      parity.compareStaffLivePermission = () => { throw new Error('817 obs'); };
      try {
        assert.equal(observeLiveStaffGate(
          { user: { id: 'u', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR] } },
          { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_HR, evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC },
        ), null);
      } finally {
        parity.compareStaffLivePermission = orig;
      }
    });
    assert.ok(getParityMetricsSnapshot().rbac_parity_observer_error_total >= 1);
    const c = classifyProductionSoak({
      environment: SOAK_ENV.PRODUCTION,
      flags: { observe: true, dualCheck: true, soakWindow: true },
      delta: emptyDelta({ requests: 2, match: 2, observer_errors: 1 }),
      active: true,
      durationSeconds: 5,
    });
    assert.equal(c.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.INVALID);
    assert.notEqual(c.productionSoakResult, PRODUCTION_SOAK_RESULT.PASS);
  });

  it('13 dual-check error → no false MATCH / INVALID evidence', async () => {
    resetParityMetricsForTests();
    await withEnv({ RBAC_DUAL_CHECK_ENABLED: 'true' }, async () => {
      const parity = require('../../services/rbacParity/compareLiveEnterprise');
      const orig = parity.enterpriseStaffPermissionDecision;
      parity.enterpriseStaffPermissionDecision = () => { throw new Error('817 dual'); };
      try {
        assert.equal(dualCheckLiveStaffGate(
          { user: { id: 'u', role: 'staff', adminRole: 'STAFF', permissions: [LIVE.MANAGE_HR] } },
          { liveDecision: 'ALLOW', livePermission: LIVE.MANAGE_HR, evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC },
        ), null);
      } finally {
        parity.enterpriseStaffPermissionDecision = orig;
      }
    });
    assert.ok(getParityMetricsSnapshot().rbac_dualcheck_error_total >= 1);
    const c = classifyProductionSoak({
      environment: SOAK_ENV.STAGING,
      flags: { observe: true, dualCheck: true, soakWindow: true },
      delta: emptyDelta({ requests: 3, match: 3, dualcheck_errors: 2 }),
      active: true,
      durationSeconds: 5,
    });
    assert.equal(c.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.INVALID);
  });

  it('14 mismatch > 0 → FINDINGS; PRIMARY remains NO', () => {
    const c = classifyProductionSoak({
      environment: SOAK_ENV.PRODUCTION,
      flags: { observe: true, dualCheck: true, soakWindow: true },
      delta: emptyDelta({
        requests: 4,
        match: 3,
        mismatch: 1,
        mismatchReasons: { ROLE_MISMATCH: 1 },
        newRuntimeMismatchSamples: [{
          permission: LIVE.MANAGE_HR,
          liveDecision: 'ALLOW',
          enterpriseDecision: 'DENY',
          mismatchReason: 'ROLE_MISMATCH',
          role: 'LEGACY_PRINCIPAL',
        }],
      }),
      active: true,
      durationSeconds: 30,
    });
    assert.equal(c.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.AVAILABLE);
    assert.equal(c.productionSoakResult, PRODUCTION_SOAK_RESULT.FINDINGS);
    assert.equal(c.enterprisePrimaryReady, false);
  });

  it('15 mismatch does not alter LIVE decision', async () => {
    await withEnv({ RBAC_DUAL_CHECK_ENABLED: 'true' }, () => {
      const out = dualCheckLiveStaffGate(
        { user: { id: 'u', role: 'staff', adminRole: 'STAFF', permissions: [] } },
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

  it('16 legacy principal remains LEGACY_PRINCIPAL', () => {
    const rr = resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: null });
    assert.equal(rr.type, 'LEGACY_PRINCIPAL');
    assert.equal(rr.enterpriseRole, null);
    assert.equal(resolveRole({ id: 'x', role: 'admin', adminRole: null }).type, 'LEGACY_PRINCIPAL');
  });

  it('17 artifact contains no secrets; sanitize strips unsafe keys', async () => {
    const dirty = {
      permission: LIVE.MANAGE_HR,
      liveDecision: 'ALLOW',
      enterpriseDecision: 'DENY',
      mismatchReason: 'PERMISSION_MISMATCH',
      password: 'secret',
      token: 'jwt-token',
      jwt: 'x.y.z',
      body: { password: 'nope' },
    };
    const clean = sanitizeMismatchSample(dirty, SOAK_ENV.STAGING);
    assert.equal(clean.password, undefined);
    assert.equal(clean.token, undefined);
    assert.equal(clean.jwt, undefined);
    assert.equal(clean.body, undefined);
    assert.equal(clean.permission, LIVE.MANAGE_HR);

    await withEnv({
      RBAC_SOAK_ENVIRONMENT: 'STAGING',
      RBAC_PARITY_OBSERVE_ENABLED: 'true',
      RBAC_DUAL_CHECK_ENABLED: 'true',
      RBAC_SOAK_WINDOW_ACTIVE: 'true',
      SOAK_DURATION_SECONDS: '1',
    }, async () => {
      resetSoakEvidenceForTests();
      const before = snapshotSoakWindow();
      recordSoakObservation({
        channel: EVIDENCE_CHANNEL.RUNTIME,
        comparison: 'MISMATCH',
        permission: LIVE.MANAGE_HR,
        mismatchReason: 'PERMISSION_MISMATCH',
        liveDecision: 'ALLOW',
        enterpriseDecision: 'DENY',
      });
      const after = snapshotSoakWindow();
      const delta = deltaSoakWindow(before, after);
      const result = await runProductionSoakOrchestrator({
        writeArtifact: false,
        waitFn: async () => {},
        snapshotFn: (() => {
          let n = 0;
          return () => {
            n += 1;
            return n === 1 ? before : after;
          };
        })(),
        deltaFn: () => delta,
      });
      const json = JSON.stringify(result.artifact);
      assert.ok(!json.includes('password'));
      assert.ok(!json.includes('jwt-token'));
      assert.equal(result.artifact.ENTERPRISE_PRIMARY_READY, 'NO');
      assert.equal(result.artifact.enterprisePrimaryReady, false);
      assert.equal(result.classification.productionSoakResult, PRODUCTION_SOAK_RESULT.FINDINGS);
    });
  });

  it('18 Enterprise PRIMARY remains NO (even on clean PASS path)', () => {
    const c = classifyProductionSoak({
      environment: SOAK_ENV.PRODUCTION,
      flags: { observe: true, dualCheck: true, soakWindow: true },
      delta: emptyDelta({ requests: 10, match: 10 }),
      active: true,
      durationSeconds: 60,
    });
    assert.equal(c.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.AVAILABLE);
    assert.equal(c.productionSoakResult, PRODUCTION_SOAK_RESULT.PASS);
    assert.equal(c.enterprisePrimaryReady, false);

    const art = buildProductionSoakArtifact({
      environment: SOAK_ENV.PRODUCTION,
      flags: { observe: true, dualCheck: true, soakWindow: true },
      delta: emptyDelta({ requests: 10, match: 10 }),
      classification: c,
    });
    assert.equal(art.ENTERPRISE_PRIMARY_READY, 'NO');
    assert.equal(art.enterprisePrimaryReady, false);
  });

  it('19 orchestrator does not auto-enable flags; script safety', async () => {
    await withEnv({
      RBAC_SOAK_ENVIRONMENT: 'PRODUCTION',
      RBAC_PARITY_OBSERVE_ENABLED: null,
      RBAC_DUAL_CHECK_ENABLED: null,
      RBAC_SOAK_WINDOW_ACTIVE: null,
      SOAK_DURATION_SECONDS: '1',
    }, async () => {
      const result = await runProductionSoakOrchestrator({
        writeArtifact: false,
        waitFn: async () => {},
      });
      assert.equal(result.ok, false);
      assert.equal(result.ENTERPRISE_PRIMARY_READY, 'NO');
      assert.equal(process.env.RBAC_PARITY_OBSERVE_ENABLED, undefined);
      assert.equal(process.env.RBAC_DUAL_CHECK_ENABLED, undefined);
      assert.equal(process.env.RBAC_SOAK_WINDOW_ACTIVE, undefined);
    });

    const src = fs.readFileSync(
      path.join(__dirname, '../../scripts/rbac-soak-production.cjs'),
      'utf8',
    );
    assert.ok(src.includes('Does NOT enable RBAC flags'));
    assert.ok(!src.includes("process.env.RBAC_PARITY_OBSERVE_ENABLED = 'true'"));
    assert.ok(!src.includes("ENTERPRISE_PRIMARY_READY: 'YES'"));

    const envEx = fs.readFileSync(path.join(__dirname, '../../.env.example'), 'utf8');
    assert.match(envEx, /^RBAC_SOAK_ENVIRONMENT=LOCAL$/m);
    assert.match(envEx, /^RBAC_SOAK_WINDOW_ACTIVE=false$/m);
  });
});
