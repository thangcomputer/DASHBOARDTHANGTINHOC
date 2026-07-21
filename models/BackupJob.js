const mongoose = require('mongoose');

const backupJobSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['pending', 'running', 'completed', 'failed'],
    default: 'pending',
    index: true,
  },
  type: {
    type: String,
    enum: ['manual', 'scheduled'],
    default: 'manual',
  },
  filename: { type: String, default: '' },
  diskPath: { type: String, default: '' },
  sizeBytes: { type: Number, default: 0 },
  collections: [{ type: String }],
  docCount: { type: Number, default: 0 },
  error: { type: String, default: '' },
  createdBy: { type: String, default: '' },
  startedAt: { type: Date, default: null },
  finishedAt: { type: Date, default: null },
}, { timestamps: true });

backupJobSchema.index({ createdAt: -1 });
backupJobSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('BackupJob', backupJobSchema);