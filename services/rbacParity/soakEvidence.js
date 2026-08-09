/**
 * Phase 8.13 — Soak evidence channels (NON-AUTHORITATIVE).
 *
 * STATIC / SYNTHETIC / RUNTIME are NEVER mixed into one readiness number.
 * Production-like soak requires RUNTIME traffic with flags enabled in a real process.
 * Test harness must tag SYNTHETIC (forced) or RUNTIME_HARNESS via opts — never claim
 * production soak from tests alone.
 */
const { PERMISSIONS: LIVE } = require('../../constants/permissions');
const map = require('../../shared/constants/legacyPermissionMapping');
const {
  COMPARISON,
  compareStaffLivePermission,
} = require('./compareLiveEnterprise');

const EVIDENCE_CHANNEL = Object.freeze({
  STATIC: 'STATIC',
  SYNTHETIC: 'SYNTHETIC',
  RUNTIME: 'RUNTIME',
});

function emptyBucket() {
  return {
    requests: 0,
    match: 0,
    mismatch: 0,
    unknown: 0,
    unsupported: 0,
    errors: 0,
    mismatchReasons: Object.create(null),
  };
}

const channels = {
  STATIC: emptyBucket(),
  SYNTHETIC: emptyBucket(),
  RUNTIME: emptyBucket(),
};

/** Cap safe mismatch samples (RUNTIME only). */
const MAX_RUNTIME_MISMATCH_SAMPLES = 50;
const runtimeMismatchSamples = [];

let staticSnapshot = null;

function normalizeChannel(channel) {
  const c = String(channel || '').toUpperCase();
  if (c === EVIDENCE_CHANNEL.STATIC) return EVIDENCE_CHANNEL.STATIC;
  if (c === EVIDENCE_CHANNEL.SYNTHETIC) return EVIDENCE_CHANNEL.SYNTHETIC;
  if (c === EVIDENCE_CHANNEL.RUNTIME) return EVIDENCE_CHANNEL.RUNTIME;
  return EVIDENCE_CHANNEL.SYNTHETIC; // fail-closed: unknown → synthetic (not runtime)
}

/**
 * Resolve evidence channel for observe/dual-check.
 * Middleware MUST pass RUNTIME. Tests MUST pass SYNTHETIC for forced cases.
 * Default without opts: SYNTHETIC (never silently inflate RUNTIME).
 */
function resolveEvidenceChannel(opts = {}) {
  if (opts.evidenceChannel) return normalizeChannel(opts.evidenceChannel);
  if (opts.evidenceSource) return normalizeChannel(opts.evidenceSource);
  return EVIDENCE_CHANNEL.SYNTHETIC;
}

function recordSoakObservation({
  channel,
  comparison,
  permission = null,
  family = null,
  role = null,
  liveDecision = null,
  enterpriseDecision = null,
  mismatchReason = null,
  scope = null,
  requestId = null,
  correlationId = null,
} = {}) {
  const ch = normalizeChannel(channel);
  const bucket = channels[ch];
  bucket.requests += 1;

  switch (comparison) {
    case 'MATCH':
      bucket.match += 1;
      break;
    case 'MISMATCH':
      bucket.mismatch += 1;
      if (mismatchReason) {
        bucket.mismatchReasons[mismatchReason] = (bucket.mismatchReasons[mismatchReason] || 0) + 1;
      }
      if (ch === EVIDENCE_CHANNEL.RUNTIME && runtimeMismatchSamples.length < MAX_RUNTIME_MISMATCH_SAMPLES) {
        runtimeMismatchSamples.push({
          permission,
          family,
          role,
          liveDecision,
          enterpriseDecision,
          mismatchReason,
          scope,
          requestId,
          correlationId,
        });
      }
      break;
    case 'UNKNOWN':
      bucket.unknown += 1;
      break;
    case 'UNSUPPORTED':
      bucket.unsupported += 1;
      break;
    case 'ERROR':
      bucket.errors += 1;
      break;
    default:
      break;
  }
}

