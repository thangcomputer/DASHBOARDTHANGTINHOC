'use strict';

const mongoose = require('mongoose');

const CommunicationPreferenceSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, trim: true },
    userRole: { type: String, enum: ['student', 'teacher'], required: true },
    rejectCalls: { type: Boolean, default: false },
    rejectMessagesFromStudents: { type: Boolean, default: false },
    rejectMessagesFromTeachers: { type: Boolean, default: false },
  },
  { timestamps: true },
);

CommunicationPreferenceSchema.index({ userId: 1, userRole: 1 }, { unique: true });

module.exports = mongoose.model('CommunicationPreference', CommunicationPreferenceSchema);
