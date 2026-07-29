/**
 * NotificationDelivery — tracking gửi theo channel (Phase 5 / ADR 0005).
 */
const mongoose = require('mongoose');

const NotificationDeliverySchema = new mongoose.Schema(
  {
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Notification',
      default: null,
      index: true,
    },
    eventId: { type: String, default: '', index: true },
    idempotencyKey: { type: String, default: '', index: true },
    userId: { type: String, default: '', index: true },
    channel: {
      type: String,
      enum: ['in_app', 'socket', 'zalo', 'email', 'fcm'],
      required: true,
    },
    status: {
      type: String,
      enum: ['queued', 'sent', 'failed', 'skipped', 'dead'],
      default: 'queued',
      index: true,
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: '' },
    providerMsgId: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

NotificationDeliverySchema.index({ channel: 1, status: 1, createdAt: -1 });
NotificationDeliverySchema.index(
  { idempotencyKey: 1, channel: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string', $gt: '' } },
  }
);

module.exports = mongoose.model('NotificationDelivery', NotificationDeliverySchema);
