/**
 * Phase 8.20 — Controlled RUNTIME evidence collection pipeline (NON-AUTHORITATIVE).
 *
 * Does NOT enable feature flags.
 * Does NOT promote Enterprise.
 * Does NOT invent RUNTIME observations.
 * Does NOT mutate LIVE auth / Policy / CutoverGate / DB.
 * LOCAL / TEST / SYNTHETIC / STATIC never become production evidence.
 */
const fs = require('node:fs');
const path = require('node:path');
const {
  SOAK_ENV,
  PRODUCTION_SOAK_EVIDENCE,
  getProductionSoakFlagState,
  sanitizeMismatchSample,
} = require('./productionSoak');
const {
  RUNTIME_COVERAGE,
  SAFETY,
  classifyRuntimeCoverage,
  collectRuntimeObservations,
  countUniqueCorrelationIds,
  isCriticalPrivilegeWidening,
} = require('./runtimeSoakEvidence');
const {
  evaluateDomainSafetyEvidence,
  classifyMismatchSeverity,
  MISMATCH_SEVERITY,
} = require('./finalReadiness');
const {
  EVIDENCE_CHANNEL,
  snapshotSoakWindow,
  deltaSoakWindow,
  isSoakWindowActive,
  getSoakEvidenceSnapshot,
} = require('./soakEvidence');
const { isRbacParityObserveEnabled } = require('./observe');
const { isRbacDualCheckEnabled } = require('./dualCheck');

const REJECTED_ENVIRONMENTS = Object.freeze([
  'LOCAL',
  'TEST',
  'DEVELOPMENT',
  'DEV',
  'SYNTHETIC',
  'UNKNOWN',
  'NONE',
  '',
]);

const DEFAULT_820_ARTIFACT = path.join(
  __dirname,
  '../../artifacts/rbac-runtime-evidence-820.json',
);

function resolveEvidenceEnvironment(env = process.env) {
  const raw = String(env.RBAC_SOAK_ENVIRONMENT ?? '').trim().toUpperCase();
  if (raw === SOAK_ENV.STAGING) return SOAK_ENV.STAGING;
  if (raw === SOAK_ENV.PRODUCTION) return SOAK_ENV.PRODUCTION;
  if (raw === SOAK_ENV.LOCAL) return SOAK_ENV.LOCAL;
  if (!raw) return 'UNKNOWN';
  if (REJECTED_ENVIRONMENTS.includes(raw)) return raw;
  return 'UNKNOWN';
}

function isEvidenceEnvironmentAccepted(environment) {
  return environment === SOAK_ENV.STAGING || environment === SOAK_ENV.PRODUCTION;
}

/**
 * Deduplicate correlation/request IDs. Never invent IDs.
 * @returns {{ uniqueRuntimeRequests: number|'UNKNOWN', ids: string[] }}
 */
function accountUniqueRuntimeRequests(samples = []) {
  const ids = [];
  let anyId = false;
  for (const s of samples || []) {
    const id = s?.correlationId || s?.requestId;
    if (id) {
      anyId = true;
      ids.push(String(id));
    }
  }
  if (!anyId) {
    return { uniqueRuntimeRequests: 'UNKNOWN', ids: [] };
  }
  return { uniqueRuntimeRequests: [...new Set(ids)].length, ids: [...new Set(ids)] };
}

function validateCollectionPreconditions(env = process.env) {
  const environment = resolveEvidenceEnvironment(env);
  const flags = getProductionSoakFlagState(env);
  const blockers = [];

  if (!isEvidenceEnvironmentAccepted(environment)) {
    blockers.push(`environment_rejected_${environment || 'UNKNOWN'}`);
  }
  if (!flags.observe) blockers.push('observe_flag_off');
  if (!flags.dualCheck) blockers.push('dual_check_flag_off');
  if (!flags.soakWindow) blockers.push('soak_window_flag_off');

  return {
    environment,
    flags,
    soakWindowActive: Boolean(flags.soakWindow && isSoakWindowActive(env)),
    accepted: blockers.length === 0,
    blockers,
  };
}

/**
 * Evaluate a soak-window delta as Phase 8.20 RUNTIME evidence.
 * Never marks AVAILABLE with zero RUNTIME events.
 */
