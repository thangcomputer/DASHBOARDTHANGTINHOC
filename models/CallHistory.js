'use strict';

const mongoose = require('mongoose');

const callHistorySchema = new mongoose.Schema({
  callId: { type: String, required: true, unique: true, trim: true },
  conversationId: { type: String, required: true, trim: true },
  callerId: { type: String, required: true, index: true },
  callerRole: { type: String, required: true, enum: ['student', 'teacher'] },
  callerName: { type: String, default: '', maxlength: 100 },
  peerId: { type: String, required: true, index: true },
  peerRole: { type: String, required: true, enum: ['student', 'teacher'] },
  peerName: { type: String, default: '', maxlength: 100 },
  status: {
    type: String,
    required: true,
    enum: ['ringing', 'active', 'missed', 'rejected', 'completed', 'busy', 'cancelled', 'failed'],
    default: 'ringing',
    index: true,
  },
  startedAt: { type: Date, required: true, default: Date.now, index: true },
  answeredAt: { type: Date, default: null },
  endedAt: { type: Date, default: null },
  endedById: { type: String, default: '' },
  reason: { type: String, default: '', maxlength: 100 },
  durationSeconds: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

callHistorySchema.index({ callerRole: 1, callerId: 1, startedAt: -1 });
callHistorySchema.index({ peerRole: 1, peerId: 1, startedAt: -1 });

module.exports = mongoose.models.CallHistory || mongoose.model('CallHistory', callHistorySchema);
