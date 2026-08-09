const PERMISSIONS = require('./permissions');

/**
 * Phase 8.8 — FUTURE compatibility mapping (LIVE lowercase → enterprise domain:action).
 *
 * NOT LIVE authorization authority.
 * LIVE remains constants/permissions.js + middleware/auth.js + livePermissionAdapter.
 *
 * Do NOT mount authorize() on LIVE routes based on this file until Dual-Check phase.
 * Finance safety: view_branch_revenue → finance:branch_revenue:view (NOT finance:view).
 */

/** Keys present in LIVE catalog but unused on LIVE HTTP (or role-gated). Explicitly unmapped. */
const LEGACY_ONLY_KEYS = Object.freeze([
  'manage_schedule',
  'manage_messages',
  'view_logs',
  'view_evaluations',
]);

/**
 * Mapping quality vs LIVE semantics (Phase 8.8–8.10).
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
  view_teachers: 'MATCH',
  manage_teachers: 'MATCH',
  manage_hr: 'MATCH',
  view_branch_revenue: 'MATCH',
});

const legacyPermissionMapping = {
  manage_students: [
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
  system_settings: [PERMISSIONS.SETTINGS_UPDATE],
  manage_blog: [PERMISSIONS.CMS_PUBLISH],
  manage_training: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.EXAM_MANAGE],
  /** DISTINCT from manage_training — dedicated student_training:manage (Phase 8.10) */
  manage_student_training: [PERMISSIONS.STUDENT_TRAINING_MANAGE],
  manage_staff: [PERMISSIONS.USER_MANAGE],
  view_teachers: [PERMISSIONS.TEACHER_VIEW],
  manage_teachers: [PERMISSIONS.TEACHER_MANAGE],
  manage_hr: [PERMISSIONS.HR_MANAGE],

  // Uppercase aliases
  MANAGE_STUDENTS: [
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
  SYSTEM_SETTINGS: [PERMISSIONS.SETTINGS_UPDATE],
  MANAGE_BLOG: [PERMISSIONS.CMS_PUBLISH],
  MANAGE_TRAINING: [PERMISSIONS.COURSE_UPDATE, PERMISSIONS.EXAM_MANAGE],
  MANAGE_STUDENT_TRAINING: [PERMISSIONS.STUDENT_TRAINING_MANAGE],
  MANAGE_STAFF: [PERMISSIONS.USER_MANAGE],
  VIEW_TEACHERS: [PERMISSIONS.TEACHER_VIEW],
  MANAGE_TEACHERS: [PERMISSIONS.TEACHER_MANAGE],
  MANAGE_HR: [PERMISSIONS.HR_MANAGE],

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
