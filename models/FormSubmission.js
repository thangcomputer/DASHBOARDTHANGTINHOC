const mongoose = require('mongoose');

const formSubmissionSchema = new mongoose.Schema({
  formId: { type: mongoose.Schema.Types.ObjectId, ref: 'FormDefinition', required: true, index: true },
  formSlug: { type: String, default: '', index: true },
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  submittedBy: { type: String, default: '' },
  submittedByRole: { type: String, default: '' },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

formSubmissionSchema.index({ formId: 1, createdAt: -1 });

module.exports = mongoose.model('FormSubmission', formSubmissionSchema);