/**
 * Phase 8.17 — Production soak orchestrator (LIVE PRIMARY).
 *
 * Does NOT enable RBAC flags.
 * Does NOT promote Enterprise.
 * Does NOT generate synthetic/local harness traffic as production evidence.
 * Does NOT hardcode secrets/credentials.
 *
 * Ops must already set (explicitly):
 *   RBAC_SOAK_ENVIRONMENT=STAGING|PRODUCTION
 *   RBAC_PARITY_OBSERVE_ENABLED=true
 *   RBAC_DUAL_CHECK_ENABLED=true
 *   RBAC_SOAK_WINDOW_ACTIVE=true
 *   SOAK_DURATION_SECONDS=<1..86400>
 *
 * Then run (preferably co-located with API process traffic / shared counters):
 *   node scripts/rbac-soak-production.cjs
 *
 * Exit codes:
 *   0 = PASS (AVAILABLE + mismatch 0)
 *   2 = FINDINGS (AVAILABLE + mismatch > 0)
 *   3 = NOT_AVAILABLE / INVALID / inactive
 *   1 = configuration error (e.g. invalid duration)
 */
const {
  runProductionSoakOrchestrator,
} = require('../services/rbacParity/productionSoak');

async function main() {
  const result = await runProductionSoakOrchestrator({
    writeArtifact: true,
  });

  // eslint-disable-next-line no-console
  console.log(JSON.stringify({
    ok: result.ok,
    exitCode: result.exitCode,
    error: result.error || null,
    artifactPath: result.artifactPath || null,
    productionSoakEvidence: result.artifact?.productionSoakEvidence || null,
    productionSoakResult: result.artifact?.productionSoakResult || null,
    environment: result.artifact?.environment || null,
    durationSeconds: result.artifact?.durationSeconds || null,
    flags: result.artifact?.flags || null,
    delta: result.artifact?.delta ? {
      requests: result.artifact.delta.requests,
      match: result.artifact.delta.match,
      mismatch: result.artifact.delta.mismatch,
      unknown: result.artifact.delta.unknown,
      unsupported: result.artifact.delta.unsupported,
      observer_errors: result.artifact.delta.observer_errors,
      dualcheck_errors: result.artifact.delta.dualcheck_errors,
      mismatchReasons: result.artifact.delta.mismatchReasons,
    } : null,
    ENTERPRISE_PRIMARY_READY: 'NO',
    note: (
      'Counters are in-process. Standalone runs without API traffic yield NOT_AVAILABLE. '
      + 'LOCAL harness scripts remain non-production.'
    ),
  }, null, 2));

  process.exit(result.exitCode);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err?.message || String(err));
  process.exit(1);
});
