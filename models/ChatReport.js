'use strict';

const mongoose = require('mongoose');

const chatReportSchema = new mongoose.Schema({
  reporterId: { type: String, required: true, index: true },
  reporterRole: { type: String, default: 'student' },
  reportedUserId: { type: String, default: '', index: true },
  reportedUserRole: { type: String, default: '' },
  conversationId: { type: String, required: true, index: true },
  messageId: { type: String, default: null },
  messageExcerpt: { type: String, default: '', maxlength: 500 },
  reason: {
    type: String,
    enum: ['spam', 'harassment', 'inappropriate', 'scam', 'other'],
    default: 'inappropriate',
  },
  details: { type: String, default: '', maxlength: 1000 },
  status: {
    type: String,
    enum: ['open', 'reviewed', 'dismissed'],
    default: 'open',
    index: true,
  },
}, { timestamps: true });

chatReportSchema.index({ createdAt: -1 });

module.exports = mongoose.models.ChatReport || mongoose.model('ChatReport', chatReportSchema);
