'use strict';

const mongoose = require('mongoose');

const mobileBillingTransactionSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true,
  },
  platform: {
    type: String,
    enum: ['apple_iap', 'google_play'],
    required: true,
  },
  environment: {
    type: String,
    enum: ['sandbox', 'production'],
    default: 'sandbox',
  },
  productCategory: {
    type: String,
    enum: ['digital_video_course', 'digital_xp_pack', 'digital_subscription'],
    required: true,
  },
  productId: { type: String, required: true, trim: true },
  targetEntityId: { type: String, default: '', trim: true },
  storeTransactionId: { type: String, required: true, trim: true },
  originalTransactionId: { type: String, default: '', trim: true, index: true },
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'refunded', 'revoked'],
    default: 'pending',
    index: true,
  },
  amount: { type: Number, default: 0, min: 0 },
  currency: { type: String, default: 'VND' },
  xpGranted: { type: Number, default: 0, min: 0 },
  verificationSource: { type: String, default: '' },
  rawSummary: { type: mongoose.Schema.Types.Mixed, default: {} },
  grantedAt: { type: Date, default: null },
  refundedAt: { type: Date, default: null },
}, { timestamps: true });

mobileBillingTransactionSchema.index({ platform: 1, storeTransactionId: 1 }, { unique: true });
mobileBillingTransactionSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.models.MobileBillingTransaction
  || mongoose.model('MobileBillingTransaction', mobileBillingTransactionSchema);
