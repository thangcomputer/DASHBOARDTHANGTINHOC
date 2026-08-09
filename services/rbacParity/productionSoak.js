/**
 * Phase 8.17 — Production soak orchestration helpers (NON-AUTHORITATIVE).
 *
 * Does NOT enable feature flags.
 * Does NOT promote Enterprise.
 * Does NOT generate fake production traffic.
 * Reuses soakEvidence snapshot/delta + existing metrics.
 */
const path = require('node:path');
const fs = require('node:fs');
const {
  snapshotSoakWindow,
  deltaSoakWindow,
  isSoakWindowActive,
  getSoakEvidenceSnapshot,
  EVIDENCE_CHANNEL,
} = require('./soakEvidence');
const { isRbacParityObserveEnabled } = require('./observe');
const { isRbacDualCheckEnabled } = require('./dualCheck');
const { getParityMetricsSnapshot } = require('./metrics');

const SOAK_ENV = Object.freeze({
  LOCAL: 'LOCAL',
  STAGING: 'STAGING',
  PRODUCTION: 'PRODUCTION',
});

const PRODUCTION_SOAK_EVIDENCE = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  INVALID: 'INVALID',
});

const PRODUCTION_SOAK_RESULT = Object.freeze({
  PASS: 'PASS',
  FINDINGS: 'FINDINGS',
  INACTIVE: 'INACTIVE',
  INVALID: 'INVALID',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
});

const MIN_SOAK_DURATION_SECONDS = 1;
/** Upper bound: 24h — reject infinite / absurd windows. */
const MAX_SOAK_DURATION_SECONDS = 86400;

const SAFE_MISMATCH_KEYS = Object.freeze([
  'permission',
  'family',
  'role',
  'liveDecision',
  'enterpriseDecision',
  'mismatchReason',
  'scope',
  'requestId',
  'correlationId',
  'action',
  'ownerClass',
  'branchClass',
  'knownLegacyMismatch',
  'mismatchClassification',
  'timestamp',
  'environment',
]);

/**
 * Explicit soak environment. Unset / unknown → LOCAL (not production-eligible).
 */
function resolveSoakEnvironment(env = process.env) {
  const raw = String(env.RBAC_SOAK_ENVIRONMENT ?? '').trim().toUpperCase();
  if (raw === SOAK_ENV.STAGING) return SOAK_ENV.STAGING;
  if (raw === SOAK_ENV.PRODUCTION) return SOAK_ENV.PRODUCTION;
  if (raw === SOAK_ENV.LOCAL) return SOAK_ENV.LOCAL;
  return SOAK_ENV.LOCAL;
}

function isProductionLikeEnvironment(environment) {
  return environment === SOAK_ENV.STAGING || environment === SOAK_ENV.PRODUCTION;
}

/**
 * All three flags must be explicitly ON. Missing any → inactive.
 * Does not enable flags.
 */
function getProductionSoakFlagState(env = process.env) {
  return {
    observe: isRbacParityObserveEnabled(env),
    dualCheck: isRbacDualCheckEnabled(env),
    soakWindow: isSoakWindowActive(env),
  };
}

function isProductionSoakActive(env = process.env) {
  const flags = getProductionSoakFlagState(env);
  const environment = resolveSoakEnvironment(env);
  return Boolean(
    flags.observe
    && flags.dualCheck
    && flags.soakWindow
    && isProductionLikeEnvironment(environment),
  );
}

/**
 * @returns {{ ok: true, seconds: number } | { ok: false, error: string }}
 */
function parseSoakDurationSeconds(env = process.env) {
  const raw = env.SOAK_DURATION_SECONDS;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return { ok: false, error: 'SOAK_DURATION_SECONDS is required' };
  }
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    return { ok: false, error: 'SOAK_DURATION_SECONDS must be a finite number' };
  }
  if (n <= 0) {
    return { ok: false, error: 'SOAK_DURATION_SECONDS must be > 0' };
  }
  if (n > MAX_SOAK_DURATION_SECONDS) {
    return {
      ok: false,
      error: `SOAK_DURATION_SECONDS exceeds max ${MAX_SOAK_DURATION_SECONDS}`,
    };
  }
  if (!Number.isInteger(n)) {
    return { ok: false, error: 'SOAK_DURATION_SECONDS must be an integer' };
  }
  return { ok: true, seconds: n };
}

