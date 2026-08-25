'use strict';

/**
 * CenterInfoItem — các mục nhập tay theo section (nhân sự, chi nhánh, MXH, …).
 */
const mongoose = require('mongoose');

const SECTIONS = ['staff', 'branch', 'social', 'service', 'exam_venue', 'certificate'];
const STATUS = ['draft', 'published', 'archived'];

const centerInfoItemSchema = new mongoose.Schema(
  {
    section: { type: String, enum: SECTIONS, required: true, index: true },
    status: { type: String, enum: STATUS, default: 'published', index: true },
    sortOrder: { type: Number, default: 0, index: true },
    title: { type: String, default: '', trim: true },
    subtitle: { type: String, default: '', trim: true },
    description: { type: String, default: '' },
    detailHtml: { type: String, default: '' },
    imageUrl: { type: String, default: '' },
    icon: { type: String, default: '' },
    url: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    city: { type: String, default: '' },
    mapsUrl: { type: String, default: '' },
    code: { type: String, default: '' },
    managerName: { type: String, default: '' },
    hours: { type: String, default: '' },
    department: { type: String, default: '' },
    expertise: { type: String, default: '' },
    experience: { type: String, default: '' },
    audience: { type: String, default: '' },
    curriculum: { type: String, default: '' },
    duration: { type: String, default: '' },
    learningMode: { type: String, default: '' },
    priceInfo: { type: String, default: '' },
    examType: { type: String, default: '' },
    scheduleInfo: { type: String, default: '' },
    capacity: { type: String, default: '' },
    issuer: { type: String, default: '' },
    requirements: { type: String, default: '' },
    relatedExam: { type: String, default: '' },
    validity: { type: String, default: '' },
    verifyInfo: { type: String, default: '' },
    verifyUrl: { type: String, default: '' },
    showEmail: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

centerInfoItemSchema.index({ section: 1, sortOrder: 1, createdAt: -1 });
centerInfoItemSchema.index({ section: 1, status: 1, isActive: 1 });

module.exports =
  mongoose.models.CenterInfoItem || mongoose.model('CenterInfoItem', centerInfoItemSchema);
module.exports.SECTIONS = SECTIONS;
module.exports.STATUS = STATUS;
