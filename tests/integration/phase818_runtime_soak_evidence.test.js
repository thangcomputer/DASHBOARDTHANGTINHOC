/**
 * Phase 8.18 — RUNTIME soak evidence acceptance (no fake production traffic).
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  SOAK_ENV,
  PRODUCTION_SOAK_EVIDENCE,
  RUNTIME_COVERAGE,
  SAFETY,
  REQUIRED_LIVE_PERMISSIONS,
  evaluateRuntimeSoakEvidence,
  buildPhase818Artifact,
  writePhase818SessionArtifact,
  isCriticalPrivilegeWidening,
  isFinanceCriticalMismatch,
  isScopeWidening,
  isOwnershipWidening,
  classifyRuntimeCoverage,
  recordSoakObservation,
  resetSoakEvidenceForTests,
  EVIDENCE_CHANNEL,
  resolveRole,
  dualCheckLiveStaffGate,
} = require('../../services/rbacParity');
const { resolveEnterpriseRoleContract } = require('../../shared/constants/roleAliasContract');
const { PERMISSIONS: LIVE } = require('../../constants/permissions');
const map = require('../../shared/constants/legacyPermissionMapping');

function baseDelta(extra = {}) {
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

function stagingFlags(on = true) {
  return {
    observe: on,
    dualCheck: on,
    soakWindow: on,
  };
}

describe('Phase 8.18 runtime soak evidence gate', { concurrency: false }, () => {
  it('1 LOCAL → NOT_AVAILABLE', () => {
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.LOCAL,
      flags: stagingFlags(true),
      delta: baseDelta({ requests: 100, match: 100 }),
      productionRuntimeExecuted: true,
      minRuntimeEvents: 1,
    });
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.ok(e.blockers.includes('environment_not_staging_or_production'));
  });

  it('2 SYNTHETIC alone → NOT_AVAILABLE', () => {
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.STAGING,
      flags: stagingFlags(true),
      delta: baseDelta(),
      channels: { SYNTHETIC: { requests: 50 }, RUNTIME: { requests: 0 }, STATIC: { requests: 0 } },
      productionRuntimeExecuted: false,
      minRuntimeEvents: 1,
    });
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.ok(e.blockers.includes('static_or_synthetic_cannot_substitute_runtime'));
  });

  it('3 STATIC alone → NOT_AVAILABLE', () => {
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.PRODUCTION,
      flags: stagingFlags(true),
      delta: baseDelta(),
      channels: { STATIC: { requests: 12 }, RUNTIME: { requests: 0 }, SYNTHETIC: { requests: 0 } },
      productionRuntimeExecuted: false,
      minRuntimeEvents: 1,
    });
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.equal(e.coverage.channels.STATIC.countedAsProductionEvidence, false);
  });

  it('4 STAGING/PRODUCTION + no runtime → NOT_AVAILABLE', () => {
    for (const environment of [SOAK_ENV.STAGING, SOAK_ENV.PRODUCTION]) {
      const e = evaluateRuntimeSoakEvidence({
        environment,
        flags: stagingFlags(true),
        delta: baseDelta(),
        productionRuntimeExecuted: true,
        minRuntimeEvents: 10,
      });
      assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
      assert.equal(e.coverage.runtimeCoverage, RUNTIME_COVERAGE.NOT_AVAILABLE);
    }
  });

  it('5 real runtime observations → eligible (AVAILABLE when gates pass)', () => {
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.STAGING,
      flags: stagingFlags(true),
      delta: baseDelta({ requests: 20, match: 20 }),
      productionRuntimeExecuted: true,
      minRuntimeEvents: 10,
      observedRoles: [
        'SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF', 'SUPPORT_AGENT',
        'TEACHER', 'STUDENT', 'LEGACY_PRINCIPAL', 'legacy_root',
      ],
      observedPermissions: [...REQUIRED_LIVE_PERMISSIONS],
      observedScopes: ['same', 'cross'],
    });
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.AVAILABLE);
    assert.equal(e.status, 'PASS');
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('6 insufficient observations → NOT_AVAILABLE', () => {
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.PRODUCTION,
      flags: stagingFlags(true),
      delta: baseDelta({ requests: 3, match: 3 }),
      productionRuntimeExecuted: true,
      minRuntimeEvents: 10,
      observedRoles: ['SUPER_ADMIN'],
      observedPermissions: [LIVE.MANAGE_HR],
      observedScopes: ['same'],
    });
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.ok(e.blockers.some((b) => b.startsWith('insufficient_runtime_events_')));
  });

  it('7 observer error → NOT_AVAILABLE', () => {
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.STAGING,
      flags: stagingFlags(true),
      delta: baseDelta({ requests: 20, match: 20, observer_errors: 1 }),
      productionRuntimeExecuted: true,
      minRuntimeEvents: 10,
      observedRoles: [
        'SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF', 'SUPPORT_AGENT',
        'TEACHER', 'STUDENT', 'LEGACY_PRINCIPAL', 'legacy_root',
      ],
      observedPermissions: [...REQUIRED_LIVE_PERMISSIONS],
      observedScopes: ['same', 'cross'],
    });
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.equal(e.status, 'FAIL');
    assert.ok(e.blockers.includes('observer_errors'));
  });

  it('8 dual-check error → NOT_AVAILABLE', () => {
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.PRODUCTION,
      flags: stagingFlags(true),
      delta: baseDelta({ requests: 20, match: 20, dualcheck_errors: 2 }),
      productionRuntimeExecuted: true,
      minRuntimeEvents: 10,
      observedRoles: [
        'SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF', 'SUPPORT_AGENT',
        'TEACHER', 'STUDENT', 'LEGACY_PRINCIPAL', 'legacy_root',
      ],
      observedPermissions: [...REQUIRED_LIVE_PERMISSIONS],
      observedScopes: ['same', 'cross'],
    });
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.ok(e.blockers.includes('dualcheck_errors'));
  });

  it('9 critical mismatch → FAIL / NOT_AVAILABLE', () => {
    const sample = {
      permission: LIVE.MANAGE_HR,
      liveDecision: 'DENY',
      enterpriseDecision: 'ALLOW',
      mismatchReason: 'PERMISSION_MISMATCH',
      role: 'ADMIN_STAFF',
    };
    assert.equal(isCriticalPrivilegeWidening(sample), true);
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.STAGING,
      flags: stagingFlags(true),
      delta: baseDelta({
        requests: 20,
        match: 19,
        mismatch: 1,
        newRuntimeMismatchSamples: [sample],
      }),
      productionRuntimeExecuted: true,
      minRuntimeEvents: 10,
      observedRoles: [
        'SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF', 'SUPPORT_AGENT',
        'TEACHER', 'STUDENT', 'LEGACY_PRINCIPAL', 'legacy_root',
      ],
      observedPermissions: [...REQUIRED_LIVE_PERMISSIONS],
      observedScopes: ['same', 'cross'],
    });
    assert.equal(e.status, 'FAIL');
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.ok(e.criticalMismatchCount >= 1);
  });

  it('10 LIVE DENY → Enterprise ALLOW → CRITICAL', () => {
    assert.equal(isCriticalPrivilegeWidening({
      liveDecision: 'DENY', enterpriseDecision: 'ALLOW',
    }), true);
    assert.equal(isCriticalPrivilegeWidening({
      liveDecision: 'ALLOW', enterpriseDecision: 'DENY',
    }), false);
  });

  it('11 finalDecision invariant violation → FAIL', () => {
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.PRODUCTION,
      flags: stagingFlags(true),
      delta: baseDelta({ requests: 20, match: 20 }),
      productionRuntimeExecuted: true,
      finalDecisionInvariant: false,
      minRuntimeEvents: 10,
      observedRoles: [
        'SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF', 'SUPPORT_AGENT',
        'TEACHER', 'STUDENT', 'LEGACY_PRINCIPAL', 'legacy_root',
      ],
      observedPermissions: [...REQUIRED_LIVE_PERMISSIONS],
      observedScopes: ['same', 'cross'],
    });
    assert.equal(e.status, 'FAIL');
    assert.equal(e.finalDecisionInvariant, SAFETY.FAIL);
    assert.equal(e.enterprisePrimaryReady, false);
  });

  it('12 finance widening → FAIL', () => {
    const sample = {
      permission: LIVE.VIEW_BRANCH_REVENUE,
      liveDecision: 'DENY',
      enterpriseDecision: 'ALLOW',
      action: 'payment_create',
      mismatchReason: 'PERMISSION_MISMATCH',
    };
    assert.equal(isFinanceCriticalMismatch(sample), true);
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.STAGING,
      flags: stagingFlags(true),
      delta: baseDelta({
        requests: 20, match: 19, mismatch: 1, newRuntimeMismatchSamples: [sample],
      }),
      productionRuntimeExecuted: true,
      minRuntimeEvents: 10,
      observedRoles: [
        'SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF', 'SUPPORT_AGENT',
        'TEACHER', 'STUDENT', 'LEGACY_PRINCIPAL', 'legacy_root',
      ],
      observedPermissions: [...REQUIRED_LIVE_PERMISSIONS],
      observedScopes: ['same', 'cross'],
    });
    assert.equal(e.financeSafety.status, SAFETY.FAIL);
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
  });

  it('13 scope widening → FAIL', () => {
    const sample = {
      permission: LIVE.MANAGE_HR,
      liveDecision: 'DENY',
      enterpriseDecision: 'ALLOW',
      mismatchReason: 'SCOPE_MISMATCH',
      scope: 'cross_or_denied',
    };
    assert.equal(isScopeWidening(sample), true);
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.PRODUCTION,
      flags: stagingFlags(true),
      delta: baseDelta({
        requests: 20, match: 19, mismatch: 1, newRuntimeMismatchSamples: [sample],
      }),
      productionRuntimeExecuted: true,
      minRuntimeEvents: 10,
      observedRoles: [
        'SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF', 'SUPPORT_AGENT',
        'TEACHER', 'STUDENT', 'LEGACY_PRINCIPAL', 'legacy_root',
      ],
      observedPermissions: [...REQUIRED_LIVE_PERMISSIONS],
      observedScopes: ['same', 'cross'],
    });
    assert.ok(e.criticalMismatchCount >= 1);
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
  });

  it('14 ownership widening → FAIL', () => {
    const sample = {
      permission: LIVE.MANAGE_TEACHERS,
      liveDecision: 'DENY',
      enterpriseDecision: 'ALLOW',
      mismatchReason: 'OWNERSHIP_MISMATCH',
    };
    assert.equal(isOwnershipWidening(sample), true);
  });

  it('15 HR mapping manage_hr ↔ hr:manage', () => {
    assert.deepEqual(map.resolve('manage_hr'), ['hr:manage']);
  });

  it('16 teacher separation view vs manage', () => {
    assert.deepEqual(map.resolve('view_teachers'), ['teacher:view']);
    assert.deepEqual(map.resolve('manage_teachers'), ['teacher:manage']);
    assert.notDeepEqual(map.resolve('view_teachers'), map.resolve('manage_teachers'));
  });

  it('17 student-training separation from manage_training', () => {
    assert.deepEqual(map.resolve('manage_student_training'), ['student_training:manage']);
    assert.notDeepEqual(map.resolve('manage_student_training'), map.resolve('manage_training'));
  });

  it('18 LEGACY_PRINCIPAL intact', () => {
    const rr = resolveEnterpriseRoleContract({ jwtRole: 'admin', adminRole: null });
    assert.equal(rr.type, 'LEGACY_PRINCIPAL');
    assert.equal(rr.enterpriseRole, null);
  });

  it('19 id=admin LEGACY_ROOT', () => {
    const rr = resolveEnterpriseRoleContract({ userId: 'admin' });
    assert.equal(rr.type, 'LEGACY_ROOT');
    assert.equal(resolveRole({ id: 'admin', role: 'admin' }).type, 'LEGACY_ROOT');
  });

  it('20 static/synthetic cannot inflate runtime', () => {
    resetSoakEvidenceForTests();
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.STATIC, comparison: 'MATCH' });
    recordSoakObservation({ channel: EVIDENCE_CHANNEL.SYNTHETIC, comparison: 'MATCH' });
    const cov = classifyRuntimeCoverage({
      runtimeHookEvents: 0,
      samples: [],
    });
    assert.equal(cov.runtimeCoverage, RUNTIME_COVERAGE.NOT_AVAILABLE);
  });

  it('21 no auto-enable flags', () => {
    const prev = {
      o: process.env.RBAC_PARITY_OBSERVE_ENABLED,
      d: process.env.RBAC_DUAL_CHECK_ENABLED,
      s: process.env.RBAC_SOAK_WINDOW_ACTIVE,
    };
    delete process.env.RBAC_PARITY_OBSERVE_ENABLED;
    delete process.env.RBAC_DUAL_CHECK_ENABLED;
    delete process.env.RBAC_SOAK_WINDOW_ACTIVE;
    try {
      writePhase818SessionArtifact({
        artifactPath: path.join(__dirname, '../../artifacts/_tmp-818-test.json'),
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
      const tmp = path.join(__dirname, '../../artifacts/_tmp-818-test.json');
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    }
  });

  it('22 no Enterprise promotion', () => {
    const e = evaluateRuntimeSoakEvidence({
      environment: SOAK_ENV.PRODUCTION,
      flags: stagingFlags(true),
      delta: baseDelta({ requests: 50, match: 50 }),
      productionRuntimeExecuted: true,
      minRuntimeEvents: 10,
      observedRoles: [
        'SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF', 'SUPPORT_AGENT',
        'TEACHER', 'STUDENT', 'LEGACY_PRINCIPAL', 'legacy_root',
      ],
      observedPermissions: [...REQUIRED_LIVE_PERMISSIONS],
      observedScopes: ['same', 'cross'],
    });
    assert.equal(e.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.AVAILABLE);
    assert.equal(e.enterprisePrimaryReady, false);
    assert.equal(e.ENTERPRISE_PRIMARY_READY, 'NO');
  });

  it('23 production artifact schema + honest session write', () => {
    const { artifact } = writePhase818SessionArtifact({
      artifactPath: path.join(__dirname, '../../artifacts/rbac-soak-818.json'),
    });
    for (const k of [
      'phase', 'status', 'environment', 'startTime', 'endTime', 'duration',
      'runtimeHookEvents', 'uniqueCorrelationIds', 'match', 'mismatch',
      'unknown', 'unsupported', 'observerErrors', 'dualCheckErrors',
      'criticalMismatchCount', 'mismatchReasons', 'coverage',
      'financeSafety', 'hrSafety', 'teacherSafety', 'studentTrainingSafety',
      'legacyPrincipalSafety', 'finalDecisionInvariant',
      'productionSoakEvidence', 'enterprisePrimaryReady', 'blockers',
    ]) {
      assert.ok(Object.prototype.hasOwnProperty.call(artifact, k), `missing ${k}`);
    }
    assert.equal(artifact.phase, '8.18');
    assert.equal(artifact.productionSoakEvidence, PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE);
    assert.equal(artifact.productionRuntimeExecuted, false);
    assert.equal(artifact.ENTERPRISE_PRIMARY_READY, 'NO');
    const json = JSON.stringify(artifact);
    assert.ok(!json.includes('password'));
    assert.ok(!json.includes('"jwt"'));
  });

  it('24 coverage classification COMPLETE / PARTIAL / NOT_AVAILABLE', () => {
    assert.equal(classifyRuntimeCoverage({
      runtimeHookEvents: 0, samples: [],
    }).runtimeCoverage, RUNTIME_COVERAGE.NOT_AVAILABLE);

    assert.equal(classifyRuntimeCoverage({
      runtimeHookEvents: 5,
      samples: [{ role: 'SUPER_ADMIN', permission: LIVE.MANAGE_HR, scope: 'same' }],
    }).runtimeCoverage, RUNTIME_COVERAGE.PARTIAL);

    const complete = classifyRuntimeCoverage(
      { runtimeHookEvents: 40, samples: [] },
      {
        observedRoles: [
          'SUPER_ADMIN', 'HIGH_ADMIN', 'ADMIN_STAFF', 'SUPPORT_AGENT',
          'TEACHER', 'STUDENT', 'LEGACY_PRINCIPAL', 'legacy_root',
        ],
        observedPermissions: [...REQUIRED_LIVE_PERMISSIONS],
        observedScopes: ['same', 'cross'],
      },
    );
    assert.equal(complete.runtimeCoverage, RUNTIME_COVERAGE.COMPLETE);
  });

  it('25 finance revenue must not map to finance:view', () => {
    assert.deepEqual(map.resolve('view_branch_revenue'), ['finance:branch_revenue:view']);
    assert.ok(!map.resolve('view_branch_revenue').includes('finance:view'));
  });

  it('26 mismatch does not alter LIVE finalDecision', async () => {
    const prev = process.env.RBAC_DUAL_CHECK_ENABLED;
    process.env.RBAC_DUAL_CHECK_ENABLED = 'true';
    try {
      const out = dualCheckLiveStaffGate(
        { user: { id: 'u', role: 'staff', adminRole: 'STAFF', permissions: [] } },
        {
          liveDecision: 'ALLOW',
          livePermission: LIVE.MANAGE_HR,
          evidenceChannel: EVIDENCE_CHANNEL.SYNTHETIC,
        },
      );
      assert.equal(out.finalDecision, out.liveDecision);
    } finally {
      if (prev === undefined) delete process.env.RBAC_DUAL_CHECK_ENABLED;
      else process.env.RBAC_DUAL_CHECK_ENABLED = prev;
    }
  });
});