function evaluateRuntimeEvidenceCollection(opts = {}) {
  const env = opts.env || process.env;
  const envName = opts.environment || resolveEvidenceEnvironment(env);
  const flagState = opts.flags || getProductionSoakFlagState(env);
  const blockers = [];

  if (!isEvidenceEnvironmentAccepted(envName)) {
    blockers.push(`environment_rejected_${envName || 'UNKNOWN'}`);
  }
  if (!flagState.observe) blockers.push('observe_flag_off');
  if (!flagState.dualCheck) blockers.push('dual_check_flag_off');
  if (!flagState.soakWindow) blockers.push('soak_window_flag_off');

  const channels = opts.channels || {};
  const staticReqs = channels?.STATIC?.requests || 0;
  const syntheticReqs = channels?.SYNTHETIC?.requests || 0;

  const obs = collectRuntimeObservations(opts.delta || {}, channels);
  const hookEvents = obs.runtimeHookEvents;
  const mismatchSamples = Array.isArray(opts.samples)
    ? opts.samples
    : (opts.delta?.newRuntimeMismatchSamples || []);

  const unique = accountUniqueRuntimeRequests(mismatchSamples);
  const uniqueCountFallback = countUniqueCorrelationIds(mismatchSamples);

  const coverage = classifyRuntimeCoverage(
    { runtimeHookEvents: hookEvents, samples: mismatchSamples },
    {
      observedRoles: opts.observedRoles,
      observedPermissions: opts.observedPermissions,
      observedScopes: opts.observedScopes,
    },
  );

  const envOk = isEvidenceEnvironmentAccepted(envName);
  const flagsOk = flagState.observe && flagState.dualCheck && flagState.soakWindow;
  const channelOk = hookEvents > 0;

  if (staticReqs > 0 && hookEvents <= 0) blockers.push('static_cannot_inflate_runtime');
  if (syntheticReqs > 0 && hookEvents <= 0) blockers.push('synthetic_cannot_inflate_runtime');
  if (!channelOk) blockers.push('zero_runtime_events');

  let productionEvidence = PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE;
  let evidenceChannel = 'NONE';
  if (envOk && flagsOk && channelOk) {
    evidenceChannel = EVIDENCE_CHANNEL.RUNTIME;
    productionEvidence = PRODUCTION_SOAK_EVIDENCE.AVAILABLE;
  }

  let runtimeCoverage = coverage.runtimeCoverage;
  if (productionEvidence !== PRODUCTION_SOAK_EVIDENCE.AVAILABLE) {
    runtimeCoverage = RUNTIME_COVERAGE.NOT_AVAILABLE;
  }

  const domains = evaluateDomainSafetyEvidence({
    productionLike: envOk,
    productionRuntimeExecuted: productionEvidence === PRODUCTION_SOAK_EVIDENCE.AVAILABLE,
    runtimeEvents: hookEvents,
    productionSoakEvidence: productionEvidence,
    financeSafety: opts.domainSafety?.finance,
    hrSafety: opts.domainSafety?.hr,
    teacherSafety: opts.domainSafety?.teacher,
    studentTrainingSafety: opts.domainSafety?.studentTraining,
    legacyPrincipalSafety: opts.domainSafety?.legacyPrincipal,
  });

  const domainSafety = {
    finance: opts.domainSafety?.finance || domains.finance,
    hr: opts.domainSafety?.hr || domains.hr,
    teacher: opts.domainSafety?.teacher || domains.teacher,
    studentTraining: opts.domainSafety?.studentTraining || domains.studentTraining,
    legacyPrincipal: opts.domainSafety?.legacyPrincipal || domains.legacyPrincipal,
  };

  const criticalSamples = mismatchSamples.filter(
    (s) => isCriticalPrivilegeWidening(s)
      || classifyMismatchSeverity(s) === MISMATCH_SEVERITY.CRITICAL,
  );
  const criticalMismatchCount = opts.criticalMismatchCount !== undefined
    ? opts.criticalMismatchCount
    : criticalSamples.length;
  const privilegeWidening = criticalMismatchCount > 0
    || Object.values(domainSafety).some((s) => s === SAFETY.FAIL);

  if (criticalMismatchCount > 0) blockers.push('critical_mismatches');
  if (privilegeWidening) blockers.push('privilege_widening');
  if (obs.observerErrors > 0) blockers.push('observer_errors');
  if (obs.dualCheckErrors > 0) blockers.push('dualcheck_errors');

  const finalDecisionInvariant = opts.finalDecisionInvariant !== false;
  if (!finalDecisionInvariant) blockers.push('finalDecision_invariant_fail');

  let uniqueRuntimeRequests = unique.uniqueRuntimeRequests;
  if (uniqueRuntimeRequests === 'UNKNOWN' && uniqueCountFallback > 0) {
    uniqueRuntimeRequests = uniqueCountFallback;
  }

  return {
    phase: '8.20',
    environment: envName,
    productionEvidence,
    evidenceChannel,
    hookEvents,
    uniqueRuntimeRequests,
    match: obs.match,
    mismatch: obs.mismatch,
    unknown: obs.unknown,
    unsupported: obs.unsupported,
    observerErrors: obs.observerErrors,
    dualCheckErrors: obs.dualCheckErrors,
    criticalMismatchCount,
    runtimeCoverage,
    coverageDetails: coverage,
    domainSafety,
    roleSafety: SAFETY.PASS,
    legacyPrincipalSafety: domainSafety.legacyPrincipal,
    privilegeWidening: privilegeWidening
      ? SAFETY.FAIL
      : (productionEvidence === PRODUCTION_SOAK_EVIDENCE.AVAILABLE
        ? SAFETY.PASS
        : SAFETY.NOT_EVALUATED),
    finalDecisionInvariant: finalDecisionInvariant ? SAFETY.PASS : SAFETY.FAIL,
    flags: flagState,
    soakWindowActive: Boolean(flagState.soakWindow),
    mismatches: criticalSamples.map((s) => sanitizeMismatchSample(s, envName)).filter(Boolean),
    blockers: [...new Set(blockers)],
    enterprisePrimaryReady: false,
    ENTERPRISE_PRIMARY_READY: 'NO',
    safety: {
      liveRemainsPrimary: true,
      enterpriseIsShadowOnly: true,
      flagsNotAutoEnabled: true,
      authorizeNotMounted: true,
      noDbMutation: true,
      noPermissionMutation: true,
      hookEventsNotUniqueRequests: true,
    },
    note: (
      'hookEvents may count observe+dual-check hooks per HTTP call. '
      + 'uniqueRuntimeRequests uses correlation/request IDs only — never invented. '
      + 'ENTERPRISE_PRIMARY_READY remains NO in Phase 8.20.'
    ),
  };
}

