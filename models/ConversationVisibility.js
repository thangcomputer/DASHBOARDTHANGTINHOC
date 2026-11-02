const mongoose = require('mongoose');

const conversationVisibilitySchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  hiddenByUsers: [{ type: String }],
  pinnedByUsers: [{ type: String }],
}, {
  timestamps: true,
});

conversationVisibilitySchema.index({ hiddenByUsers: 1 });
conversationVisibilitySchema.index({ pinnedByUsers: 1 });

module.exports = mongoose.model('ConversationVisibility', conversationVisibilitySchema);
