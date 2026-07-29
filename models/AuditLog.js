/**
 * AuditLog — nhật ký nghiệp vụ append-only (ADR 0005).
 * Không UPDATE/DELETE qua API nghiệp vụ. Redact password/token ở tầng service.
 */
const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now, index: true },
    actorUserId: { type: String, default: '', index: true },
    actorRole: { type: String, default: '' },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null, index: true },

    action: { type: String, required: true, trim: true, index: true }, // course.soft_delete, ...
    entityType: { type: String, default: '', index: true },
    entityId: { type: String, default: '', index: true },

    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },

    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
    requestId: { type: String, default: '' },
    correlationId: { type: String, default: '' },

    courseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', default: null },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher', default: null },
    enrollmentId: { type: String, default: '' },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Schedule', default: null },

    /** Phase 14 — archive (ẩn khỏi query mặc định, không xóa) */
    archivedAt: { type: Date, default: null, index: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

AuditLogSchema.index({ branchId: 1, at: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, at: -1 });
AuditLogSchema.index({ action: 1, at: -1 });
AuditLogSchema.index({ archivedAt: 1, at: -1 });

module.exports = mongoose.model('AuditLog', AuditLogSchema);