function buildRuntimeEvidence820Artifact(evaluation, meta = {}) {
  return {
    phase: '8.20',
    environment: evaluation.environment,
    soakWindow: meta.soakWindow || null,
    productionEvidence: evaluation.productionEvidence,
    evidenceChannel: evaluation.evidenceChannel,
    hookEvents: evaluation.hookEvents,
    uniqueRuntimeRequests: evaluation.uniqueRuntimeRequests,
    match: evaluation.match,
    mismatch: evaluation.mismatch,
    unknown: evaluation.unknown,
    unsupported: evaluation.unsupported,
    observerErrors: evaluation.observerErrors,
    dualCheckErrors: evaluation.dualCheckErrors,
    criticalMismatchCount: evaluation.criticalMismatchCount,
    runtimeCoverage: evaluation.runtimeCoverage,
    domainSafety: evaluation.domainSafety,
    roleSafety: evaluation.roleSafety,
    legacyPrincipalSafety: evaluation.legacyPrincipalSafety,
    privilegeWidening: evaluation.privilegeWidening,
    finalDecisionInvariant: evaluation.finalDecisionInvariant,
    blockers: evaluation.blockers,
    enterprisePrimaryReady: false,
    ENTERPRISE_PRIMARY_READY: 'NO',
    flags: evaluation.flags,
    safety: evaluation.safety,
    note: evaluation.note,
    timestamp: meta.timestamp || new Date().toISOString(),
  };
}

function writeRuntimeEvidence820SessionArtifact(opts = {}) {
  const env = opts.env || process.env;
  const evaluation = evaluateRuntimeEvidenceCollection({
    env,
    environment: resolveEvidenceEnvironment(env),
    flags: getProductionSoakFlagState(env),
    delta: opts.delta || {
      requests: 0,
      match: 0,
      mismatch: 0,
      unknown: 0,
      unsupported: 0,
      observer_errors: 0,
      dualcheck_errors: 0,
      mismatchReasons: {},
      newRuntimeMismatchSamples: [],
    },
    channels: opts.channels || getSoakEvidenceSnapshot().channels,
    samples: opts.samples,
    domainSafety: opts.domainSafety,
    finalDecisionInvariant: opts.finalDecisionInvariant !== false,
    criticalMismatchCount: opts.criticalMismatchCount,
  });

  if (evaluation.hookEvents <= 0) {
    evaluation.productionEvidence = PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE;
    evaluation.evidenceChannel = 'NONE';
    evaluation.runtimeCoverage = RUNTIME_COVERAGE.NOT_AVAILABLE;
  }

  evaluation.enterprisePrimaryReady = false;
  evaluation.ENTERPRISE_PRIMARY_READY = 'NO';

  const artifact = buildRuntimeEvidence820Artifact(evaluation, {
    soakWindow: opts.soakWindow || null,
    timestamp: new Date().toISOString(),
  });

  const artifactPath = opts.artifactPath || DEFAULT_820_ARTIFACT;
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
  return { artifact, artifactPath, evaluation };
}

module.exports = {
  REJECTED_ENVIRONMENTS,
  DEFAULT_820_ARTIFACT,
  resolveEvidenceEnvironment,
  isEvidenceEnvironmentAccepted,
  accountUniqueRuntimeRequests,
  validateCollectionPreconditions,
  evaluateRuntimeEvidenceCollection,
  buildRuntimeEvidence820Artifact,
  writeRuntimeEvidence820SessionArtifact,
  snapshotSoakWindow,
  deltaSoakWindow,
  PRODUCTION_SOAK_EVIDENCE,
  RUNTIME_COVERAGE,
  SAFETY,
  EVIDENCE_CHANNEL,
  isRbacParityObserveEnabled,
  isRbacDualCheckEnabled,
};
