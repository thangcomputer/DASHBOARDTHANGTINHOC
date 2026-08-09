require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Teacher = require('../modules/teacher/models/Teacher');
const Student = require('../modules/student/models/Student');
const Branch = require('../modules/branch/models/Branch');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to DB');

    // 1. Delete old test data
    await Branch.deleteMany({ code: { $in: ['QAMSG'] } });
    await Teacher.deleteMany({ phone: { $in: ['0999999001', '0999999002', '0999999003'] } });
    await Student.deleteMany({ phone: { $in: ['0999999101'] } });
    
    // 2. Create Branch
    const branch = await Branch.create({ name: 'Chi Nhánh QA Message', code: 'QAMSG', isActive: true });
    console.log('✅ Created Branch:', branch._id);

    // 3. Create Branch Admin
    const branchAdmin = await Teacher.create({
      name: 'Branch Admin Msg', phone: '0999999001', password: '123456',
      role: 'staff', adminRole: 'STAFF', permissions: ['ALL'],
      branchId: branch._id, branchCode: branch.code, status: 'active'
    });
    console.log('✅ Created Branch Admin');

    // 4. Create Support Agent
    const supportAgent = await Teacher.create({
      name: 'Support Agent Msg', phone: '0999999002', password: '123456',
      role: 'staff', adminRole: 'SUPPORT', permissions: ['ALL'],
      branchId: branch._id, branchCode: branch.code, status: 'active'
    });
    console.log('✅ Created Support Agent');

    // 5. Create Teacher
    const teacher = await Teacher.create({
      name: 'Teacher Msg', phone: '0999999003', password: '123456',
      role: 'teacher', branchId: branch._id, branchCode: branch.code, status: 'active'
    });
    console.log('✅ Created Teacher');

    // 6. Create Student
    const student = await Student.create({
      name: 'Student Msg', phone: '0999999101', zalo: '0999999101', password: '123456',
      branchId: branch._id, branchCode: branch.code, teacherId: teacher._id, teacherName: teacher.name,
      course: 'Khoá Message QA', paid: true, price: 1000000, totalSessions: 12, remainingSessions: 12, status: 'active'
    });
    console.log('✅ Created Student');

    // 7. Output JSON file with credentials and IDs for tests
    const testData = {
      superAdmin: { id: 'admin', phone: 'admin', password: 'admin123' }, // Giả định
      branchAdmin: { id: branchAdmin._id.toString(), phone: branchAdmin.phone, password: '123456' },
      supportAgent: { id: supportAgent._id.toString(), phone: supportAgent.phone, password: '123456' },
      teacher: { id: teacher._id.toString(), phone: teacher.phone, password: '123456' },
      student: { id: student._id.toString(), phone: student.phone, password: '123456' },
      branch: { id: branch._id.toString(), code: branch.code }
    };
    
    fs.writeFileSync(path.join(__dirname, 'qa_messaging_data.json'), JSON.stringify(testData, null, 2));
    console.log('✅ Seed data successfully created.');

  } catch (err) {
    console.error('❌ Error during seeding:', err);
  } finally {
    mongoose.disconnect();
  }
}

seed();
