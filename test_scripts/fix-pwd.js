const mongoose = require('mongoose');
require('dotenv').config();

const Teacher = require('./models/Teacher');
const Student = require('./models/Student');
const Employee = require('./models/Employee');
const Branch = require('./models/Branch');

async function seedAndTest() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const plainPass = 'password123';

  let admin = await Teacher.findOne({ email: 'admin2@test.com' });
  admin.password = plainPass;
  await admin.save();

  let student = await Student.findOne({ email: 'student2@test.com' });
  student.password = plainPass;
  await student.save();

  console.log('Fixed passwords!');
  process.exit(0);
}

seedAndTest().catch(err => {
  console.error(err);
  process.exit(1);
});
