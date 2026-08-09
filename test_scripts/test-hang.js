require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student');
const Schedule = require('./models/Schedule');
const { applyEnrollmentStats } = require('./services/enrollmentService');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  const student = await Student.findOne({ email: 'student@test.com' });
  console.log('Found student:', student._id);
  const doc = student.toObject();
  
  console.log('Calling applyEnrollmentStats...');
  const start = Date.now();
  await applyEnrollmentStats(doc, student._id.toString(), Schedule);
  console.log('Done in', Date.now() - start, 'ms');
  
  process.exit(0);
}

test().catch(console.error);
