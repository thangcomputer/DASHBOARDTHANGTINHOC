/**
 * Phase 8.18 — Controlled RUNTIME soak evidence acceptance gate.
 *
 * LIVE remains PRIMARY. Enterprise observe/dual-check only.
 * Does NOT enable flags. Does NOT promote Enterprise.
 * Does NOT invent RUNTIME observations or treat LOCAL/SYNTHETIC/STATIC as production.
 */
const fs = require('node:fs');
const path = require('node:path');
const { PERMISSIONS: LIVE } = require('../../constants/permissions');
const {
  SOAK_ENV,
  PRODUCTION_SOAK_EVIDENCE,
  resolveSoakEnvironment,
  isProductionLikeEnvironment,
  getProductionSoakFlagState,
  sanitizeMismatchSample,
} = require('./productionSoak');
const { EVIDENCE_CHANNEL } = require('./soakEvidence');

/** Default minimum RUNTIME hook events for AVAILABLE eligibility. */
const DEFAULT_MIN_RUNTIME_EVENTS = 10;

const RUNTIME_COVERAGE = Object.freeze({
  COMPLETE: 'COMPLETE',
  PARTIAL: 'PARTIAL',
  NOT_AVAILABLE: 'NOT_AVAILABLE',
});

const SAFETY = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  NOT_EVALUATED: 'NOT_EVALUATED',
});

const REQUIRED_ROLE_MARKERS = Object.freeze([
  'SUPER_ADMIN',
  'HIGH_ADMIN',
  'ADMIN_STAFF',
  'SUPPORT_AGENT',
  'TEACHER',
  'STUDENT',
  'LEGACY_PRINCIPAL',
  'LEGACY_ROOT',
  'legacy_root',
]);

const REQUIRED_LIVE_PERMISSIONS = Object.freeze([
  LIVE.MANAGE_HR,
  LIVE.VIEW_TEACHERS,
  LIVE.MANAGE_TEACHERS,
  LIVE.VIEW_BRANCH_REVENUE,
  LIVE.MANAGE_FINANCE,
  LIVE.MANAGE_STUDENT_TRAINING,
  LIVE.MANAGE_TRAINING,
  LIVE.MANAGE_STAFF,
]);

const FINANCE_MUTATE_ACTIONS = Object.freeze([
  'payment_create',
  'refund_approve',
  'ledger_void',
  'discount_mutate',
  'heal',
  'reconcile',
  'snapshot_sync',
  'invoice_mutate',
  'transaction_mutate',
]);

function parseMinRuntimeEvents(env = process.env) {
  const raw = env.RBAC_SOAK_MIN_RUNTIME_EVENTS;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return DEFAULT_MIN_RUNTIME_EVENTS;
  }
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MIN_RUNTIME_EVENTS;
  return Math.floor(n);
}

function isCriticalPrivilegeWidening(sample) {
  if (!sample) return false;
  return sample.liveDecision === 'DENY' && sample.enterpriseDecision === 'ALLOW';
}

function isFinanceCriticalMismatch(sample) {
  if (!sample) return false;
  const perm = String(sample.permission || '');
  const action = String(sample.action || '').toLowerCase();
  const reason = String(sample.mismatchReason || '');

  if (isCriticalPrivilegeWidening(sample)) {
    if (
      perm.includes('finance')
      || perm === LIVE.MANAGE_FINANCE
      || perm === LIVE.VIEW_BRANCH_REVENUE
      || FINANCE_MUTATE_ACTIONS.includes(action)
      || reason === 'SCOPE_MISMATCH'
      || reason === 'BUNDLE_MISMATCH'
    ) {
      return true;
    }
  }

  if (
    perm === LIVE.VIEW_BRANCH_REVENUE
    && sample.liveDecision === 'DENY'
    && sample.enterpriseDecision === 'ALLOW'
  ) {
    return true;
  }

  return false;
}

function isScopeWidening(sample) {
  return Boolean(
    sample
    && sample.liveDecision === 'DENY'
    && sample.enterpriseDecision === 'ALLOW'
    && (sample.mismatchReason === 'SCOPE_MISMATCH' || sample.scope === 'cross_or_denied'),
  );
}

function isOwnershipWidening(sample) {
  return Boolean(
    sample
    && sample.liveDecision === 'DENY'
    && sample.enterpriseDecision === 'ALLOW'
    && sample.mismatchReason === 'OWNERSHIP_MISMATCH',
  );
}

