/**
 * Phase 4 — Canonical MessagingPolicy (LIVE messaging only).
 *
 * Authority freeze (MESSAGING_BUSINESS_DECISIONS.md):
 *   canDiscoverContacts ← contact-visibility-824b
 *   canSendMessage      ← pairing-matrix-824 / messagingPairing
 *   transportRole never implies productRole (SUPPORT → transport staff)
 *
 * Existing modules:
 *   messagingPairing     — SEND engine (delegated)
 *   messagingRoles       — transport + conversation access (delegated)
 *   chatAccessService    — compatibility wrapper → this module
 *   messageRoutes /contacts — still owns DB queries (Phase 6 migrates to this)
 */
'use strict';

const {
  PRODUCT_ROLES,
  resolveProductRole,
  isPairStructurallyAllowed,
  assertMessagingPairAllowed,
  resolveCanonicalPeer,
  sameBranch,
} = require('./messagingPairing');
const {
  getMessagingRole,
  canAccessDirectConversation,
  isAdminLevelMessagingUser,
  parseDirectConversationTokens,
} = require('../utils/messagingRoles');
const mongoose = require('mongoose');
const Branch = require('../models/Branch');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');

const POLICY_CODES = Object.freeze({
  AUTH_REQUIRED: 'MESSAGING_AUTH_REQUIRED',
  UNKNOWN_PRODUCT_ROLE: 'MESSAGING_UNKNOWN_PRODUCT_ROLE',
  PAIR_DENIED: 'MESSAGING_PAIR_DENIED',
  BRANCH_DENIED: 'MESSAGING_BRANCH_DENIED',
  DISCOVER_DENIED: 'MESSAGING_DISCOVER_DENIED',
  CONVERSATION_DENIED: 'MESSAGING_CONVERSATION_DENIED',
  RECIPIENT_NOT_FOUND: 'MESSAGING_RECIPIENT_NOT_FOUND',
  TENANT_MISMATCH: 'MESSAGING_TENANT_MISMATCH',
  ALLOWED: 'MESSAGING_ALLOWED',
});

function decision({ allowed, reason, policy, scope = null, code = null, extra = {} }) {
  return {
    allowed: Boolean(allowed),
    reason: String(reason || (allowed ? 'ALLOWED' : 'DENIED')),
    policy: String(policy || 'UNKNOWN'),
    scope: scope == null ? null : String(scope),
    code: code || (allowed ? POLICY_CODES.ALLOWED : POLICY_CODES.PAIR_DENIED),
    ...extra,
  };
}

/**
 * Normalize actor/target for policy. Never trusts client transport as productRole.
 */
function normalizeIdentity(user = {}) {
  const id = String(user.id || user._id || '');
  const adminRole = user.adminRole || null;
  const productRole = resolveProductRole(user);
  const transportRole = getMessagingRole(user);
  const branchId = user.branchId != null && user.branchId !== ''
    ? String(user.branchId)
    : null;
  const branchCode = user.branchCode ? String(user.branchCode) : '';
  const tenantId = user.tenantId != null && user.tenantId !== ''
    ? String(user.tenantId)
    : null;

  return {
    id,
    productRole,
    transportRole,
    adminRole,
    branchId,
    branchCode,
    tenantId,
    raw: user,
  };
}

/**
 * Phase 5.1 — authoritative tenant for messaging.
 * Prefer explicit tenantId on identity; else Branch.tenantId via branchId.
 * Never trusts client spoof fields alone (caller must pass server identity).
 * @returns {Promise<string|null>}
 */
async function resolveAuthoritativeTenantId(identity = {}) {
  if (identity.tenantId != null && String(identity.tenantId) !== '') {
    return String(identity.tenantId);
  }
  const branchId = identity.branchId != null && identity.branchId !== ''
    ? (typeof identity.branchId === 'object' && identity.branchId._id != null
      ? String(identity.branchId._id)
      : String(identity.branchId))
    : null;
  if (!branchId || !mongoose.Types.ObjectId.isValid(branchId)) {
    return null;
  }
  const branch = await Branch.findById(branchId).select('tenantId').lean();
  if (!branch) {
    return null;
  }
  if (branch.tenantId != null && branch.tenantId !== '') {
    return String(branch.tenantId);
  }
  // Production Branches often lack tenantId — isolate by branch so same-CN DMs still work.
  // Cross-branch still yields different keys. Missing Branch doc remains DENY above.
  return `branch:${branchId}`;
}

/**
 * Load branch/adminRole from DB so JWT-only identity cannot under-scope STAFF/TEACHER.
 */
async function enrichActorIdentity(actor = {}) {
  const id = String(actor.id || actor._id || '');
  if (!id || id === 'admin' || !mongoose.Types.ObjectId.isValid(id)) {
    return actor;
  }
  const role = String(actor.role || '').toLowerCase();
  try {
    if (role === 'student') {
      const s = await Student.findById(id).select('branchId branchCode').lean();
      if (!s) return actor;
      return {
        ...actor,
        branchId: actor.branchId || s.branchId || null,
        branchCode: actor.branchCode || s.branchCode || '',
      };
    }
    const t = await Teacher.findById(id).select('branchId branchCode adminRole role').lean();
    if (!t) return actor;
    return {
      ...actor,
      role: actor.role || t.role,
      adminRole: actor.adminRole || t.adminRole || null,
      branchId: actor.branchId || t.branchId || null,
      branchCode: actor.branchCode || t.branchCode || '',
    };
  } catch {
    return actor;
  }
}

