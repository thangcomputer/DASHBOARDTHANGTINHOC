/**
 * Phase 8.12 — Dual-Check shadow evaluator (NON-AUTHORITATIVE).
 *
 * Independently evaluates Enterprise authorization beside LIVE.
 * finalDecision is ALWAYS the LIVE decision passed in — never derived from Enterprise.
 *
 * Flag: RBAC_DUAL_CHECK_ENABLED=true|1|yes|on (default OFF).
 * Never writes HTTP, never calls next(), never mutates authz / DB.
 */
const logger = require('../../config/logger');
const parityCompare = require('./compareLiveEnterprise');
const { resolveEnterpriseRoleContract } = require('../../shared/constants/roleAliasContract');
const {
  incrementParityMetric,
  incrementDualCheckMetric,
} = require('./metrics');
const { COMPARISON, DECISION, map } = parityCompare;
const { buildTrustedActor, classifyActorRole } = require('./observe');
const {
  resolveEvidenceChannel,
  recordSoakObservation,
} = require('./soakEvidence');

const MISMATCH_REASON = Object.freeze({
  ROLE_MISMATCH: 'ROLE_MISMATCH',
  PERMISSION_MISMATCH: 'PERMISSION_MISMATCH',
  SCOPE_MISMATCH: 'SCOPE_MISMATCH',
  OWNERSHIP_MISMATCH: 'OWNERSHIP_MISMATCH',
  ACTION_MISMATCH: 'ACTION_MISMATCH',
  BUNDLE_MISMATCH: 'BUNDLE_MISMATCH',
  ROOT_IDENTITY_MISMATCH: 'ROOT_IDENTITY_MISMATCH',
  UNKNOWN_CONTEXT: 'UNKNOWN_CONTEXT',
  OTHER: 'OTHER',
});

