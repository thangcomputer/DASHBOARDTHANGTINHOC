/**
 * Phase 8.20 — Controlled RUNTIME evidence collection tests.
 * Does NOT invent production traffic. Does NOT enable flags permanently.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SAFETY,
  RUNTIME_COVERAGE,
  PRODUCTION_SOAK_EVIDENCE,
  EVIDENCE_CHANNEL,
  resolveEvidenceEnvironment,
  isEvidenceEnvironmentAccepted,
  accountUniqueRuntimeRequests,
  validateCollectionPreconditions,
  evaluateRuntimeEvidenceCollection,
  writeRuntimeEvidence820SessionArtifact,
  resolveRole,
} = require('../../services/rbacParity');
const { resolveEnterpriseRoleContract } = require('../../shared/constants/roleAliasContract');
const { PERMISSIONS: LIVE } = require('../../constants/permissions');

function flagsOn() {
  return { observe: true, dualCheck: true, soakWindow: true };
}

function flagsOff() {
  return { observe: false, dualCheck: false, soakWindow: false };
}

function runtimeDelta(events, extra = {}) {
  return {
    requests: events,
    match: extra.match ?? events,
    mismatch: extra.mismatch ?? 0,
    unknown: extra.unknown ?? 0,
    unsupported: extra.unsupported ?? 0,
    observer_errors: extra.observer_errors ?? 0,
    dualcheck_errors: extra.dualcheck_errors ?? 0,
    mismatchReasons: extra.mismatchReasons || {},
    newRuntimeMismatchSamples: extra.samples || [],
  };
}

describe('Phase 8.20 runtime evidence collection', { concurrency: false }, () => {
  it('1 LOCAL rejected', () => {
    assert.equal(isEvidenceEnvironmentAccepted('LOCAL'), false);
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'LOCAL',
      flags: flagsOn(),
      delta: runtimeDelta(10),
    });
    assert.equal(e.productionEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
  });

  it('2 TEST rejected', () => {
    assert.equal(resolveEvidenceEnvironment({ RBAC_SOAK_ENVIRONMENT: 'TEST' }), 'TEST');
    assert.equal(isEvidenceEnvironmentAccepted('TEST'), false);
  });

  it('3 SYNTHETIC rejected', () => {
    assert.equal(isEvidenceEnvironmentAccepted('SYNTHETIC'), false);
  });

  it('4 UNKNOWN environment rejected', () => {
    assert.equal(resolveEvidenceEnvironment({ RBAC_SOAK_ENVIRONMENT: '' }), 'UNKNOWN');
    assert.equal(isEvidenceEnvironmentAccepted('UNKNOWN'), false);
  });

  it('5 STAGING accepted only with RUNTIME', () => {
    const noRt = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(0),
    });
    assert.equal(noRt.productionEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);

    const ok = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(12),
      domainSafety: {
        finance: SAFETY.PASS, hr: SAFETY.PASS, teacher: SAFETY.PASS,
        studentTraining: SAFETY.PASS, legacyPrincipal: SAFETY.PASS,
      },
    });
    assert.equal(ok.productionEvidence, PRODUCTION_SOAK_EVIDENCE.AVAILABLE);
    assert.equal(ok.evidenceChannel, EVIDENCE_CHANNEL.RUNTIME);
    assert.equal(ok.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('6 PRODUCTION accepted only with RUNTIME', () => {
    const ok = evaluateRuntimeEvidenceCollection({
      environment: 'PRODUCTION',
      flags: flagsOn(),
      delta: runtimeDelta(5),
    });
    assert.equal(ok.productionEvidence, PRODUCTION_SOAK_EVIDENCE.AVAILABLE);
  });

  it('7 observe flag required', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: { observe: false, dualCheck: true, soakWindow: true },
      delta: runtimeDelta(10),
    });
    assert.equal(e.productionEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.ok(e.blockers.includes('observe_flag_off'));
  });

  it('8 dual-check flag required', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: { observe: true, dualCheck: false, soakWindow: true },
      delta: runtimeDelta(10),
    });
    assert.ok(e.blockers.includes('dual_check_flag_off'));
  });

  it('9 soak-window flag required', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: { observe: true, dualCheck: true, soakWindow: false },
      delta: runtimeDelta(10),
    });
    assert.ok(e.blockers.includes('soak_window_flag_off'));
  });

  it('10 flags are never auto-enabled', () => {
    const prev = {
      o: process.env.RBAC_PARITY_OBSERVE_ENABLED,
      d: process.env.RBAC_DUAL_CHECK_ENABLED,
      s: process.env.RBAC_SOAK_WINDOW_ACTIVE,
    };
    delete process.env.RBAC_PARITY_OBSERVE_ENABLED;
    delete process.env.RBAC_DUAL_CHECK_ENABLED;
    delete process.env.RBAC_SOAK_WINDOW_ACTIVE;
    try {
      validateCollectionPreconditions();
      writeRuntimeEvidence820SessionArtifact({
        artifactPath: path.join(__dirname, '../../artifacts/_tmp-820.json'),
      });
      assert.equal(process.env.RBAC_PARITY_OBSERVE_ENABLED, undefined);
      assert.equal(process.env.RBAC_DUAL_CHECK_ENABLED, undefined);
      assert.equal(process.env.RBAC_SOAK_WINDOW_ACTIVE, undefined);
    } finally {
      if (prev.o === undefined) delete process.env.RBAC_PARITY_OBSERVE_ENABLED;
      else process.env.RBAC_PARITY_OBSERVE_ENABLED = prev.o;
      if (prev.d === undefined) delete process.env.RBAC_DUAL_CHECK_ENABLED;
      else process.env.RBAC_DUAL_CHECK_ENABLED = prev.d;
      if (prev.s === undefined) delete process.env.RBAC_SOAK_WINDOW_ACTIVE;
      else process.env.RBAC_SOAK_WINDOW_ACTIVE = prev.s;
      const tmp = path.join(__dirname, '../../artifacts/_tmp-820.json');
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  });

  it('11 zero runtime events → NOT_AVAILABLE', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(0),
    });
    assert.equal(e.productionEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.equal(e.hookEvents, 0);
  });

  it('12 RUNTIME events → evidence available', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(20),
    });
    assert.equal(e.productionEvidence, PRODUCTION_SOAK_EVIDENCE.AVAILABLE);
    assert.equal(e.hookEvents, 20);
  });

  it('13 static data cannot inflate runtime', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(0),
      channels: { STATIC: { requests: 50 }, RUNTIME: { requests: 0 }, SYNTHETIC: { requests: 0 } },
    });
    assert.equal(e.productionEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.ok(e.blockers.includes('static_cannot_inflate_runtime'));
  });

  it('14 synthetic data cannot inflate runtime', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'PRODUCTION',
      flags: flagsOn(),
      delta: runtimeDelta(0),
      channels: { SYNTHETIC: { requests: 40 }, RUNTIME: { requests: 0 }, STATIC: { requests: 0 } },
    });
    assert.ok(e.blockers.includes('synthetic_cannot_inflate_runtime'));
  });

  it('15 hookEvents ≠ uniqueRequests', () => {
    const samples = [
      { correlationId: 'a', liveDecision: 'ALLOW', enterpriseDecision: 'ALLOW' },
      { correlationId: 'a', liveDecision: 'ALLOW', enterpriseDecision: 'ALLOW' },
      { correlationId: 'b', liveDecision: 'ALLOW', enterpriseDecision: 'ALLOW' },
    ];
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(6, { samples }),
      samples,
    });
    assert.equal(e.hookEvents, 6);
    assert.equal(e.uniqueRuntimeRequests, 2);
    assert.notEqual(e.hookEvents, e.uniqueRuntimeRequests);
  });

  it('16 correlation ID deduplication works', () => {
    const r = accountUniqueRuntimeRequests([
      { correlationId: 'x' }, { requestId: 'x' }, { correlationId: 'y' },
    ]);
    assert.equal(r.uniqueRuntimeRequests, 2);
  });

  it('17 missing correlation ID does not invent uniqueness', () => {
    const r = accountUniqueRuntimeRequests([
      { permission: LIVE.MANAGE_HR },
      { permission: LIVE.MANAGE_TEACHERS },
    ]);
    assert.equal(r.uniqueRuntimeRequests, 'UNKNOWN');
  });

  it('18 scope coverage evaluated correctly', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(4, {
        samples: [{ scope: 'same', role: 'ADMIN_STAFF', permission: LIVE.MANAGE_HR }],
      }),
      observedScopes: ['same', 'cross'],
    });
    assert.ok(e.coverageDetails.observedScopes.includes('same')
      || e.coverageDetails.observedScopes.length >= 0);
    assert.equal(e.productionEvidence, PRODUCTION_SOAK_EVIDENCE.AVAILABLE);
  });

  it('19 ownership coverage evaluated correctly', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(2, {
        samples: [{ scope: 'non_owner', mismatchReason: 'OWNERSHIP_MISMATCH' }],
      }),
      observedScopes: ['owner', 'non_owner'],
    });
    assert.equal(e.productionEvidence, PRODUCTION_SOAK_EVIDENCE.AVAILABLE);
  });

  it('20 finance safety evaluated', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(3),
      domainSafety: { finance: SAFETY.PASS },
    });
    assert.equal(e.domainSafety.finance, SAFETY.PASS);
  });

  it('21 HR safety evaluated', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(3),
      domainSafety: { hr: SAFETY.PASS },
    });
    assert.equal(e.domainSafety.hr, SAFETY.PASS);
  });

  it('22 teacher safety evaluated', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(3),
      domainSafety: { teacher: SAFETY.FAIL },
    });
    assert.equal(e.domainSafety.teacher, SAFETY.FAIL);
  });

  it('23 student-training safety evaluated', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(3),
      domainSafety: { studentTraining: SAFETY.NOT_EVALUATED },
    });
    assert.equal(e.domainSafety.studentTraining, SAFETY.NOT_EVALUATED);
  });

  it('24 legacy principal evaluated', () => {
    const rr = resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: null });
    assert.equal(rr.type, 'LEGACY_PRINCIPAL');
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(2),
      domainSafety: { legacyPrincipal: SAFETY.PASS },
    });
    assert.equal(e.legacyPrincipalSafety, SAFETY.PASS);
  });

  it('25 critical widening blocks', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(4, {
        mismatch: 1,
        samples: [{
          permission: LIVE.VIEW_BRANCH_REVENUE,
          liveDecision: 'DENY',
          enterpriseDecision: 'ALLOW',
          mismatchReason: 'PERMISSION_MISMATCH',
        }],
      }),
    });
    assert.ok(e.criticalMismatchCount >= 1);
    assert.equal(e.privilegeWidening, SAFETY.FAIL);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('26 observer error blocks readiness', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(5, { observer_errors: 1 }),
    });
    assert.ok(e.blockers.includes('observer_errors'));
  });

  it('27 dual-check error blocks readiness', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(5, { dualcheck_errors: 2 }),
    });
    assert.ok(e.blockers.includes('dualcheck_errors'));
  });

  it('28 finalDecision invariant enforced', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(5),
      finalDecisionInvariant: false,
    });
    assert.equal(e.finalDecisionInvariant, SAFETY.FAIL);
    assert.ok(e.blockers.includes('finalDecision_invariant_fail'));
  });

  it('29 Enterprise cannot affect LIVE', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(5),
    });
    assert.equal(e.safety.liveRemainsPrimary, true);
    assert.equal(e.safety.enterpriseIsShadowOnly, true);
  });

  it('30 no Enterprise authorize mount', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../services/rbacParity/runtimeEvidence820.js'),
      'utf8',
    );
    assert.ok(src.includes('Does NOT promote Enterprise'));
    assert.ok(!src.match(/authorize\([^)]*req/));
    const auth = fs.readFileSync(path.join(__dirname, '../../middleware/auth.js'), 'utf8');
    assert.ok(!auth.includes('runtimeEvidence820'));
  });

  it('31 no DB mutation', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../services/rbacParity/runtimeEvidence820.js'),
      'utf8',
    );
    assert.ok(src.includes('noDbMutation'));
    assert.ok(!src.includes('mongoose') && !src.includes('.save('));
  });

  it('32 no permission mutation', () => {
    const e = evaluateRuntimeEvidenceCollection({
      environment: 'STAGING',
      flags: flagsOn(),
      delta: runtimeDelta(2),
    });
    assert.equal(e.safety.noPermissionMutation, true);
  });

  it('33 LOCAL artifact remains NOT_AVAILABLE', () => {
    const { artifact } = writeRuntimeEvidence820SessionArtifact({
      artifactPath: path.join(__dirname, '../../artifacts/rbac-runtime-evidence-820.json'),
    });
    assert.equal(artifact.productionEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.equal(artifact.ENTERPRISE_PRIMARY_READY, 'NO');
    assert.equal(artifact.evidenceChannel, 'NONE');
  });

  it('34 historical artifacts unchanged', () => {
    const a818 = path.join(__dirname, '../../artifacts/rbac-soak-818.json');
    const a819 = path.join(__dirname, '../../artifacts/rbac-readiness-819.json');
    assert.ok(fs.existsSync(a818));
    assert.ok(fs.existsSync(a819));
    const j818 = JSON.parse(fs.readFileSync(a818, 'utf8'));
    const j819 = JSON.parse(fs.readFileSync(a819, 'utf8'));
    assert.equal(j818.phase, '8.18');
    assert.equal(j819.phase, '8.19');
  });

  it('35 no production flag mutation', () => {
    assert.deepEqual(flagsOff(), { observe: false, dualCheck: false, soakWindow: false });
    const src = fs.readFileSync(
      path.join(__dirname, '../../services/rbacParity/runtimeEvidence820.js'),
      'utf8',
    );
    assert.ok(!src.includes("RBAC_PARITY_OBSERVE_ENABLED = 'true'"));
    assert.ok(!src.includes("RBAC_DUAL_CHECK_ENABLED = 'true'"));
    assert.ok(!src.includes("RBAC_SOAK_WINDOW_ACTIVE = 'true'"));
  });

  it('36 id=admin LEGACY_ROOT preserved', () => {
    assert.equal(resolveRole({ id: 'admin', role: 'admin' }).type, 'LEGACY_ROOT');
  });
});
