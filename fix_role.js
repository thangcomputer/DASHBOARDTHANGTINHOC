const mongoose = require('mongoose');
const Teacher = require('./modules/teacher/models/Teacher');
mongoose.connect('mongodb://127.0.0.1:27017/dashboardthangtinhoc').then(async () => {
  const result = await Teacher.updateOne({ phone: '0900000003' }, { $set: { adminRole: 'SUPPORT' }});
  console.log('Update support role:', result);
  process.exit(0);
});
