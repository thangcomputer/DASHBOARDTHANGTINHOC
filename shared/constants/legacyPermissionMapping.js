const PERMISSIONS = require('./permissions');

/**
 * Phase 8.8 — FUTURE compatibility mapping (LIVE lowercase → enterprise domain:action).
 * Phase RBAC-S1 — expanded CRUD codes for design matrix parity (shadow only).
 *
 * NOT LIVE authorization authority.
 * LIVE remains constants/permissions.js + middleware/auth.js + livePermissionAdapter.
 *
 * Do NOT mount authorize() on LIVE routes based on this file until Dual-Check / S3 gate.
 * Finance safety: view_branch_revenue → finance:branch_revenue:view (NOT finance:view).
 */

/** Keys that remain coarse on LIVE with no single enterprise 1:1 until S3 module work. */
const LEGACY_ONLY_KEYS = Object.freeze([
  'view_evaluations',
]);

/**
 * Mapping quality vs LIVE semantics (Phase 8.8–8.10 + RBAC-S1).
 * manage_student_training MUST stay DISTINCT from manage_training.
 */
const MAPPING_STATUS = Object.freeze({
  manage_students: 'PARTIAL',
  manage_training: 'PARTIAL',
  manage_student_training: 'MATCH',
  manage_finance: 'PARTIAL',
  manage_staff: 'PARTIAL',
  manage_blog: 'PARTIAL',
  system_settings: 'PARTIAL',
  manage_schedule: 'PARTIAL',
  manage_messages: 'PARTIAL',
  view_logs: 'PARTIAL',
  view_teachers: 'MATCH',
  manage_teachers: 'MATCH',
  manage_hr: 'MATCH',
  view_branch_revenue: 'MATCH',
});

