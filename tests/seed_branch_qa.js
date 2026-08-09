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
    await Branch.deleteMany({ code: { $in: ['QAT_A', 'QAT_B'] } });
    await Teacher.deleteMany({ phone: { $in: ['0999999001', '0999999002', '0999999003'] } });
    await Student.deleteMany({ phone: { $in: ['0999999101', '0999999102'] } });
    await Course.deleteMany({ name: { $in: ['Course QA Branch A', 'Course QA Branch B'] } });
    await Employee.deleteMany({ phone: { $in: ['0999999201', '0999999202'] } });
    
    // 2. Create Branches
    const branchA = await Branch.create({ name: 'Chi Nhánh Test A', code: 'QAT_A', isActive: true });
    const branchB = await Branch.create({ name: 'Chi Nhánh Test B', code: 'QAT_B', isActive: true });
    console.log('✅ Created Branch A:', branchA._id);
    console.log('✅ Created Branch B:', branchB._id);

    // 3. Create Admin Staff A (Branch A only)
    const adminStaffA = await Teacher.create({
      name: 'Admin Staff Chi nhánh A',
      phone: '0999999001',
      password: '123456',
      role: 'staff',
      adminRole: 'STAFF', // STAFF for branch admin
      permissions: ['ALL'], // Grant all permissions so we can test branch isolation instead of role isolation
      branchId: branchA._id,
      branchCode: branchA.code,
      status: 'active'
    });
    console.log('✅ Created Admin Staff A (login: 0999999001 / 123456)');

    // 4. Create Normal Teacher for A and B
    const teacherA = await Teacher.create({
      name: 'Teacher Branch A', phone: '0999999002', password: '123456',
      role: 'teacher', branchId: branchA._id, branchCode: branchA.code, status: 'active'
    });
    const teacherB = await Teacher.create({
      name: 'Teacher Branch B', phone: '0999999003', password: '123456',
      role: 'teacher', branchId: branchB._id, branchCode: branchB.code, status: 'active'
    });

    // 5. Create Courses
    const courseA = await Course.create({ name: 'Course QA Branch A', price: 1000000 });
    const courseB = await Course.create({ name: 'Course QA Branch B', price: 2000000 });

    // 6. Create Students
    const studentA = await Student.create({
      name: 'Student Branch A', phone: '0999999101', zalo: '0999999101', password: '123456',
      branchId: branchA._id, branchCode: branchA.code, courseId: courseA._id, course: courseA.name,
      paid: true, price: 1000000, totalSessions: 10, remainingSessions: 10, status: 'learning'
    });
    
    const studentB = await Student.create({
      name: 'Student Branch B', phone: '0999999102', zalo: '0999999102', password: '123456',
      branchId: branchB._id, branchCode: branchB.code, courseId: courseB._id, course: courseB.name,
      paid: true, price: 2000000, totalSessions: 10, remainingSessions: 10, status: 'learning'
    });

    // 7. Create Employees
    const empA = await Employee.create({
      name: 'Employee Branch A', phone: '0999999201', position: 'BAO_VE',
      branchId: branchA._id, branchCode: branchA.code, baseSalary: 5000000
    });
    const empB = await Employee.create({
      name: 'Employee Branch B', phone: '0999999202', position: 'BAO_VE',
      branchId: branchB._id, branchCode: branchB.code, baseSalary: 6000000
    });

    // 8. Output JSON file with credentials and IDs for tests
    const fs = require('fs');
    const testData = {
      branchA: { id: branchA._id.toString(), code: branchA.code },
      branchB: { id: branchB._id.toString(), code: branchB.code },
      adminStaffA: { phone: adminStaffA.phone, password: '123456', id: adminStaffA._id.toString() },
      teacherB: { id: teacherB._id.toString() },
      studentB: { id: studentB._id.toString() },
      empB: { id: empB._id.toString() }
    };
    fs.writeFileSync(__dirname + '/qa_branch_data.json', JSON.stringify(testData, null, 2));

    console.log('✅ Seed data successfully created.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error seeding data:', err);
    process.exit(1);
  }
}

seed();
