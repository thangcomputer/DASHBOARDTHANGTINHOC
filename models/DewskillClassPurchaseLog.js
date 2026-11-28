'use strict';

const mongoose = require('mongoose');

/** Lịch sử mua / kích hoạt khóa học DewSkill & Gói hỗ trợ AI (lưu lâu dài cho Hồ sơ học viên). */
const dewskillClassPurchaseLogSchema = new mongoose.Schema(
  {
    purchaseType: {
      type: String,
      enum: ['course', 'ai_package'],
      default: 'course',
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DewskillClass',
      default: null,
    },
    planId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 24,
    },
    courseName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    courseCode: {
      type: String,
      default: '',
      trim: true,
      maxlength: 60,
    },
    source: {
      type: String,
      enum: ['payment', 'code', 'admin', 'dev_simulate'],
      default: 'payment',
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    durationMonths: {
      type: Number,
      default: 12,
      min: 0,
      max: 60,
    },
    durationLabel: {
      type: String,
      default: '',
      trim: true,
      maxlength: 60,
    },
    includesMeet: {
      type: Boolean,
      default: true,
    },
    paymentRef: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    sessionId: {
      type: String,
      default: '',
      trim: true,
      maxlength: 120,
    },
    activationCode: {
      type: String,
      default: '',
      trim: true,
      maxlength: 60,
    },
    startsAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'expired'],
      default: 'active',
    },
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: 320,
    },
  },
  { timestamps: true }
);

dewskillClassPurchaseLogSchema.index({ studentId: 1, createdAt: -1 });
dewskillClassPurchaseLogSchema.index({ sessionId: 1 }, { sparse: true });

module.exports =
  mongoose.models.DewskillClassPurchaseLog ||
  mongoose.model('DewskillClassPurchaseLog', dewskillClassPurchaseLogSchema);
