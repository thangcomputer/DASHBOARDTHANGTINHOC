'use strict';

const mongoose = require('mongoose');

const outboxSchema = new mongoose.Schema({
  eventType: { type: String, required: true, index: true },
  aggregateType: { type: String, required: true },
  aggregateId: { type: mongoose.Schema.Types.ObjectId, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'],
    default: 'PENDING',
    index: true,
  },
  workerId: String,
  processingAt: Date,
  tenantId: { type: mongoose.Schema.Types.ObjectId, index: true },
  branchId: mongoose.Schema.Types.ObjectId,
  actorId: mongoose.Schema.Types.ObjectId,
  retryCount: { type: Number, default: 0 },
  lastError: String,
  processedAt: Date,
}, { timestamps: true });

outboxSchema.index({ status: 1, createdAt: 1 });
outboxSchema.index({ status: 1, processingAt: 1 });

module.exports = mongoose.models.OutboxEvent || mongoose.model('OutboxEvent', outboxSchema);
