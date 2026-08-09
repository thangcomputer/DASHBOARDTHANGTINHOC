const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Teacher = require('./models/Teacher');
const Student = require('./models/Student');
const Employee = require('./models/Employee');
const Branch = require('./models/Branch');

async function seedAndTest() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to DB');

  const randomPhone = () => '09' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');

  // 1. Create a Branch
  let branch = await Branch.findOne({ code: 'CN01' });
  if (!branch) {
    branch = await Branch.create({ name: 'Chi nhánh 1', code: 'CN01', address: '123 Test' });
    console.log('Created branch CN01');
  }

  // 2. Create Admin
  const adminPass = await bcrypt.hash('password123', 10);
  let admin = await Teacher.findOne({ email: 'admin2@test.com' });
  if (!admin) {
    admin = await Teacher.create({
      name: 'Test Admin',
      email: 'admin2@test.com',
      phone: randomPhone(),
      password: adminPass,
      role: 'admin',
      adminRole: 'SUPER_ADMIN',
      status: 'active',
      permissions: ['ALL']
    });
    console.log('Created admin2@test.com');
  }

  // 3. Create Staff (Nhân viên hỗ trợ)
  let staff = await Teacher.findOne({ email: 'staff@test.com' });
  if (!staff) {
    staff = await Teacher.create({
      name: 'Test Staff',
      email: 'staff@test.com',
      phone: randomPhone(),
      password: adminPass,
      role: 'staff',
      adminRole: 'STAFF',
      status: 'active',
      permissions: ['MANAGE_STUDENTS']
    });
    console.log('Created staff@test.com');
  }

  // 4. Create Branch Staff (Nhân viên chi nhánh)
  let branchStaff = await Teacher.findOne({ email: 'branchstaff@test.com' });
  if (!branchStaff) {
    branchStaff = await Teacher.create({
      name: 'Test Branch Staff',
      email: 'branchstaff@test.com',
      phone: randomPhone(),
      password: adminPass,
      role: 'staff',
      adminRole: 'STAFF',
      branchId: branch._id,
      branchCode: branch.code,
      status: 'active',
      permissions: ['MANAGE_STUDENTS']
    });
    console.log('Created branchstaff@test.com');
  }

  // 5. Create Teacher (Giảng viên)
  let teacher = await Teacher.findOne({ email: 'teacher@test.com' });
  if (!teacher) {
    teacher = await Teacher.create({
      name: 'Test Teacher',
      email: 'teacher@test.com',
      phone: randomPhone(),
      password: adminPass,
      role: 'teacher',
      status: 'active'
    });
    console.log('Created teacher@test.com');
  }

  // 6. Create Student (Học viên)
  let student = await Student.findOne({ email: 'student2@test.com' });
  if (!student) {
    const studentPhone = randomPhone();
    student = await Student.create({
      name: 'Test Student',
      email: 'student2@test.com',
      phone: studentPhone,
      zalo: studentPhone,
      password: adminPass,
      status: 'active',
      branchId: branch._id,
      price: 1000000,
      course: 'Test Course'
    });
    console.log('Created student2@test.com');
  }

  console.log('All test users created successfully!');
  process.exit(0);
}

seedAndTest().catch(err => {
  console.error(err);
  process.exit(1);
});
