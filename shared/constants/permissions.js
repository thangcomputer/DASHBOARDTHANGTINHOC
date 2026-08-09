/**
 * Enterprise RBAC - Centralized Permission Catalog (FUTURE TARGET).
 * Standard format: domain:action | domain:sub:action
 *
 * NOT LIVE authorization authority.
 * LIVE authority remains: constants/permissions.js + middleware/auth.js
 *
 * Phase 8.8: hr:manage, teacher:manage, finance:branch_revenue:view
 * Phase 8.10: student_training:manage (distinct from manage_training)
 * Phase RBAC-S1: expand CRUD codes per role-crud-scope-matrix.md (shadow only)
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
  TEACHER_CREATE: 'teacher:create',
  TEACHER_UPDATE: 'teacher:update',
  TEACHER_DELETE: 'teacher:delete',
  TEACHER_ASSIGN: 'teacher:assign',
  /** LIVE manage_teachers (score / approve / reject + branch). Not teacher:view. */
  TEACHER_MANAGE: 'teacher:manage',

  // Staff / admin account capabilities
  STAFF_VIEW: 'staff:view',
  STAFF_CREATE: 'staff:create',
  STAFF_UPDATE: 'staff:update',
  STAFF_DELETE: 'staff:delete',
  HIGH_ADMIN_VIEW: 'high_admin:view',
  HIGH_ADMIN_CREATE: 'high_admin:create',
  HIGH_ADMIN_UPDATE: 'high_admin:update',
  HIGH_ADMIN_DELETE: 'high_admin:delete',
  SUPPORT_AGENT_VIEW: 'support_agent:view',
  SUPPORT_AGENT_CREATE: 'support_agent:create',
  SUPPORT_AGENT_UPDATE: 'support_agent:update',
  SUPPORT_AGENT_DELETE: 'support_agent:delete',

  // Course capabilities
  COURSE_VIEW: 'course:view',
  COURSE_CREATE: 'course:create',
  COURSE_UPDATE: 'course:update',
  COURSE_DELETE: 'course:delete',

  // Class & enrollment
  CLASS_VIEW: 'class:view',
  CLASS_CREATE: 'class:create',
  CLASS_UPDATE: 'class:update',
  CLASS_DELETE: 'class:delete',
  ENROLLMENT_VIEW: 'enrollment:view',
  ENROLLMENT_CREATE: 'enrollment:create',
  ENROLLMENT_UPDATE: 'enrollment:update',
  ENROLLMENT_DELETE: 'enrollment:delete',

  // Schedule & Attendance capabilities
  SCHEDULE_VIEW: 'schedule:view',
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_UPDATE: 'schedule:update',
  SCHEDULE_DELETE: 'schedule:delete',
  ATTENDANCE_MANAGE: 'attendance:manage',

  // Content / exam / result
  LESSON_VIEW: 'lesson:view',
  LESSON_CREATE: 'lesson:create',
  LESSON_UPDATE: 'lesson:update',
  LESSON_DELETE: 'lesson:delete',
  EXAM_VIEW: 'exam:view',
  EXAM_CREATE: 'exam:create',
  EXAM_UPDATE: 'exam:update',
  EXAM_DELETE: 'exam:delete',
  EXAM_MANAGE: 'exam:manage',
  RESULT_VIEW: 'result:view',
  RESULT_CREATE: 'result:create',
  RESULT_UPDATE: 'result:update',
  RESULT_DELETE: 'result:delete',
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
  MESSAGE_VIEW: 'message:view',
  MESSAGE_CREATE: 'message:create',
  MESSAGE_UPDATE: 'message:update',
  MESSAGE_DELETE: 'message:delete',
  CHAT_MODERATE: 'chat:moderate',
  NOTIFICATION_BROADCAST: 'notification:broadcast',

  // Ticket (Support track) — close/archive preferred over hard-delete for SUPPORT
  TICKET_VIEW: 'ticket:view',
  TICKET_CREATE: 'ticket:create',
  TICKET_UPDATE: 'ticket:update',
  TICKET_CLOSE: 'ticket:close',
  TICKET_ARCHIVE: 'ticket:archive',
  TICKET_DELETE: 'ticket:delete',
  TICKET_ESCALATE: 'ticket:escalate',

  // CMS capabilities
  CMS_PUBLISH: 'cms:publish',

  // Reports / audit / settings
  REPORT_VIEW: 'report:view',
  AUDIT_VIEW: 'audit:view',
  ANALYTICS_VIEW: 'analytics:view',
  SETTINGS_VIEW: 'settings:view',
  SETTINGS_UPDATE: 'settings:update',
  BRANCH_MANAGE: 'branch:manage',
  USER_MANAGE: 'user:manage',
  ROLE_MANAGE: 'role:manage',
  PERMISSION_MANAGE: 'permission:manage',
});

module.exports = PERMISSIONS;