function isOrgWideMessagingProduct(productRole) {
  return productRole === PRODUCT_ROLES.SUPPORT
    || productRole === PRODUCT_ROLES.HIGH_ADMIN
    || productRole === PRODUCT_ROLES.SUPER_ADMIN;
}

function isSyntheticTenantKey(tenantId) {
  if (tenantId == null || tenantId === '') return true;
  const t = String(tenantId);
  return t.startsWith('branch:') || t.startsWith('branchcode:') || t === 'legacy:org' || t === 'legacy:branch-soft';
}

function isRealTenantObjectId(tenantId) {
  if (!tenantId || isSyntheticTenantKey(tenantId)) return false;
  return mongoose.Types.ObjectId.isValid(String(tenantId));
}

function branchKeyForTenant(doc = {}) {
  const bid = doc.branchId != null && doc.branchId !== ''
    ? (typeof doc.branchId === 'object' && doc.branchId._id != null
      ? String(doc.branchId._id)
      : String(doc.branchId))
    : null;
  if (bid) return `id:${bid}`;
  if (doc.branchCode) return `code:${String(doc.branchCode).trim().toUpperCase()}`;
  return '';
}

/**
 * Soft-align tenant when pairing already scopes the relationship:
 * - STAFF↔TEACHER/STUDENT: empty branch / sameBranch soft-allow
 * - TEACHER↔STUDENT: assignment ACL (branch/tenant must not undo it)
 */
function shouldSoftAlignScopedTenants(actorProduct, peerProduct, actorIdentity, peerIdentity) {
  const pair = new Set([actorProduct, peerProduct]);
  if (pair.has(PRODUCT_ROLES.TEACHER) && pair.has(PRODUCT_ROLES.STUDENT)) {
    return true;
  }
  const staffScoped = pair.has(PRODUCT_ROLES.STAFF)
    && (pair.has(PRODUCT_ROLES.TEACHER) || pair.has(PRODUCT_ROLES.STUDENT));
  if (!staffScoped) return false;
  return !branchKeyForTenant(actorIdentity)
    || !branchKeyForTenant(peerIdentity)
    || sameBranch(actorIdentity, peerIdentity);
}

/**
 * Align missing/synthetic tenants for soft-scoped messaging pairs.
 * Never coerce two different real Tenant ObjectIds.
 */
function softAlignScopedTenants(actorTenantId, recipientTenantId) {
  let a = actorTenantId != null && actorTenantId !== '' ? String(actorTenantId) : null;
  let r = recipientTenantId != null && recipientTenantId !== '' ? String(recipientTenantId) : null;
  if (isRealTenantObjectId(a) && isRealTenantObjectId(r) && a !== r) {
    return { actorTenantId: a, recipientTenantId: r };
  }
  if (!r && a) r = a;
  if (!a && r) a = r;
  if (a && r && isRealTenantObjectId(a) && !isRealTenantObjectId(r)) r = a;
  if (a && r && isRealTenantObjectId(r) && !isRealTenantObjectId(a)) a = r;
  if (a && r && !isRealTenantObjectId(a) && !isRealTenantObjectId(r) && a !== r) {
    a = 'legacy:branch-soft';
    r = 'legacy:branch-soft';
  }
  if (!a && !r) {
    a = 'legacy:branch-soft';
    r = 'legacy:branch-soft';
  }
  return { actorTenantId: a, recipientTenantId: r };
}

/**
 * SUPPORT / HIGH / SUPER are org-wide helpdesk (pairing freeze).
 * Either side may inherit missing/synthetic tenant from the other when one
 * party is org-wide — so TEACHER/STUDENT without branch still discover SUPPORT.
 * Real Tenant ObjectId mismatches still DENY.
 */
function alignMessagingTenants(actorTenantId, recipientTenantId, actorProduct, peerProduct) {
  let a = actorTenantId != null && actorTenantId !== '' ? String(actorTenantId) : null;
  let r = recipientTenantId != null && recipientTenantId !== '' ? String(recipientTenantId) : null;
  const actorWide = isOrgWideMessagingProduct(actorProduct);
  const peerWide = isOrgWideMessagingProduct(peerProduct);
  if (!actorWide && !peerWide) {
    return { actorTenantId: a, recipientTenantId: r };
  }

  if (peerWide) {
    // Scoped actor (e.g. teacher without branch) inherits from SUPPORT/HIGH/SUPER
    if (!a && r) a = r;
    if (!r && a) r = a;
    if (a && r && isSyntheticTenantKey(r) && !isSyntheticTenantKey(a)) r = a;
    if (a && r && isSyntheticTenantKey(a) && !isSyntheticTenantKey(r)) a = r;
    if (a && r && isSyntheticTenantKey(a) && isSyntheticTenantKey(r)) {
      a = 'legacy:org';
      r = 'legacy:org';
    }
    if (!a && !r) {
      a = 'legacy:org';
      r = 'legacy:org';
    }
  }

  if (actorWide) {
    if (!a && r) a = r;
    if (!r && a) r = a;
    if (a && r && isSyntheticTenantKey(a) && !isSyntheticTenantKey(r)) a = r;
    if (a && r && isSyntheticTenantKey(r) && !isSyntheticTenantKey(a)) r = a;
    if (a && r && isSyntheticTenantKey(a) && isSyntheticTenantKey(r)) {
      a = 'legacy:org';
      r = 'legacy:org';
    }
    if (!a && !r) {
      a = 'legacy:org';
      r = 'legacy:org';
    }
  }

  return { actorTenantId: a, recipientTenantId: r };
}

