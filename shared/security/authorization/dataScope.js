/**
 * Design Data Scope resolver (RBAC-S2).
 *
 * NOT LIVE authorization authority — observe / dual-check only until S3 gates.
 * Scope codes match docs/rbac/role-crud-scope-matrix.md.
 *
 * Never trust client body/query for scope authority.
 */
'use strict';

const DATA_SCOPES = Object.freeze({
  ALL: 'ALL',
  ALL_OPERATIONAL: 'ALL_OPERATIONAL',
  BRANCH_ASSIGNED: 'BRANCH_ASSIGNED',
  SUPPORT_RELATED: 'SUPPORT_RELATED',
  OWN_AND_ASSIGNED_CLASS: 'OWN_AND_ASSIGNED_CLASS',
  OWN_AND_AUTHORIZED: 'OWN_AND_AUTHORIZED',
  NONE: 'NONE',
});

/**
 * @param {object} actor trusted actor from JWT/DB
 * @returns {string} DATA_SCOPES.*
 */
function resolveDataScope(actor = {}) {
  const id = actor.id != null ? String(actor.id) : '';
  const role = String(actor.role || '').toLowerCase();
  const adminRole = String(actor.adminRole || '').toUpperCase();

  if (id === 'admin' || adminRole === 'SUPER_ADMIN') return DATA_SCOPES.ALL;
  if (adminRole === 'HIGH_ADMIN') return DATA_SCOPES.ALL_OPERATIONAL;
  if (adminRole === 'STAFF' || role === 'staff') return DATA_SCOPES.BRANCH_ASSIGNED;
  if (adminRole === 'SUPPORT') return DATA_SCOPES.SUPPORT_RELATED;
  if (role === 'teacher') return DATA_SCOPES.OWN_AND_ASSIGNED_CLASS;
  if (role === 'student') return DATA_SCOPES.OWN_AND_AUTHORIZED;
  // JWT role=admin without adminRole — unresolved; do not invent ALL
  if (role === 'admin') return DATA_SCOPES.NONE;
  return DATA_SCOPES.NONE;
}

/**
 * Record-level scope check (design). Returns { inScope, reason }.
 * Does not throw; callers decide observe vs enforce.
 *
 * @param {object} actor
 * @param {string} resource e.g. 'student' | 'ticket' | 'message'
 * @param {object|null} record
 * @param {object} [ctx] server-trusted extras: branchCode, teacherId, studentId
 */
function assertInScope(actor = {}, resource = '', record = null, ctx = {}) {
  const scope = resolveDataScope(actor);
  const actorId = actor.id != null ? String(actor.id) : '';
  const branchCode = String(
    ctx.branchCode || actor.branchCode || actor.branchId || '',
  );

  if (scope === DATA_SCOPES.ALL) {
    return { inScope: true, reason: 'scope_all', scope };
  }

  if (scope === DATA_SCOPES.NONE) {
    return { inScope: false, reason: 'scope_unresolved', scope };
  }

  if (scope === DATA_SCOPES.ALL_OPERATIONAL) {
    // HIGH: operational resources ok; settings/audit SUPER ops denied at permission layer
    if (resource === 'settings' && ctx.highSystemConfig === true) {
      return { inScope: false, reason: 'high_forbidden_system_config', scope };
    }
    return { inScope: true, reason: 'scope_all_operational', scope };
  }

  if (!record && !ctx.listMode) {
    return { inScope: true, reason: 'no_record_skip', scope };
  }

  if (scope === DATA_SCOPES.BRANCH_ASSIGNED) {
    if (ctx.listMode) {
      return { inScope: true, reason: 'list_branch_filter_expected', scope };
    }
    const recBranch = String(
      record?.branchCode || record?.branchId || record?.branch_id || '',
    );
    if (branchCode && recBranch && branchCode !== recBranch) {
      return { inScope: false, reason: 'branch_mismatch', scope };
    }
    return { inScope: true, reason: 'branch_ok_or_unspecified', scope };
  }

  if (scope === DATA_SCOPES.SUPPORT_RELATED) {
    if (resource === 'student' || resource === 'teacher' || resource === 'message' || resource === 'ticket') {
      return { inScope: true, reason: 'support_related_resource', scope };
    }
    if (resource === 'course' || resource === 'class' || resource === 'enrollment') {
      return { inScope: false, reason: 'support_not_staff_ops', scope };
    }
    return { inScope: true, reason: 'support_default_allow_observe', scope };
  }

  if (scope === DATA_SCOPES.OWN_AND_ASSIGNED_CLASS) {
    if (ctx.listMode) {
      return { inScope: true, reason: 'list_teacher_filter_expected', scope };
    }
    if (resource === 'student') {
      const teacherId = String(record?.teacherId || '');
      const assigned = Array.isArray(record?.enrollments)
        && record.enrollments.some((e) => String(e?.teacherId) === actorId);
      if (teacherId === actorId || assigned) {
        return { inScope: true, reason: 'teacher_assigned_student', scope };
      }
      return { inScope: false, reason: 'student_not_assigned', scope };
    }
    if (resource === 'message' || resource === 'ticket') {
      return { inScope: true, reason: 'participant_acl_elsewhere', scope };
    }
    return { inScope: true, reason: 'teacher_default_observe', scope };
  }

  if (scope === DATA_SCOPES.OWN_AND_AUTHORIZED) {
    if (ctx.listMode) {
      return { inScope: true, reason: 'list_own_filter_expected', scope };
    }
    if (resource === 'student') {
      const sid = String(record?._id || record?.id || '');
      if (sid && sid === actorId) {
        return { inScope: true, reason: 'own_student', scope };
      }
      return { inScope: false, reason: 'not_own_student', scope };
    }
    if (resource === 'result' || resource === 'payment' || resource === 'ticket') {
      const owner = String(
        record?.studentId || record?.student_id || record?.ownerId || '',
      );
      if (owner && owner === actorId) {
        return { inScope: true, reason: 'own_record', scope };
      }
      return { inScope: false, reason: 'not_own_record', scope };
    }
    return { inScope: true, reason: 'student_default_observe', scope };
  }

  return { inScope: false, reason: 'unknown_scope', scope };
}

module.exports = {
  DATA_SCOPES,
  resolveDataScope,
  assertInScope,
};
