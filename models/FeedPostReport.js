const mongoose = require('mongoose');

const feedPostReportSchema = new mongoose.Schema({
  postId: { type: String, required: true, index: true },
  reporterId: { type: String, required: true },
  reporterName: { type: String, required: true },
  reporterRole: { type: String, required: true },
  reason: {
    type: String,
    enum: ['spam', 'harassment', 'inappropriate', 'misinformation', 'other'],
    required: true,
  },
  details: { type: String, default: '', trim: true, maxlength: 500 },
  status: { type: String, enum: ['pending', 'reviewed'], default: 'pending', index: true },
  resolvedBy: { type: String, default: null },
  resolvedAt: { type: Date, default: null },
}, { timestamps: true });

feedPostReportSchema.index({ postId: 1, reporterId: 1 }, { unique: true });
feedPostReportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('FeedPostReport', feedPostReportSchema);
