const mongoose = require('mongoose');

const auditLogEntrySchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ['enable', 'disable', 'delay_change', 'admin_disable', 'rate_limit'],
    required: true,
  },
  enabled: { type: Boolean, default: false },
  delayMinutes: { type: Number, default: 5 },
  actorId: { type: String, default: '' },
  actorName: { type: String, default: '' },
  actorRole: { type: String, default: '' },
  note: { type: String, default: '' },
  at: { type: Date, default: Date.now },
}, { _id: false });

const conversationAiAutoReplySchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  enabled: {
    type: Boolean,
    default: false,
  },
  delayMinutes: {
    type: Number,
    enum: [1, 3, 5, 10, 15, 30],
    default: 5,
  },
  updatedBy: { type: String, default: '' },
  updatedByName: { type: String, default: '' },
  updatedByRole: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now },
  lastStatus: {
    type: String,
    enum: ['idle', 'pending', 'cancelled_human', 'cancelled_disabled', 'sent', 'needs_human', 'rate_limited', 'failed'],
    default: 'idle',
  },
  lastStatusAt: { type: Date, default: null },
  lastStatusReason: { type: String, default: '' },
  lastTriggeringMessageId: { type: String, default: '' },
  lastSentMessageId: { type: String, default: '' },
  consecutiveAiReplies: { type: Number, default: 0 },
  dailyAiReplyDate: { type: String, default: '' },
  dailyAiReplyCount: { type: Number, default: 0 },
  auditLogs: {
    type: [auditLogEntrySchema],
    default: [],
  },
}, {
  timestamps: true,
});

conversationAiAutoReplySchema.index({ enabled: 1, updatedAt: -1 });

module.exports = mongoose.model('ConversationAiAutoReply', conversationAiAutoReplySchema);
