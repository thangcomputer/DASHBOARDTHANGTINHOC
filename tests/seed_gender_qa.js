require('dotenv').config();
const mongoose = require('mongoose');
const Teacher = require('../modules/teacher/models/Teacher');
const Student = require('../modules/student/models/Student');
const Branch = require('../modules/branch/models/Branch');
const fs = require('fs');
const path = require('path');

async function seed() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to DB');

    // Create a Branch
    const branch = await Branch.findOneAndUpdate({ code: 'QAGENDER' }, { name: 'Gender QA Branch', code: 'QAGENDER', address: '123 QA' }, { upsert: true, new: true });

    await Teacher.deleteMany({ phone: { $in: ['0888888001', '0888888002', '0888888003', '0888888004'] } });
    await Student.deleteMany({ phone: '0888888101' });

    // Branch Admin
    const branchAdmin = await Teacher.create({
      name: 'Branch Admin Gender', phone: '0888888001', password: '123456',
      role: 'staff', adminRole: 'STAFF', permissions: ['ALL'],
      branchId: branch._id, branchCode: branch.code, status: 'active', gender: ''
    });

    // Employee
    const employee = await Teacher.create({
      name: 'Employee Gender', phone: '0888888002', password: '123456',
      role: 'staff', adminRole: 'STAFF', permissions: [],
      branchId: branch._id, branchCode: branch.code, status: 'active', gender: ''
    });

    // Support Agent
    const supportAgent = await Teacher.create({
      name: 'Support Gender', phone: '0888888003', password: '123456',
      role: 'staff', adminRole: 'SUPPORT', permissions: [],
      branchId: branch._id, branchCode: branch.code, status: 'active', gender: ''
    });

    // Teacher
    const teacher = await Teacher.create({
      name: 'Teacher Gender', phone: '0888888004', password: '123456',
      role: 'teacher', branchId: branch._id, branchCode: branch.code, status: 'active', gender: ''
    });

    // Student
    const student = await Student.create({
      name: 'Student Gender', phone: '0888888101', zalo: '0888888101', password: '123456',
      course: 'Test Course', price: 1000000,
      branchId: branch._id, branchCode: branch.code, status: 'active', gender: ''
    });

    const testData = {
      branchAdmin: { id: branchAdmin._id.toString(), phone: branchAdmin.phone, password: '123456' },
      employee: { id: employee._id.toString(), phone: employee.phone, password: '123456' },
      support: { id: supportAgent._id.toString(), phone: supportAgent.phone, password: '123456' },
      teacher: { id: teacher._id.toString(), phone: teacher.phone, password: '123456' },
      student: { id: student._id.toString(), phone: student.phone, password: '123456' },
      admin: { phone: 'admin', password: 'admin123' }
    };

    fs.writeFileSync(path.join(__dirname, 'qa_gender_data.json'), JSON.stringify(testData, null, 2));
    console.log('✅ Seed data successfully created.');

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

seed();
