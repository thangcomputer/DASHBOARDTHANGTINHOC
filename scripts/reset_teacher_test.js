const mongoose = require('mongoose');
require('dotenv').config();
const SystemSettings = require('../models/SystemSettings');
const { invalidateSettingsCache } = require('../services/settingsCache');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc';

async function seedExamMinutes() {
  await mongoose.connect(MONGODB_URI);
  const tn = Number(process.argv[3]) || 5;
  const tl = Number(process.argv[4]) || 5;
  const keys = ['coban', 'word', 'excel', 'powerpoint', 'canva', 'situation', 'computer', 'other'];
  await SystemSettings.findOneAndUpdate(
    { _key: 'main' },
    {
      $set: {
        teacherExamMinutesRaw: Object.fromEntries(keys.map((k) => [k, tn])),
        teacherEssayExamMinutesRaw: Object.fromEntries(keys.map((k) => [k, tl])),
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  await invalidateSettingsCache();
  console.log('Seeded teacher exam minutes:', tn, 'TN /', tl, 'TL');
  await mongoose.disconnect();
}

if (process.argv[2] === 'seed-minutes') {
  seedExamMinutes().catch((e) => { console.error(e); process.exit(1); });
} else {

const TeacherSchema = new mongoose.Schema({
  phone: String,
  status: String,
  testStatus: String,
  testScore: Number,
  lockReason: String
});

const Teacher = mongoose.model('Teacher', TeacherSchema);

async function main() {
  await mongoose.connect(MONGODB_URI);
  const teacher = await Teacher.findOneAndUpdate(
    { phone: '020304' },
    { 
      status: 'pending',
      testStatus: null,
      testScore: 0,
      lockReason: null
    },
    { returnDocument: 'after' }
  );
  console.log('Teacher reset:', teacher);
  await mongoose.disconnect();
}

main().catch(console.error);

}
