'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const TEST_DB = String(process.env.TEST_DATABASE_URI || '').trim();
const hasTestDb = /^test_|_test$/i.test(
  (() => {
    try {
      return decodeURIComponent(new URL(TEST_DB).pathname.replace(/^\/+|\/+$/g, ''));
    } catch {
      return '';
    }
  })(),
);

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
}

const { assertTestDatabaseEnvironment } = require('../setup/testDatabaseGuard');
const Student = require('../../models/Student');
const Teacher = require('../../models/Teacher');
const Branch = require('../../models/Branch');
const LedgerEntry = require('../../models/LedgerEntry');
const UserDeviceSession = require('../../models/UserDeviceSession');
const AuthSession = require('../../models/AuthSession');
const SystemSettings = require('../../models/SystemSettings');
const LmsLearnerProgress = require('../../models/LmsLearnerProgress');
const LmsXpGrant = require('../../models/LmsXpGrant');
const studentRoutes = require('../../routes/studentRoutes');
const presenceStore = require('../../config/presenceStore');
const { vnStartOfDay } = require('../../utils/vnTimezone');

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server);
    });
  });
}

test('GET /api/students/stats aggregates full DB (>5 students), online Admin/Staff/GV/HV, VN ledger todayRevenue, funnel, exams, and pending teachers', {
  timeout: 30000,
  skip: hasTestDb ? false : 'TEST_DATABASE_URI (test_* or *_test DB) not set',
}, async () => {
  process.env.NODE_ENV = 'test';
  const target = assertTestDatabaseEnvironment(process.env);

  const suffix = crypto.randomBytes(4).toString('hex');
  const createdIds = { students: [], teachers: [], sessions: [], ledgerKeys: [] };
  let connected = false;
  let server = null;
  let branchA = null;
  let branchB = null;
  let createdSettingsMain = false;

  try {
    await mongoose.connect(target.uri, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    await Promise.all([
      Student.init(),
      Teacher.init(),
      Branch.init(),
      LedgerEntry.init(),
      UserDeviceSession.init(),
      AuthSession.init(),
    ]);

    const existingSettings = await SystemSettings.findOne({ _key: 'main' }).lean();
    if (!existingSettings) {
      await SystemSettings.create({ _key: 'main', adminTokenVersion: 0 });
      createdSettingsMain = true;
    }
    const settingsDoc = await SystemSettings.findOne({ _key: 'main' }).lean();

    branchA = await Branch.create({ name: `Overview A ${suffix}`, code: `OA${suffix.slice(0, 6).toUpperCase()}` });
    branchB = await Branch.create({ name: `Overview B ${suffix}`, code: `OB${suffix.slice(0, 6).toUpperCase()}` });

    const now = new Date();
    const startTodayVN = vnStartOfDay(now);
    const yesterday = new Date(startTodayVN.getTime() - 12 * 3600 * 1000);
    const eightDaysAgo = new Date(now.getTime() - 8 * 86400_000);

    // Create 7 students (> pagination limit 5!) in Branch A & 1 in Branch B:
    // - 3 paid center students (one updated today WITHOUT payment today -> must NOT add to todayRevenue)
    // - 2 freePortal unpaid 0đ students (one engaged via session, one never logged in)
    // - 2 center students unpaid / at-risk / with examProgress
    const phoneBase = parseInt(suffix, 16) % 10000000;
    const mkPhone = (idx) => `09${String((phoneBase + idx) % 100000000).padStart(8, '0')}`;

    const studentDocs = await Student.create([
      {
        name: `STU1 PAID OLD UPDATED TODAY ${suffix}`,
        phone: mkPhone(1),
        zalo: mkPhone(1),
        course: 'Excel Pro',
        price: 5000000,
        paid: true,
        paidAmount: 5000000,
        branchId: branchA._id,
        status: 'Đang học',
        remainingSessions: 1,
        completedSessions: 3,
        lastAccessAt: now,
        examProgress: [{ status: 'dat', tracNghiem: { score: 9, total: 10 }, thucHanh: 'da_nop', essayScore: 8 }],
      },
      {
        name: `STU2 PAID TODAY ${suffix}`,
        phone: mkPhone(2),
        zalo: mkPhone(2),
        course: 'Word Pro',
        price: 3000000,
        paid: true,
        paidAmount: 3000000,
        branchId: branchA._id,
        status: 'Đang học',
        remainingSessions: 10,
        completedSessions: 2,
        lastAccessAt: yesterday,
      },
      {
        name: `STU3 PAID TODAY PARTIAL REFUND ${suffix}`,
        phone: mkPhone(3),
        zalo: mkPhone(3),
        course: 'MOS Combo',
        price: 4000000,
        paid: true,
        paidAmount: 4000000,
        branchId: branchA._id,
        status: 'Đang học',
        remainingSessions: 12,
        completedSessions: 0,
      },
      {
        name: `STU4 FREE UNENGAGED ${suffix}`,
        phone: mkPhone(4),
        zalo: mkPhone(4),
        course: 'Tài khoản miễn phí',
        price: 0,
        paid: true,
        paidAmount: 0,
        freePortal: true,
        freeUnlocked: false,
        branchId: branchA._id,
        status: 'Đang học',
        enrollments: [{ courseName: 'Tài khoản miễn phí', price: 0, paid: true, status: 'active' }],
      },
      {
        name: `STU5 FREE ENGAGED ${suffix}`,
        phone: mkPhone(5),
        zalo: mkPhone(5),
        course: 'Tài khoản miễn phí',
        price: 0,
        paid: true,
        paidAmount: 0,
        freePortal: true,
        freeUnlocked: false,
        branchId: branchA._id,
        status: 'Đang học',
        enrollments: [{ courseName: 'Tài khoản miễn phí', price: 0, paid: true, status: 'active' }],
      },
      {
        name: `STU6 UNPAID RISK ${suffix}`,
        phone: mkPhone(6),
        zalo: mkPhone(6),
        course: 'Tin Học VP',
        price: 2000000,
        paid: false,
        branchId: branchA._id,
        status: 'Đang học',
        remainingSessions: 5,
        lastAccessAt: eightDaysAgo,
        examProgress: [{ status: 'dang_thi', tracNghiem: { score: 8, total: 10 }, thucHanh: 'chua_nop' }],
      },
      {
        name: `STU7 MOBILE ACTIVE TODAY ${suffix}`,
        phone: mkPhone(7),
        zalo: mkPhone(7),
        course: 'PowerPoint',
        price: 1500000,
        paid: false,
        branchId: branchA._id,
        status: 'Đang học',
        remainingSessions: 8,
        lastAccessAt: null, // disconnect hasn't fired yet!
      },
      {
        name: `STU8 BRANCH B ${suffix}`,
        phone: mkPhone(8),
        zalo: mkPhone(8),
        course: 'Excel Pro',
        price: 2000000,
        paid: true,
        paidAmount: 2000000,
        branchId: branchB._id,
        status: 'Đang học',
        remainingSessions: 5,
      },
    ]);
    createdIds.students.push(...studentDocs.map((s) => s._id));

    // Teachers & Staff (note Teacher pending registered with lowercase 'pending'!)
    const teacherDocs = await Teacher.create([
      { name: `GV Active A ${suffix}`, phone: mkPhone(20), role: 'teacher', status: 'active', branchId: branchA._id, password: 'Pass1234()' },
      { name: `GV Pending Lower A ${suffix}`, phone: mkPhone(21), role: 'teacher', status: 'pending', branchId: branchA._id, password: 'Pass1234()' },
      { name: `Staff Online A ${suffix}`, phone: mkPhone(22), role: 'staff', adminRole: 'STAFF', status: 'active', branchId: branchA._id, password: 'Pass1234()' },
      { name: `GV Pending B ${suffix}`, phone: mkPhone(23), role: 'teacher', status: 'Pending', branchId: branchB._id, password: 'Pass1234()' },
    ]);
    createdIds.teachers.push(...teacherDocs.map((t) => t._id));
    const [teacherA, , staffA] = teacherDocs;

    // Ledger entries:
    // - Stu1 paid 5,000,000 YESTERDAY (must NOT count in todayRevenue even though stu1 was updated today!)
    // - Stu2 paid 3,000,000 TODAY
    // - Stu3 paid 4,000,000 TODAY + refunded 1,000,000 TODAY -> net today = 6,000,000
    // - Stu8 (Branch B) paid 2,000,000 TODAY
    const lKeys = [`ov-p1-${suffix}`, `ov-p2-${suffix}`, `ov-p3-${suffix}`, `ov-r3-${suffix}`, `ov-p8-${suffix}`];
    createdIds.ledgerKeys.push(...lKeys);
    await LedgerEntry.create([
      { idempotencyKey: lKeys[0], type: 'payment', amount: 5000000, status: 'posted', studentId: studentDocs[0]._id, branchId: branchA._id, postedAt: yesterday },
      { idempotencyKey: lKeys[1], type: 'payment', amount: 3000000, status: 'posted', studentId: studentDocs[1]._id, branchId: branchA._id, postedAt: now },
      { idempotencyKey: lKeys[2], type: 'payment', amount: 4000000, status: 'posted', studentId: studentDocs[2]._id, branchId: branchA._id, postedAt: now },
      { idempotencyKey: lKeys[3], type: 'refund', amount: 1000000, status: 'posted', studentId: studentDocs[2]._id, branchId: branchA._id, postedAt: now },
      { idempotencyKey: lKeys[4], type: 'payment', amount: 2000000, status: 'posted', studentId: studentDocs[7]._id, branchId: branchB._id, postedAt: now },
    ]);

    // Active sessions in last 15 mins (Admin, Staff, Teacher, Student5 Web, Student7 Mobile)
    // Plus logged-out session from earlier today for Student2 (still counts in activeToday!)
    const sIds = [`ws-adm-${suffix}`, `ws-stf-${suffix}`, `ws-tea-${suffix}`, `ws-s5-${suffix}`, `ws-s2-old-${suffix}`];
    createdIds.sessions.push(...sIds);
    await UserDeviceSession.create([
      { sessionId: sIds[0], userId: 'admin', role: 'admin', lastActiveAt: now, expiresAt: new Date(now.getTime() + 86400_000), revokedAt: null },
      { sessionId: sIds[1], userId: String(staffA._id), role: 'staff', lastActiveAt: now, expiresAt: new Date(now.getTime() + 86400_000), revokedAt: null },
      { sessionId: sIds[2], userId: String(teacherA._id), role: 'teacher', lastActiveAt: now, expiresAt: new Date(now.getTime() + 86400_000), revokedAt: null },
      { sessionId: sIds[3], userId: String(studentDocs[4]._id), role: 'student', lastActiveAt: now, expiresAt: new Date(now.getTime() + 86400_000), revokedAt: null },
      { sessionId: sIds[4], userId: String(studentDocs[1]._id), role: 'student', createdAt: now, lastActiveAt: now, expiresAt: new Date(now.getTime() + 86400_000), revokedAt: now },
    ]);

    await AuthSession.create({
      sessionId: `mob-s7-${suffix}`,
      userId: studentDocs[6]._id,
      role: 'student',
      clientType: 'mobile',
      platform: 'android',
      createdAt: now,
      lastUsedAt: now,
      absoluteExpiresAt: new Date(now.getTime() + 86400_000),
      revokedAt: null,
      refreshFamilyId: `fam-${suffix}`,
      currentRefreshJtiHash: crypto.createHash('sha256').update(`jti-${suffix}`).digest('hex'),
    });

    // Live socket presence for Student1
    await presenceStore.upsertPresence(`student_${studentDocs[0]._id}`, {
      userId: String(studentDocs[0]._id),
      role: 'student',
      name: studentDocs[0].name,
      branchId: String(branchA._id),
      socketId: `sock-${suffix}`,
    });

    const app = express();
    app.use(express.json());
    app.use('/api/students', studentRoutes);
    server = await listen(app);
    const { port } = server.address();

    const adminToken = jwt.sign(
      {
        id: 'admin',
        name: 'Super Admin',
        role: 'admin',
        adminRole: 'SUPER_ADMIN',
        tokenVersion: Number(settingsDoc?.adminTokenVersion || 0),
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    const resA = await fetch(`http://127.0.0.1:${port}/api/students/stats?branch_id=${branchA._id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const bodyA = await resA.json();
    assert.equal(resA.status, 200, JSON.stringify(bodyA));
    const statsA = bodyA.data;

    // 7 students in Branch A (>5!), only 3 truly paid (freePortal 0đ excluded!)
    assert.equal(statsA.total, 7);
    assert.equal(statsA.paid, 3);
    // Today revenue in Branch A = 3M + 4M - 1M = 6M (yesterday's 5M NOT double-counted!)
    assert.equal(statsA.todayRevenue, 6000000);
    assert.equal(statsA.totalRevenue, 11000000);
    // Teachers in Branch A: 1 active, 1 pending ('pending' lowercase caught!), 2 total (active + pending; staff excluded)
    assert.equal(statsA.activeTeachers, 1);
    assert.equal(statsA.pendingTeachers, 1);
    assert.equal(statsA.totalTeachers, 2);
    // Branch A online users (Staff + Teacher + Stu1 socket + Stu5 web + Stu7 mobile = 5; Super Admin branchId=null excluded when scoped to branchA)
    assert.equal(statsA.realtime.onlineTotal, 5);
    // Branch A active today students: Stu1 (lastAccessAt+socket), Stu2 (logged-out today session), Stu5 (web active), Stu7 (mobile active) => 4
    assert.equal(statsA.realtime.activeToday, 4);
    // Funnel over all 7 students
    assert.deepEqual(
      statsA.funnel.map((f) => f.count),
      [7, 5, 3], // 7 registered, 5 engaged (Stu1, Stu2, Stu5, Stu6, Stu7), 3 paid (Stu1, Stu2, Stu3)
    );
    // Exams & At-risk & Renewal automation over all 7 students
    assert.equal(statsA.certificationStats.dat, 1);
    assert.equal(statsA.certificationStats.choNop, 1);
    assert.equal(statsA.atRisk.total, 1);
    assert.equal(statsA.automations.total, 2); // 1 renewal (Stu1 rem=1) + 1 nudge (Stu6 inactive 8d)

    // Now verify ALL-branch view includes Super Admin in onlineTotal & Branch B in revenue
    const resAll = await fetch(`http://127.0.0.1:${port}/api/students/stats?branch_id=all`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const bodyAll = await resAll.json();
    assert.equal(resAll.status, 200);
    assert.ok(bodyAll.data.realtime.onlineTotal >= 6, 'All-branch onlineTotal must include global Admin + Staff + Teachers + Students');
    assert.ok(bodyAll.data.todayRevenue >= 8000000);
  } finally {
    await presenceStore.removePresence(`student_${createdIds.students[0]}`).catch(() => {});
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connected) {
      await Promise.all([
        LedgerEntry.deleteMany({ idempotencyKey: { $in: createdIds.ledgerKeys } }),
        UserDeviceSession.deleteMany({ sessionId: { $in: createdIds.sessions } }),
        AuthSession.deleteMany({ sessionId: `mob-s7-${suffix}` }),
        LmsLearnerProgress.deleteMany({ studentId: { $in: createdIds.students } }),
        LmsXpGrant.deleteMany({ studentId: { $in: createdIds.students } }),
        Student.deleteMany({ _id: { $in: createdIds.students } }),
        Teacher.deleteMany({ _id: { $in: createdIds.teachers } }),
        branchA ? Branch.deleteOne({ _id: branchA._id }) : Promise.resolve(),
        branchB ? Branch.deleteOne({ _id: branchB._id }) : Promise.resolve(),
        createdSettingsMain ? SystemSettings.deleteOne({ _key: 'main' }) : Promise.resolve(),
      ]);
      await mongoose.disconnect();
    }
  }
});
