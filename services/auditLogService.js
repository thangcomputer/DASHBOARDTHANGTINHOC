/**
 * auditLogService — ghi AuditLog append-only + redact (ADR 0005).
 * Phase 1: service sẵn; routes migrate dần ở phase sau.
 */
const AuditLog = require('../models/AuditLog');

const REDACT_KEYS = new Set([
  'password',
  'newPassword',
  'oldPassword',
  'token',
  'refreshToken',
  'accessToken',
  'otp',
  'secret',
  'mfaSecret',
  'mfaPendingSecret',
]);

function redact(value, depth = 0) {
  if (value == null || depth > 6) return value;
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (REDACT_KEYS.has(k)) out[k] = '[REDACTED]';
    else out[k] = redact(v, depth + 1);
  }
  return out;
}

/**
 * @param {object} entry
 */
async function writeAudit(entry = {}) {
  const doc = {
    at: entry.at || new Date(),
    actorUserId: entry.actorUserId != null ? String(entry.actorUserId) : '',
    actorRole: entry.actorRole || '',
    branchId: entry.branchId || null,
    tenantId: entry.tenantId || null,
    action: entry.action,
    entityType: entry.entityType || '',
    entityId: entry.entityId != null ? String(entry.entityId) : '',
    oldValue: entry.oldValue != null ? redact(entry.oldValue) : null,
    newValue: entry.newValue != null ? redact(entry.newValue) : null,
    ip: entry.ip || '',
    userAgent: entry.userAgent || '',
    requestId: entry.requestId || '',
    correlationId: entry.correlationId || '',
    courseId: entry.courseId || null,
    studentId: entry.studentId || null,
    teacherId: entry.teacherId || null,
    enrollmentId: entry.enrollmentId != null ? String(entry.enrollmentId) : '',
    sessionId: entry.sessionId || null,
  };
  if (!doc.action) throw new Error('writeAudit: action là bắt buộc');
  return AuditLog.create(doc);
}

module.exports = {
  writeAudit,
  redact,
  REDACT_KEYS,
};
