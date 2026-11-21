'use strict';

const mongoose = require('mongoose');

/**
 * Thống kê tổng hợp theo ngày cho đợt thử nghiệm có giới hạn (7–14 ngày).
 * Lưu bền vững qua restart server, TUYỆT ĐỐI KHÔNG lưu PII hay nội dung câu hỏi thô.
 */
const aiQuickAskDailyStatSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, maxlength: 16 }, // YYYY-MM-DD (Asia/Ho_Chi_Minh)
    platform: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web',
    },
    totalRequests: { type: Number, default: 0 },
    pilotRequests: { type: Number, default: 0 },
    benchmarkRequests: { type: Number, default: 0 },
    uniqueUserHashes: { type: [String], default: [] },
    ragColdCalls: { type: Number, default: 0 },
    ragWarmCacheHits: { type: Number, default: 0 },
    coalescedHits: { type: Number, default: 0 },
    legacyCalls: { type: Number, default: 0 },
    memoryHits: { type: Number, default: 0 },
    outOfScopeRejected: { type: Number, default: 0 },
    noSourceFoundCount: { type: Number, default: 0 },
    geminiCallsCount: { type: Number, default: 0 },
    slowRagOver3sCount: { type: Number, default: 0 },
    errorsHttp429: { type: Number, default: 0 },
    errorsHttp500: { type: Number, default: 0 },
    errorsHttp503: { type: Number, default: 0 },
    errorsTimeout: { type: Number, default: 0 },
    errorsNetwork: { type: Number, default: 0 },
    clientErrors: { type: Number, default: 0 },
    authBlockedCount: { type: Number, default: 0 },
    feedbackHelpful: { type: Number, default: 0 },
    feedbackInaccurate: { type: Number, default: 0 },
    promptTokens: { type: Number, default: 0 },
    candidatesTokens: { type: Number, default: 0 },
    thoughtsTokens: { type: Number, default: 0 },
    estimatedCostMicroUsd: { type: Number, default: 0 }, // USD * 1e6 để cộng dồn chính xác
    ragColdLatencySumMs: { type: Number, default: 0 },
    ragWarmLatencySumMs: { type: Number, default: 0 },
    legacyLatencySumMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

aiQuickAskDailyStatSchema.index({ dateKey: 1, platform: 1 }, { unique: true });
aiQuickAskDailyStatSchema.index({ dateKey: -1 });

module.exports = mongoose.models.AiQuickAskDailyStat || mongoose.model('AiQuickAskDailyStat', aiQuickAskDailyStatSchema);
