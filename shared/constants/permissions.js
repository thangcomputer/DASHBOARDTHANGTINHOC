/**
 * Enterprise RBAC - Centralized Permission Catalog (FUTURE TARGET).
 * Standard format: domain:action | domain:sub:action
 *
 * NOT LIVE authorization authority.
 * LIVE authority remains: constants/permissions.js + middleware/auth.js
 *
 * Phase 8.8: added hr:manage, teacher:manage, finance:branch_revenue:view
 * for future dual-read/dual-check parity (not mounted on LIVE routes).
 */
const PERMISSIONS = Object.freeze({
  // Global bypass wildcard (enterprise Super only — NEVER a Cutover family wildcard)
  ALL: 'ALL',

  // Student capabilities
  STUDENT_VIEW: 'student:view',
  STUDENT_CREATE: 'student:create',
  STUDENT_UPDATE: 'student:update',
  STUDENT_DELETE: 'student:delete',

  // Teacher capabilities
  TEACHER_VIEW: 'teacher:view',
  TEACHER_UPDATE: 'teacher:update',
  TEACHER_ASSIGN: 'teacher:assign',
  /** LIVE manage_teachers (score / approve / reject + branch). Not teacher:view. */
  TEACHER_MANAGE: 'teacher:manage',

  // Course capabilities
  COURSE_VIEW: 'course:view',
  COURSE_CREATE: 'course:create',
  COURSE_UPDATE: 'course:update',
  COURSE_DELETE: 'course:delete',

  // Schedule & Attendance capabilities
  SCHEDULE_VIEW: 'schedule:view',
  SCHEDULE_UPDATE: 'schedule:update',
  ATTENDANCE_MANAGE: 'attendance:manage',

  // Exam & Certificate capabilities
  EXAM_MANAGE: 'exam:manage',
  CERTIFICATE_ISSUE: 'certificate:issue',

  // Finance capabilities
  FINANCE_VIEW: 'finance:view',
  FINANCE_PAYMENT_CREATE: 'finance:payment:create',
  FINANCE_REFUND_APPROVE: 'finance:refund:approve',
  /**
   * LIVE view_branch_revenue — read-only revenue/analytics.
   * MUST NOT equal FINANCE_VIEW alone (privilege collision resolved Phase 8.7/8.8).
   */
  FINANCE_BRANCH_REVENUE_VIEW: 'finance:branch_revenue:view',

  // HR (LIVE manage_hr — employee CRUD + pay + payroll)
  HR_MANAGE: 'hr:manage',

  /**
   * LIVE manage_student_training — student training module / settings / exam any-of.
   * Distinct from manage_training (teacher training / quizzes / LMS admin).
   * Phase 8.10: NOT course:update (would widen via manage_training overlap).
   */
  STUDENT_TRAINING_MANAGE: 'student_training:manage',

  // Chat & Support capabilities
  CHAT_MODERATE: 'chat:moderate',
  NOTIFICATION_BROADCAST: 'notification:broadcast',

  // CMS capabilities
  CMS_PUBLISH: 'cms:publish',

  // Admin & Settings capabilities
  ANALYTICS_VIEW: 'analytics:view',
  SETTINGS_UPDATE: 'settings:update',
  BRANCH_MANAGE: 'branch:manage',
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  PERMISSION_MANAGE: 'permission:manage',
});

module.exports = PERMISSIONS;
