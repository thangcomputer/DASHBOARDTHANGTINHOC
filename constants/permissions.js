/**
 * Bộ mã quyền — CommonJS mirror của client/src/constants/permissions.js
 * Không đổi giá trị key đã lưu DB.
 */
const PERMISSIONS = {
  MANAGE_STUDENTS: 'manage_students',
  MANAGE_SCHEDULE: 'manage_schedule',
  MANAGE_FINANCE: 'manage_finance',
  MANAGE_MESSAGES: 'manage_messages',
  MANAGE_TRAINING: 'manage_training',
  MANAGE_STUDENT_TRAINING: 'manage_student_training',
  MANAGE_CERT_PREP: 'manage_cert_prep',
  MANAGE_STAFF: 'manage_staff',
  MANAGE_HR: 'manage_hr',
  MANAGE_BLOG: 'manage_blog',
  SYSTEM_SETTINGS: 'system_settings',
  VIEW_LOGS: 'view_logs',
  VIEW_EVALUATIONS: 'view_evaluations',
  VIEW_BRANCH_REVENUE: 'view_branch_revenue',
  VIEW_TEACHERS: 'view_teachers',
  MANAGE_TEACHERS: 'manage_teachers',
  VIEW_CENTER_INFO: 'view_center_info',
  MANAGE_CENTER_INFO: 'manage_center_info',
};

/** Enum các adminRole — dùng chung thay vì hard-code string */
const ADMIN_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HIGH_ADMIN: 'HIGH_ADMIN',
  STAFF: 'STAFF',
  SUPPORT: 'SUPPORT',
};

/** Quyền mặc định khi tạo HIGH_ADMIN — có thể điều chỉnh sau */
const HIGH_ADMIN_DEFAULT_PERMISSIONS = [
  'manage_students', 'view_teachers', 'manage_teachers', 'manage_schedule',
  'manage_messages', 'manage_finance', 'view_branch_revenue',
  'manage_training', 'manage_student_training',
  'manage_hr', 'manage_blog',
  'view_logs', 'view_evaluations',
];

const SUPPORT_DEFAULT_PERMISSIONS = ['manage_messages'];

module.exports = { PERMISSIONS, ADMIN_ROLES, HIGH_ADMIN_DEFAULT_PERMISSIONS, SUPPORT_DEFAULT_PERMISSIONS };
