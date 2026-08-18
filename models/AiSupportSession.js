const mongoose = require('mongoose');
const { AI_SUPPORT_STATUS } = require('../shared/enums/AiSupportStatus');

const aiSupportSessionSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true, index: true },
  userId: { type: String, required: true, index: true },
  userRole: { type: String, required: true },
  branchId: { type: String, default: '' },
  /** Backward compatible: true khi không còn AI_ACTIVE */
  escalated: { type: Boolean, default: false },
  escalatedAt: { type: Date, default: null },
  status: {
    type: String,
    enum: Object.values(AI_SUPPORT_STATUS),
    default: AI_SUPPORT_STATUS.AI_ACTIVE,
    index: true,
  },
  handoffReason: { type: String, default: '' },
  handoffSummary: { type: String, default: '' },
  handoffRequestedAt: { type: Date, default: null },
  claimedBy: { type: String, default: '' },
  claimedByName: { type: String, default: '' },
  claimedAt: { type: Date, default: null },
  resolvedAt: { type: Date, default: null },
  consecutiveAiFailures: { type: Number, default: 0 },
  /** Số ảnh gửi cho AI trong ngày (Asia/Ho_Chi_Minh). Chat nhân viên không đếm. */
  imageUploadDate: { type: String, default: '' },
  imageUploadCount: { type: Number, default: 0 },
  /** Số câu hỏi HV gửi AI trong ngày. */
  questionDate: { type: String, default: '' },
  questionCount: { type: Number, default: 0 },
  /** Tin user gần nhất — dùng idle 5 phút. */
  lastUserMessageAt: { type: Date, default: null },
  /** Đã hỏi “còn đó không” — chờ phản hồi rồi kết thúc phiên. */
  idlePingAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('AiSupportSession', aiSupportSessionSchema);
