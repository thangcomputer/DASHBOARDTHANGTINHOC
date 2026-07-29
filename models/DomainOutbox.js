/**
 * DomainOutbox — transactional outbox cho domain events (ADR 0005).
 * Writer: cùng unit-of-work với mutation. Reader/worker: publish Notification/Audit side-effects.
 */
const mongoose = require('mongoose');

const DomainOutboxSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, unique: true, trim: true },
    eventType: { type: String, required: true, trim: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null, index: true },
    tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
    status: {
      type: String,
      enum: ['pending', 'processing', 'done', 'failed'],
      default: 'pending',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    availableAt: { type: Date, default: Date.now, index: true },
    processedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

DomainOutboxSchema.index({ status: 1, availableAt: 1 });

module.exports = mongoose.model('DomainOutbox', DomainOutboxSchema);
