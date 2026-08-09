const mongoose = require('mongoose');
const { UserRole, AccessScope } = require('../../shared/enums');

const roleSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    enum: Object.values(UserRole),
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  scope: {
    type: String,
    enum: Object.values(AccessScope),
    default: AccessScope.GLOBAL,
  },
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission',
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model('Role', roleSchema);