function sanitizeMismatchSample(sample, environment) {
  if (!sample || typeof sample !== 'object') return null;
  const out = { environment: environment || null, timestamp: new Date().toISOString() };
  for (const k of SAFE_MISMATCH_KEYS) {
    if (sample[k] !== undefined && sample[k] !== null) out[k] = sample[k];
  }
  return out;
}

function buildCoverageReport({ delta, channels, staticNote } = {}) {
  const samples = delta?.newRuntimeMismatchSamples || [];
  const roles = new Set();
  const permissions = new Set();
  const scopes = new Set();
  for (const s of samples) {
    if (s?.role) roles.add(s.role);
    if (s?.permission) permissions.add(s.permission);
    if (s?.scope) scopes.add(s.scope);
  }
  return {
    note: (
      'RUNTIME coverage lists only dimensions observed during this soak window. '
      + 'STATIC/SYNTHETIC catalog tests are NOT production evidence.'
    ),
    channels: {
      STATIC: {
        countedAsProductionEvidence: false,
        note: staticNote || 'catalog parity only',
      },
      SYNTHETIC: {
        countedAsProductionEvidence: false,
        requests: channels?.SYNTHETIC?.requests ?? 0,
      },
      RUNTIME: {
        countedAsProductionEvidence: true,
        events: delta?.requests ?? 0,
        note: 'events may be observe+dual-check hooks, not unique HTTP requests',
      },
    },
    runtimeObserved: {
      roles: [...roles],
      permissions: [...permissions],
      scopes: [...scopes],
      mismatchSampleCount: samples.length,
    },
    dimensionsRequired: {
      canonicalRoles: 'RUNTIME_REQUIRED',
      legacyPrincipal: 'RUNTIME_REQUIRED',
      idAdmin: 'RUNTIME_REQUIRED',
      criticalPermissions: 'RUNTIME_REQUIRED',
      branchSame: 'RUNTIME_REQUIRED',
      branchCross: 'RUNTIME_REQUIRED',
      nullBranch: 'RUNTIME_REQUIRED',
      ownershipOwner: 'RUNTIME_REQUIRED',
      ownershipNonOwner: 'RUNTIME_REQUIRED',
      missingResource: 'RUNTIME_REQUIRED',
      negativePermissions: 'RUNTIME_REQUIRED',
      financeRevenue: 'RUNTIME_REQUIRED',
      financePaymentRefund: 'RUNTIME_REQUIRED',
      hr: 'RUNTIME_REQUIRED',
      teachers: 'RUNTIME_REQUIRED',
      studentTraining: 'RUNTIME_REQUIRED',
    },
  };
}

/**
 * Classify soak window outcomes. Never sets ENTERPRISE_PRIMARY_READY=YES.
 */