function countUniqueCorrelationIds(samples = []) {
  const ids = new Set();
  for (const s of samples) {
    const id = s?.correlationId || s?.requestId;
    if (id) ids.add(String(id));
  }
  return ids.size;
}

function collectRuntimeObservations(delta = {}, channels = {}) {
  const runtime = channels?.RUNTIME || {};
  const hookEvents = Number(delta?.requests ?? runtime.requests ?? 0);
  const samples = Array.isArray(delta?.newRuntimeMismatchSamples)
    ? delta.newRuntimeMismatchSamples
    : [];
  return {
    runtimeHookEvents: hookEvents,
    match: Number(delta?.match ?? runtime.match ?? 0),
    mismatch: Number(delta?.mismatch ?? runtime.mismatch ?? 0),
    unknown: Number(delta?.unknown ?? runtime.unknown ?? 0),
    unsupported: Number(delta?.unsupported ?? runtime.unsupported ?? 0),
    observerErrors: Number(delta?.observer_errors ?? 0),
    dualCheckErrors: Number(delta?.dualcheck_errors ?? 0),
    mismatchReasons: { ...(delta?.mismatchReasons || runtime.mismatchReasons || {}) },
    samples,
    uniqueCorrelationIds: countUniqueCorrelationIds(samples),
  };
}

function classifyRuntimeCoverage(observations, opts = {}) {
  const { runtimeHookEvents, samples } = observations;
  if (!runtimeHookEvents || runtimeHookEvents <= 0) {
    return {
      runtimeCoverage: RUNTIME_COVERAGE.NOT_AVAILABLE,
      observedRoles: [],
      observedPermissions: [],
      observedScopes: [],
      missingRoles: [...REQUIRED_ROLE_MARKERS],
      missingPermissions: [...REQUIRED_LIVE_PERMISSIONS],
      note: 'No RUNTIME observations',
    };
  }

  const roles = new Set();
  const permissions = new Set();
  const scopes = new Set();
  for (const s of samples) {
    if (s?.role) roles.add(String(s.role));
    if (s?.permission) {
      String(s.permission).split('|').forEach((p) => permissions.add(p));
    }
    if (s?.scope) scopes.add(String(s.scope));
  }

  for (const r of opts.observedRoles || []) roles.add(r);
  for (const p of opts.observedPermissions || []) permissions.add(p);
  for (const s of opts.observedScopes || []) scopes.add(s);

  const missingRoles = REQUIRED_ROLE_MARKERS.filter((r) => ![...roles].some(
    (o) => o === r || o.includes(r) || (r === 'LEGACY_ROOT' && o === 'legacy_root'),
  ));
  const missingPermissions = REQUIRED_LIVE_PERMISSIONS.filter((p) => !permissions.has(p));

  let runtimeCoverage = RUNTIME_COVERAGE.PARTIAL;
  if (missingRoles.length === 0 && missingPermissions.length === 0
    && scopes.has('same') && (scopes.has('cross') || scopes.has('cross_or_denied'))) {
    runtimeCoverage = RUNTIME_COVERAGE.COMPLETE;
  }

  return {
    runtimeCoverage,
    observedRoles: [...roles],
    observedPermissions: [...permissions],
    observedScopes: [...scopes],
    missingRoles,
    missingPermissions,
    note: 'Coverage from RUNTIME samples/metadata only; STATIC/SYNTHETIC excluded',
  };
}

function evaluateDomainSafety(samples, predicateFail) {
  const relevant = samples.filter((s) => predicateFail.relevant(s));
  if (relevant.length === 0) {
    return { status: SAFETY.NOT_EVALUATED, critical: 0, findings: [] };
  }
  const findings = relevant.filter((s) => predicateFail.fail(s));
  return {
    status: findings.length ? SAFETY.FAIL : SAFETY.PASS,
    critical: findings.length,
    findings: findings.map((s) => sanitizeMismatchSample(s)),
  };
}

function evaluateFinanceSafety(samples) {
  return evaluateDomainSafety(samples, {
    relevant: (s) => {
      const p = String(s.permission || '');
      return p === LIVE.VIEW_BRANCH_REVENUE || p === LIVE.MANAGE_FINANCE
        || p.includes('finance') || FINANCE_MUTATE_ACTIONS.includes(String(s.action || ''));
    },
    fail: (s) => isFinanceCriticalMismatch(s) || isCriticalPrivilegeWidening(s),
  });
}

