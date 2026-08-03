const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
  url: { type: String, required: true },
  name: { type: String, default: '' },
  mime: { type: String, default: '' },
  size: { type: Number, default: 0 },
  kind: { type: String, enum: ['image', 'video', 'file'], default: 'file' },
}, { _id: false });

const blogPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 220,
    index: true,
  },
  excerpt: {
    type: String,
    default: '',
    trim: true,
    maxlength: 500,
  },
  contentHtml: {
    type: String,
    default: '',
    maxlength: 200000,
  },
  thumbnailUrl: { type: String, default: '' },
  attachments: { type: [attachmentSchema], default: [] },
  authorId: { type: String, required: true, index: true },
  authorName: { type: String, default: 'Admin' },
  authorRole: {
    type: String,
    enum: ['admin', 'staff'],
    default: 'admin',
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'hidden'],
    default: 'draft',
    index: true,
  },
  targetAudience: {
    type: String,
    enum: ['all', 'teacher', 'student'],
    default: 'all',
    index: true,
  },
  publishedAt: { type: Date, default: null, index: true },
  viewCount: { type: Number, default: 0, min: 0 },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

blogPostSchema.index({ status: 1, publishedAt: -1 });
blogPostSchema.index({ deletedAt: 1, status: 1, publishedAt: -1 });
blogPostSchema.index({ title: 'text', excerpt: 'text' });

module.exports = mongoose.model('BlogPost', blogPostSchema);