function classifyProductionSoak({
  environment,
  flags,
  delta,
  active,
  durationSeconds,
} = {}) {
  const errors = {
    observer: delta?.observer_errors || 0,
    dualCheck: delta?.dualcheck_errors || 0,
  };
  const runtimeEvents = delta?.requests || 0;
  const mismatch = delta?.mismatch || 0;

  if (!isProductionLikeEnvironment(environment)) {
    return {
      productionSoakActive: false,
      productionSoakEvidence: PRODUCTION_SOAK_EVIDENCE.INVALID,
      productionSoakResult: PRODUCTION_SOAK_RESULT.INVALID,
      reason: 'environment_not_production_like',
      enterprisePrimaryReady: false,
      errors,
      runtimeEvents,
      mismatch,
    };
  }

  if (!active) {
    return {
      productionSoakActive: false,
      productionSoakEvidence: PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE,
      productionSoakResult: PRODUCTION_SOAK_RESULT.INACTIVE,
      reason: 'flags_incomplete_or_inactive',
      flags,
      enterprisePrimaryReady: false,
      errors,
      runtimeEvents,
      mismatch,
    };
  }

  if (errors.observer > 0 || errors.dualCheck > 0) {
    return {
      productionSoakActive: true,
      productionSoakEvidence: PRODUCTION_SOAK_EVIDENCE.INVALID,
      productionSoakResult: PRODUCTION_SOAK_RESULT.INVALID,
      reason: 'instrumentation_errors',
      enterprisePrimaryReady: false,
      errors,
      runtimeEvents,
      mismatch,
    };
  }

  if (runtimeEvents <= 0) {
    return {
      productionSoakActive: true,
      productionSoakEvidence: PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE,
      productionSoakResult: PRODUCTION_SOAK_RESULT.NOT_AVAILABLE,
      reason: 'no_runtime_observations',
      note: 'Standalone orchestrator process has empty counters unless co-located with API traffic',
      enterprisePrimaryReady: false,
      errors,
      runtimeEvents,
      mismatch,
      durationSeconds,
    };
  }

  if (mismatch > 0) {
    return {
      productionSoakActive: true,
      productionSoakEvidence: PRODUCTION_SOAK_EVIDENCE.AVAILABLE,
      productionSoakResult: PRODUCTION_SOAK_RESULT.FINDINGS,
      reason: 'runtime_mismatch',
      enterprisePrimaryReady: false,
      errors,
      runtimeEvents,
      mismatch,
    };
  }

  return {
    productionSoakActive: true,
    productionSoakEvidence: PRODUCTION_SOAK_EVIDENCE.AVAILABLE,
    productionSoakResult: PRODUCTION_SOAK_RESULT.PASS,
    reason: 'runtime_clean',
    enterprisePrimaryReady: false,
    errors,
    runtimeEvents,
    mismatch,
  };
}

