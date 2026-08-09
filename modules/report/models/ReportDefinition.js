const mongoose = require('mongoose');

const reportDefinitionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  /** students | teachers | schedules | transactions | form:<formId> */
  source: { type: String, required: true },
  columns: [{ type: String }],
  filters: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

reportDefinitionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ReportDefinition', reportDefinitionSchema);