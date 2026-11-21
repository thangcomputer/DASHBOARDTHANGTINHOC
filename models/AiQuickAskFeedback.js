'use strict';

const mongoose = require('mongoose');

/**
 * Lưu phản hồi chất lượng câu trả lời Quick Ask AI (Hữu ích / Chưa chính xác + góp ý ngắn).
 * Chỉ dành cho Admin rà soát thủ công — TUYỆT ĐỐI KHÔNG tự động nạp vào kho tri thức RAG.
 */
const aiQuickAskFeedbackSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userRole: {
      type: String,
      enum: ['student', 'teacher', 'staff', 'admin'],
      default: 'student',
      index: true,
    },
    platform: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web',
    },
    rating: {
      type: String,
      enum: ['helpful', 'inaccurate'],
      required: true,
      index: true,
    },
    comment: { type: String, default: '', maxlength: 500 },
    responseId: { type: String, default: '', maxlength: 80, index: true },
    questionHash: { type: String, default: '', index: true },
    questionPreview: { type: String, default: '', maxlength: 240 },
    answerPreview: { type: String, default: '', maxlength: 300 },
    answerSource: { type: String, default: 'ai', maxlength: 32 },
    model: { type: String, default: '', maxlength: 80 },
    knowledgeVersion: { type: String, default: '', maxlength: 32 },
    ragEnabled: { type: Boolean, default: false },
    reviewStatus: {
      type: String,
      enum: ['pending_admin_review', 'reviewed_approved', 'reviewed_dismissed'],
      default: 'pending_admin_review',
      index: true,
    },
    adminNote: { type: String, default: '', maxlength: 300 },
    reviewedBy: { type: String, default: '', maxlength: 80 },
    reviewedAt: { type: Date, default: null },
    // Cờ bất biến khẳng định phản hồi người dùng không bao giờ tự động thành tri thức đã duyệt
    autoPromotedToKnowledge: {
      type: Boolean,
      default: false,
      immutable: true,
    },
  },
  { timestamps: true }
);

aiQuickAskFeedbackSchema.index({ createdAt: -1 });
aiQuickAskFeedbackSchema.index({ reviewStatus: 1, rating: 1, createdAt: -1 });
aiQuickAskFeedbackSchema.index({ userId: 1, responseId: 1 });
aiQuickAskFeedbackSchema.index({ userId: 1, questionHash: 1, createdAt: -1 });

module.exports = mongoose.models.AiQuickAskFeedback || mongoose.model('AiQuickAskFeedback', aiQuickAskFeedbackSchema);
