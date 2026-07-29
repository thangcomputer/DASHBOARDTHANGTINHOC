const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['SYSTEM', 'COURSE', 'FINANCE', 'EVALUATION', 'MESSAGE', 'EXAM', 'SCHEDULE'],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  sender_id: {
    type: String,
    default: 'SYSTEM'
  },
  // "GLOBAL", "ALL_ADMIN", "ALL_TEACHER", or specific IDs
  receivers: [{
    type: String,
    required: true,
  }],
  // IDs of users who have read the notification
  read_by: [{
    type: String
  }],
  // Per-user dismiss (ẩn khỏi inbox, không xóa bản ghi chung)
  dismissed_by: [{
    type: String
  }],
  // Per-user archive (Phase 5)
  archived_by: [{
    type: String
  }],
  payload: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  path: {
    type: String,
    default: ''
  },
  // Phase 5 platform fields
  templateCode: { type: String, default: '', index: true },
  eventId: { type: String, default: '', index: true },
  idempotencyKey: { type: String, default: '' },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high'],
    default: 'normal',
  },
  expiresAt: { type: Date, default: null },
}, {
  timestamps: true
});

notificationSchema.index({ receivers: 1, createdAt: -1 });
notificationSchema.index({ read_by: 1, createdAt: -1 });
notificationSchema.index({ dismissed_by: 1, createdAt: -1 });
notificationSchema.index({ archived_by: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index(
  { idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string', $gt: '' } },
  }
);

module.exports = mongoose.model('Notification', notificationSchema);
