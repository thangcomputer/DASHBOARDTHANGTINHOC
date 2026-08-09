const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../modules/users/User');
const Role = require('../modules/roles/Role');
const Teacher = require('../modules/teacher/models/Teacher');
const Student = require('../modules/student/models/Student');
const { UserRole } = require('../shared/enums');

async function seedData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const roles = await Role.find();
    if (roles.length === 0) {
      console.log('Please run migrate-identity.js first to init roles.');
      process.exit(1);
    }

    await Teacher.deleteMany({});
    await Student.deleteMany({});
    await User.deleteMany({});

    const testUsers = [
      {
        email: 'admin@test.com',
        phone: '0900000001',
        password: 'password123',
        name: 'Super Admin',
        roleCode: UserRole.SUPER_ADMIN,
        legacyRole: 'admin',
        legacyAdminRole: 'SUPER_ADMIN'
      },
      {
        email: 'staff@test.com',
        phone: '0900000002',
        password: 'password123',
        name: 'Chi Nhánh Staff',
        roleCode: UserRole.ADMIN_STAFF,
        legacyRole: 'staff',
        legacyAdminRole: 'STAFF'
      },
      {
        email: 'support@test.com',
        phone: '0900000003',
        password: 'password123',
        name: 'Nhân viên Hỗ trợ',
        roleCode: UserRole.SUPPORT_AGENT,
        legacyRole: 'staff', // Old system didn't have dedicated support role often
        legacyAdminRole: 'SUPPORT'
      },
      {
        email: 'teacher@test.com',
        phone: '0900000004',
        password: 'password123',
        name: 'Giảng Viên Test',
        roleCode: UserRole.TEACHER,
        legacyRole: 'teacher',
        legacyAdminRole: null
      },
      {
        email: 'student@test.com',
        phone: '0900000005',
        password: 'password123',
        name: 'Học Viên Test',
        roleCode: UserRole.STUDENT,
        legacyRole: 'student',
        legacyAdminRole: null
      }
    ];

    for (const data of testUsers) {
      const roleDoc = roles.find(r => r.code === data.roleCode);
      
      let legacyId;
      // Because authRoutes.js still checks Teacher / Student collection, we MUST create them there first!
      if (data.legacyRole === 'student') {
        const s = new Student({
          email: data.email,
          phone: data.phone,
          password: data.password, // Schema hook hashes it
          name: data.name,
          role: 'student',
          status: 'Hoạt động',
          zalo: data.phone,
          course: 'Khóa học Test',
          price: 1000000,
        });
        await s.save();
        legacyId = s._id;
      } else {
        const t = new Teacher({
          email: data.email,
          phone: data.phone,
          password: data.password, // Schema hook hashes it
          name: data.name,
          role: data.legacyRole,
          adminRole: data.legacyAdminRole,
          status: 'active',
        });
        await t.save();
        legacyId = t._id;
      }

      // Then create the new User object with the SAME _id
      const u = new User({
        _id: legacyId,
        username: data.email,
        email: data.email,
        phone: data.phone,
        displayName: data.name,
        roleId: roleDoc._id,
        roleCode: data.roleCode,
        password: 'dummy' // Not used yet, login checks old model
      });
      await u.save();
      console.log(`Created ${data.email} (${data.roleCode}) with ID ${legacyId}`);
    }

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seedData();
