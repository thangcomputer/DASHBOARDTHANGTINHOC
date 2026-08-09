const mongoose = require('mongoose');

const supportAssignmentSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportAgent',
    required: true,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User', // Who assigned it (could be self, or another admin, or system)
    default: null,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'TRANSFERRED', 'CLOSED'],
    default: 'ACTIVE',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('SupportAssignment', supportAssignmentSchema);
