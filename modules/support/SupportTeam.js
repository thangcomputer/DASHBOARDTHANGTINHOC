const mongoose = require('mongoose');

const supportTeamSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: '' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', default: null },
  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
});

module.exports = mongoose.model('SupportTeam', supportTeamSchema);
