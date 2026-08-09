'use strict';

const mongoose = require('mongoose');

const outboxSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    index: true
  },
  aggregateType: {
    type: String,
    required: true
  },
  aggregateId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'],
    default: 'PENDING',
    index: true
  },
  workerId: {
    type: String
  },
  processingAt: {
    type: Date
  },
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    index: true
  },
  branchId: {
    type: mongoose.Schema.Types.ObjectId
  },
  actorId: {
    type: mongoose.Schema.Types.ObjectId
  },
  retryCount: {
    type: Number,
    default: 0
  },
  lastError: {
    type: String
  },
  processedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Claim path: PENDING first, then stuck PROCESSING leases
outboxSchema.index({ status: 1, createdAt: 1 });
outboxSchema.index({ status: 1, processingAt: 1 });

// Avoid OverwriteModelError
module.exports = mongoose.models.OutboxEvent || mongoose.model('OutboxEvent', outboxSchema);
