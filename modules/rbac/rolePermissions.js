const ROLES = require('../../shared/constants/roles');
const PERMISSIONS = require('../../shared/constants/permissions');

/**
 * Static mapping of base permissions assigned to default roles.
 */
const rolePermissions = {
  [ROLES.STUDENT]: [
    PERMISSIONS.COURSE_VIEW,
    PERMISSIONS.SCHEDULE_VIEW,
  ],
  [ROLES.TEACHER]: [
    PERMISSIONS.SCHEDULE_UPDATE,
    PERMISSIONS.ATTENDANCE_MANAGE,
    PERMISSIONS.EXAM_MANAGE,
    PERMISSIONS.STUDENT_VIEW,
  ],
  [ROLES.SUPPORT]: [
    PERMISSIONS.TEACHER_VIEW,
    PERMISSIONS.CHAT_MODERATE,
  ],
  [ROLES.ADMIN_STAFF]: [
    PERMISSIONS.STUDENT_CREATE,
    PERMISSIONS.STUDENT_UPDATE,
    PERMISSIONS.STUDENT_DELETE,
    PERMISSIONS.TEACHER_UPDATE,
    PERMISSIONS.TEACHER_ASSIGN,
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_UPDATE,
    PERMISSIONS.COURSE_DELETE,
    PERMISSIONS.CERTIFICATE_ISSUE,
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_PAYMENT_CREATE,
    PERMISSIONS.NOTIFICATION_BROADCAST,
    PERMISSIONS.CMS_PUBLISH,
    PERMISSIONS.ANALYTICS_VIEW,
  ],
  [ROLES.SUPER_ADMIN]: [
    PERMISSIONS.ALL,
  ],
};

/**
 * Explicit role inheritance chains.
 * Kept independent as per ARB recommendation.
 */
const inheritanceRules = {
  [ROLES.TEACHER]: [ROLES.STUDENT],
  [ROLES.SUPPORT]: [ROLES.STUDENT],
  [ROLES.ADMIN_STAFF]: [ROLES.SUPPORT, ROLES.TEACHER],
  [ROLES.SUPER_ADMIN]: [],
  [ROLES.STUDENT]: [],
};

/**
 * Helper to recursively resolve role permissions through the inheritance chain.
 *
 * @param {string} role - The role to resolve permissions for
 * @param {Set<string>} [visited] - Internal cycle prevention set
 * @returns {string[]} Resolved permissions array
 */
const resolveRolePermissions = (role, visited = new Set()) => {
  if (!role || visited.has(role)) return [];
  visited.add(role);

  const basePermissions = rolePermissions[role] || [];
  const inherits = inheritanceRules[role] || [];

  let resolved = [...basePermissions];
  for (const parentRole of inherits) {
    resolved = resolved.concat(resolveRolePermissions(parentRole, visited));
  }

  return Array.from(new Set(resolved));
};

module.exports = {
  rolePermissions,
  inheritanceRules,
  resolveRolePermissions,
};
