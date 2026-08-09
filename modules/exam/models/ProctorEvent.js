const mongoose = require('mongoose');

/**
 * Audit log sự kiện giám sát thi (không lưu video/frame).
 */
const proctorEventSchema = new mongoose.Schema(
  {
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ['student', 'teacher', 'admin', 'staff', 'unknown'], default: 'unknown' },
    sessionId: { type: String, default: '', index: true },
    examType: { type: String, default: 'exam' },
    type: { type: String, required: true, index: true },
    severity: { type: String, enum: ['info', 'soft', 'warn', 'critical'], default: 'info' },
    detail: { type: mongoose.Schema.Types.Mixed, default: {} },
    clientTs: { type: Date },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true },
);

proctorEventSchema.index({ createdAt: -1 });
proctorEventSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ProctorEvent', proctorEventSchema);
