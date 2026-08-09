const { resolveRolePermissions } = require('./rolePermissions');
const ROLES = require('../../shared/constants/roles');
const PERMISSIONS = require('../../shared/constants/permissions');
const PermissionCache = require('../../shared/cache/permissionCache');

const PermissionService = {
  /**
   * Check if user has Super Admin role or wildcard permission.
   *
   * @param {Object} user
   * @returns {boolean}
   */
  isSuperAdmin: (user) => {
    if (!user) return false;
    const role = user.roleCode || user.adminRole;
    if (role === ROLES.SUPER_ADMIN) return true;

    const legacyPermissions = Array.isArray(user.permissions) ? user.permissions : [];
    return legacyPermissions.includes('ALL') || legacyPermissions.includes(PERMISSIONS.ALL);
  },

  /**
   * Resolves the effective permission list for a user.
   * Merges: role-mapped permissions + custom grants − deny rules + legacy inline array.
   *
   * @param {Object} user
   * @returns {string[]}
   */
  getPermissions: (user) => {
    if (!user) return [];

    const role = user.roleCode || user.adminRole;
    let resolved = [];
    if (role) {
      resolved = resolveRolePermissions(role);
    }

    const customGrants = user.customPermissions || [];
    const denyRules = user.denyPermissions || [];

    let finalPermissions = [...resolved, ...customGrants];
    finalPermissions = finalPermissions.filter(p => !denyRules.includes(p));

    // Merge legacy fallback array (backward compatibility)
    const legacyPermissions = Array.isArray(user.permissions) ? user.permissions : [];
    for (const lp of legacyPermissions) {
      if (!finalPermissions.includes(lp)) {
        finalPermissions.push(lp);
      }
    }

    return finalPermissions;
  },

  // ─── Cache Interfaces (delegating to PermissionCache adapter) ─────────────

  /**
   * Retrieve cached permissions for a user.
   *
   * @param {string} userId
   * @returns {Promise<string[]|null>}
   */
  getCachedPermissions: async (userId) => {
    return PermissionCache.get(userId);
  },

  /**
   * Store resolved permissions in cache.
   *
   * @param {string} userId
   * @param {string[]} permissions
   * @param {number} [ttlSec]
   * @returns {Promise<void>}
   */
  setCachedPermissions: async (userId, permissions, ttlSec) => {
    return PermissionCache.set(userId, permissions, ttlSec);
  },

  /**
   * Invalidate cached permissions.
   * Must be called on role change, permission change, or branch/tenant reassignment.
   *
   * @param {string|null} [userId] - Specific user or null to flush all
   * @returns {Promise<void>}
   */
  invalidateCache: async (userId = null) => {
    return PermissionCache.invalidate(userId);
  },

  // ─── Internal: Resolve with Cache-Aside Pattern ────────────────────────────

  /**
   * @private
   * Resolve user permissions — check cache first, populate on miss.
   *
   * @param {Object} user
   * @returns {Promise<string[]>}
   */
  _resolveWithCache: async (user) => {
    const userId = user.id || user._id;
    const cached = await PermissionCache.get(userId);
    if (cached !== null) {
      return cached;
    }
    const resolved = PermissionService.getPermissions(user);
    await PermissionCache.set(userId, resolved);
    return resolved;
  },

  // ─── Public Permission Check APIs ─────────────────────────────────────────

  /**
   * Check if a user possesses the required permission.
   *
   * @param {Object} user
   * @param {string} permission
   * @param {Object} [context] - Optional Policy Engine context (reserved)
   * @returns {Promise<boolean>}
   */
  hasPermission: async (user, permission, context = {}) => {
    if (!user) return false;
    if (PermissionService.isSuperAdmin(user)) return true;

    const userPermissions = await PermissionService._resolveWithCache(user);
    return userPermissions.includes(PERMISSIONS.ALL) || userPermissions.includes(permission);
  },

  /**
   * Check if user has AT LEAST ONE of the specified permissions.
   *
   * @param {Object} user
   * @param {string[]} permissions
   * @param {Object} [context]
   * @returns {Promise<boolean>}
   */
  hasAnyPermission: async (user, permissions = [], context = {}) => {
    if (!user) return false;
    if (PermissionService.isSuperAdmin(user)) return true;

    const userPermissions = await PermissionService._resolveWithCache(user);
    if (userPermissions.includes(PERMISSIONS.ALL)) return true;
    return permissions.some(p => userPermissions.includes(p));
  },

  /**
   * Check if user has ALL of the specified permissions.
   *
   * @param {Object} user
   * @param {string[]} permissions
   * @param {Object} [context]
   * @returns {Promise<boolean>}
   */
  hasAllPermissions: async (user, permissions = [], context = {}) => {
    if (!user) return false;
    if (PermissionService.isSuperAdmin(user)) return true;

    const userPermissions = await PermissionService._resolveWithCache(user);
    if (userPermissions.includes(PERMISSIONS.ALL)) return true;
    return permissions.every(p => userPermissions.includes(p));
  },
};

module.exports = PermissionService;