function buildProductionSoakArtifact({
  environment,
  startedAt,
  endedAt,
  durationSeconds,
  flags,
  before,
  after,
  delta,
  classification,
  channels,
} = {}) {
  const mismatches = (delta?.newRuntimeMismatchSamples || [])
    .map((s) => sanitizeMismatchSample(s, environment))
    .filter(Boolean);

  return {
    phase: '8.17',
    environment,
    startedAt,
    endedAt,
    durationSeconds,
    flags: {
      observe: Boolean(flags?.observe),
      dualCheck: Boolean(flags?.dualCheck),
      soakWindow: Boolean(flags?.soakWindow),
    },
    evidenceChannel: EVIDENCE_CHANNEL.RUNTIME,
    before: before || null,
    after: after || null,
    delta: delta || null,
    mismatches,
    mismatchReasons: delta?.mismatchReasons || {},
    errors: classification?.errors || {
      observer: delta?.observer_errors || 0,
      dualCheck: delta?.dualcheck_errors || 0,
    },
    coverage: buildCoverageReport({ delta, channels }),
    productionSoakActive: Boolean(classification?.productionSoakActive),
    productionSoakEvidence: classification?.productionSoakEvidence
      || PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE,
    productionSoakResult: classification?.productionSoakResult
      || PRODUCTION_SOAK_RESULT.NOT_AVAILABLE,
    classificationReason: classification?.reason || null,
    enterprisePrimaryReady: false,
    ENTERPRISE_PRIMARY_READY: 'NO',
    safety: {
      finalDecisionEqualsLiveDecision: true,
      enterpriseNotAuthoritative: true,
      flagsNotAutoEnabled: true,
      liveSemanticsUnchanged: true,
    },
    note: (
      'RUNTIME.requests/events may count observe+dual-check hooks per HTTP call. '
      + 'LOCAL harness artifacts are not production evidence.'
    ),
  };
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Orchestrate a controlled soak window over in-process soakEvidence counters.
 * Does not enable flags. Does not generate traffic. Does not promote Enterprise.
 */
async function runProductionSoakOrchestrator(opts = {}) {
  const env = opts.env || process.env;
  const environment = resolveSoakEnvironment(env);
  const flags = getProductionSoakFlagState(env);
  const active = isProductionSoakActive(env);
  const duration = parseSoakDurationSeconds(env);

  if (!duration.ok) {
    return {
      ok: false,
      exitCode: 1,
      error: duration.error,
      enterprisePrimaryReady: false,
      ENTERPRISE_PRIMARY_READY: 'NO',
    };
  }

  if (!isProductionLikeEnvironment(environment)) {
    const classification = classifyProductionSoak({
      environment,
      flags,
      delta: { requests: 0, mismatch: 0, observer_errors: 0, dualcheck_errors: 0 },
      active: false,
      durationSeconds: duration.seconds,
    });
    const artifact = buildProductionSoakArtifact({
      environment,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      durationSeconds: duration.seconds,
      flags,
      before: null,
      after: null,
      delta: null,
      classification,
      channels: getSoakEvidenceSnapshot().channels,
    });
    return {
      ok: false,
      exitCode: 3,
      artifact,
      classification,
      enterprisePrimaryReady: false,
      ENTERPRISE_PRIMARY_READY: 'NO',
      error: 'RBAC_SOAK_ENVIRONMENT must be STAGING or PRODUCTION',
    };
  }

  if (!flags.observe || !flags.dualCheck || !flags.soakWindow) {
    const classification = classifyProductionSoak({
      environment,
      flags,
      delta: { requests: 0, mismatch: 0, observer_errors: 0, dualcheck_errors: 0 },
      active: false,
      durationSeconds: duration.seconds,
    });
    const artifact = buildProductionSoakArtifact({
      environment,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      durationSeconds: duration.seconds,
      flags,
      before: null,
      after: null,
      delta: null,
      classification,
      channels: getSoakEvidenceSnapshot().channels,
    });
    return {
      ok: false,
      exitCode: 3,
      artifact,
      classification,
      enterprisePrimaryReady: false,
      ENTERPRISE_PRIMARY_READY: 'NO',
      error: 'Production soak requires OBSERVE + DUAL_CHECK + SOAK_WINDOW all enabled (not auto-set)',
    };
  }

  const snapshotFn = opts.snapshotFn || snapshotSoakWindow;
  const deltaFn = opts.deltaFn || deltaSoakWindow;
  const waitFn = opts.waitFn || ((sec) => sleep(sec * 1000));

  const startedAt = new Date().toISOString();
  const before = snapshotFn();
  await waitFn(duration.seconds);
  const after = snapshotFn();
  const endedAt = new Date().toISOString();
  const delta = deltaFn(before, after);
  const channels = getSoakEvidenceSnapshot().channels;

  const classification = classifyProductionSoak({
    environment,
    flags,
    delta,
    active,
    durationSeconds: duration.seconds,
  });

  const artifact = buildProductionSoakArtifact({
    environment,
    startedAt,
    endedAt,
    durationSeconds: duration.seconds,
    flags,
    before,
    after,
    delta,
    classification,
    channels,
  });

  artifact.enterprisePrimaryReady = false;
  artifact.ENTERPRISE_PRIMARY_READY = 'NO';

  const artifactPath = opts.artifactPath
    || path.join(__dirname, '../../artifacts/rbac-soak-production.json');

  if (opts.writeArtifact !== false) {
    fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
    fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
  }

  let exitCode = 0;
  if (classification.productionSoakEvidence === PRODUCTION_SOAK_EVIDENCE.INVALID) {
    exitCode = 3;
  } else if (classification.productionSoakEvidence === PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE) {
    exitCode = 3;
  } else if (classification.productionSoakResult === PRODUCTION_SOAK_RESULT.FINDINGS) {
    exitCode = 2;
  }

  return {
    ok: exitCode === 0,
    exitCode,
    artifact,
    artifactPath,
    classification,
    metrics: getParityMetricsSnapshot(),
    enterprisePrimaryReady: false,
    ENTERPRISE_PRIMARY_READY: 'NO',
  };
}

module.exports = {
  SOAK_ENV,
  PRODUCTION_SOAK_EVIDENCE,
  PRODUCTION_SOAK_RESULT,
  MIN_SOAK_DURATION_SECONDS,
  MAX_SOAK_DURATION_SECONDS,
  SAFE_MISMATCH_KEYS,
  resolveSoakEnvironment,
  isProductionLikeEnvironment,
  getProductionSoakFlagState,
  isProductionSoakActive,
  parseSoakDurationSeconds,
  sanitizeMismatchSample,
  buildCoverageReport,
  classifyProductionSoak,
  buildProductionSoakArtifact,
  runProductionSoakOrchestrator,
};
