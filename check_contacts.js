const mongoose = require('mongoose');
const Teacher = require('./modules/teacher/models/Teacher');
const Student = require('./modules/student/models/Student');
mongoose.connect('mongodb://127.0.0.1:27017/dashboardthangtinhoc').then(async () => {
  const support = await Teacher.findOne({ phone: '0900000003' });
  console.log('Support adminRole:', support.adminRole);
  console.log('Support branchId:', support.branchId);
  const students = await Student.find({});
  console.log('Total students:', students.length);
  process.exit(0);
});
