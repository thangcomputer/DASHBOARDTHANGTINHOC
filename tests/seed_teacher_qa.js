const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');

dotenv.config();

// Models
const Branch = require('../modules/branch/models/Branch');
const Teacher = require('../modules/teacher/models/Teacher');
const Student = require('../modules/student/models/Student');
const Course = require('../modules/course/models/Course');
const Employee = require('../modules/auth/models/Employee');
const Transaction = require('../modules/transaction/models/Transaction');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dashboardthangtinhoc';

async function seed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to DB');

    // 1. Delete old test data
    await Branch.deleteMany({ code: { $in: ['QATT'] } });
    await Teacher.deleteMany({ phone: { $in: ['0888888001', '0888888002', '0888888003'] } });
    await Student.deleteMany({ phone: { $in: ['0888888101', '0888888102'] } });
    await Course.deleteMany({ name: { $in: ['Course Teacher QA'] } });
    
    // 2. Create Branch
    const branch = await Branch.create({ name: 'Chi Nhánh QA Teacher', code: 'QATT', isActive: true });
    console.log('✅ Created Branch:', branch._id);

    // 3. Create Admin Staff (Branch Admin)
    const adminStaff = await Teacher.create({
      name: 'Branch Admin Teacher QA',
      phone: '0888888003',
      password: '123456',
      role: 'staff',
      adminRole: 'STAFF', 
      permissions: ['ALL'],
      branchId: branch._id,
      branchCode: branch.code,
      status: 'active'
    });

    // 4. Create Teachers
    const teacherA = await Teacher.create({
      name: 'Giảng viên QA Chính', phone: '0888888001', password: '123456',
      role: 'teacher', branchId: branch._id, branchCode: branch.code, status: 'active'
    });
    console.log('✅ Created Teacher A (login: 0888888001 / 123456)');
    
    const teacherB = await Teacher.create({
      name: 'Giảng viên QA Khác', phone: '0888888002', password: '123456',
      role: 'teacher', branchId: branch._id, branchCode: branch.code, status: 'active'
    });

    // 5. Create Courses
    const course = await Course.create({ name: 'Course Teacher QA', price: 1000000 });

    // 6. Create Students (assigned to Teacher A vs Teacher B)
    const studentA = await Student.create({
      name: 'Học viên của GV Chính', phone: '0777777001', zalo: '0777777001', password: '123456',
      branchId: branch._id, branchCode: branch.code, courseId: course._id, course: course.name,
      teacherId: teacherA._id, teacherName: teacherA.name,
      paid: true, price: 1000000, totalSessions: 12, remainingSessions: 12, status: 'active'
    });
    
    const studentB = await Student.create({
      name: 'Học viên của GV Khác', phone: '0777777002', zalo: '0777777002', password: '123456',
      branchId: branch._id, branchCode: branch.code, courseId: course._id, course: course.name,
      teacherId: teacherB._id, teacherName: teacherB.name,
      paid: true, price: 1000000, totalSessions: 10, remainingSessions: 10, status: 'active'
    });

    // 7. Output JSON file with credentials and IDs for tests
    const fs = require('fs');
    const testData = {
      branch: { id: branch._id.toString(), code: branch.code },
      adminStaff: { phone: adminStaff.phone, password: '123456', id: adminStaff._id.toString() },
      teacherA: { phone: teacherA.phone, password: '123456', id: teacherA._id.toString() },
      teacherB: { phone: teacherB.phone, password: '123456', id: teacherB._id.toString() },
      studentA: { phone: studentA.phone, password: '123456', id: studentA._id.toString() },
      studentB: { phone: studentB.phone, password: '123456', id: studentB._id.toString() },
      course: { id: course._id.toString() }
    };
    fs.writeFileSync(__dirname + '/qa_teacher_data.json', JSON.stringify(testData, null, 2));

    console.log('✅ Seed data successfully created.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding data:', err);
    process.exit(1);
  }
}

seed();
