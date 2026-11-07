const mongoose = require('mongoose');

const SLOTS = {
  morning: { label: 'Sáng', startTime: '09:00', endTime: '12:00' },
  afternoon: { label: 'Chiều', startTime: '14:00', endTime: '16:00' },
  evening: { label: 'Tối', startTime: '19:00', endTime: '21:00' },
};

const meetClassSchema = new mongoose.Schema({
  title: { type: String, default: 'Học Meet', trim: true },
  linkHoc: { type: String, default: '' },
  day: { type: String, required: true },
  slot: { type: String, enum: ['morning', 'afternoon', 'evening', 'custom'], required: true },
  inviteAllMeetPackage: { type: Boolean, default: false },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  students: [{
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
    name: { type: String, default: '' },
  }],
  status: { type: String, enum: ['scheduled', 'cancelled'], default: 'scheduled' },
  note: { type: String, default: '' },
  createdById: { type: String, default: '' },
  createdByName: { type: String, default: '' },
}, { timestamps: true });

meetClassSchema.index({ day: 1, startTime: 1, status: 1 });
meetClassSchema.index({ studentIds: 1, status: 1, day: 1 });

module.exports = mongoose.models.MeetClass || mongoose.model('MeetClass', meetClassSchema);
module.exports.SLOTS = SLOTS;
