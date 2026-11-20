'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
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

if (!process.env.JWT_SECRET) process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_REFRESH_SECRET) process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
process.env.RATE_LIMIT_LOGIN_MAX = '100';
process.env.RATE_LIMIT_LOGIN_BURST_MAX = '100';
process.env.RATE_LIMIT_LOGIN_ACCOUNT_MAX = '100';

const { assertTestDatabaseEnvironment } = require('../setup/testDatabaseGuard');
const Student = require('../../models/Student');
const Teacher = require('../../models/Teacher');
const LmsLearnerProgress = require('../../models/LmsLearnerProgress');
const LmsXpGrant = require('../../models/LmsXpGrant');
const { csrfProtection } = require('../../middleware/csrf');
const authRoutes = require('../../routes/authRoutes');

function listen(app) {
  return new Promise((resolve, reject) => {
    const srv = http.createServer(app);
    srv.once('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      srv.removeListener('error', reject);
      resolve(srv);
    });
  });
}

async function getCsrf(baseUrl) {
  const res = await fetch(`${baseUrl}/api/auth/csrf-token`);
  const data = await res.json();
  const cookie = res.headers.getSetCookie?.()[0]?.split(';')[0] || '';
  return { csrfToken: data.csrfToken, cookie };
}

test('Real MongoDB login lockout exposes remaining attempts (4..1) and 900s temporary lock for Student and Teacher', {
  timeout: 30000,
  skip: hasTestDb ? false : 'TEST_DATABASE_URI (test_* or *_test DB) not set',
}, async () => {
  let server = null;
  let connected = false;
  let student = null;
  let teacher = null;

  try {
    const { uri } = assertTestDatabaseEnvironment(process.env);
    await mongoose.connect(uri);
    connected = true;

    const suffix = crypto.randomBytes(4).toString('hex');
    const phoneBase = parseInt(suffix, 16) % 10_000_000;
    const studentPhone = `09${String((phoneBase + 11) % 100_000_000).padStart(8, '0')}`;
    const teacherPhone = `09${String((phoneBase + 22) % 100_000_000).padStart(8, '0')}`;

    student = await Student.create({
      name: `Lock Student ${suffix}`,
      phone: studentPhone,
      zalo: studentPhone,
      course: 'Tài khoản miễn phí',
      price: 0,
      paid: true,
      freePortal: true,
      password: 'CorrectPass!123',
      status: 'Đang học',
    });

    teacher = await Teacher.create({
      name: `Lock Teacher ${suffix}`,
      phone: teacherPhone,
      password: 'TeacherPass!123',
      role: 'teacher',
      status: 'active',
    });

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api', csrfProtection);
    app.use('/api/auth', authRoutes);
    server = await listen(app);
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const postLogin = async (payload) => {
      const { csrfToken, cookie } = await getCsrf(baseUrl);
      const res = await fetch(`${baseUrl}/api/auth/login/public`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrfToken,
          ...(cookie ? { cookie } : {}),
        },
        body: JSON.stringify(payload),
      });
      return { status: res.status, headers: res.headers, body: await res.json() };
    };

    // Student: 1..4 wrong -> 401 with remaining 4..1 and lockDurationSeconds 900
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await postLogin({ identifier: studentPhone, password: `wrong-${attempt}`, role: 'student' });
      assert.equal(res.status, 401);
      assert.equal(res.body.code, 'INVALID_CREDENTIALS');
      assert.equal(res.body.remainingAttempts, 5 - attempt);
      assert.equal(res.body.maxAttempts, 5);
      assert.equal(res.body.lockDurationSeconds, 900);
      assert.equal(res.body.message, 'Mật khẩu không đúng.');
    }

    // Student 5th wrong -> 403 LOGIN_TEMPORARILY_LOCKED with ~900s wait
    const lockedStudent5 = await postLogin({ identifier: studentPhone, password: 'wrong-5', role: 'student' });
    assert.equal(lockedStudent5.status, 403);
    assert.equal(lockedStudent5.body.code, 'LOGIN_TEMPORARILY_LOCKED');
    assert.equal(lockedStudent5.body.remainingAttempts, 0);
    assert.equal(lockedStudent5.body.lockDurationSeconds, 900);
    assert.ok(lockedStudent5.body.retryAfterSeconds >= 895 && lockedStudent5.body.retryAfterSeconds <= 900);
    assert.ok(Number(lockedStudent5.headers.get('retry-after')) >= 895);

    // Student 6th attempt even with RIGHT password -> still blocked with remaining seconds
    const blockedRightPw = await postLogin({ identifier: studentPhone, password: 'CorrectPass!123', role: 'student' });
    assert.equal(blockedRightPw.status, 403);
    assert.equal(blockedRightPw.body.code, 'LOGIN_TEMPORARILY_LOCKED');
    assert.ok(blockedRightPw.body.retryAfterSeconds >= 890 && blockedRightPw.body.retryAfterSeconds <= 900);

    // Teacher: 1..4 wrong -> 401 remaining 4..1, 5th wrong -> 403 LOGIN_TEMPORARILY_LOCKED
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      const res = await postLogin({ identifier: teacherPhone, password: `wrong-t-${attempt}`, role: 'teacher' });
      assert.equal(res.status, 401);
      assert.equal(res.body.remainingAttempts, 5 - attempt);
      assert.equal(res.body.lockDurationSeconds, 900);
    }
    const lockedTeacher5 = await postLogin({ identifier: teacherPhone, password: 'wrong-t-5', role: 'teacher' });
    assert.equal(lockedTeacher5.status, 403);
    assert.equal(lockedTeacher5.body.code, 'LOGIN_TEMPORARILY_LOCKED');
    assert.ok(lockedTeacher5.body.retryAfterSeconds >= 895 && lockedTeacher5.body.retryAfterSeconds <= 900);

    // Simulate expired lock -> next valid login succeeds and resets counters
    await Student.updateOne({ _id: student._id }, { $set: { loginLockUntil: new Date(Date.now() - 1000) } });
    const recovered = await postLogin({ identifier: studentPhone, password: 'CorrectPass!123', role: 'student' });
    assert.equal(recovered.status, 200);
    const refreshedStudent = await Student.findById(student._id).select('loginAttempts loginLockUntil').lean();
    assert.equal(refreshedStudent.loginAttempts, 0);
    assert.equal(refreshedStudent.loginLockUntil, null);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (connected) {
      await Promise.all([
        student ? LmsLearnerProgress.deleteMany({ studentId: student._id }) : Promise.resolve(),
        student ? LmsXpGrant.deleteMany({ studentId: student._id }) : Promise.resolve(),
        student ? Student.deleteOne({ _id: student._id }) : Promise.resolve(),
        teacher ? Teacher.deleteOne({ _id: teacher._id }) : Promise.resolve(),
      ]);
      await mongoose.disconnect();
    }
  }
});
