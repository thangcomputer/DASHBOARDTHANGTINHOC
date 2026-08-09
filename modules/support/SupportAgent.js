const mongoose = require('mongoose');
const { SupportStatus, OnlineStatus } = require('../../shared/enums');

const supportAgentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  teamId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportTeam',
    default: null,
  },
  maxConcurrentConversations: {
    type: Number,
    default: 5,
  },
  currentConcurrentConversations: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: Object.values(SupportStatus),
    default: SupportStatus.OFFLINE,
  },
  onlineStatus: {
    type: String,
    enum: Object.values(OnlineStatus),
    default: OnlineStatus.OFFLINE,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('SupportAgent', supportAgentSchema);
