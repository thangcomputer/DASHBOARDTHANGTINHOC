/**
 * @deprecated Phase 8.8 — Third / dormant permission taxonomy.
 * DO NOT use for LIVE authorization or future Enterprise dual-read.
 * Future canonical: shared/constants/permissions.js (domain:action).
 * LIVE canonical: constants/permissions.js (lowercase manage_*).
 * Kept for dormant modules/support references only — do not delete in this phase.
 */
const PermissionCode = Object.freeze({
  // User Management
  USER_VIEW: 'USER_VIEW',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  USER_DELETE: 'USER_DELETE',

  // Course Management
  COURSE_VIEW: 'COURSE_VIEW',
  COURSE_CREATE: 'COURSE_CREATE',
  COURSE_UPDATE: 'COURSE_UPDATE',
  COURSE_DELETE: 'COURSE_DELETE',

  // Support & Chat
  SUPPORT_ASSIGN: 'SUPPORT_ASSIGN',
  SUPPORT_TRANSFER: 'SUPPORT_TRANSFER',
  MESSAGE_SEND: 'MESSAGE_SEND',
  MESSAGE_DELETE: 'MESSAGE_DELETE',

  // Finance
  PAYMENT_REFUND: 'PAYMENT_REFUND',

  // Reports
  REPORT_EXPORT: 'REPORT_EXPORT',
});

module.exports = PermissionCode;
