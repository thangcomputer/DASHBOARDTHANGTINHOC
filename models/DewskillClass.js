'use strict';

const mongoose = require('mongoose');

const dewskillClassSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Tên lớp học không được để trống'],
      trim: true,
      maxlength: 140,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    code: {
      type: String,
      default: '',
      trim: true,
      uppercase: true,
      maxlength: 40,
    },
    tier: {
      type: String,
      required: true,
      enum: ['cap-1', 'cap-2', 'cap-3', 'mos', 'hs-sv', 'nguoi-di-lam', 'chung-chi'],
      index: true,
    },
    grade: {
      type: Number,
      default: null,
      min: 1,
      max: 12,
    },
    track: {
      type: String,
      enum: ['', 'general', 'ict', 'cs', 'word', 'excel', 'powerpoint', 'combo'],
      default: '',
    },
    level: {
      type: String,
      enum: ['', 'basic', 'intermediate', 'advanced'],
      default: '',
    },
    curriculumSource: {
      type: String,
      enum: ['KNTT_GDPT2018', 'CERTIPORT', 'DEWSKILL', 'TT03_IC3'],
      default: 'KNTT_GDPT2018',
    },
    badge: {
      type: String,
      default: '',
      trim: true,
      maxlength: 60,
    },
    shortDescription: {
      type: String,
      default: '',
      trim: true,
      maxlength: 320,
    },
    description: {
      type: String,
      default: '',
      trim: true,
      maxlength: 2000,
    },
    accentColor: {
      type: String,
      enum: ['emerald', 'sky', 'violet', 'amber', 'rose', 'indigo'],
      default: 'emerald',
    },
    dailyPracticeTopicIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'DailyPracticeTopic',
      },
    ],
    certPrepCourseIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CertPrepCourse',
      },
    ],
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    originalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    allowTrial: {
      type: Boolean,
      default: true,
    },
    allowRegistration: {
      type: Boolean,
      default: true,
    },
    visibilityMode: {
      type: String,
      enum: ['hidden', 'selected', 'free_portal', 'all'],
      default: 'hidden',
      index: true,
    },
    freePreviewTopics: {
      type: Number,
      default: 1,
      min: 0,
      max: 50,
    },
    dailyXpAllowance: {
      type: Number,
      default: 100,
      min: 0,
      max: 100000,
    },
    durationMonths: {
      type: Number,
      default: 12,
      min: 1,
      max: 60,
    },
    includesMeet: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

dewskillClassSchema.index({ tier: 1, sortOrder: 1, createdAt: 1 });
dewskillClassSchema.index({ visibilityMode: 1, isActive: 1 });

module.exports =
  mongoose.models.DewskillClass ||
  mongoose.model('DewskillClass', dewskillClassSchema);