/**
 * Fail-closed tenant isolation (private DM).
 * missing actor/recipient tenant → DENY
 * unequal tenants → DENY
 * equal → continue
 */
function assertTenantIsolation(actorTenantId, recipientTenantId, extra = {}) {
  if (!actorTenantId) {
    return decision({
      allowed: false,
      reason: 'ACTOR_TENANT_MISSING',
      policy: 'TENANT',
      scope: 'TENANT',
      code: POLICY_CODES.TENANT_MISMATCH,
      extra,
    });
  }
  if (!recipientTenantId) {
    return decision({
      allowed: false,
      reason: 'RECIPIENT_TENANT_MISSING',
      policy: 'TENANT',
      scope: 'TENANT',
      code: POLICY_CODES.TENANT_MISMATCH,
      extra,
    });
  }
  if (String(actorTenantId) !== String(recipientTenantId)) {
    return decision({
      allowed: false,
      reason: 'TENANT_MISMATCH',
      policy: 'TENANT',
      scope: 'TENANT',
      code: POLICY_CODES.TENANT_MISMATCH,
      extra: { ...extra, actorTenantId: String(actorTenantId), recipientTenantId: String(recipientTenantId) },
    });
  }
  return decision({
    allowed: true,
    reason: 'SAME_TENANT',
    policy: 'TENANT',
    scope: 'TENANT',
    code: POLICY_CODES.ALLOWED,
    extra: { ...extra, actorTenantId: String(actorTenantId), recipientTenantId: String(recipientTenantId) },
  });
}

function sameBranchContext(actorN, targetN, ctx = {}) {
  if (typeof ctx.sameBranch === 'boolean') return ctx.sameBranch;
  if (actorN.branchId && targetN.branchId) {
    return actorN.branchId === targetN.branchId;
  }
  if (actorN.branchCode && targetN.branchCode) {
    return actorN.branchCode === targetN.branchCode;
  }
  return null;
}

function isElevated(pr) {
  return pr === PRODUCT_ROLES.SUPER_ADMIN || pr === PRODUCT_ROLES.HIGH_ADMIN;
}

/**
 * Phase 8.24B contact visibility — pure decision given resolved identities + context.
 * Context may include: { assigned?: boolean, sameBranch?: boolean|null, allowUnknownBranch?: boolean }
 * Fail closed when required relationship is unknown.
 */
