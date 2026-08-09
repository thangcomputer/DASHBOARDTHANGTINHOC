const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');

// Legacy Models
const Teacher = require('../modules/teacher/models/Teacher');
const Student = require('../modules/student/models/Student');

// New Models
const User = require('../modules/users/User');
const Role = require('../modules/roles/Role');
const Permission = require('../modules/permissions/Permission');

const { UserRole, PermissionCode, AccessScope } = require('../shared/enums');

async function migrateIdentity() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    // 1. Init Permissions
    console.log('Initializing permissions...');
    const permissions = Object.values(PermissionCode);
    for (const code of permissions) {
      await Permission.updateOne(
        { code },
        { $setOnInsert: { code, description: `Permission for ${code}` } },
        { upsert: true }
      );
    }
    const allPermissions = await Permission.find();
    const permMap = {};
    allPermissions.forEach(p => (permMap[p.code] = p._id));

    // 2. Init Roles
    console.log('Initializing roles...');
    const roles = [
      { code: UserRole.SUPER_ADMIN, name: 'Quản trị hệ thống', scope: AccessScope.GLOBAL, perms: Object.values(PermissionCode) },
      { code: UserRole.HIGH_ADMIN, name: 'Quản trị cấp cao', scope: AccessScope.GLOBAL, perms: [PermissionCode.USER_VIEW, PermissionCode.COURSE_VIEW] },
      { code: UserRole.ADMIN_STAFF, name: 'Nhân viên quản trị', scope: AccessScope.BRANCH, perms: [] },
      { code: UserRole.SUPPORT_AGENT, name: 'Chuyên viên hỗ trợ', scope: AccessScope.BRANCH, perms: [PermissionCode.SUPPORT_ASSIGN, PermissionCode.MESSAGE_SEND] },
      { code: UserRole.TEACHER, name: 'Giảng viên', scope: AccessScope.BRANCH, perms: [PermissionCode.COURSE_VIEW] },
      { code: UserRole.STUDENT, name: 'Học viên', scope: AccessScope.BRANCH, perms: [] },
    ];

    for (const r of roles) {
      const permIds = r.perms.map(code => permMap[code]);
      await Role.updateOne(
        { code: r.code },
        { $setOnInsert: { code: r.code, name: r.name, scope: r.scope, permissions: permIds } },
        { upsert: true }
      );
    }
    const allRoles = await Role.find();
    const roleMap = {};
    allRoles.forEach(r => (roleMap[r.code] = r._id));

    // 3. Migrate Teachers
    console.log('Migrating Teachers...');
    const teachers = await Teacher.find().select('+password');
    let migratedTeacherCount = 0;
    for (const t of teachers) {
      // Determine Role
      let roleCode = UserRole.TEACHER;
      if (t.role === 'admin' || t.role === 'staff') {
        if (t.adminRole === 'SUPER_ADMIN') roleCode = UserRole.SUPER_ADMIN;
        else if (t.adminRole === 'HIGH_ADMIN') roleCode = UserRole.HIGH_ADMIN;
        else if (t.adminRole === 'SUPPORT') roleCode = UserRole.SUPPORT_AGENT;
        else roleCode = UserRole.ADMIN_STAFF;
      }

      // Check if user already exists
      const existing = await User.findOne({ phone: t.phone });
      if (!existing) {
        await User.create({
          _id: t._id,
          phone: t.phone,
          email: t.email || `legacy_${t._id}@example.com`,
          password: t.password || 'MIGRATED_NO_PASSWORD',
          displayName: t.name,
          avatar: t.avatar,
          jobTitle: t.specialty || '',
          roleId: roleMap[roleCode],
          roleCode: roleCode,
          branchId: t.branchId,
          status: t.status === 'active' ? 'active' : 'inactive',
        });
        migratedTeacherCount++;
      }
    }
    console.log(`Migrated ${migratedTeacherCount} teachers to User collection.`);

    // 4. Migrate Students
    console.log('Migrating Students...');
    const students = await Student.find().select('+password');
    let migratedStudentCount = 0;
    for (const s of students) {
      const existing = await User.findOne({ phone: s.phone });
      if (!existing) {
        await User.create({
          _id: s._id,
          phone: s.phone || s.zalo || s.email,
          email: s.email || `student_${s._id}@example.com`,
          passwordHash: s.password || 'none',
          displayName: s.name || 'Học viên',        avatar: s.avatar,
          roleId: roleMap[UserRole.STUDENT],
          roleCode: UserRole.STUDENT,
          branchId: s.branchId,
          status: s.status === 'active' ? 'active' : 'inactive',
        });
        migratedStudentCount++;
      }
    }
    console.log(`Migrated ${migratedStudentCount} students to User collection.`);

    console.log('Migration Completed Successfully (Test Run).');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrateIdentity();
