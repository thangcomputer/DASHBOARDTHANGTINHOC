/**
 * Phase 8.9 — Observe-only LIVE vs Enterprise RBAC parity comparator.
 *
 * NON-AUTHORITATIVE. Never call from LIVE middleware for deny/allow.
 * Never mutates req, DB, HTTP, sockets, queues, or notifications.
 *
 * finalDecision is ALWAYS the LIVE decision.
 */
const { PERMISSIONS: LIVE } = require('../../constants/permissions');
const ENT = require('../../shared/constants/permissions');
const map = require('../../shared/constants/legacyPermissionMapping');
const { resolveEnterpriseRoleContract } = require('../../shared/constants/roleAliasContract');
const { actorHasLivePermission, actorHasAnyLivePermission } = require('../policyShadow/livePermissionAdapter');

const COMPARISON = Object.freeze({
  MATCH: 'MATCH',
  MISMATCH: 'MISMATCH',
  UNKNOWN: 'UNKNOWN',
  UNSUPPORTED: 'UNSUPPORTED',
});

const DECISION = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
});

/** Expand actor LIVE permission strings → enterprise code set (via mapping contract). */
function expandLivePermissionsToEnterprise(livePermissions) {
  const out = new Set();
  for (const p of livePermissions || []) {
    for (const code of map.resolve(p)) {
      out.add(code);
    }
  }
  return out;
}

function isRootOrSuper(actor) {
  if (!actor) return false;
  if (actor.id === 'admin' || actor._id === 'admin') return true;
  return actor.adminRole === 'SUPER_ADMIN';
}

/**
 * LIVE staff-gate mirror (checkPermission-style): admin|staff role + permission
 * (or SUPER / id=admin bypass). Does not reimplement branch — caller passes scopeOk.
 */
function liveStaffPermissionDecision(actor, livePermission, { scopeOk = true } = {}) {
  if (!actor || !actor.id) {
    return { decision: DECISION.DENY, reason: 'unauthenticated' };
  }
  if (isRootOrSuper(actor)) {
    return { decision: DECISION.ALLOW, reason: 'super_or_root' };
  }
  const role = String(actor.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'staff') {
    return { decision: DECISION.DENY, reason: 'role_not_staff' };
  }
  if (!actorHasLivePermission(actor, livePermission)) {
    return { decision: DECISION.DENY, reason: 'missing_live_permission' };
  }
  if (!scopeOk) {
    return { decision: DECISION.DENY, reason: 'scope_denied' };
  }
  return { decision: DECISION.ALLOW, reason: 'live_allow' };
}

function liveAnyStaffPermissionDecision(actor, livePermissions, { scopeOk = true } = {}) {
  if (!actor || !actor.id) {
    return { decision: DECISION.DENY, reason: 'unauthenticated' };
  }
  if (isRootOrSuper(actor)) {
    return { decision: DECISION.ALLOW, reason: 'super_or_root' };
  }
  const role = String(actor.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'staff') {
    return { decision: DECISION.DENY, reason: 'role_not_staff' };
  }
  if (!actorHasAnyLivePermission(actor, livePermissions)) {
    return { decision: DECISION.DENY, reason: 'missing_live_permission' };
  }
  if (!scopeOk) {
    return { decision: DECISION.DENY, reason: 'scope_denied' };
  }
  return { decision: DECISION.ALLOW, reason: 'live_allow' };
}

/**
 * Enterprise candidate: same staff/super gate, but required enterprise codes
 * derived from mapping of the LIVE permission(s).
 */
