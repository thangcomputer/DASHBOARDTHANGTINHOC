/**
 * Enterprise RBAC - Centralized Role Catalog (FUTURE TARGET).
 *
 * NOT LIVE authorization authority.
 * LIVE uses JWT role + ADMIN_ROLES (constants/permissions.js) + adminRole in DB.
 *
 * Phase 8.8: HIGH_ADMIN + SUPPORT_AGENT added for unified target contract.
 * SUPPORT retained as naming alias of SUPPORT_AGENT for existing dormant rolePermissions.
 */
const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  HIGH_ADMIN: 'HIGH_ADMIN',
  ADMIN_STAFF: 'ADMIN_STAFF',
  /** Canonical enterprise name for LIVE adminRole SUPPORT */
  SUPPORT_AGENT: 'SUPPORT_AGENT',
  /** Alias / legacy enterprise key — same semantic class as SUPPORT_AGENT */
  SUPPORT: 'SUPPORT',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
});

module.exports = ROLES;
