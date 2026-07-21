const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: {
    type: String,
    enum: ['text', 'textarea', 'number', 'select', 'checkbox', 'date', 'email', 'phone'],
    default: 'text',
  },
  required: { type: Boolean, default: false },
  options: [{ type: String }],
  placeholder: { type: String, default: '' },
  order: { type: Number, default: 0 },
}, { _id: false });

const formDefinitionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft',
    index: true,
  },
  fields: { type: [fieldSchema], default: [] },
  createdBy: { type: String, default: '' },
}, { timestamps: true });

formDefinitionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FormDefinition', formDefinitionSchema);