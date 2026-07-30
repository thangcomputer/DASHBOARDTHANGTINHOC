require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');

const staffId = '6a6add48c735fe98d5277340';
(async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const staff = await Teacher.findById(staffId);
    if (!staff) {
      console.error('Staff user not found:', staffId);
      process.exit(1);
    }
    staff.permissions = Array.isArray(staff.permissions) ? staff.permissions : [];
    if (!staff.permissions.includes('manage_staff')) {
      staff.permissions.push('manage_staff');
    }
    await staff.save();
    console.log('Updated permissions:', staff.permissions);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
})();
