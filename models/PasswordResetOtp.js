'use strict';

const mongoose = require('mongoose');

const PasswordResetOtpSchema = new mongoose.Schema(
  {
    challengeKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['student', 'teacher'],
      required: true,
    },
    contactType: {
      type: String,
      enum: ['email', 'sms'],
      required: true,
    },
    contactValue: {
      type: String,
      required: true,
    },
    salt: {
      type: String,
      required: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastSentAt: {
      type: Date,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('PasswordResetOtp', PasswordResetOtpSchema);
