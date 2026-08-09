const mongoose = require('mongoose');

const messageAttachmentSchema = new mongoose.Schema({
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
  },
  url: {
    type: String,
    required: true,
  },
  fileType: {
    type: String,
    default: 'unknown', // image/png, application/pdf, etc.
  },
  fileName: {
    type: String,
    default: '',
  },
  fileSize: {
    type: Number,
    default: 0, // bytes
  }
}, {
  timestamps: true,
});

module.exports = mongoose.model('MessageAttachment', messageAttachmentSchema);
