const mongoose = require('mongoose');

const conversationVisibilitySchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  hiddenByUsers: [{ type: String }] // Array of user IDs who have hidden this conversation
}, {
  timestamps: true,
});

conversationVisibilitySchema.index({ hiddenByUsers: 1 });

module.exports = mongoose.model('ConversationVisibility', conversationVisibilitySchema);
