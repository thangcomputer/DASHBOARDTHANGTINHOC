const mongoose = require('mongoose');
const Student = require('../modules/student/models/Student');
require('dotenv').config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc');
  const students = await Student.find().sort({ _id: -1 }).limit(3).select('+password +isFirstLogin');
  for (const t of students) {
    console.log('Student:', t.name, t.phone);
    console.log('isFirstLogin:', t.isFirstLogin);
  }
  process.exit(0);
}
run();
