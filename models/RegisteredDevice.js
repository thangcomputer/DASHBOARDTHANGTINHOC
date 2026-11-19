'use strict';

const mongoose = require('mongoose');

/**
 * Thiết bị cố định (tối đa 2) của HV/GV.
 * Không có TTL. Logout / hết hạn phiên không xóa bản ghi.
 */
const registeredDeviceSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  role: { type: String, required: true, enum: ['student', 'teacher'] },
  slot: { type: Number, required: true, min: 1, max: 2 },
  deviceKey: { type: String, required: true, trim: true },
  secretHash: { type: String, required: true },
  secretHashes: { type: [String], default: [] },
  status: { type: String, default: 'active', enum: ['active', 'revoked'] },
  platform: { type: String, default: 'web', trim: true },
  deviceLabel: { type: String, default: '', trim: true },
  deviceType: { type: String, default: 'unknown', trim: true },
  os: { type: String, default: '', trim: true },
  browser: { type: String, default: '', trim: true },
  registeredAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  revokedAt: { type: Date, default: null },
  revokedBy: { type: String, default: '' },
  revokeReason: { type: String, default: '' },
}, { timestamps: true });

registeredDeviceSchema.index(
  { userId: 1, role: 1, slot: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
registeredDeviceSchema.index(
  { userId: 1, role: 1, deviceKey: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);

module.exports = mongoose.model('RegisteredDevice', registeredDeviceSchema);
