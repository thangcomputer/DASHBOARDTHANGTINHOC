'use strict';

/**
 * Reset and seed ONLY the isolated test database.
 *
 * Refuses to run unless:
 * - NODE_ENV=test
 * - TEST_DATABASE_URI names exactly thang_tin_hoc_test
 * - that name ends with _test and differs from MONGODB_URI
 * - ALLOW_TEST_DB_RESET=true
 * - ALLOW_TEST_DB_HOST_MATCH=true when the Mongo host matches runtime
 *
 * Never drops a database. Never writes to MONGODB_URI.
 * Usage (PowerShell):
 *   $env:NODE_ENV='test'
 *   $env:TEST_DATABASE_URI='mongodb://127.0.0.1:27018/thang_tin_hoc_test?replicaSet=rs0'
 *   $env:ALLOW_TEST_DB_RESET='true'
 *   $env:ALLOW_TEST_DB_HOST_MATCH='true'
 *   node scripts/reset-and-seed-test-db.js
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { assertTestDatabaseResetAllowed } = require('../tests/setup/testDatabaseGuard');
const { parseMongoTarget } = require('../utils/mongoUriUtils');

const TEST_DB_NAME = 'thang_tin_hoc_test';
const PASSWORD = 'Test@12345';

function loadDotEnv() {
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.indexOf('=') < 1) continue;
    const key = trimmed.slice(0, trimmed.indexOf('='));
    if (process.env[key]) continue;
    process.env[key] = trimmed.slice(trimmed.indexOf('=') + 1).replace(/^['"]|['"]$/g, '');
  }
}

async function countStudents(uri) {
  const conn = mongoose.createConnection(uri);
  await conn.asPromise();
  const name = conn.name;
  const count = await conn.collection('students').countDocuments();
  await conn.close();
  return { name, count };
}

async function clearDocuments(db) {
  const listed = await db.listCollections().toArray();
  const cleared = [];
  for (const item of listed) {
    const result = await db.collection(item.name).deleteMany({});
    cleared.push({ name: item.name, deleted: result.deletedCount });
  }
  return cleared;
}

async function seed() {
  if (mongoose.connection.name !== TEST_DB_NAME) {
    throw new Error(`Seed từ chối vì đang nối ${mongoose.connection.name}`);
  }
  const Teacher = require('../models/Teacher');
  const Student = require('../models/Student');
  const Course = require('../models/Course');
  const Schedule = require('../models/Schedule');
  const Assignment = require('../models/Assignment');
  const Notification = require('../models/Notification');
  const Message = require('../models/Message');
  const DailyPracticeProfile = require('../models/DailyPracticeProfile');
  const PaymentSession = require('../models/PaymentSession');
  const LessonSubject = require('../models/LessonSubject');
  const LessonUnit = require('../models/LessonUnit');
  const { claimLoginDevice } = require('../services/registeredDeviceService');

  const admin = await Teacher.create({
    name: 'Admin Test',
    phone: '0900000001',
    email: 'admin.test@thang-tin-hoc.test',
    password: PASSWORD,
    role: 'admin',
    adminRole: 'SUPER_ADMIN',
    status: 'active',
    permissions: ['manage_students', 'manage_schedule', 'manage_finance', 'manage_training', 'system_settings', 'manage_staff'],
  });

  const teachers = [];
  for (let i = 1; i <= 3; i += 1) {
    teachers.push(await Teacher.create({
      name: `Giảng viên test ${i}`,
      phone: `090100000${i}`,
      email: `teacher${i}.test@thang-tin-hoc.test`,
      password: PASSWORD,
      role: 'teacher',
      status: 'active',
    }));
  }

  const courses = await Course.create([
    { name: 'Tin học văn phòng test', slug: 'tin-hoc-van-phong-test', category: 'van-phong', description: 'Khóa test', price: 1500000 },
    { name: 'Lập trình test', slug: 'lap-trinh-test', category: 'lap-trinh', description: 'Khóa test', price: 2000000 },
  ]);

  const subject = await LessonSubject.create({
    name: 'Windows cơ bản test',
    slug: 'windows-co-ban-test',
    summary: 'Môn test',
    sortOrder: 1,
  });
  const unit = await LessonUnit.create({
    subjectId: subject._id,
    title: 'Bài 1 - Màn hình nền',
    videoUrl: 'https://example.test/video-bai-1',
    note: 'Tài liệu test, không phải video thật.',
    sortOrder: 1,
  });

  const students = [];
  for (let i = 1; i <= 10; i += 1) {
    const teacher = teachers[(i - 1) % teachers.length];
    const course = courses[i % 2];
    students.push(await Student.create({
      name: `Học viên test ${i}`,
      email: `student${i}.test@thang-tin-hoc.test`,
      phone: `09020000${String(i).padStart(2, '0')}`,
      zalo: `09020000${String(i).padStart(2, '0')}`,
      age: 18,
      gender: i % 2 ? 'Nam' : 'Nữ',
      course: course.name,
      price: course.price,
      status: i <= 8 ? 'Đang học' : 'Chờ xếp lớp',
      password: PASSWORD,
      teacherId: teacher._id,
      teacherName: teacher.name,
      enrollments: [{
        courseName: course.name,
        courseId: course._id,
        teacherId: teacher._id,
        teacherName: teacher.name,
        price: 0,
        paid: i <= 3,
        totalSessions: 12,
        remainingSessions: i <= 3 ? 8 : 12,
        completedSessions: i <= 3 ? 4 : 0,
      }],
    }));
  }

  const now = new Date();
  const upcoming = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  await Schedule.create([
    {
      teacherId: teachers[0]._id,
      teacherName: teachers[0].name,
      studentId: students[0]._id,
      studentName: students[0].name,
      courseId: courses[0]._id,
      course: courses[0].name,
      date: upcoming,
      startTime: '19:00',
      endTime: '21:00',
      status: 'scheduled',
    },
    {
      teacherId: teachers[0]._id,
      teacherName: teachers[0].name,
      studentId: students[1]._id,
      studentName: students[1].name,
      courseId: courses[0]._id,
      course: courses[0].name,
      date: past,
      startTime: '19:00',
      endTime: '21:00',
      status: 'completed',
    },
  ]);

  const assignment = await Assignment.create({
    courseId: String(courses[0]._id),
    teacherId: teachers[0]._id,
    studentId: students[0]._id,
    assignedById: String(teachers[0]._id),
    assignedByRole: 'teacher',
    assignedByName: teachers[0].name,
    title: 'Bài tập test 1',
    description: 'Nộp file test.',
    deadline: upcoming,
  });

  await Notification.create({
    type: 'COURSE',
    title: 'Khóa test đã mở',
    content: 'Thông báo seed, không gửi ra ngoài.',
    sender_id: 'SYSTEM',
    receivers: [String(students[0]._id)],
    read_by: [],
  });

  const { buildConversationId } = require('../utils/chatConversationId');
  const conversationId = buildConversationId('teacher', teachers[0]._id, 'student', students[0]._id);
  await Message.create([
    {
      conversationId,
      senderId: String(teachers[0]._id),
      senderName: teachers[0].name,
      senderRole: 'teacher',
      receiverId: String(students[0]._id),
      receiverName: students[0].name,
      receiverRole: 'student',
      content: 'Chào học viên test.',
      isRead: false,
    },
    {
      conversationId,
      senderId: String(students[0]._id),
      senderName: students[0].name,
      senderRole: 'student',
      receiverId: String(teachers[0]._id),
      receiverName: teachers[0].name,
      receiverRole: 'teacher',
      content: 'Em đã nhận tin.',
      isRead: true,
    },
  ]);

  const rules = require('../services/dailyPracticeRules');
  await DailyPracticeProfile.create({
    studentId: students[0]._id,
    xpTotal: rules.FREE_PORTAL_DAILY_XP || 60,
    dailyXp: rules.FREE_PORTAL_DAILY_XP || 60,
    purchasedXp: 0,
    studyXpTotal: 0,
    streak: 1,
  });

  await PaymentSession.create({
    sessionId: 'test-session-paid-1',
    ref: 'TESTREF0001',
    amount: 100000,
    originalAmount: 100000,
    status: 'paid',
    studentName: students[2].name,
    courseName: courses[0].name,
    courseId: courses[0]._id,
    studentId: students[2]._id,
    paidAmount: 100000,
    kind: 'tuition',
    plan: '',
  });

  const deviceUser = students[0];
  const first = await claimLoginDevice({ userId: deviceUser._id, role: 'student', deviceKey: 'test-device-1', platform: 'web' });
  const second = await claimLoginDevice({ userId: deviceUser._id, role: 'student', deviceKey: 'test-device-2', platform: 'web' });
  let thirdCode = '';
  try {
    await claimLoginDevice({ userId: deviceUser._id, role: 'student', deviceKey: 'test-device-3', platform: 'web' });
  } catch (error) {
    thirdCode = error.code || '';
  }
  const again = await claimLoginDevice({
    userId: deviceUser._id,
    role: 'student',
    deviceKey: 'test-device-1',
    deviceSecret: first.deviceSecret,
    platform: 'web',
  });
  const stillTwo = await mongoose.connection.collection('registereddevices').countDocuments({ userId: String(deviceUser._id), status: 'active' });

  const teacherIds = new Set(teachers.map((row) => String(row._id)));
  const linked = students.every((row) => row.enrollments.every((item) => teacherIds.has(String(item.teacherId)) && courses.some((course) => String(course._id) === String(item.courseId))));

  return {
    adminId: String(admin._id),
    teacherIds: teachers.map((row) => String(row._id)),
    studentIds: students.map((row) => String(row._id)),
    courseIds: courses.map((row) => String(row._id)),
    lessonSubjectId: String(subject._id),
    lessonUnitId: String(unit._id),
    assignmentId: String(assignment._id),
    linksOk: linked,
    device: {
      firstSlot: first.slot,
      secondSlot: second.slot,
      thirdCode,
      reloginSlot: again.slot,
      activeDevicesAfterRelogin: stillTwo,
    },
    xpRule: rules.FREE_PORTAL_DAILY_XP,
  };
}

async function main() {
  loadDotEnv();
  const target = assertTestDatabaseResetAllowed(process.env);
  if (target.dbName !== TEST_DB_NAME) {
    throw new Error(`Chỉ được reset database ${TEST_DB_NAME}, nhận được ${target.dbName}`);
  }
  const runtimeUri = String(process.env.MONGODB_URI || '').trim();
  const runtime = runtimeUri ? parseMongoTarget(runtimeUri, 'MONGODB_URI') : null;
  if (runtime && runtime.dbName === target.dbName) {
    throw new Error('Database test trùng tên database runtime');
  }

  let runtimeBefore = null;
  if (runtimeUri) runtimeBefore = await countStudents(runtimeUri);

  await mongoose.connect(target.uri);
  if (mongoose.connection.name !== TEST_DB_NAME) {
    await mongoose.disconnect();
    throw new Error(`Kết nối sai database: ${mongoose.connection.name}`);
  }

  const cleared = await clearDocuments(mongoose.connection.db);
  const seeded = await seed();
  const counts = {
    teachers: await mongoose.connection.collection('teachers').countDocuments(),
    students: await mongoose.connection.collection('students').countDocuments(),
    courses: await mongoose.connection.collection('courses').countDocuments(),
    schedules: await mongoose.connection.collection('schedules').countDocuments(),
    messages: await mongoose.connection.collection('messages').countDocuments(),
  };
  await mongoose.disconnect();

  let runtimeAfter = null;
  if (runtimeUri) runtimeAfter = await countStudents(runtimeUri);
  if (runtimeBefore && runtimeAfter && (runtimeBefore.count !== runtimeAfter.count || runtimeBefore.name === TEST_DB_NAME)) {
    throw new Error('Số học viên database runtime thay đổi sau seed test');
  }

  const manifest = {
    database: TEST_DB_NAME,
    host: target.hostname,
    runtimeDatabaseUntouched: runtimeBefore ? runtimeBefore.name : null,
    runtimeStudentCountUnchanged: runtimeBefore ? runtimeBefore.count === runtimeAfter.count : null,
    cleared,
    counts,
    seeded,
    password: PASSWORD,
  };
  const out = path.join(__dirname, '..', 'tests', 'fixtures');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'test-seed-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify({
    database: manifest.database,
    counts,
    linksOk: seeded.linksOk,
    device: seeded.device,
    runtimeStudentCountUnchanged: manifest.runtimeStudentCountUnchanged,
  }, null, 2));
}

main().catch((error) => {
  console.error('RESET_ABORTED', error.message);
  process.exit(1);
});
