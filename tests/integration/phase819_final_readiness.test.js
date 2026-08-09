/**
 * Phase 8.19 — Final Enterprise readiness gate tests (hardened semantics).
 * Does NOT promote Enterprise. Does NOT invent production evidence.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  READINESS_DECISION,
  GATE,
  SAFETY,
  RUNTIME_COVERAGE,
  PRODUCTION_SOAK_EVIDENCE,
  evaluateFinalReadiness,
  writeReadiness819Artifact,
  evaluateCatalogContracts,
  evaluateDomainSafetyEvidence,
  resolveRole,
} = require('../../services/rbacParity');
const { resolveEnterpriseRoleContract } = require('../../shared/constants/roleAliasContract');
const map = require('../../shared/constants/legacyPermissionMapping');

function validProdArtifact(overrides = {}) {
  return {
    phase: '8.18',
    environment: 'STAGING',
    productionSoakEvidence: PRODUCTION_SOAK_EVIDENCE.AVAILABLE,
    productionRuntimeExecuted: true,
    runtimeHookEvents: 40,
    observerErrors: 0,
    dualCheckErrors: 0,
    criticalMismatchCount: 0,
    coverage: { runtimeCoverage: RUNTIME_COVERAGE.COMPLETE },
    financeSafety: { status: SAFETY.PASS, critical: 0 },
    hrSafety: { status: SAFETY.PASS, critical: 0 },
    teacherSafety: { status: SAFETY.PASS, critical: 0 },
    studentTrainingSafety: { status: SAFETY.PASS, critical: 0 },
    legacyPrincipalSafety: { status: SAFETY.PASS, critical: 0 },
    finalDecisionInvariant: SAFETY.PASS,
    ...overrides,
  };
}

describe('Phase 8.19 final readiness gate', { concurrency: false }, () => {
  it('1 LOCAL → production evidence NOT_AVAILABLE', () => {
    const e = evaluateFinalReadiness({
      soakArtifact: validProdArtifact({
        environment: 'LOCAL',
        productionSoakEvidence: 'NOT_AVAILABLE',
        productionRuntimeExecuted: false,
        runtimeHookEvents: 0,
        coverage: { runtimeCoverage: RUNTIME_COVERAGE.NOT_AVAILABLE },
      }),
    });
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.equal(e.hardGates.G5_ProductionEvidence, GATE.NOT_AVAILABLE);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('2 SYNTHETIC → NOT_AVAILABLE', () => {
    const e = evaluateFinalReadiness({
      soakArtifact: {
        environment: 'LOCAL',
        productionSoakEvidence: 'NOT_AVAILABLE',
        channels: { SYNTHETIC: { requests: 100 }, RUNTIME: { requests: 0 } },
        runtimeHookEvents: 0,
      },
    });
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('3 STATIC → NOT_AVAILABLE', () => {
    const e = evaluateFinalReadiness({
      soakArtifact: {
        environment: 'STAGING',
        productionSoakEvidence: 'NOT_AVAILABLE',
        channels: { STATIC: { requests: 12 }, RUNTIME: { requests: 0 } },
        runtimeHookEvents: 0,
        coverage: { runtimeCoverage: RUNTIME_COVERAGE.NOT_AVAILABLE },
      },
    });
    assert.equal(e.hardGates.G5_ProductionEvidence, GATE.NOT_AVAILABLE);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('4 no production evidence → NOT_AVAILABLE / BLOCKED', () => {
    const e = evaluateFinalReadiness({ soakArtifact: null });
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.ok(e.decision === READINESS_DECISION.BLOCKED || e.decision === READINESS_DECISION.NOT_READY);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('5 NOT_EVALUATED domain ≠ FAIL', () => {
    const domains = evaluateDomainSafetyEvidence({
      productionLike: false,
      productionRuntimeExecuted: false,
      runtimeEvents: 0,
      productionSoakEvidence: PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE,
    });
    assert.equal(domains.finance, SAFETY.NOT_EVALUATED);
    assert.equal(domains.hr, SAFETY.NOT_EVALUATED);
    assert.equal(domains.teacher, SAFETY.NOT_EVALUATED);
    assert.equal(domains.studentTraining, SAFETY.NOT_EVALUATED);
    assert.equal(domains.legacyPrincipal, SAFETY.NOT_EVALUATED);

    const e = evaluateFinalReadiness({
      soakArtifactPath: path.join(__dirname, '../../artifacts/rbac-soak-818.json'),
    });
    assert.equal(e.financeSafety, SAFETY.NOT_EVALUATED);
    assert.equal(e.hrSafety, SAFETY.NOT_EVALUATED);
    assert.equal(e.teacherSafety, SAFETY.NOT_EVALUATED);
    assert.equal(e.studentTrainingSafety, SAFETY.NOT_EVALUATED);
    assert.equal(e.legacyPrincipalSafety, SAFETY.NOT_EVALUATED);
    assert.equal(e.hardGates.G10_DomainSafety, GATE.NOT_EVALUATED);
    assert.notEqual(e.hardGates.G10_DomainSafety, GATE.FAIL);
    assert.notEqual(e.financeSafety, SAFETY.FAIL);
  });

  it('6 NOT_EVALUATED domain still blocks PRIMARY', () => {
    const e = evaluateFinalReadiness({
      soakArtifact: validProdArtifact({
        financeSafety: { status: SAFETY.NOT_EVALUATED },
        hrSafety: { status: SAFETY.NOT_EVALUATED },
        teacherSafety: { status: SAFETY.NOT_EVALUATED },
        studentTrainingSafety: { status: SAFETY.NOT_EVALUATED },
        legacyPrincipalSafety: { status: SAFETY.NOT_EVALUATED },
      }),
    });
    // With production runtime but domains explicitly NOT_EVALUATED in artifact
    assert.equal(e.hardGates.G10_DomainSafety, GATE.NOT_EVALUATED);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
    assert.notEqual(e.decision, READINESS_DECISION.READY);
  });

  it('7 production evidence + incomplete coverage → NOT_READY', () => {
    const e = evaluateFinalReadiness({
      soakArtifact: validProdArtifact({
        coverage: { runtimeCoverage: RUNTIME_COVERAGE.PARTIAL },
      }),
    });
    assert.equal(e.hardGates.G12_Coverage, GATE.NOT_EVALUATED);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('8 production evidence + domain FAIL → NOT_READY', () => {
    const e = evaluateFinalReadiness({
      soakArtifact: validProdArtifact({
        financeSafety: { status: SAFETY.FAIL, critical: 1 },
      }),
    });
    assert.equal(e.financeSafety, SAFETY.FAIL);
    assert.equal(e.hardGates.G10_DomainSafety, GATE.FAIL);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('9 production evidence + critical mismatch → NOT_READY', () => {
    const e = evaluateFinalReadiness({
      soakArtifact: validProdArtifact({ criticalMismatchCount: 1 }),
    });
    assert.equal(e.hardGates.G7_CriticalMismatch, GATE.FAIL);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('10 production evidence + privilege widening → NOT_READY', () => {
    const e = evaluateFinalReadiness({
      soakArtifact: validProdArtifact(),
      privilegeWidening: true,
    });
    assert.equal(e.hardGates.G9_PrivilegeWidening, GATE.FAIL);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('11 production evidence + all PASS → READY', () => {
    const e = evaluateFinalReadiness({ soakArtifact: validProdArtifact() });
    assert.equal(e.decision, READINESS_DECISION.READY);
    assert.equal(e.status, 'PASS');
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'YES');
    assert.equal(e.recommendation, 'READY_FOR_CUTOVER_REVIEW');
    assert.equal(e.hardGates.G10_DomainSafety, GATE.PASS);
  });

  it('12 LOCAL cannot become production evidence', () => {
    const e = evaluateFinalReadiness({
      soakArtifact: validProdArtifact({
        environment: 'LOCAL',
        productionSoakEvidence: 'AVAILABLE', // spoof attempt
        runtimeHookEvents: 99,
      }),
    });
    assert.equal(e.hardGates.G5_ProductionEvidence, GATE.NOT_AVAILABLE);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
    assert.equal(e.financeSafety, SAFETY.NOT_EVALUATED);
  });

  it('13 evaluator cannot enable flags', () => {
    const prev = process.env.RBAC_PARITY_OBSERVE_ENABLED;
    delete process.env.RBAC_PARITY_OBSERVE_ENABLED;
    try {
      evaluateFinalReadiness({ soakArtifact: null });
      assert.equal(process.env.RBAC_PARITY_OBSERVE_ENABLED, undefined);
    } finally {
      if (prev === undefined) delete process.env.RBAC_PARITY_OBSERVE_ENABLED;
      else process.env.RBAC_PARITY_OBSERVE_ENABLED = prev;
    }
  });

  it('14 evaluator cannot mount Enterprise authorize', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../../services/rbacParity/finalReadiness.js'),
      'utf8',
    );
    assert.ok(src.includes('Does NOT mount authorize()'));
    assert.ok(!src.match(/authorize\([^)]*req/));
  });

  it('15 evaluator cannot mutate LIVE', () => {
    const auth = fs.readFileSync(path.join(__dirname, '../../middleware/auth.js'), 'utf8');
    assert.ok(!auth.includes('finalReadiness'));
    const fr = fs.readFileSync(
      path.join(__dirname, '../../services/rbacParity/finalReadiness.js'),
      'utf8',
    );
    assert.ok(!fr.includes("require('../../middleware/auth')"));
  });

  it('16 unsupported legacy remains unsupported', () => {
    for (const k of ['manage_schedule', 'manage_messages', 'view_logs', 'view_evaluations']) {
      assert.equal(map.isLegacyOnly(k), true);
      assert.deepEqual(map.resolve(k), []);
    }
    assert.equal(evaluateCatalogContracts().unsupportedSilentMap, false);
  });

  it('17 LEGACY_PRINCIPAL remains valid', () => {
    const rr = resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: null });
    assert.equal(rr.type, 'LEGACY_PRINCIPAL');
    assert.equal(rr.enterpriseRole, null);
  });

  it('18 id=admin remains LEGACY_ROOT', () => {
    assert.equal(resolveEnterpriseRoleContract({ userId: 'admin' }).type, 'LEGACY_ROOT');
    assert.equal(resolveRole({ id: 'admin', role: 'admin' }).type, 'LEGACY_ROOT');
  });

  it('19 finalDecision invariant remains mandatory', () => {
    const e = evaluateFinalReadiness({
      soakArtifact: validProdArtifact({ finalDecisionInvariant: SAFETY.FAIL }),
    });
    assert.equal(e.hardGates.G8_DecisionInvariant, GATE.FAIL);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('20 artifact schema valid + current session BLOCKED with NOT_EVALUATED domains', () => {
    const { artifact } = writeReadiness819Artifact({
      soakArtifactPath: path.join(__dirname, '../../artifacts/rbac-soak-818.json'),
      artifactPath: path.join(__dirname, '../../artifacts/rbac-readiness-819.json'),
    });
    for (const k of [
      'phase', 'status', 'environment', 'productionEvidence', 'runtimeCoverage',
      'hardGates', 'domainSafety', 'roleSafety', 'legacyPrincipalSafety',
      'criticalMismatchCount', 'observerErrors', 'dualCheckErrors',
      'privilegeWidening', 'blockers', 'enterprisePrimaryReady',
    ]) {
      assert.ok(Object.prototype.hasOwnProperty.call(artifact, k), `missing ${k}`);
    }
    assert.equal(artifact.status, 'BLOCKED');
    assert.equal(artifact.ENTERPRISE_PRIMARY_READY, 'NO');
    assert.equal(artifact.financeSafety, SAFETY.NOT_EVALUATED);
    assert.equal(artifact.hrSafety, SAFETY.NOT_EVALUATED);
    assert.equal(artifact.teacherSafety, SAFETY.NOT_EVALUATED);
    assert.equal(artifact.studentTrainingSafety, SAFETY.NOT_EVALUATED);
    assert.equal(artifact.legacyPrincipalSafety, SAFETY.NOT_EVALUATED);
    assert.equal(artifact.hardGates.G10_DomainSafety, GATE.NOT_EVALUATED);
    assert.equal(artifact.hardGates.G5_ProductionEvidence, GATE.NOT_AVAILABLE);
    assert.equal(artifact.hardGates.G12_Coverage, GATE.NOT_AVAILABLE);
    assert.equal(artifact.recommendation, 'NOT_READY');
  });
});
