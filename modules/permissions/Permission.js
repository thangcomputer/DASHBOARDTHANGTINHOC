const mongoose = require('mongoose');
const { PermissionCode } = require('../../shared/enums');

const permissionSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    enum: Object.values(PermissionCode),
  },
  description: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Permission', permissionSchema);
