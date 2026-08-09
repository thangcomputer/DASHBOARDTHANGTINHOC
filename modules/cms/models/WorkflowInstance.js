const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
  step: { type: String, default: '' },
  action: { type: String, required: true },
  by: { type: String, default: '' },
  byName: { type: String, default: '' },
  note: { type: String, default: '' },
  at: { type: Date, default: Date.now },
}, { _id: false });

const workflowInstanceSchema = new mongoose.Schema({
  definitionKey: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ['open', 'completed', 'rejected', 'cancelled'],
    default: 'open',
    index: true,
  },
  currentStep: { type: String, required: true },
  entityType: { type: String, required: true, index: true },
  entityId: { type: String, required: true, index: true },
  entityLabel: { type: String, default: '' },
  title: { type: String, default: '' },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  history: { type: [historySchema], default: [] },
  createdBy: { type: String, default: '' },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

workflowInstanceSchema.index({ status: 1, createdAt: -1 });
workflowInstanceSchema.index({ definitionKey: 1, entityId: 1, status: 1 });

module.exports = mongoose.model('WorkflowInstance', workflowInstanceSchema);