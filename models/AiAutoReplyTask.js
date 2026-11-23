const mongoose = require('mongoose');

const knowledgeRefSchema = new mongoose.Schema({
  docId: { type: String, default: '' },
  docTitle: { type: String, default: '' },
  location: { type: String, default: '' },
  score: { type: Number, default: 0 },
}, { _id: false });

const aiAutoReplyTaskSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    index: true,
  },
  aliasConversationIds: {
    type: [String],
    default: [],
  },
  studentId: {
    type: String,
    required: true,
    index: true,
  },
  studentName: { type: String, default: '' },
  recipientId: {
    type: String,
    required: true,
  },
  recipientRole: {
    type: String,
    required: true,
  },
  recipientName: { type: String, default: '' },
  triggeringMessageId: {
    type: String,
    required: true,
  },
  triggeringMessageAt: {
    type: Date,
    required: true,
  },
  burstMessageIds: {
    type: [String],
    default: [],
  },
  delayMinutes: {
    type: Number,
    required: true,
    default: 5,
  },
  scheduledAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  dueAt: {
    type: Date,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'cancelled', 'needs_human', 'failed'],
    default: 'pending',
    index: true,
  },
  idempotencyKey: {
    type: String,
    required: true,
    unique: true,
  },
  lockToken: { type: String, default: '' },
  lockedAt: { type: Date, default: null },
  bullJobId: { type: String, default: '' },
  cancelledAt: { type: Date, default: null },
  cancelledBy: { type: String, default: '' },
  cancelReason: { type: String, default: '' },
  sentMessageId: { type: String, default: '' },
  replyPreview: { type: String, default: '' },
  model: { type: String, default: '' },
  knowledgeReferences: {
    type: [knowledgeRefSchema],
    default: [],
  },
  needsHuman: { type: Boolean, default: false },
  errorMessage: { type: String, default: '' },
  attempts: { type: Number, default: 0 },
}, {
  timestamps: true,
});

aiAutoReplyTaskSchema.index({ status: 1, dueAt: 1 });
aiAutoReplyTaskSchema.index({ conversationId: 1, status: 1 });
aiAutoReplyTaskSchema.index({ status: 1, lockedAt: 1 });
aiAutoReplyTaskSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AiAutoReplyTask', aiAutoReplyTaskSchema);
