const mongoose = require('mongoose');
const { ConversationStatus } = require('../../shared/enums');

const conversationSchema = new mongoose.Schema({
  title: { type: String, default: '' },
  type: {
    type: String,
    enum: ['DIRECT', 'GROUP', 'SUPPORT'],
    required: true,
  },
  status: {
    type: String,
    enum: Object.values(ConversationStatus),
    default: ConversationStatus.OPEN,
  },
  lastMessageAt: { type: Date, default: Date.now },
  lastMessageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Conversation', conversationSchema);