function evaluateHrSafety(samples) {
  return evaluateDomainSafety(samples, {
    relevant: (s) => String(s.permission || '') === LIVE.MANAGE_HR
      || String(s.permission || '').includes('hr'),
    fail: (s) => isCriticalPrivilegeWidening(s),
  });
}

function evaluateTeacherSafety(samples) {
  return evaluateDomainSafety(samples, {
    relevant: (s) => {
      const p = String(s.permission || '');
      return p === LIVE.VIEW_TEACHERS || p === LIVE.MANAGE_TEACHERS || p.includes('teacher');
    },
    fail: (s) => isCriticalPrivilegeWidening(s),
  });
}

function evaluateStudentTrainingSafety(samples) {
  return evaluateDomainSafety(samples, {
    relevant: (s) => {
      const p = String(s.permission || '');
      return p === LIVE.MANAGE_STUDENT_TRAINING || p === LIVE.MANAGE_TRAINING
        || p.includes('student_training');
    },
    fail: (s) => isCriticalPrivilegeWidening(s),
  });
}

function evaluateLegacyPrincipalSafety(samples) {
  const relevant = samples.filter((s) => {
    const role = String(s.role || '');
    return role === 'LEGACY_PRINCIPAL' || role === 'admin_staff_identity'
      || s.mismatchClassification === 'LEGACY_COMPATIBILITY'
      || s.knownLegacyMismatch === 'KNOWN_LEGACY_MISMATCH';
  });
  const fail = relevant.filter((s) => isCriticalPrivilegeWidening(s));
  if (relevant.length === 0) {
    return { status: SAFETY.NOT_EVALUATED, critical: 0, findings: [] };
  }
  return {
    status: fail.length ? SAFETY.FAIL : SAFETY.PASS,
    critical: fail.length,
    findings: fail.map((s) => sanitizeMismatchSample(s)),
    note: 'LEGACY_COMPATIBILITY mismatches may remain; privilege widening is FAIL',
  };
}

/**
 * Phase 8.18 acceptance evaluation over a soak delta (RUNTIME only).
 */