/**
 * Static catalog gate parity (not request traffic).
 * Canonical staff actors — MATCH count for mapped gates; UNSUPPORTED for legacy-only.
 */
function computeAndRecordStaticParity() {
  // Reset STATIC bucket only
  channels.STATIC = emptyBucket();

  const gates = [
    LIVE.VIEW_TEACHERS,
    LIVE.MANAGE_TEACHERS,
    LIVE.MANAGE_HR,
    LIVE.VIEW_BRANCH_REVENUE,
    LIVE.MANAGE_FINANCE,
    LIVE.MANAGE_STUDENT_TRAINING,
    LIVE.MANAGE_TRAINING,
    LIVE.MANAGE_STAFF,
  ];

  const allowActor = {
    id: 'static-u1',
    role: 'staff',
    adminRole: 'STAFF',
    permissions: gates.slice(),
  };

  let match = 0;
  let mismatch = 0;
  let unknown = 0;
  let unsupported = 0;

  for (const g of gates) {
    const r = compareStaffLivePermission(allowActor, g);
    if (r.comparison === COMPARISON.MATCH) match += 1;
    else if (r.comparison === COMPARISON.MISMATCH) mismatch += 1;
    else if (r.comparison === COMPARISON.UNKNOWN) unknown += 1;
    else if (r.comparison === COMPARISON.UNSUPPORTED) unsupported += 1;
  }

  const legacy = map.LEGACY_ONLY_KEYS || [];
  for (const g of legacy) {
    const r = compareStaffLivePermission(
      { ...allowActor, permissions: [g] },
      g,
    );
    if (r.comparison === COMPARISON.UNSUPPORTED) unsupported += 1;
    else if (r.comparison === COMPARISON.MATCH) match += 1;
    else if (r.comparison === COMPARISON.MISMATCH) mismatch += 1;
    else unknown += 1;
  }

  channels.STATIC.match = match;
  channels.STATIC.mismatch = mismatch;
  channels.STATIC.unknown = unknown;
  channels.STATIC.unsupported = unsupported;
  channels.STATIC.requests = match + mismatch + unknown + unsupported;

  staticSnapshot = {
    channel: EVIDENCE_CHANNEL.STATIC,
    match,
    mismatch,
    unknown,
    unsupported,
    gates: gates.length,
    legacyOnly: legacy.length,
    /** Phase 8.10/8.12 baseline: 8 mapped gate MATCHes (excluding legacy-only). */
    mappedGateMatchTarget: 8,
    mappedGateMatch: match,
  };

  return { ...staticSnapshot };
}

function getSoakEvidenceSnapshot() {
  return {
    channels: {
      STATIC: { ...channels.STATIC, mismatchReasons: { ...channels.STATIC.mismatchReasons } },
      SYNTHETIC: { ...channels.SYNTHETIC, mismatchReasons: { ...channels.SYNTHETIC.mismatchReasons } },
      RUNTIME: { ...channels.RUNTIME, mismatchReasons: { ...channels.RUNTIME.mismatchReasons } },
    },
    runtimeMismatchSamples: runtimeMismatchSamples.slice(),
    staticSnapshot,
  };
}

/**
 * Production-like soak is AVAILABLE only when:
 * 1) RUNTIME channel has observations, AND
 * 2) RBAC_SOAK_WINDOW_ACTIVE is explicitly enabled for an intentional soak window.
 *
 * Never claim production soak from automated tests alone.
 */
function getSoakEvidenceStatus() {
  const rt = channels.RUNTIME;
  if (rt.requests <= 0) {
    return {
      SOAK_EVIDENCE: 'NOT_AVAILABLE',
      reason: 'no_runtime_channel_observations',
    };
  }
  const window = String(process.env.RBAC_SOAK_WINDOW_ACTIVE ?? '').trim().toLowerCase();
  const windowActive = window === 'true' || window === '1' || window === 'yes' || window === 'on';
  if (!windowActive) {
    return {
      SOAK_EVIDENCE: 'NOT_AVAILABLE',
      reason: 'soak_window_not_active',
      runtimeChannelRequests: rt.requests,
      note: 'Enable RBAC_SOAK_WINDOW_ACTIVE only during intentional staging/prod soak',
    };
  }
  return {
    SOAK_EVIDENCE: 'AVAILABLE',
    requests: rt.requests,
    match: rt.match,
    mismatch: rt.mismatch,
    unknown: rt.unknown,
    unsupported: rt.unsupported,
    errors: rt.errors,
  };
}