/** Architectural classification — never converts MISMATCH → MATCH. */
const MISMATCH_CLASSIFICATION = Object.freeze({
  LEGACY_COMPATIBILITY: 'LEGACY_COMPATIBILITY',
  INVALID_AUTH_CONTEXT: 'INVALID_AUTH_CONTEXT',
  ROLE_RESOLUTION_DEFECT: 'ROLE_RESOLUTION_DEFECT',
  PERMISSION_RESOLUTION_DEFECT: 'PERMISSION_RESOLUTION_DEFECT',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Phase 8.14/8.15 — Annotate residual bare-admin ROLE_MISMATCH if still present.
 * After Phase 8.15 LEGACY_PRINCIPAL permission eval, this should rarely fire.
 */
function annotateKnownLegacyMismatch(payload, enterprise, actor, roleResolution) {
  if (!payload || payload.comparison !== COMPARISON.MISMATCH) return payload;
  if (payload.mismatchReason !== MISMATCH_REASON.ROLE_MISMATCH) return payload;
  if (enterprise?.reason !== 'role_unresolved_adminRole') return payload;
  const t = roleResolution?.type;
  if (t !== 'CONDITIONAL' && t !== 'LEGACY_PRINCIPAL') return payload;
  const jwt = String(actor?.role || '').toLowerCase();
  if (jwt !== 'admin' && jwt !== 'staff') return payload;
  if (actor?.adminRole) return payload;

  payload.mismatchClassification = MISMATCH_CLASSIFICATION.LEGACY_COMPATIBILITY;
  payload.knownLegacyMismatch = 'KNOWN_LEGACY_MISMATCH';
  payload.mismatchNotes = (
    'Unexpected ROLE_MISMATCH for LEGACY_PRINCIPAL — investigate. '
    + 'Do not auto-map admin→SUPER_ADMIN or admin→ADMIN_STAFF.'
  );
  return payload;
}

function envFlagOn(name, env = process.env) {
  const v = String(env[name] ?? '').trim().toLowerCase();
  if (!v || v === 'false' || v === '0' || v === 'no' || v === 'off') return false;
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function isRbacDualCheckEnabled(env = process.env) {
  return envFlagOn('RBAC_DUAL_CHECK_ENABLED', env);
}

/**
 * Independent Enterprise shadow decision — does NOT copy liveDecision.
 */
function evaluateEnterpriseShadow(actor, opts = {}) {
  const scopeOk = opts.scopeOk !== false;
  const ownershipOk = opts.ownershipOk !== false;
  const mode = Array.isArray(opts.livePermissions) && opts.livePermissions.length ? 'any' : 'all';
  const liveKey = mode === 'any' ? opts.livePermissions : opts.livePermission;

  if (mode === 'all' && map.isLegacyOnly(opts.livePermission)) {
    return {
      decision: null,
      unsupported: true,
      reason: 'legacy_only',
      enterpriseCodes: [],
      roleResolution: resolveRole(actor),
    };
  }

  if (mode === 'any') {
    const anyLegacy = (opts.livePermissions || []).some((p) => map.isLegacyOnly(p));
    if (anyLegacy) {
      return {
        decision: null,
        unsupported: true,
        reason: 'legacy_only',
        enterpriseCodes: [],
        roleResolution: resolveRole(actor),
      };
    }
  }

  // Role gate first (independent of LIVE ok)
  const roleResolution = resolveRole(actor);
  if (!actor || !actor.id) {
    return {
      decision: DECISION.DENY,
      reason: 'unauthenticated',
      enterpriseCodes: [],
      roleResolution,
    };
  }

  // Phase 8.15 — LEGACY_PRINCIPAL (JWT admin|staff, adminRole=null):
  // Do NOT deny solely for missing adminRole.
  // Do NOT assign SUPER_ADMIN / ADMIN_STAFF.
  // Fall through to permission-code evaluation (same staff identity gate as LIVE).

  const teacherOrStudent = ['TEACHER', 'STUDENT'].includes(
    String(roleResolution.enterpriseRole || ''),
  );
  if (teacherOrStudent && !parityCompare.isRootOrSuper(actor)) {
    // Staff-gate shadow: teacher/student cannot pass staff permission gates
    return {
      decision: DECISION.DENY,
      reason: 'role_not_staff',
      enterpriseCodes: [],
      roleResolution,
    };
  }

  let enterprise = parityCompare.enterpriseStaffPermissionDecision(actor, liveKey, {
    scopeOk: true,
    mode,
  });

  if (roleResolution.type === 'LEGACY_PRINCIPAL') {
    enterprise = {
      ...enterprise,
      legacyPrincipal: true,
      enterpriseRole: null,
      roleResolution,
    };
  }

  if (enterprise.unsupported) {
    return { ...enterprise, roleResolution };
  }

  // Apply ownership after permission check (shadow semantics)
  if (enterprise.decision === DECISION.ALLOW && !ownershipOk && !parityCompare.isRootOrSuper(actor)) {
    enterprise = {
      ...enterprise,
      decision: DECISION.DENY,
      reason: 'ownership_denied',
    };
  }

  // Apply scope (branch) after permission — SUPER/root bypass branch scope
  if (enterprise.decision === DECISION.ALLOW && !scopeOk && !parityCompare.isRootOrSuper(actor)) {
    enterprise = {
      ...enterprise,
      decision: DECISION.DENY,
      reason: 'scope_denied',
    };
  }

  // Action overrides (e.g. create/delete teachers remain SUPER-only where LIVE says so)
  if (opts.action && enterprise.decision === DECISION.ALLOW) {
    const actionDeny = shadowActionDeny(actor, opts.action, opts.livePermission);
    if (actionDeny) {
      enterprise = {
        ...enterprise,
        decision: DECISION.DENY,
        reason: actionDeny,
      };
    }
  }

  return { ...enterprise, roleResolution };
}

function resolveRole(actor) {
  return resolveEnterpriseRoleContract({
    jwtRole: actor?.role,
    adminRole: actor?.adminRole,
    userId: actor?.id || actor?._id,
  });
}

/** LIVE-aligned: teacher create/delete are SUPER/root — not manage_teachers alone. */
function shadowActionDeny(actor, action, livePermission) {
  const a = String(action || '').toLowerCase();
  if (!a) return null;
  if (
    (livePermission === 'manage_teachers' || livePermission === 'view_teachers')
    && (a === 'create' || a === 'delete')
  ) {
    if (!parityCompare.isRootOrSuper(actor)) return 'action_requires_super';
  }
  // Revenue-only must not authorize finance mutations via action tag
  if (
    livePermission === 'view_branch_revenue'
    && ['payment_create', 'refund_approve', 'ledger_void', 'discount_mutate',
      'heal', 'reconcile', 'snapshot_sync', 'invoice_mutate', 'transaction_mutate'].includes(a)
  ) {
    return 'action_finance_mutate_denied';
  }
  return null;
}

function classifyMismatchReason(liveDecision, enterprise, opts = {}) {
  if (!enterprise || enterprise.unsupported || enterprise.decision == null) {
    return null;
  }
  if (liveDecision === enterprise.decision) return null;

  const er = enterprise.reason || '';
  if (er === 'ownership_denied' || opts.ownershipOk === false) {
    return MISMATCH_REASON.OWNERSHIP_MISMATCH;
  }
  if (er === 'scope_denied' || opts.scopeOk === false) {
    return MISMATCH_REASON.SCOPE_MISMATCH;
  }
  if (er === 'action_requires_super' || er === 'action_finance_mutate_denied' || opts.action) {
    if (er.startsWith('action_') || (opts.action && liveDecision !== enterprise.decision)) {
      // Only ACTION if enterprise reason is action-related or both differ on action path
      if (er.startsWith('action_')) return MISMATCH_REASON.ACTION_MISMATCH;
    }
  }
  if (er === 'role_not_staff' || er === 'role_unresolved_adminRole' || er === 'unauthenticated') {
    return MISMATCH_REASON.ROLE_MISMATCH;
  }
  if (er === 'super_or_root' || String(opts.actorId) === 'admin') {
    return MISMATCH_REASON.ROOT_IDENTITY_MISMATCH;
  }
  if (er === 'missing_enterprise_equivalent') {
    const lp = opts.livePermission || '';
    if (lp === 'manage_finance' || lp === 'view_branch_revenue' || lp === 'manage_training'
      || lp === 'manage_student_training') {
      return MISMATCH_REASON.BUNDLE_MISMATCH;
    }
    return MISMATCH_REASON.PERMISSION_MISMATCH;
  }
  if (er === 'missing_live_permission') {
    return MISMATCH_REASON.PERMISSION_MISMATCH;
  }
  if (!er) return MISMATCH_REASON.UNKNOWN_CONTEXT;
  return MISMATCH_REASON.OTHER;
}

function classifyScope(opts = {}) {
  if (opts.scopeOk === false) return 'cross_or_denied';
  if (opts.scopeOk === true && opts.branchClass) return opts.branchClass;
  if (opts.ownershipOk === false) return 'non_owner';
  if (opts.ownershipOk === true && opts.ownerClass) return opts.ownerClass;
  return 'unspecified';
}

/**
 * Dual-check after LIVE gate. Must never throw to caller.
 * @param {object} req
 * @param {object} opts
 * @param {'ALLOW'|'DENY'} opts.liveDecision — authoritative LIVE only
 */
function dualCheckLiveStaffGate(req, opts = {}) {
  if (!isRbacDualCheckEnabled()) return null;

  try {
    // Ignore client spoof surfaces
    void req?.body?.role;
    void req?.body?.permissions;
    void req?.body?.adminRole;
    void req?.body?.branchId;
    void req?.query?.role;
    void req?.query?.permissions;
    void req?.query?.branchId;

    const liveDecision = opts.liveDecision === 'ALLOW' ? 'ALLOW' : 'DENY';
    const actor = buildTrustedActor(req);
    // Prefer DB-hydrated permissions already on req.user after LIVE assert
    const roleResolution = resolveRole(actor);

    let enterprise;
    let livePermission = opts.livePermission || null;

    if (Array.isArray(opts.livePermissions) && opts.livePermissions.length) {
      livePermission = opts.livePermissions.join('|');
      enterprise = evaluateEnterpriseShadow(actor, {
        livePermissions: opts.livePermissions,
        scopeOk: opts.scopeOk,
        ownershipOk: opts.ownershipOk,
        action: opts.action,
      });
    } else if (opts.livePermission) {
      enterprise = evaluateEnterpriseShadow(actor, {
        livePermission: opts.livePermission,
        scopeOk: opts.scopeOk,
        ownershipOk: opts.ownershipOk,
        action: opts.action,
      });
    } else {
      return null;
    }

    const enterpriseDecision = enterprise.unsupported
      ? null
      : (enterprise.decision || null);

    let comparison;
    if (enterprise.unsupported) {
      comparison = COMPARISON.UNSUPPORTED;
    } else {
      comparison = parityCompare.compareDecisions(
        { decision: liveDecision },
        { decision: enterpriseDecision },
      );
    }

    const mismatchReason = comparison === COMPARISON.MISMATCH
      ? classifyMismatchReason(liveDecision, enterprise, {
        scopeOk: opts.scopeOk,
        ownershipOk: opts.ownershipOk,
        action: opts.action,
        livePermission: opts.livePermission,
        actorId: actor.id,
      })
      : null;

    let payload = {
      event: 'RBAC_DUAL_CHECK',
      liveDecision,
      enterpriseDecision,
      comparison,
      livePermission,
      enterprisePermissions: enterprise.enterpriseCodes || [],
      role: roleResolution.enterpriseRole
        || (roleResolution.type === 'LEGACY_PRINCIPAL' ? 'LEGACY_PRINCIPAL' : classifyActorRole(actor)),
      roleType: roleResolution.type || null,
      scope: classifyScope(opts),
      family: opts.family || req?.authzFamily || null,
      mismatchReason,
      finalDecision: liveDecision,
      requestId: req?.requestId || null,
      correlationId: req?.correlationId || null,
      evidenceChannel: resolveEvidenceChannel(opts),
    };
    payload = annotateKnownLegacyMismatch(payload, enterprise, actor, roleResolution);

    incrementParityMetric(comparison);
    incrementDualCheckMetric(comparison);
    recordSoakObservation({
      channel: payload.evidenceChannel,
      comparison,
      permission: livePermission,
      family: payload.family,
      role: payload.role,
      liveDecision,
      enterpriseDecision,
      mismatchReason: payload.knownLegacyMismatch || mismatchReason,
      scope: payload.scope,
      requestId: payload.requestId,
      correlationId: payload.correlationId,
    });

    if (comparison === COMPARISON.MISMATCH) {
      logger.warn(payload, '[RBAC_DUAL_CHECK] MISMATCH — LIVE remains authoritative');
    } else if (comparison === COMPARISON.UNSUPPORTED) {
      logger.info(payload, '[RBAC_DUAL_CHECK] UNSUPPORTED — LIVE remains authoritative');
    } else {
      logger.info(payload, '[RBAC_DUAL_CHECK] shadow');
    }

    return payload;
  } catch (err) {
    try {
      incrementParityMetric('ERROR');
      incrementDualCheckMetric('ERROR');
      recordSoakObservation({
        channel: resolveEvidenceChannel(opts),
        comparison: 'ERROR',
        requestId: req?.requestId || null,
        correlationId: req?.correlationId || null,
      });
      logger.warn(
        {
          event: 'RBAC_DUAL_CHECK_ERROR',
          err: err?.message || String(err),
          requestId: req?.requestId || null,
          correlationId: req?.correlationId || null,
        },
        '[RBAC_DUAL_CHECK] evaluator failed — LIVE unchanged',
      );
    } catch {
      /* swallow */
    }
    return null;
  }
}

module.exports = {
  MISMATCH_REASON,
  MISMATCH_CLASSIFICATION,
  isRbacDualCheckEnabled,
  evaluateEnterpriseShadow,
  classifyMismatchReason,
  annotateKnownLegacyMismatch,
  dualCheckLiveStaffGate,
  resolveRole,
};