const legacyPermissionMapping = {
  manage_students: [
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.STUDENT_CREATE,
    PERMISSIONS.STUDENT_UPDATE,
    PERMISSIONS.STUDENT_DELETE,
  ],
  manage_finance: [
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_PAYMENT_CREATE,
    PERMISSIONS.FINANCE_REFUND_APPROVE,
  ],
  /** MUST NOT be FINANCE_VIEW — privilege boundary vs manage_finance */
  view_branch_revenue: [PERMISSIONS.FINANCE_BRANCH_REVENUE_VIEW],
  system_settings: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_UPDATE],
  manage_blog: [PERMISSIONS.CMS_PUBLISH],
  manage_training: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.EXAM_MANAGE],
  /** DISTINCT from manage_training — dedicated student_training:manage (Phase 8.10) */
  manage_student_training: [PERMISSIONS.STUDENT_TRAINING_MANAGE],
  manage_staff: [
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_CREATE,
    PERMISSIONS.STAFF_UPDATE,
    PERMISSIONS.STAFF_DELETE,
  ],
  view_teachers: [PERMISSIONS.TEACHER_VIEW],
  manage_teachers: [PERMISSIONS.TEACHER_MANAGE],
  manage_hr: [PERMISSIONS.HR_MANAGE],
  manage_schedule: [
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_CREATE,
    PERMISSIONS.SCHEDULE_UPDATE,
    PERMISSIONS.SCHEDULE_DELETE,
    PERMISSIONS.CLASS_VIEW,
    PERMISSIONS.CLASS_UPDATE,
  ],
  /**
   * LIVE manage_messages covers inbox + support chat.
   * Ticket codes are shadow targets until a dedicated ticket module mounts on LIVE.
   */
  manage_messages: [
    PERMISSIONS.MESSAGE_VIEW,
    PERMISSIONS.MESSAGE_CREATE,
    PERMISSIONS.MESSAGE_UPDATE,
    PERMISSIONS.MESSAGE_DELETE,
    PERMISSIONS.TICKET_VIEW,
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_UPDATE,
    PERMISSIONS.TICKET_CLOSE,
    PERMISSIONS.TICKET_ARCHIVE,
    PERMISSIONS.TICKET_ESCALATE,
  ],
  view_logs: [PERMISSIONS.AUDIT_VIEW],

  // Uppercase aliases
  MANAGE_STUDENTS: [
    PERMISSIONS.STUDENT_VIEW,
    PERMISSIONS.STUDENT_CREATE,
    PERMISSIONS.STUDENT_UPDATE,
    PERMISSIONS.STUDENT_DELETE,
  ],
  MANAGE_FINANCE: [
    PERMISSIONS.FINANCE_VIEW,
    PERMISSIONS.FINANCE_PAYMENT_CREATE,
    PERMISSIONS.FINANCE_REFUND_APPROVE,
  ],
  VIEW_BRANCH_REVENUE: [PERMISSIONS.FINANCE_BRANCH_REVENUE_VIEW],
  SYSTEM_SETTINGS: [PERMISSIONS.SETTINGS_VIEW, PERMISSIONS.SETTINGS_UPDATE],
  MANAGE_BLOG: [PERMISSIONS.CMS_PUBLISH],
  MANAGE_TRAINING: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.EXAM_MANAGE],
  MANAGE_STUDENT_TRAINING: [PERMISSIONS.STUDENT_TRAINING_MANAGE],
  MANAGE_STAFF: [
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.STAFF_VIEW,
    PERMISSIONS.STAFF_CREATE,
    PERMISSIONS.STAFF_UPDATE,
    PERMISSIONS.STAFF_DELETE,
  ],
  VIEW_TEACHERS: [PERMISSIONS.TEACHER_VIEW],
  MANAGE_TEACHERS: [PERMISSIONS.TEACHER_MANAGE],
  MANAGE_HR: [PERMISSIONS.HR_MANAGE],
  MANAGE_SCHEDULE: [
    PERMISSIONS.SCHEDULE_VIEW,
    PERMISSIONS.SCHEDULE_CREATE,
    PERMISSIONS.SCHEDULE_UPDATE,
    PERMISSIONS.SCHEDULE_DELETE,
    PERMISSIONS.CLASS_VIEW,
    PERMISSIONS.CLASS_UPDATE,
  ],
  MANAGE_MESSAGES: [
    PERMISSIONS.MESSAGE_VIEW,
    PERMISSIONS.MESSAGE_CREATE,
    PERMISSIONS.MESSAGE_UPDATE,
    PERMISSIONS.MESSAGE_DELETE,
    PERMISSIONS.TICKET_VIEW,
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_UPDATE,
    PERMISSIONS.TICKET_CLOSE,
    PERMISSIONS.TICKET_ARCHIVE,
    PERMISSIONS.TICKET_ESCALATE,
  ],
  VIEW_LOGS: [PERMISSIONS.AUDIT_VIEW],

  /**
   * Resolve LIVE key → enterprise permission array.
   * LEGACY_ONLY → []. Unknown → [] (no invented pass-through of LIVE strings as enterprise).
   */
  resolve: (legacyKey) => {
    if (legacyKey === undefined || legacyKey === null) return [];
    const key = String(legacyKey).trim();
    if (!key) return [];
    const lower = key.toLowerCase();
    if (LEGACY_ONLY_KEYS.includes(lower)) return [];
    if (Array.isArray(legacyPermissionMapping[key])) {
      return [...legacyPermissionMapping[key]];
    }
    if (Array.isArray(legacyPermissionMapping[lower])) {
      return [...legacyPermissionMapping[lower]];
    }
    return [];
  },

  isLegacyOnly: (legacyKey) => LEGACY_ONLY_KEYS.includes(String(legacyKey || '').toLowerCase()),

  getMappingStatus: (legacyKey) => {
    const lower = String(legacyKey || '').toLowerCase();
    if (LEGACY_ONLY_KEYS.includes(lower)) return 'LEGACY_ONLY';
    return MAPPING_STATUS[lower] || 'UNMAPPED';
  },

  LEGACY_ONLY_KEYS,
  MAPPING_STATUS,
};

module.exports = legacyPermissionMapping;