function resetSoakEvidenceForTests() {
  channels.STATIC = emptyBucket();
  channels.SYNTHETIC = emptyBucket();
  channels.RUNTIME = emptyBucket();
  runtimeMismatchSamples.length = 0;
  staticSnapshot = null;
}

function cloneBucket(b) {
  return {
    requests: b.requests,
    match: b.match,
    mismatch: b.mismatch,
    unknown: b.unknown,
    unsupported: b.unsupported,
    errors: b.errors,
    mismatchReasons: { ...b.mismatchReasons },
  };
}

/** Snapshot RUNTIME (+ dual-check metric totals) for soak-window delta. */
function snapshotSoakWindow() {
  const { getParityMetricsSnapshot } = require('./metrics');
  const metrics = getParityMetricsSnapshot();
  return {
    at: new Date().toISOString(),
    runtime: cloneBucket(channels.RUNTIME),
    synthetic: cloneBucket(channels.SYNTHETIC),
    static: cloneBucket(channels.STATIC),
    dualcheck_total: metrics.rbac_dualcheck_total,
    dualcheck_mismatch_total: metrics.rbac_dualcheck_mismatch_total,
    dualcheck_error_total: metrics.rbac_dualcheck_error_total,
    observer_error_total: metrics.rbac_parity_observer_error_total,
    runtimeMismatchSamples: runtimeMismatchSamples.slice(),
  };
}

function deltaSoakWindow(before, after) {
  const d = (a, b) => Math.max(0, (b || 0) - (a || 0));
  const reasonDelta = {};
  const afterReasons = after?.runtime?.mismatchReasons || {};
  const beforeReasons = before?.runtime?.mismatchReasons || {};
  for (const k of new Set([...Object.keys(beforeReasons), ...Object.keys(afterReasons)])) {
    const v = d(beforeReasons[k], afterReasons[k]);
    if (v > 0) reasonDelta[k] = v;
  }
  return {
    requests: d(before?.runtime?.requests, after?.runtime?.requests),
    match: d(before?.runtime?.match, after?.runtime?.match),
    mismatch: d(before?.runtime?.mismatch, after?.runtime?.mismatch),
    unknown: d(before?.runtime?.unknown, after?.runtime?.unknown),
    unsupported: d(before?.runtime?.unsupported, after?.runtime?.unsupported),
    observer_errors: d(before?.observer_error_total, after?.observer_error_total),
    dualcheck_errors: d(before?.dualcheck_error_total, after?.dualcheck_error_total),
    dualcheck_total: d(before?.dualcheck_total, after?.dualcheck_total),
    mismatchReasons: reasonDelta,
    newRuntimeMismatchSamples: (after?.runtimeMismatchSamples || []).slice(
      (before?.runtimeMismatchSamples || []).length,
    ),
  };
}

function isSoakWindowActive(env = process.env) {
  const window = String(env.RBAC_SOAK_WINDOW_ACTIVE ?? '').trim().toLowerCase();
  return window === 'true' || window === '1' || window === 'yes' || window === 'on';
}

/** Phase 8.20C aliases — same implementation, no duplicate logic. */
const snapshotRuntimeEvidence = snapshotSoakWindow;
const deltaRuntimeEvidence = deltaSoakWindow;

module.exports = {
  EVIDENCE_CHANNEL,
  resolveEvidenceChannel,
  recordSoakObservation,
  computeAndRecordStaticParity,
  getSoakEvidenceSnapshot,
  getSoakEvidenceStatus,
  resetSoakEvidenceForTests,
  snapshotSoakWindow,
  deltaSoakWindow,
  snapshotRuntimeEvidence,
  deltaRuntimeEvidence,
  isSoakWindowActive,
};
