/**
 * Phase 8.20C — Export LIVE RUNTIME evidence from the application process (READ-ONLY).
 *
 * Does NOT authorize.
 * Does NOT promote Enterprise.
 * Does NOT mutate LIVE auth / Policy / CutoverGate / DB / permissions.
 * Does NOT invent RUNTIME counters.
 * Reuses soakEvidence snapshot/delta + Phase 8.20 evaluation.
 */
const {
  snapshotSoakWindow,
  deltaSoakWindow,
  getSoakEvidenceSnapshot,
  EVIDENCE_CHANNEL,
  isSoakWindowActive,
} = require('./soakEvidence');
const { getParityMetricsSnapshot } = require('./metrics');
const {
  PRODUCTION_SOAK_EVIDENCE,
  getProductionSoakFlagState,
  sanitizeMismatchSample,
} = require('./productionSoak');
const {
  evaluateRuntimeEvidenceCollection,
  resolveEvidenceEnvironment,
} = require('./runtimeEvidence820');

/** Alias — reuse existing soak snapshot (same process memory). */
function snapshotRuntimeEvidence() {
  return snapshotSoakWindow();
}

/** Alias — reuse existing soak delta. */
function deltaRuntimeEvidence(before, after) {
  return deltaSoakWindow(before, after);
}

function emptySoakBaseline() {
  return {
    at: null,
    runtime: {
      requests: 0,
      match: 0,
      mismatch: 0,
      unknown: 0,
      unsupported: 0,
      errors: 0,
      mismatchReasons: {},
    },
    synthetic: {
      requests: 0,
      match: 0,
      mismatch: 0,
      unknown: 0,
      unsupported: 0,
      errors: 0,
      mismatchReasons: {},
    },
    static: {
      requests: 0,
      match: 0,
      mismatch: 0,
      unknown: 0,
      unsupported: 0,
      errors: 0,
      mismatchReasons: {},
    },
    dualcheck_total: 0,
    dualcheck_mismatch_total: 0,
    dualcheck_error_total: 0,
    observer_error_total: 0,
    runtimeMismatchSamples: [],
  };
}

/**
 * Honest multi-process status. Never invent cluster aggregates.
 */
function resolveMultiProcessStatus(env = process.env) {
  const instancesRaw = env.instances ?? env.PM2_INSTANCES ?? null;
  const execMode = env.exec_mode || env.PM2_EXEC_MODE || null;
  let instanceCount = 'UNKNOWN';
  if (instancesRaw !== null && instancesRaw !== undefined && String(instancesRaw).trim() !== '') {
    const n = Number(instancesRaw);
    instanceCount = Number.isFinite(n) ? n : 'UNKNOWN';
  }
  const aggregationComplete = instanceCount === 1;
  return {
    instanceCount,
    execMode: execMode || 'UNKNOWN',
    pmId: env.pm_id ?? null,
    nodeAppInstance: env.NODE_APP_INSTANCE ?? null,
    pid: process.pid,
    aggregationComplete,
    note: aggregationComplete
      ? 'Single configured PM2 instance — this process holds the in-memory counter set for the app.'
      : 'Multi-process or unknown instance count — payload is PER-PROCESS only; do not claim cluster-wide aggregate COMPLETE.',
  };
}

