/**
 * Phase 8.8 / 8.15 — FUTURE role alias contract (NON-RUNTIME for LIVE enforcement).
 *
 * JWT `admin` / `staff` are identity roles, NOT enterprise canonical roles.
 * With adminRole → ALIAS to SUPER_ADMIN / HIGH_ADMIN / ADMIN_STAFF / SUPPORT_AGENT.
 * Without adminRole → LEGACY_PRINCIPAL (enterpriseRole=null): permission-bearing only.
 *
 * NEVER flatten:
 *   admin → SUPER_ADMIN
 *   admin → ADMIN_STAFF
 * solely because JWT role is admin/staff.
 *
 * Phase 8.15: LIVE assertStaffPermissions fallthrough ALLOWs admin|staff + permissions[]
 * even when adminRole is null. Enterprise shadow evaluates mapped permissions without
 * inventing a canonical role (LEGACY_PRINCIPAL).
 */

const ROLES = require('./roles');

/** LIVE adminRole → enterprise canonical role */
const ADMIN_ROLE_TO_ENTERPRISE = Object.freeze({
  SUPER_ADMIN: ROLES.SUPER_ADMIN,
  HIGH_ADMIN: ROLES.HIGH_ADMIN,
  STAFF: ROLES.ADMIN_STAFF,
  SUPPORT: ROLES.SUPPORT_AGENT,
});

/**
 * JWT role + optional adminRole → enterprise role (contract helper, not LIVE middleware).
 * @returns {{ enterpriseRole: string|null, type: string, notes: string }}
 */
function resolveEnterpriseRoleContract({ jwtRole, adminRole, userId } = {}) {
  if (String(userId) === 'admin') {
    return {
      enterpriseRole: ROLES.SUPER_ADMIN,
      type: 'LEGACY_ROOT',
      notes: 'id=admin is LEGACY root; semantic equivalent SUPER_ADMIN for comparison only',
    };
  }

  const jwt = String(jwtRole || '').toLowerCase();
  if (jwt === 'teacher') {
    return { enterpriseRole: ROLES.TEACHER, type: 'MATCH', notes: 'JWT teacher' };
  }
  if (jwt === 'student') {
    return { enterpriseRole: ROLES.STUDENT, type: 'MATCH', notes: 'JWT student' };
  }

  if (jwt === 'admin' || jwt === 'staff') {
    if (!adminRole) {
      return {
        enterpriseRole: null,
        type: 'LEGACY_PRINCIPAL',
        notes: (
          `JWT ${jwt} without adminRole is a permission-bearing LEGACY_PRINCIPAL; `
          + 'no enterprise role inference (not SUPER_ADMIN / ADMIN_STAFF)'
        ),
      };
    }
    const mapped = ADMIN_ROLE_TO_ENTERPRISE[adminRole];
    if (!mapped) {
      return {
        enterpriseRole: null,
        type: 'UNKNOWN',
        notes: `Unknown adminRole: ${adminRole}`,
      };
    }
    return {
      enterpriseRole: mapped,
      type: 'ALIAS',
      notes: `JWT ${jwt} + adminRole ${adminRole} → ${mapped}`,
    };
  }

  return {
    enterpriseRole: null,
    type: 'UNKNOWN',
    notes: `Unhandled JWT role: ${jwtRole}`,
  };
}

const ROLE_ALIAS_TABLE = Object.freeze([
  { live: 'SUPER_ADMIN', enterprise: ROLES.SUPER_ADMIN, type: 'MATCH' },
  { live: 'HIGH_ADMIN', enterprise: ROLES.HIGH_ADMIN, type: 'MATCH' },
  { live: 'STAFF', enterprise: ROLES.ADMIN_STAFF, type: 'SAFE_ALIAS' },
  { live: 'SUPPORT', enterprise: ROLES.SUPPORT_AGENT, type: 'SAFE_ALIAS' },
  { live: 'teacher', enterprise: ROLES.TEACHER, type: 'MATCH' },
  { live: 'student', enterprise: ROLES.STUDENT, type: 'MATCH' },
  {
    live: 'JWT admin without adminRole',
    enterprise: null,
    type: 'LEGACY_PRINCIPAL',
    notes: 'permission-bearing only; no role flatten',
  },
  {
    live: 'JWT staff without adminRole',
    enterprise: null,
    type: 'LEGACY_PRINCIPAL',
    notes: 'permission-bearing only; no role flatten',
  },
  { live: 'JWT admin + adminRole', enterprise: 'via ADMIN_ROLE_TO_ENTERPRISE', type: 'ALIAS' },
  { live: 'JWT staff + adminRole', enterprise: 'via ADMIN_ROLE_TO_ENTERPRISE', type: 'ALIAS' },
  { live: 'id=admin', enterprise: ROLES.SUPER_ADMIN, type: 'LEGACY_ROOT' },
]);

module.exports = {
  ADMIN_ROLE_TO_ENTERPRISE,
  ROLE_ALIAS_TABLE,
  resolveEnterpriseRoleContract,
  ROLES,
};
