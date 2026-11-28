'use strict';

const mongoose = require('mongoose');

const studentDewskillClassAccessSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
    },
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'DewskillClass',
      required: true,
    },
    accessLevel: {
      type: String,
      enum: ['preview', 'full'],
      default: 'full',
    },
    isVisible: {
      type: Boolean,
      default: true,
    },
    note: {
      type: String,
      default: '',
      trim: true,
      maxlength: 300,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    purchasedAt: {
      type: Date,
      default: null,
    },
    durationMonths: {
      type: Number,
      default: 12,
    },
    expiredResetAt: {
      type: Date,
      default: null,
    },
    grantedBy: {
      type: String,
      default: '',
    },
    grantedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

studentDewskillClassAccessSchema.index({ studentId: 1, classId: 1 }, { unique: true });
studentDewskillClassAccessSchema.index({ classId: 1, isVisible: 1 });
studentDewskillClassAccessSchema.index({ studentId: 1, isVisible: 1 });
studentDewskillClassAccessSchema.index({ accessLevel: 1, expiresAt: 1 });

module.exports =
  mongoose.models.StudentDewskillClassAccess ||
  mongoose.model('StudentDewskillClassAccess', studentDewskillClassAccessSchema);