function enterpriseStaffPermissionDecision(actor, livePermissionOrList, { scopeOk = true, mode = 'all' } = {}) {
  if (!actor || !actor.id) {
    return { decision: DECISION.DENY, reason: 'unauthenticated', enterpriseCodes: [] };
  }
  if (isRootOrSuper(actor)) {
    return { decision: DECISION.ALLOW, reason: 'super_or_root', enterpriseCodes: [ENT.ALL] };
  }
  const role = String(actor.role || '').toLowerCase();
  if (role !== 'admin' && role !== 'staff') {
    return { decision: DECISION.DENY, reason: 'role_not_staff', enterpriseCodes: [] };
  }

  const liveList = Array.isArray(livePermissionOrList)
    ? livePermissionOrList
    : [livePermissionOrList];

  // LEGACY_ONLY → UNSUPPORTED path handled by caller via map status
  const requiredSets = liveList.map((lp) => map.resolve(lp));
  if (requiredSets.some((s) => s.length === 0)) {
    return {
      decision: null,
      reason: 'unmapped_or_legacy_only',
      enterpriseCodes: [],
      unsupported: true,
    };
  }

  const held = expandLivePermissionsToEnterprise(actor.permissions || []);
  let ok;
  if (mode === 'any') {
    ok = requiredSets.some((codes) => codes.every((c) => held.has(c)));
  } else {
    // single live permission → must hold all mapped enterprise codes
    ok = requiredSets[0].every((c) => held.has(c));
  }

  if (!ok) {
    return {
      decision: DECISION.DENY,
      reason: 'missing_enterprise_equivalent',
      enterpriseCodes: requiredSets.flat(),
    };
  }
  if (!scopeOk) {
    return {
      decision: DECISION.DENY,
      reason: 'scope_denied',
      enterpriseCodes: requiredSets.flat(),
    };
  }
  return {
    decision: DECISION.ALLOW,
    reason: 'enterprise_allow',
    enterpriseCodes: requiredSets.flat(),
  };
}

function compareDecisions(live, enterprise) {
  if (enterprise?.unsupported || enterprise?.decision == null) {
    return COMPARISON.UNSUPPORTED;
  }
  if (!live?.decision || !enterprise?.decision) {
    return COMPARISON.UNKNOWN;
  }
  if (live.decision === enterprise.decision) {
    return COMPARISON.MATCH;
  }
  return COMPARISON.MISMATCH;
}

/**
 * Observe-only parity for a staff LIVE permission gate.
 * @returns {{ live, enterprise, comparison, finalDecision }}
 */
function compareStaffLivePermission(actor, livePermission, opts = {}) {
  const status = map.getMappingStatus(livePermission);
  if (status === 'LEGACY_ONLY') {
    const live = liveStaffPermissionDecision(actor, livePermission, opts);
    return {
      live,
      enterprise: { decision: null, reason: 'legacy_only', unsupported: true },
      comparison: COMPARISON.UNSUPPORTED,
      finalDecision: live.decision,
      mappingStatus: status,
    };
  }

  const live = liveStaffPermissionDecision(actor, livePermission, opts);
  const enterprise = enterpriseStaffPermissionDecision(actor, livePermission, opts);
  const comparison = compareDecisions(live, enterprise);

  return {
    live,
    enterprise,
    comparison,
    finalDecision: live.decision,
    mappingStatus: status,
  };
}

/**
 * Observe-only OR of LIVE permissions (e.g. finance readGuard).
 */
function compareStaffLiveAnyPermission(actor, livePermissions, opts = {}) {
  const live = liveAnyStaffPermissionDecision(actor, livePermissions, opts);
  const enterprise = enterpriseStaffPermissionDecision(actor, livePermissions, {
    ...opts,
    mode: 'any',
  });
  return {
    live,
    enterprise,
    comparison: compareDecisions(live, enterprise),
    finalDecision: live.decision,
  };
}

/** Safe metadata for optional logging (no secrets / PII / full perm arrays). */
function toSafeParityLog(result, meta = {}) {
  return {
    event: 'RBAC_PARITY_COMPARE',
    family: meta.family || null,
    livePermission: meta.livePermission || null,
    enterpriseCodes: result.enterprise?.enterpriseCodes || [],
    liveDecision: result.live?.decision || null,
    enterpriseDecision: result.enterprise?.decision || null,
    comparison: result.comparison,
    finalDecision: result.finalDecision,
    requestId: meta.requestId || null,
    correlationId: meta.correlationId || null,
  };
}

module.exports = {
  COMPARISON,
  DECISION,
  LIVE,
  ENT,
  expandLivePermissionsToEnterprise,
  liveStaffPermissionDecision,
  liveAnyStaffPermissionDecision,
  enterpriseStaffPermissionDecision,
  compareDecisions,
  compareStaffLivePermission,
  compareStaffLiveAnyPermission,
  resolveEnterpriseRoleContract,
  toSafeParityLog,
  isRootOrSuper,
  map,
};
