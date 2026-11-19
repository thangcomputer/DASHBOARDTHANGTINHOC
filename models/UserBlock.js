'use strict';

const mongoose = require('mongoose');

const userBlockSchema = new mongoose.Schema({
  blockerId: { type: String, required: true, index: true },
  blockerRole: { type: String, default: 'student' },
  blockedId: { type: String, required: true, index: true },
  blockedRole: { type: String, default: '' },
  reason: { type: String, default: '', maxlength: 300 },
}, { timestamps: true });

userBlockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

module.exports = mongoose.models.UserBlock || mongoose.model('UserBlock', userBlockSchema);
