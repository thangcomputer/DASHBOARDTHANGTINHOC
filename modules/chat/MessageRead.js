const mongoose = require('mongoose');

const messageReadSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  readAt: {
    type: Date,
    default: Date.now,
  }
});

messageReadSchema.index({ messageId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('MessageRead', messageReadSchema);
