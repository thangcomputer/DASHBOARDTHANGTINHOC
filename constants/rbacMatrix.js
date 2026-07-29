/**
 * RBAC matrix — nguồn sự thật cho Role × Permission × Scope (Phase 3).
 * Không đổi giá trị PERMISSIONS đã lưu DB.
 */
const { PERMISSIONS } = require('./permissions');

/** Roles chuẩn hệ thống */
const ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  BRANCH_ADMIN: 'BRANCH_ADMIN', // Teacher.role=admin + adminRole null/legacy — thực tế = staff nội bộ full-ish
  STAFF: 'STAFF',
  TEACHER: 'teacher',
  STUDENT: 'student',
});

/**
 * Scope dữ liệu
 * - global: Super Admin
 * - branch: Staff/Admin CN — chỉ branchId của mình
 * - own: Teacher/Student — chỉ resource mình (hoặc HV được assign)
 */
const SCOPES = Object.freeze({
  GLOBAL: 'global',
  BRANCH: 'branch',
  OWN: 'own',
});

/**
 * Quyền mặc định theo vai (Staff phải được cấp từng perm trong DB).
 * Super Admin = all.
 */
const ROLE_PERMISSION_DEFAULTS = Object.freeze({
  SUPER_ADMIN: Object.values(PERMISSIONS),
  STAFF: [], // deny-by-default; cấp qua UI
  teacher: [],
  student: [],
});

/**
 * Permission cần có để cấp mật khẩu theo đối tượng.
 */
const PROVISION_PASSWORD_PERMISSION = Object.freeze({
  student: PERMISSIONS.MANAGE_STUDENTS,
  teacher: PERMISSIONS.VIEW_TEACHERS,
});

/**
 * Ma trận tóm tắt (dùng doc + test). true = được phép về nguyên tắc (Staff còn cần perm cụ thể).
 */
const ACCESS_MATRIX = Object.freeze({
  manage_students: {
    SUPER_ADMIN: true,
    STAFF: 'perm',
    teacher: 'own_assigned',
    student: false,
  },
  manage_schedule: {
    SUPER_ADMIN: true,
    STAFF: 'perm',
    teacher: 'own',
    student: 'own_read',
  },
  manage_finance: {
    SUPER_ADMIN: true,
    STAFF: 'perm',
    teacher: false,
    student: false,
  },
  view_branch_revenue: {
    SUPER_ADMIN: true,
    STAFF: 'perm',
    teacher: false,
    student: false,
  },
  provision_password_student: {
    SUPER_ADMIN: true,
    STAFF: 'perm:manage_students',
    teacher: false,
    student: false,
  },
  provision_password_teacher: {
    SUPER_ADMIN: true,
    STAFF: 'perm:view_teachers',
    teacher: false,
    student: false,
  },
  audit_view: {
    SUPER_ADMIN: true,
    STAFF: 'perm:view_logs',
    teacher: false,
    student: false,
  },
  cross_branch: {
    SUPER_ADMIN: true,
    STAFF: false,
    teacher: false,
    student: false,
  },
});

function provisionPermissionForTarget(userRole) {
  return userRole === 'teacher'
    ? PROVISION_PASSWORD_PERMISSION.teacher
    : PROVISION_PASSWORD_PERMISSION.student;
}

module.exports = {
  ROLES,
  SCOPES,
  ROLE_PERMISSION_DEFAULTS,
  PROVISION_PASSWORD_PERMISSION,
  ACCESS_MATRIX,
  provisionPermissionForTarget,
  PERMISSIONS,
};
