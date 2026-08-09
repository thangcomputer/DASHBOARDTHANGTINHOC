const mongoose = require('mongoose');
const Teacher = require('./modules/teacher/models/Teacher');
const Student = require('./modules/student/models/Student');
mongoose.connect('mongodb://127.0.0.1:27017/dashboardthangtinhoc').then(async () => {
  await Teacher.updateMany({}, { $set: { isFirstLogin: false } });
  await Student.updateMany({}, { $set: { isFirstLogin: false } });
  console.log('Set isFirstLogin=false for all users');
  process.exit(0);
});