function evaluateRuntimeSoakEvidence({
  environment,
  flags,
  delta,
  channels,
  finalDecisionInvariant = true,
  productionRuntimeExecuted = false,
  observedRoles,
  observedPermissions,
  observedScopes,
  minRuntimeEvents,
  env = process.env,
} = {}) {
  const blockers = [];
  const envName = environment || resolveSoakEnvironment(env);
  const flagState = flags || getProductionSoakFlagState(env);
  const active = isProductionLikeEnvironment(envName)
    && flagState.observe && flagState.dualCheck && flagState.soakWindow;
  const minEvents = minRuntimeEvents ?? parseMinRuntimeEvents(env);

  const staticReqs = channels?.STATIC?.requests || 0;
  const syntheticReqs = channels?.SYNTHETIC?.requests || 0;

  if (!isProductionLikeEnvironment(envName)) {
    blockers.push('environment_not_staging_or_production');
  }
  if (!productionRuntimeExecuted) {
    blockers.push('production_runtime_not_executed');
  }
  if (!flagState.observe) blockers.push('observe_flag_off');
  if (!flagState.dualCheck) blockers.push('dual_check_flag_off');
  if (!flagState.soakWindow) blockers.push('soak_window_flag_off');

  const obs = collectRuntimeObservations(delta, channels);
  const coverage = classifyRuntimeCoverage(obs, {
    observedRoles,
    observedPermissions,
    observedScopes,
  });

  if (!productionRuntimeExecuted || obs.runtimeHookEvents <= 0) {
    if (staticReqs > 0 || syntheticReqs > 0) {
      blockers.push('static_or_synthetic_cannot_substitute_runtime');
    }
  }

  const criticalSamples = (obs.samples || []).filter(
    (s) => isCriticalPrivilegeWidening(s)
      || isFinanceCriticalMismatch(s)
      || isScopeWidening(s)
      || isOwnershipWidening(s),
  );

  const financeSafety = evaluateFinanceSafety(obs.samples);
  const hrSafety = evaluateHrSafety(obs.samples);
  const teacherSafety = evaluateTeacherSafety(obs.samples);
  const studentTrainingSafety = evaluateStudentTrainingSafety(obs.samples);
  const legacyPrincipalSafety = evaluateLegacyPrincipalSafety(obs.samples);

  const finalDecisionInvariantStatus = finalDecisionInvariant ? SAFETY.PASS : SAFETY.FAIL;
  if (!finalDecisionInvariant) {
    blockers.push('finalDecision_invariant_violated');
  }

  if (obs.observerErrors > 0) blockers.push('observer_errors');
  if (obs.dualCheckErrors > 0) blockers.push('dualcheck_errors');
  if (obs.runtimeHookEvents < minEvents) {
    blockers.push(`insufficient_runtime_events_${obs.runtimeHookEvents}_lt_${minEvents}`);
  }
  if (criticalSamples.length > 0) blockers.push('critical_privilege_widening');
  if (financeSafety.status === SAFETY.FAIL) blockers.push('finance_safety_fail');
  if (hrSafety.status === SAFETY.FAIL) blockers.push('hr_safety_fail');
  if (teacherSafety.status === SAFETY.FAIL) blockers.push('teacher_safety_fail');
  if (studentTrainingSafety.status === SAFETY.FAIL) blockers.push('student_training_safety_fail');
  if (legacyPrincipalSafety.status === SAFETY.FAIL) blockers.push('legacy_principal_safety_fail');
  if (coverage.runtimeCoverage === RUNTIME_COVERAGE.NOT_AVAILABLE) {
    blockers.push('runtime_coverage_not_available');
  }

  let productionSoakEvidence = PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE;
  let status = 'BLOCKED';

  const hardFail = !finalDecisionInvariant
    || criticalSamples.length > 0
    || financeSafety.status === SAFETY.FAIL
    || obs.observerErrors > 0
    || obs.dualCheckErrors > 0;

  if (hardFail && productionRuntimeExecuted && isProductionLikeEnvironment(envName)) {
    status = 'FAIL';
    productionSoakEvidence = PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE;
  } else if (
    productionRuntimeExecuted
    && active
    && obs.runtimeHookEvents >= minEvents
    && obs.observerErrors === 0
    && obs.dualCheckErrors === 0
    && criticalSamples.length === 0
    && finalDecisionInvariant
    && financeSafety.status !== SAFETY.FAIL
    && hrSafety.status !== SAFETY.FAIL
    && teacherSafety.status !== SAFETY.FAIL
    && studentTrainingSafety.status !== SAFETY.FAIL
    && legacyPrincipalSafety.status !== SAFETY.FAIL
    && coverage.runtimeCoverage !== RUNTIME_COVERAGE.NOT_AVAILABLE
  ) {
    productionSoakEvidence = PRODUCTION_SOAK_EVIDENCE.AVAILABLE;
    status = obs.mismatch > 0 ? 'FINDINGS' : 'PASS';
  } else {
    status = 'BLOCKED';
    productionSoakEvidence = PRODUCTION_SOAK_EVIDENCE.NOT_AVAILABLE;
  }

  return {
    phase: '8.18',
    status,
    environment: envName,
    flags: flagState,
    productionRuntimeExecuted: Boolean(productionRuntimeExecuted),
    productionSoakActive: Boolean(active),
    productionSoakEvidence,
    enterprisePrimaryReady: false,
    ENTERPRISE_PRIMARY_READY: 'NO',
    runtimeHookEvents: obs.runtimeHookEvents,
    uniqueCorrelationIds: obs.uniqueCorrelationIds,
    match: obs.match,
    mismatch: obs.mismatch,
    unknown: obs.unknown,
    unsupported: obs.unsupported,
    observerErrors: obs.observerErrors,
    dualCheckErrors: obs.dualCheckErrors,
    criticalMismatchCount: criticalSamples.length,
    mismatchReasons: obs.mismatchReasons,
    coverage: {
      runtimeCoverage: coverage.runtimeCoverage,
      observedRoles: coverage.observedRoles,
      observedPermissions: coverage.observedPermissions,
      observedScopes: coverage.observedScopes,
      missingRoles: coverage.missingRoles,
      missingPermissions: coverage.missingPermissions,
      note: coverage.note,
      channels: {
        STATIC: { countedAsProductionEvidence: false, requests: staticReqs },
        SYNTHETIC: { countedAsProductionEvidence: false, requests: syntheticReqs },
        RUNTIME: {
          countedAsProductionEvidence: true,
          hookEvents: obs.runtimeHookEvents,
          note: 'hook events may be observe+dual-check; not unique HTTP',
        },
      },
    },
    financeSafety,
    hrSafety,
    teacherSafety,
    studentTrainingSafety,
    legacyPrincipalSafety,
    finalDecisionInvariant: finalDecisionInvariantStatus,
    minRuntimeEvents: minEvents,
    blockers,
    evidenceChannel: EVIDENCE_CHANNEL.RUNTIME,
    safety: {
      finalDecisionEqualsLiveDecision: Boolean(finalDecisionInvariant),
      enterpriseNotAuthoritative: true,
      flagsNotAutoEnabled: true,
      liveSemanticsUnchanged: true,
    },
  };
}

