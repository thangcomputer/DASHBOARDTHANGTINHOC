/**
 * Structured audit writer used by ledger and other domain services.
 */
const AuditLog = require('../models/AuditLog');
const SystemLog = require('../models/SystemLog');
const logger = require('../config/logger');

async function writeAudit({
  action,
  actorUserId = '',
  actorRole = '',
  branchId = null,
  entityType = '',
  entityId = '',
  studentId = null,
  teacherId = null,
  courseId = null,
  oldValue = {},
  newValue = {},
  ip = '',
  userAgent = '',
  device = '',
} = {}) {
  if (!action) return null;

  try {
    const doc = await AuditLog.create({
      action,
      actorUserId: String(actorUserId || ''),
      actorRole: String(actorRole || ''),
      branchId: branchId || null,
      entityType: String(entityType || ''),
      entityId: String(entityId || ''),
      studentId: studentId || null,
      teacherId: teacherId || null,
      courseId: courseId || null,
      oldValue: oldValue || {},
      newValue: newValue || {},
      ip: String(ip || '').slice(0, 80),
      userAgent: String(userAgent || '').slice(0, 500),
      device: String(device || '').slice(0, 120),
    });

    // Mirror finance actions vào SystemLog để Admin xem trên UI log hiện có
    if (String(action).startsWith('payment.') || String(action).startsWith('course.')) {
      SystemLog.create({
        user_id: String(actorUserId || 'system'),
        name: String(actorRole || 'system'),
        role: String(actorRole || 'system'),
        action: String(action),
        category: 'finance',
        target: `${entityType}/${entityId}`,
        message: `${action} ${entityType} ${entityId}`.trim(),
        method: 'SERVICE',
        ip: String(ip || 'unknown'),
        userAgent: String(userAgent || '').slice(0, 500),
      }).catch(() => {});
    }

    return doc;
  } catch (err) {
    logger.warn('[audit] writeAudit failed: %s', err.message);
    return null;
  }
}

module.exports = { writeAudit };