function sanitizeExportPayloadKeys(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const forbidden = [
    'password', 'token', 'secret', 'authorization', 'cookie',
    'email', 'phone', 'jwt', 'body', 'headers', 'userId', 'name',
  ];
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const lk = String(k).toLowerCase();
    if (forbidden.some((f) => lk.includes(f))) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Build read-only runtime evidence from THIS process memory.
 */
function buildLiveRuntimeEvidenceExport(opts = {}) {
  const env = opts.env || process.env;
  const snap = opts.snapshot || snapshotRuntimeEvidence();
  const baseline = opts.baseline || emptySoakBaseline();
  const delta = deltaRuntimeEvidence(baseline, snap);
  const soakSnap = opts.soakSnapshot || getSoakEvidenceSnapshot();
  const metrics = opts.metrics || getParityMetricsSnapshot();
  const multiProcess = resolveMultiProcessStatus(env);
  const flags = getProductionSoakFlagState(env);
  const environment = resolveEvidenceEnvironment(env);

  const evaluation = evaluateRuntimeEvidenceCollection({
    env,
    environment,
    flags,
    delta,
    channels: soakSnap.channels,
    samples: (delta.newRuntimeMismatchSamples || []).length
      ? delta.newRuntimeMismatchSamples
      : (snap.runtimeMismatchSamples || []),
    finalDecisionInvariant: opts.finalDecisionInvariant !== false,
    domainSafety: opts.domainSafety,
  });

  const runtime = {
    requests: snap.runtime?.requests || 0,
    events: snap.runtime?.requests || 0,
    match: snap.runtime?.match || 0,
    mismatch: snap.runtime?.mismatch || 0,
    unknown: snap.runtime?.unknown || 0,
    unsupported: snap.runtime?.unsupported || 0,
    errors: snap.runtime?.errors || 0,
    observerErrors: metrics.rbac_parity_observer_error_total || 0,
    dualCheckErrors: metrics.rbac_dualcheck_error_total || 0,
    dualCheckTotal: metrics.rbac_dualcheck_total || 0,
    dualCheckMismatchTotal: metrics.rbac_dualcheck_mismatch_total || 0,
    mismatchReasons: { ...(snap.runtime?.mismatchReasons || {}) },
  };

  const safeMismatchSamples = (evaluation.mismatches || [])
    .map((s) => sanitizeMismatchSample(s, environment))
    .filter(Boolean)
    .map(sanitizeExportPayloadKeys);

  let productionSoakEvidence = evaluation.productionEvidence;
  const blockers = [...(evaluation.blockers || [])];

  if (!multiProcess.aggregationComplete) {
    blockers.push('multiprocess_aggregation_incomplete');
    // Do not claim AVAILABLE as cluster-complete; keep per-process honesty.
    if (productionSoakEvidence === PRODUCTION_SOAK_EVIDENCE.AVAILABLE) {
      // Still AVAILABLE for THIS process, but flagged incomplete aggregation.
    }
  }

  return {
    phase: '8.20C',
    environment,
    evidenceChannel: evaluation.evidenceChannel,
    soakWindowActive: Boolean(flags.soakWindow && isSoakWindowActive(env)),
    flags,
    runtime,
    coverage: evaluation.runtimeCoverage,
    coverageDetails: {
      runtimeCoverage: evaluation.runtimeCoverage,
      note: evaluation.coverageDetails?.note || evaluation.note || null,
    },
    domainSafety: evaluation.domainSafety,
    finalDecisionInvariant: evaluation.finalDecisionInvariant,
    PRODUCTION_SOAK_EVIDENCE: productionSoakEvidence,
    productionSoakEvidence,
    ENTERPRISE_PRIMARY_READY: 'NO',
    enterprisePrimaryReady: false,
    liveRemainsPrimary: true,
    enterpriseIsShadowOnly: true,
    multiProcess,
    process: {
      pid: process.pid,
      pmId: multiProcess.pmId,
      nodeAppInstance: multiProcess.nodeAppInstance,
    },
    source: 'application_process_memory',
    readOnly: true,
    snapshotAt: snap.at || new Date().toISOString(),
    mismatchSamples: safeMismatchSamples,
    blockers: [...new Set(blockers)],
    safety: {
      liveRemainsPrimary: true,
      enterpriseIsShadowOnly: true,
      authorizeNotMounted: true,
      noDbMutation: true,
      noPermissionMutation: true,
      noSecretsExported: true,
      noPiiExported: true,
      finalDecisionEqualsLiveDecision: evaluation.finalDecisionInvariant === 'PASS'
        || evaluation.finalDecisionInvariant === true,
    },
    note: (
      'Phase 8.20C exports in-process RUNTIME counters only. '
      + 'Standalone scripts must HTTP-GET this endpoint on the live process. '
      + 'ENTERPRISE_PRIMARY_READY remains NO.'
    ),
  };
}

module.exports = {
  snapshotRuntimeEvidence,
  deltaRuntimeEvidence,
  emptySoakBaseline,
  resolveMultiProcessStatus,
  buildLiveRuntimeEvidenceExport,
  EVIDENCE_CHANNEL,
};