function buildPhase818Artifact(evaluation, meta = {}) {
  return {
    phase: '8.18',
    status: evaluation.status,
    environment: evaluation.environment,
    startTime: meta.startTime || null,
    endTime: meta.endTime || null,
    duration: meta.duration ?? null,
    runtimeHookEvents: evaluation.runtimeHookEvents,
    uniqueCorrelationIds: evaluation.uniqueCorrelationIds,
    match: evaluation.match,
    mismatch: evaluation.mismatch,
    unknown: evaluation.unknown,
    unsupported: evaluation.unsupported,
    observerErrors: evaluation.observerErrors,
    dualCheckErrors: evaluation.dualCheckErrors,
    criticalMismatchCount: evaluation.criticalMismatchCount,
    mismatchReasons: evaluation.mismatchReasons,
    coverage: evaluation.coverage,
    financeSafety: {
      status: evaluation.financeSafety.status,
      critical: evaluation.financeSafety.critical,
    },
    hrSafety: { status: evaluation.hrSafety.status, critical: evaluation.hrSafety.critical },
    teacherSafety: {
      status: evaluation.teacherSafety.status,
      critical: evaluation.teacherSafety.critical,
    },
    studentTrainingSafety: {
      status: evaluation.studentTrainingSafety.status,
      critical: evaluation.studentTrainingSafety.critical,
    },
    legacyPrincipalSafety: {
      status: evaluation.legacyPrincipalSafety.status,
      critical: evaluation.legacyPrincipalSafety.critical,
    },
    finalDecisionInvariant: evaluation.finalDecisionInvariant,
    productionSoakEvidence: evaluation.productionSoakEvidence,
    productionRuntimeExecuted: evaluation.productionRuntimeExecuted,
    enterprisePrimaryReady: false,
    ENTERPRISE_PRIMARY_READY: 'NO',
    blockers: evaluation.blockers,
    flags: evaluation.flags,
    note: (
      'Phase 8.18: LOCAL/SYNTHETIC/STATIC are never production evidence. '
      + 'AVAILABLE requires explicit STAGING/PRODUCTION runtime soak.'
    ),
  };
}

/**
 * Write honest Phase 8.18 artifact for the current Cursor/local session.
 * Never invents RUNTIME production traffic.
 */
function writePhase818SessionArtifact(opts = {}) {
  const env = opts.env || process.env;
  const evaluation = evaluateRuntimeSoakEvidence({
    environment: resolveSoakEnvironment(env),
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
    channels: opts.channels || {
      STATIC: { requests: 0 },
      SYNTHETIC: { requests: 0 },
      RUNTIME: { requests: 0 },
    },
    finalDecisionInvariant: true,
    productionRuntimeExecuted: false,
    env,
  });

  const artifact = buildPhase818Artifact(evaluation, {
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    duration: 0,
  });

  const artifactPath = opts.artifactPath
    || path.join(__dirname, '../../artifacts/rbac-soak-818.json');
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), 'utf8');
  return { artifact, artifactPath, evaluation };
}

module.exports = {
  DEFAULT_MIN_RUNTIME_EVENTS,
  RUNTIME_COVERAGE,
  SAFETY,
  REQUIRED_ROLE_MARKERS,
  REQUIRED_LIVE_PERMISSIONS,
  FINANCE_MUTATE_ACTIONS,
  parseMinRuntimeEvents,
  isCriticalPrivilegeWidening,
  isFinanceCriticalMismatch,
  isScopeWidening,
  isOwnershipWidening,
  countUniqueCorrelationIds,
  collectRuntimeObservations,
  classifyRuntimeCoverage,
  evaluateFinanceSafety,
  evaluateHrSafety,
  evaluateTeacherSafety,
  evaluateStudentTrainingSafety,
  evaluateLegacyPrincipalSafety,
  evaluateRuntimeSoakEvidence,
  buildPhase818Artifact,
  writePhase818SessionArtifact,
  PRODUCTION_SOAK_EVIDENCE,
  SOAK_ENV,
};
