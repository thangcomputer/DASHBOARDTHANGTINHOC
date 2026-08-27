const mongoose = require('mongoose');

const blogTopicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 80,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 100,
    index: true,
  },
  sortOrder: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null, index: true },
}, { timestamps: true });

blogTopicSchema.index({ deletedAt: 1, sortOrder: 1, name: 1 });

module.exports = mongoose.model('BlogTopic', blogTopicSchema);
