/**
 * Bộ mã quyền — CommonJS mirror của client/src/constants/permissions.js
 * Không đổi giá trị key đã lưu DB.
 */
const PERMISSIONS = {
  MANAGE_STUDENTS: 'manage_students',
  MANAGE_SCHEDULE: 'manage_schedule',
  MANAGE_FINANCE: 'manage_finance',
  MANAGE_TRAINING: 'manage_training',
  MANAGE_STUDENT_TRAINING: 'manage_student_training',
  MANAGE_STAFF: 'manage_staff',
  MANAGE_HR: 'manage_hr',
  MANAGE_BLOG: 'manage_blog',
  SYSTEM_SETTINGS: 'system_settings',
  VIEW_LOGS: 'view_logs',
  VIEW_EVALUATIONS: 'view_evaluations',
  VIEW_BRANCH_REVENUE: 'view_branch_revenue',
  VIEW_TEACHERS: 'view_teachers',
};

module.exports = { PERMISSIONS };
