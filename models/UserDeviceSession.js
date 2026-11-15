'use strict';

const mongoose = require('mongoose');

const userDeviceSessionSchema = new mongoose.Schema({
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
    index: true,
  },
  userName: {
    type: String,
    default: '',
    trim: true,
  },
  role: {
    type: String,
    required: true,
    enum: ['admin', 'staff', 'teacher', 'student'],
    index: true,
  },
  adminRole: {
    type: String,
    default: '',
    trim: true,
  },
  clientType: {
    type: String,
    default: 'web',
    enum: ['web', 'mobile'],
  },
  loginChannel: {
    type: String,
    default: 'web',
    trim: true,
  },
  deviceLabel: {
    type: String,
    default: '',
    trim: true,
  },
  deviceType: {
    type: String,
    default: 'desktop',
    enum: ['desktop', 'mobile', 'tablet', 'unknown'],
  },
  browser: {
    type: String,
    default: '',
    trim: true,
  },
  os: {
    type: String,
    default: '',
    trim: true,
  },
  ip: {
    type: String,
    default: '',
    trim: true,
  },
  userAgent: {
    type: String,
    default: '',
    trim: true,
  },
  fingerprint: {
    type: String,
    default: '',
    trim: true,
  },
  lastActiveAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  revokedAt: {
    type: Date,
    default: null,
    index: true,
  },
  revocationReason: {
    type: String,
    default: '',
    trim: true,
  },
  revokedBy: {
    type: String,
    default: '',
    trim: true,
  },
}, {
  timestamps: true,
});

userDeviceSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
userDeviceSessionSchema.index({ userId: 1, role: 1, revokedAt: 1, lastActiveAt: -1 });
userDeviceSessionSchema.index({ revokedAt: 1, lastActiveAt: -1 });

module.exports = mongoose.model('UserDeviceSession', userDeviceSessionSchema);

