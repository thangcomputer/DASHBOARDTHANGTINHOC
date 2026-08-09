/**
 * AuditLog — nhật ký nghiệp vụ có old/new (bổ sung SystemLog HTTP).
 */
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, trim: true, index: true },
    actorUserId: { type: String, default: '', index: true },
    actorRole: { type: String, default: '' },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    entityType: { type: String, default: '', index: true },
    entityId: { type: String, default: '', index: true },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      default: null,
      index: true,
    },
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Teacher',
      default: null,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: {} },
    newValue: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '', maxlength: 500 },
    device: { type: String, default: '' },
    requestId: { type: String, default: '', index: true },
    correlationId: { type: String, default: '', index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
