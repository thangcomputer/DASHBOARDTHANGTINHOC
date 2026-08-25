'use strict';

/**
 * CenterOverview — singleton trang Tổng quan «Thông tin trung tâm» (nhập tay).
 */
const mongoose = require('mongoose');

const STATUS = ['draft', 'published', 'archived'];

const centerOverviewSchema = new mongoose.Schema(
  {
    _key: { type: String, default: 'main', unique: true },
    status: { type: String, enum: STATUS, default: 'draft', index: true },
    name: { type: String, default: '', trim: true },
    logoUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    intro: { type: String, default: '' },
    mission: { type: String, default: '' },
    vision: { type: String, default: '' },
    coreValues: { type: String, default: '' },
    foundedYear: { type: String, default: '' },
    contactEmail: { type: String, default: '' },
    contactPhone: { type: String, default: '' },
    website: { type: String, default: '' },
    headquartersAddress: { type: String, default: '' },
    detailHtml: { type: String, default: '' },
    galleryUrls: { type: [String], default: [] },
    introVideoUrl: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.CenterOverview || mongoose.model('CenterOverview', centerOverviewSchema);
module.exports.STATUS = STATUS;
