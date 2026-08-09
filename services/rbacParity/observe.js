/**
 * Phase 8.11 — Dual-read observation hook (NON-AUTHORITATIVE).
 *
 * LIVE decision is always final. This module only compares + logs + meters.
 * Never writes HTTP responses, never calls next(), never mutates authz state.
 *
 * Flag: RBAC_PARITY_OBSERVE_ENABLED=true|1|yes|on (default OFF).
 */
const logger = require('../../config/logger');
const parityCompare = require('./compareLiveEnterprise');
const { incrementParityMetric } = require('./metrics');
const { COMPARISON, compareDecisions, map } = parityCompare;
const {
  resolveEvidenceChannel,
  recordSoakObservation,
  EVIDENCE_CHANNEL,
} = require('./soakEvidence');

function isRbacParityObserveEnabled(env = process.env) {
  const v = String(env.RBAC_PARITY_OBSERVE_ENABLED ?? '').trim().toLowerCase();
  if (!v || v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function buildTrustedActor(req) {
  const u = req?.user || {};
  return {
    id: u.id || u._id || '',
    role: u.role || '',
    adminRole: u.adminRole || null,
    // Trusted only — never req.body / query permissions
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
  };
}

function classifyActorRole(actor) {
  if (!actor?.id) return 'unauthenticated';
  if (String(actor.id) === 'admin') return 'legacy_root';
  if (actor.adminRole === 'SUPER_ADMIN') return 'SUPER_ADMIN';
  if (actor.adminRole === 'HIGH_ADMIN') return 'HIGH_ADMIN';
  if (actor.adminRole === 'SUPPORT') return 'SUPPORT';
  if (actor.adminRole === 'STAFF') return 'STAFF';
  const r = String(actor.role || '').toLowerCase();
  if (r === 'teacher') return 'TEACHER';
  if (r === 'student') return 'STUDENT';
  if (r === 'admin' || r === 'staff') return 'admin_staff_identity';
  return 'other';
}

/**
 * Observe after LIVE gate has decided. Must never throw to caller.
 *
 * @param {object} req
 * @param {object} opts
 * @param {'ALLOW'|'DENY'} opts.liveDecision — authoritative from assertStaffPermissions
 * @param {string} [opts.livePermission] — single permission (checkPermission)
 * @param {string[]} [opts.livePermissions] — OR list (checkAnyPermission)
 * @param {string} [opts.family]
 */
function observeLiveStaffGate(req, opts = {}) {
  if (!isRbacParityObserveEnabled()) return null;

  try {
    const liveDecision = opts.liveDecision === 'ALLOW' ? 'ALLOW' : 'DENY';
    const actor = buildTrustedActor(req);
    // Explicitly ignore client spoof fields
    void req?.body?.role;
    void req?.body?.permissions;
    void req?.body?.adminRole;
    void req?.body?.branchId;
    void req?.query?.role;
    void req?.query?.permissions;

    let enterpriseResult;
    let livePermission = opts.livePermission || null;
    let enterpriseCodes = [];

    const scopeOpts = {
      scopeOk: opts.scopeOk !== false,
    };

    if (Array.isArray(opts.livePermissions) && opts.livePermissions.length) {
      livePermission = opts.livePermissions.join('|');
      enterpriseResult = parityCompare.compareStaffLiveAnyPermission(
        actor,
        opts.livePermissions,
        scopeOpts,
      );
      enterpriseCodes = enterpriseResult.enterprise?.enterpriseCodes || [];
    } else if (opts.livePermission) {
      if (map.isLegacyOnly(opts.livePermission)) {
        enterpriseResult = {
          enterprise: { decision: null, unsupported: true, reason: 'legacy_only' },
          comparison: COMPARISON.UNSUPPORTED,
        };
      } else {
        enterpriseResult = parityCompare.compareStaffLivePermission(
          actor,
          opts.livePermission,
          scopeOpts,
        );
        enterpriseCodes = enterpriseResult.enterprise?.enterpriseCodes || [];
      }
    } else {
      return null;
    }

    // Ownership (shadow) — SUPER/root bypass
    if (
      opts.ownershipOk === false
      && enterpriseResult.enterprise
      && !enterpriseResult.enterprise.unsupported
      && enterpriseResult.enterprise.decision === 'ALLOW'
      && !parityCompare.isRootOrSuper(actor)
    ) {
      enterpriseResult.enterprise = {
        ...enterpriseResult.enterprise,
        decision: 'DENY',
        reason: 'ownership_denied',
      };
    }

    let enterpriseDecision = enterpriseResult.enterprise?.unsupported
      ? null
      : (enterpriseResult.enterprise?.decision || null);

    let comparison = enterpriseResult.enterprise?.unsupported
      || enterpriseResult.comparison === COMPARISON.UNSUPPORTED
      ? COMPARISON.UNSUPPORTED
      : compareDecisions(
        { decision: liveDecision },
        { decision: enterpriseDecision },
      );

    let mismatchReason = null;
    if (comparison === COMPARISON.MISMATCH) {
      if (opts.ownershipOk === false) mismatchReason = 'OWNERSHIP_MISMATCH';
      else if (opts.scopeOk === false) mismatchReason = 'SCOPE_MISMATCH';
      else mismatchReason = 'PERMISSION_MISMATCH';
    }

    const payload = {
      event: 'RBAC_PARITY_OBSERVE',
      comparison,
      liveDecision,
      enterpriseDecision,
      livePermission,
      enterprisePermission: enterpriseCodes,
      family: opts.family || req?.authzFamily || null,
      route: req?.route?.path || req?.path || null,
      actorClass: classifyActorRole(actor),
      scopeResult: opts.scopeOk === false
        ? (opts.branchClass || 'cross_or_denied')
        : (opts.ownershipOk === false ? (opts.ownerClass || 'non_owner') : 'live_authoritative'),
      requestId: req?.requestId || null,
      correlationId: req?.correlationId || null,
    };

    incrementParityMetric(comparison);
    const evidenceChannel = resolveEvidenceChannel(opts);
    recordSoakObservation({
      channel: evidenceChannel,
      comparison,
      permission: livePermission,
      family: opts.family || req?.authzFamily || null,
      role: classifyActorRole(actor),
      liveDecision,
      enterpriseDecision,
      mismatchReason,
      scope: payload.scopeResult,
      requestId: req?.requestId || null,
      correlationId: req?.correlationId || null,
    });
    payload.evidenceChannel = evidenceChannel;

    if (comparison === COMPARISON.MISMATCH) {
      logger.warn(payload, '[RBAC_PARITY] MISMATCH — LIVE remains authoritative');
    } else if (comparison === COMPARISON.UNSUPPORTED) {
      logger.info(payload, '[RBAC_PARITY] UNSUPPORTED legacy-only — LIVE remains authoritative');
    } else {
      logger.info(payload, '[RBAC_PARITY] observe');
    }

    // Never attach to client response; optional internal debug only if already used
    return payload;
  } catch (err) {
    try {
      incrementParityMetric('ERROR');
      recordSoakObservation({
        channel: resolveEvidenceChannel(opts),
        comparison: 'ERROR',
        requestId: req?.requestId || null,
        correlationId: req?.correlationId || null,
      });
      logger.warn(
        {
          event: 'RBAC_PARITY_OBSERVER_ERROR',
          err: err?.message || String(err),
          requestId: req?.requestId || null,
          correlationId: req?.correlationId || null,
        },
        '[RBAC_PARITY] observer failed — LIVE unchanged',
      );
    } catch {
      /* swallow */
    }
    return null;
  }
}

module.exports = {
  isRbacParityObserveEnabled,
  observeLiveStaffGate,
  buildTrustedActor,
  classifyActorRole,
  EVIDENCE_CHANNEL,
};