function canDiscoverContacts(actor, target, context = {}) {
  if (!actor || !(actor.id || actor._id)) {
    return decision({
      allowed: false,
      reason: 'UNAUTHENTICATED',
      policy: 'AUTH',
      code: POLICY_CODES.AUTH_REQUIRED,
    });
  }
  if (!target || !(target.id || target._id)) {
    return decision({
      allowed: false,
      reason: 'TARGET_MISSING',
      policy: 'DISCOVER',
      code: POLICY_CODES.DISCOVER_DENIED,
    });
  }

  const a = normalizeIdentity(actor);
  const t = normalizeIdentity(target);

  if (!a.productRole) {
    return decision({
      allowed: false,
      reason: 'UNKNOWN_ACTOR_PRODUCT_ROLE',
      policy: 'IDENTITY',
      code: POLICY_CODES.UNKNOWN_PRODUCT_ROLE,
    });
  }
  if (!t.productRole) {
    return decision({
      allowed: false,
      reason: 'UNKNOWN_TARGET_PRODUCT_ROLE',
      policy: 'IDENTITY',
      code: POLICY_CODES.UNKNOWN_PRODUCT_ROLE,
    });
  }

  if (a.id && t.id && a.id === t.id) {
    return decision({
      allowed: false,
      reason: 'SELF',
      policy: 'DISCOVER',
      code: POLICY_CODES.DISCOVER_DENIED,
    });
  }

  // Phase 5.1: tenant before product discover (fail-closed; uses identity tenantId only — no Branch I/O here)
  const alignedDiscover = alignMessagingTenants(a.tenantId, t.tenantId, a.productRole, t.productRole);
  const tenantGate = assertTenantIsolation(
    alignedDiscover.actorTenantId,
    alignedDiscover.recipientTenantId,
    {
      actorProductRole: a.productRole,
      targetProductRole: t.productRole,
    },
  );
  if (!tenantGate.allowed) {
    return decision({
      allowed: false,
      reason: tenantGate.reason,
      policy: 'TENANT',
      scope: 'TENANT',
      code: POLICY_CODES.TENANT_MISMATCH,
      extra: {
        actorProductRole: a.productRole,
        targetProductRole: t.productRole,
        actorTenantId: alignedDiscover.actorTenantId,
        targetTenantId: alignedDiscover.recipientTenantId,
      },
    });
  }

  const branch = sameBranchContext(a, t, context);
  const assigned = context.assigned === true;

  if (a.productRole === PRODUCT_ROLES.SUPER_ADMIN) {
    const ok = t.productRole === PRODUCT_ROLES.HIGH_ADMIN;
    return decision({
      allowed: ok,
      reason: ok ? 'SUPER_SEES_HIGH' : 'SUPER_CONTACTS_HIGH_ONLY',
      policy: 'DISCOVER_824B',
      scope: 'GLOBAL',
      code: ok ? POLICY_CODES.ALLOWED : POLICY_CODES.DISCOVER_DENIED,
      extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
    });
  }

  if (a.productRole === PRODUCT_ROLES.HIGH_ADMIN) {
    if (t.productRole === PRODUCT_ROLES.STUDENT) {
      return decision({
        allowed: false,
        reason: 'HIGH_NO_STUDENT_DISCOVER',
        policy: 'DISCOVER_824B',
        code: POLICY_CODES.DISCOVER_DENIED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    const ok = (
      t.productRole === PRODUCT_ROLES.SUPER_ADMIN
      || t.productRole === PRODUCT_ROLES.HIGH_ADMIN
      || t.productRole === PRODUCT_ROLES.STAFF
      || t.productRole === PRODUCT_ROLES.SUPPORT
      || t.productRole === PRODUCT_ROLES.TEACHER
    );
    return decision({
      allowed: ok,
      reason: ok ? 'HIGH_DISCOVER_OPS' : 'HIGH_DISCOVER_DENIED',
      policy: 'DISCOVER_824B',
      scope: 'GLOBAL',
      code: ok ? POLICY_CODES.ALLOWED : POLICY_CODES.DISCOVER_DENIED,
      extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
    });
  }

  if (a.productRole === PRODUCT_ROLES.SUPPORT) {
    if (t.productRole === PRODUCT_ROLES.SUPER_ADMIN) {
      return decision({
        allowed: false,
        reason: 'SUPPORT_NO_SUPER_DISCOVER',
        policy: 'DISCOVER_824B',
        code: POLICY_CODES.DISCOVER_DENIED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    const ok = (
      t.productRole === PRODUCT_ROLES.STAFF
      || t.productRole === PRODUCT_ROLES.HIGH_ADMIN
      || t.productRole === PRODUCT_ROLES.TEACHER
      || t.productRole === PRODUCT_ROLES.STUDENT
      || t.productRole === PRODUCT_ROLES.SUPPORT
    );
    return decision({
      allowed: ok,
      reason: ok ? 'SUPPORT_DISCOVER' : 'SUPPORT_DISCOVER_DENIED',
      policy: 'DISCOVER_824B',
      scope: 'GLOBAL',
      code: ok ? POLICY_CODES.ALLOWED : POLICY_CODES.DISCOVER_DENIED,
      extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
    });
  }

  if (a.productRole === PRODUCT_ROLES.STAFF) {
    if (t.productRole === PRODUCT_ROLES.SUPER_ADMIN) {
      return decision({
        allowed: false,
        reason: 'STAFF_NO_SUPER_DISCOVER',
        policy: 'DISCOVER_824B',
        code: POLICY_CODES.DISCOVER_DENIED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    if (t.productRole === PRODUCT_ROLES.HIGH_ADMIN || t.productRole === PRODUCT_ROLES.SUPPORT) {
      return decision({
        allowed: true,
        reason: 'STAFF_DISCOVER_ELEVATED_OR_SUPPORT',
        policy: 'DISCOVER_824B',
        scope: 'SOFT_BRANCH',
        code: POLICY_CODES.ALLOWED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    if (t.productRole === PRODUCT_ROLES.TEACHER || t.productRole === PRODUCT_ROLES.STUDENT) {
      if (branch === false) {
        return decision({
          allowed: false,
          reason: 'CROSS_BRANCH',
          policy: 'BRANCH_SCOPE',
          scope: 'BRANCH',
          code: POLICY_CODES.BRANCH_DENIED,
          extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
        });
      }
      if (branch === null && !context.allowUnknownBranch) {
        return decision({
          allowed: false,
          reason: 'BRANCH_UNKNOWN_FAIL_CLOSED',
          policy: 'BRANCH_SCOPE',
          scope: 'BRANCH',
          code: POLICY_CODES.BRANCH_DENIED,
          extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
        });
      }
      return decision({
        allowed: true,
        reason: 'STAFF_SAME_BRANCH_PEER',
        policy: 'DISCOVER_824B',
        scope: 'BRANCH',
        code: POLICY_CODES.ALLOWED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    if (t.productRole === PRODUCT_ROLES.STAFF) {
      return decision({
        allowed: false,
        reason: 'STAFF_PEER_NOT_IN_CONTACTS_MATRIX',
        policy: 'DISCOVER_824B',
        code: POLICY_CODES.DISCOVER_DENIED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
  }

  if (a.productRole === PRODUCT_ROLES.TEACHER) {
    if (t.productRole === PRODUCT_ROLES.SUPER_ADMIN) {
      return decision({
        allowed: false,
        reason: 'TEACHER_NO_SUPER_DISCOVER',
        policy: 'DISCOVER_824B',
        code: POLICY_CODES.DISCOVER_DENIED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    if (
      t.productRole === PRODUCT_ROLES.HIGH_ADMIN
      || t.productRole === PRODUCT_ROLES.STAFF
      || t.productRole === PRODUCT_ROLES.SUPPORT
    ) {
      return decision({
        allowed: true,
        reason: 'TEACHER_DISCOVER_OPS',
        policy: 'DISCOVER_824B',
        scope: 'SOFT_BRANCH',
        code: POLICY_CODES.ALLOWED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    if (t.productRole === PRODUCT_ROLES.STUDENT) {
      if (!assigned) {
        return decision({
          allowed: false,
          reason: 'ASSIGNMENT_REQUIRED',
          policy: 'ASSIGNMENT_SCOPE',
          scope: 'ASSIGNMENT',
          code: POLICY_CODES.DISCOVER_DENIED,
          extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
        });
      }
      return decision({
        allowed: true,
        reason: 'TEACHER_ASSIGNED_STUDENT',
        policy: 'DISCOVER_824B',
        scope: 'ASSIGNMENT',
        code: POLICY_CODES.ALLOWED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    if (t.productRole === PRODUCT_ROLES.TEACHER) {
      return decision({
        allowed: false,
        reason: 'TEACHER_PEER_DENIED',
        policy: 'DISCOVER_824B',
        code: POLICY_CODES.DISCOVER_DENIED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
  }

  if (a.productRole === PRODUCT_ROLES.STUDENT) {
    if (isElevated(t.productRole)) {
      return decision({
        allowed: false,
        reason: t.productRole === PRODUCT_ROLES.SUPER_ADMIN
          ? 'STUDENT_NO_SUPER_DISCOVER'
          : 'STUDENT_NO_HIGH_DISCOVER',
        policy: 'DISCOVER_824B',
        code: POLICY_CODES.DISCOVER_DENIED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    if (t.productRole === PRODUCT_ROLES.SUPPORT) {
      return decision({
        allowed: true,
        reason: 'STUDENT_DISCOVER_SUPPORT',
        policy: 'DISCOVER_824B',
        scope: 'SOFT_BRANCH',
        code: POLICY_CODES.ALLOWED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    if (t.productRole === PRODUCT_ROLES.STAFF) {
      if (branch === false) {
        return decision({
          allowed: false,
          reason: 'CROSS_BRANCH',
          policy: 'BRANCH_SCOPE',
          scope: 'BRANCH',
          code: POLICY_CODES.BRANCH_DENIED,
          extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
        });
      }
      if (branch === null && !context.allowUnknownBranch) {
        return decision({
          allowed: false,
          reason: 'BRANCH_UNKNOWN_FAIL_CLOSED',
          policy: 'BRANCH_SCOPE',
          scope: 'BRANCH',
          code: POLICY_CODES.BRANCH_DENIED,
          extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
        });
      }
      return decision({
        allowed: true,
        reason: 'STUDENT_DISCOVER_STAFF_SAME_BRANCH',
        policy: 'DISCOVER_824B',
        scope: 'BRANCH',
        code: POLICY_CODES.ALLOWED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    if (t.productRole === PRODUCT_ROLES.TEACHER) {
      if (!assigned) {
        return decision({
          allowed: false,
          reason: 'ASSIGNMENT_REQUIRED',
          policy: 'ASSIGNMENT_SCOPE',
          scope: 'ASSIGNMENT',
          code: POLICY_CODES.DISCOVER_DENIED,
          extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
        });
      }
      return decision({
        allowed: true,
        reason: 'STUDENT_DISCOVER_ASSIGNED_TEACHER',
        policy: 'DISCOVER_824B',
        scope: 'ASSIGNMENT',
        code: POLICY_CODES.ALLOWED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
    if (t.productRole === PRODUCT_ROLES.STUDENT) {
      return decision({
        allowed: false,
        reason: 'STUDENT_PEER_DENIED',
        policy: 'DISCOVER_824B',
        code: POLICY_CODES.DISCOVER_DENIED,
        extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
      });
    }
  }

  return decision({
    allowed: false,
    reason: 'DISCOVER_FALLTHROUGH_DENY',
    policy: 'DISCOVER_824B',
    code: POLICY_CODES.DISCOVER_DENIED,
    extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
  });
}

function canSendStructurally(actor, target) {
  const a = normalizeIdentity(actor);
  const t = normalizeIdentity(target);
  if (!a.productRole || !t.productRole) {
    return decision({
      allowed: false,
      reason: 'UNKNOWN_PRODUCT_ROLE',
      policy: 'IDENTITY',
      code: POLICY_CODES.UNKNOWN_PRODUCT_ROLE,
    });
  }
  const ok = isPairStructurallyAllowed(a.productRole, t.productRole);
  return decision({
    allowed: ok,
    reason: ok ? 'PAIR_STRUCTURAL_ALLOW' : 'PAIR_STRUCTURAL_DENY',
    policy: 'PAIRING_824',
    scope: 'STRUCTURAL',
    code: ok ? POLICY_CODES.ALLOWED : POLICY_CODES.PAIR_DENIED,
    extra: { actorProductRole: a.productRole, targetProductRole: t.productRole },
  });
}

/**
 * Phase 5 — Canonical recipient resolution surface.
 * Engine: messagingPairing.resolveCanonicalPeer (KEEP).
 * Never trusts client role/branch/tenant as authority.
 *
 * @param {string} recipientId
 * @param {{ roleHint?: string, receiverRole?: string }} [context]
 * @returns {Promise<{
 *   ok: boolean,
 *   code: string,
 *   reason?: string,
 *   policy: string,
 *   isBroadcast?: boolean,
 *   recipient?: {
 *     id: string,
 *     tenantId: string|null,
 *     branchId: string|null,
 *     branchCode: string,
 *     productRole: string,
 *     adminRole: string|null,
 *     transportRole: string,
 *     name?: string|null,
 *     status?: string|null,
 *   }|null,
 *   _engine?: object,
 * }>}
 */
async function resolveCanonicalRecipient(recipientId, context = {}) {
  const rid = String(recipientId || '');
  const roleHint = context.roleHint || context.receiverRole || '';

  if (!rid) {
    return {
      ok: false,
      code: POLICY_CODES.RECIPIENT_NOT_FOUND,
      reason: 'MISSING_RECIPIENT_ID',
      policy: 'RECIPIENT_RESOLUTION',
      recipient: null,
    };
  }

  const engine = await resolveCanonicalPeer(rid, roleHint);
  if (!engine.ok) {
    return {
      ok: false,
      code: POLICY_CODES.RECIPIENT_NOT_FOUND,
      reason: engine.message || 'RECIPIENT_NOT_FOUND',
      policy: 'RECIPIENT_RESOLUTION',
      recipient: null,
      actorId: context.actorId || null,
      recipientId: rid,
    };
  }

  if (engine.isBroadcast) {
    return {
      ok: true,
      code: POLICY_CODES.ALLOWED,
      reason: 'BROADCAST_TARGET',
      policy: 'RECIPIENT_RESOLUTION',
      isBroadcast: true,
      recipient: {
        id: String(engine.finalReceiverId || rid),
        tenantId: null,
        branchId: null,
        branchCode: '',
        productRole: engine.productRole,
        adminRole: null,
        transportRole: engine.transportRole,
        name: null,
        status: null,
      },
      _engine: engine,
    };
  }

  const peer = engine.peer || {};
  const id = String(engine.finalReceiverId || peer.id || peer._id || rid);
  let tenantId = peer.tenantId != null && peer.tenantId !== '' ? String(peer.tenantId) : null;
  const branchId = peer.branchId != null && peer.branchId !== '' ? String(peer.branchId) : null;
  if (!tenantId) {
    tenantId = await resolveAuthoritativeTenantId({ tenantId: null, branchId });
  }
  return {
    ok: true,
    code: POLICY_CODES.ALLOWED,
    reason: 'RECIPIENT_RESOLVED',
    policy: 'RECIPIENT_RESOLUTION',
    isBroadcast: false,
    recipient: {
      id,
      tenantId,
      branchId,
      branchCode: peer.branchCode ? String(peer.branchCode) : '',
      productRole: engine.productRole,
      adminRole: peer.adminRole || null,
      transportRole: engine.transportRole,
      name: peer.name || null,
      status: peer.status || null,
    },
    _engine: engine,
  };
}

async function canSendMessage(actor, recipientIdOrUser, clientReceiverRoleHint = '') {
  if (!actor || !(actor.id || actor._id)) {
    return decision({
      allowed: false,
      reason: 'UNAUTHENTICATED',
      policy: 'AUTH',
      code: POLICY_CODES.AUTH_REQUIRED,
    });
  }

  const enrichedActor = await enrichActorIdentity(actor);
  const actorN = normalizeIdentity(enrichedActor);
  if (!actorN.productRole) {
    return decision({
      allowed: false,
      reason: 'UNKNOWN_ACTOR_PRODUCT_ROLE',
      policy: 'IDENTITY',
      code: POLICY_CODES.UNKNOWN_PRODUCT_ROLE,
    });
  }

  let receiverId = recipientIdOrUser;
  let hint = clientReceiverRoleHint;
  if (recipientIdOrUser && typeof recipientIdOrUser === 'object') {
    receiverId = recipientIdOrUser.id || recipientIdOrUser._id;
    hint = hint || recipientIdOrUser.role || '';
  }

  // Phase 5: explicit resolve → policy (pairing engine reused via options.resolved)
  const resolved = await resolveCanonicalRecipient(receiverId, {
    roleHint: hint,
    actorId: actorN.id,
  });
  if (!resolved.ok) {
    return decision({
      allowed: false,
      reason: resolved.reason || 'RECIPIENT_NOT_FOUND',
      policy: 'RECIPIENT_RESOLUTION',
      scope: 'RECIPIENT',
      code: POLICY_CODES.RECIPIENT_NOT_FOUND,
      extra: {
        actorProductRole: actorN.productRole,
        actorId: actorN.id,
        recipientId: String(receiverId || ''),
      },
    });
  }

  // Phase 5.1: Tenant Policy before Branch / Pairing (private DM only)
  if (!resolved.isBroadcast) {
    const actorTenantId = await resolveAuthoritativeTenantId(actorN);
    const recipientTenantId = resolved.recipient?.tenantId
      || await resolveAuthoritativeTenantId(resolved.recipient || {});
    let aligned = alignMessagingTenants(
      actorTenantId,
      recipientTenantId,
      actorN.productRole,
      resolved.recipient?.productRole || null,
    );
    // Pairing soft-scopes STAFF↔TEACHER/STUDENT and TEACHER↔STUDENT (assignment) —
    // do not fail-closed on missing tenant/branch for those pairs.
    if (shouldSoftAlignScopedTenants(
      actorN.productRole,
      resolved.recipient?.productRole || null,
      actorN,
      resolved.recipient || {},
    )) {
      aligned = softAlignScopedTenants(aligned.actorTenantId, aligned.recipientTenantId);
    }
    const tenantGate = assertTenantIsolation(aligned.actorTenantId, aligned.recipientTenantId, {
      actorId: actorN.id,
      recipientId: resolved.recipient?.id || String(receiverId || ''),
      actorProductRole: actorN.productRole,
      targetProductRole: resolved.recipient?.productRole || null,
    });
    if (!tenantGate.allowed) {
      return tenantGate;
    }
  }

  const pair = await assertMessagingPairAllowed(enrichedActor, receiverId, hint, {
    resolved: resolved._engine,
  });
  if (!pair.ok) {
    const branchish = /chi nhanh|branch/i.test(String(pair.message || ''));
    return decision({
      allowed: false,
      reason: pair.message || 'PAIR_DENIED',
      policy: branchish ? 'BRANCH_SCOPE' : 'PAIRING_824',
      scope: branchish ? 'BRANCH' : 'PAIR',
      code: branchish ? POLICY_CODES.BRANCH_DENIED : POLICY_CODES.PAIR_DENIED,
      extra: {
        actorProductRole: actorN.productRole,
        targetProductRole: resolved.recipient?.productRole || pair.productRole || null,
        recipient: resolved.recipient,
        pair,
      },
    });
  }

  return decision({
    allowed: true,
    reason: 'PAIR_ALLOWED',
    policy: 'PAIRING_824',
    scope: 'PAIR',
    code: POLICY_CODES.ALLOWED,
    extra: {
      actorProductRole: actorN.productRole,
      targetProductRole: pair.productRole || resolved.recipient?.productRole || null,
      transportRole: pair.transportRole || resolved.recipient?.transportRole || null,
      finalReceiverId: pair.finalReceiverId || resolved.recipient?.id || null,
      peer: pair.peer || null,
      recipient: resolved.recipient,
      pair,
    },
  });
}

async function canStartConversation(actor, target, context = {}) {
  if (context.existingParticipant === true) {
    const send = await canSendMessage(
      actor,
      target?.id || target?._id || target,
      target?.role || '',
    );
    if (send.allowed) {
      return decision({
        allowed: true,
        reason: 'EXISTING_PARTICIPANT_AND_CAN_SEND',
        policy: 'START',
        scope: send.scope,
        code: POLICY_CODES.ALLOWED,
        extra: { send },
      });
    }
    return decision({
      allowed: false,
      reason: send.reason,
      policy: 'START',
      scope: send.scope,
      code: send.code,
      extra: { send },
    });
  }

  const discover = canDiscoverContacts(actor, target, context);
  if (discover.allowed) {
    const send = canSendStructurally(actor, target);
    if (send.allowed) {
      return decision({
        allowed: true,
        reason: 'DISCOVERABLE_AND_STRUCTURAL_SEND',
        policy: 'START',
        scope: discover.scope,
        code: POLICY_CODES.ALLOWED,
        extra: { discover, send },
      });
    }
  }

  if (context.allowSendWithoutDiscover === true) {
    const send = await canSendMessage(
      actor,
      target?.id || target?._id || target,
      target?.role || '',
    );
    return decision({
      allowed: send.allowed,
      reason: send.allowed ? 'SEND_WITHOUT_DISCOVER' : send.reason,
      policy: 'START',
      scope: send.scope,
      code: send.code,
      extra: { discover, send },
    });
  }

  return decision({
    allowed: false,
    reason: discover.allowed ? 'STRUCTURAL_SEND_DENIED' : discover.reason,
    policy: 'START',
    code: POLICY_CODES.DISCOVER_DENIED,
    extra: { discover },
  });
}

function conversationAccessDecision(actor, conversationId, actionPolicy) {
  if (!actor || !(actor.id || actor._id)) {
    return decision({
      allowed: false,
      reason: 'UNAUTHENTICATED',
      policy: 'AUTH',
      code: POLICY_CODES.AUTH_REQUIRED,
    });
  }
  const cid = String(conversationId || '');
  if (!cid) {
    return decision({
      allowed: false,
      reason: 'MISSING_CONVERSATION',
      policy: actionPolicy,
      code: POLICY_CODES.CONVERSATION_DENIED,
    });
  }
  if (cid.startsWith('group_')) {
    return decision({
      allowed: false,
      reason: 'GROUP_REQUIRES_MEMBERSHIP_CHECK',
      policy: actionPolicy,
      scope: 'GROUP',
      code: POLICY_CODES.CONVERSATION_DENIED,
      extra: { requiresGroupMembership: true },
    });
  }
  const ok = canAccessDirectConversation(cid, actor);
  return decision({
    allowed: ok,
    reason: ok ? 'PARTICIPANT_OR_LEGACY_ADMIN_MAILBOX' : 'NOT_PARTICIPANT',
    policy: actionPolicy,
    scope: 'DIRECT',
    code: ok ? POLICY_CODES.ALLOWED : POLICY_CODES.CONVERSATION_DENIED,
    extra: {
      actorProductRole: resolveProductRole(actor),
      actorTransportRole: getMessagingRole(actor),
      elevatedMailbox: isAdminLevelMessagingUser(actor),
      tokens: parseDirectConversationTokens(cid),
    },
  });
}

function canViewConversation(actor, conversation) {
  const cid = typeof conversation === 'string'
    ? conversation
    : (conversation?.conversationId || conversation?.id || '');
  return conversationAccessDecision(actor, cid, 'VIEW');
}

function canReceiveMessage(actor, conversation) {
  const cid = typeof conversation === 'string'
    ? conversation
    : (conversation?.conversationId || conversation?.id || '');
  return conversationAccessDecision(actor, cid, 'RECEIVE');
}

function canMarkRead(actor, conversation) {
  const cid = typeof conversation === 'string'
    ? conversation
    : (conversation?.conversationId || conversation?.id || '');
  return conversationAccessDecision(actor, cid, 'MARK_READ');
}

function canReceiveNotification(actor, conversation) {
  const base = canReceiveMessage(actor, conversation);
  if (!base.allowed) return { ...base, policy: 'NOTIFICATION' };
  return decision({
    allowed: true,
    reason: 'REALTIME_CHAT_BADGE',
    policy: 'NOTIFICATION',
    scope: base.scope,
    code: POLICY_CODES.ALLOWED,
    extra: { persistentNotification: false, receive: base },
  });
}

async function assertCanDirectMessage(sender, receiverId, receiverRole) {
  const d = await canSendMessage(sender, receiverId, receiverRole);
  if (!d.allowed) {
    const code = d.code;
    let message = d.reason;
    if (d.reason === 'ACTOR_TENANT_MISSING' || d.reason === 'RECIPIENT_TENANT_MISSING') {
      message = 'Tài khoản chưa gắn chi nhánh hợp lệ để nhắn tin. Liên hệ quản trị viên.';
    } else if (code === POLICY_CODES.TENANT_MISMATCH || d.reason === 'TENANT_MISMATCH') {
      message = 'Không được nhắn tin sang chi nhánh/tổ chức khác';
    } else if (code === POLICY_CODES.BRANCH_DENIED) {
      message = d.reason && /chi nhanh|branch/i.test(d.reason)
        ? 'Không được nhắn tin giảng viên/học viên chi nhánh khác'
        : (d.reason || 'Không được nhắn tin đến người này');
    } else if (code === POLICY_CODES.PAIR_DENIED) {
      message = d.reason || 'Không được nhắn tin đến người này';
    }
    return {
      ok: false,
      message,
      code: d.code,
      policy: d.policy,
      scope: d.scope,
      reason: d.reason,
    };
  }
  const pair = d.pair || {};
  return {
    ok: true,
    peer: pair.peer || d.peer,
    productRole: pair.productRole || d.targetProductRole,
    transportRole: pair.transportRole || d.transportRole,
    finalReceiverId: pair.finalReceiverId || d.finalReceiverId,
    senderProduct: pair.senderProduct || d.actorProductRole,
    code: d.code,
    policy: d.policy,
    scope: d.scope,
  };
}

module.exports = {
  POLICY_CODES,
  PRODUCT_ROLES,
  normalizeIdentity,
  resolveProductRole,
  getMessagingRole,
  resolveCanonicalPeer,
  resolveCanonicalRecipient,
  resolveAuthoritativeTenantId,
  assertTenantIsolation,
  alignMessagingTenants,
  canDiscoverContacts,
  canSendStructurally,
  canSendMessage,
  canStartConversation,
  canViewConversation,
  canReceiveMessage,
  canMarkRead,
  canReceiveNotification,
  assertCanDirectMessage,
};
