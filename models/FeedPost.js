const mongoose = require('mongoose');

const REACTION_TYPES = ['heart', 'like', 'haha', 'wow', 'sad'];

const commentSchema = new mongoose.Schema({
  authorId:   { type: String, required: true },
  authorName: { type: String, required: true },
  authorAvatar: { type: String, default: '' },
  authorRole: {
    type: String,
    enum: ['admin', 'teacher', 'student', 'staff'],
    required: true,
  },
  content:    { type: String, default: '', trim: true, maxlength: 2000 },
  images:     { type: [String], default: [] },
  parentId:   { type: String, default: null },
  createdAt:  { type: Date, default: Date.now },
}, { _id: true });

const reactionSchema = new mongoose.Schema({
  userId:   { type: String, required: true },
  userName: { type: String, default: '' },
  role:     { type: String, default: '' },
  type:     { type: String, enum: REACTION_TYPES, default: 'heart' },
}, { _id: false });

const feedPostSchema = new mongoose.Schema({
  authorId:   { type: String, required: true, index: true },
  authorName: { type: String, required: true },
  authorRole: {
    type: String,
    enum: ['admin', 'teacher', 'student', 'staff'],
    required: true,
    index: true,
  },
  authorAvatar: { type: String, default: '' },
  content: {
    type: String,
    default: '',
    trim: true,
    maxlength: 5000,
  },
  images: {
    type: [String],
    default: [],
    validate: [(arr) => arr.length <= 6, 'Toi da 6 anh'],
  },
  likes:      { type: [mongoose.Schema.Types.Mixed], default: [] },
  reactions:  { type: [reactionSchema], default: [] },
  comments:   { type: [commentSchema], default: [] },
}, { timestamps: true });

feedPostSchema.index({ createdAt: -1 });
feedPostSchema.index({ authorId: 1, createdAt: -1 });
feedPostSchema.index({ authorRole: 1, createdAt: -1 });

module.exports = mongoose.model('FeedPost', feedPostSchema);
module.exports.REACTION_TYPES = REACTION_TYPES;