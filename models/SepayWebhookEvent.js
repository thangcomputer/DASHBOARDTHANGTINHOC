const mongoose = require('mongoose');

const sepayWebhookEventSchema = new mongoose.Schema({
  gatewayTxnId: { type: String, required: true, unique: true },
  amount: { type: Number, default: 0 },
  content: { type: String, default: '' },
  matched: { type: Boolean, default: false },
  matchedRef: { type: String, default: '' },
  rawSummary: { type: String, default: '' },
}, { timestamps: true });

sepayWebhookEventSchema.index({ createdAt: -1 });

module.exports = mongoose.model('SepayWebhookEvent', sepayWebhookEventSchema);
