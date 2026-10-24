const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cookieParser = require('cookie-parser');
const express = require('express');
const fs = require('node:fs');
const http = require('node:http');
const mongoose = require('mongoose');
const ts = require('typescript');
const { assertTestDatabaseEnvironment } = require('../../../DASHBOARDTHANGTINHOC-mobile-profile-api/tests/setup/testDatabaseGuard');

require.extensions['.ts'] = (loadedModule, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  }).outputText;
  loadedModule._compile(compiled, filename);
};

process.env.NODE_ENV = 'test';
process.env.MOBILE_MULTI_SESSION_AUTH = 'true';
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString('hex');

const target = assertTestDatabaseEnvironment(process.env);
const mongoUrl = new URL(target.uri);
const redisUrl = new URL(String(process.env.REDIS_URL || ''));
assert.equal(target.hostname, '127.0.0.1', 'Profile integration must use the isolated local MongoDB host');
assert.equal(mongoUrl.port, '27019', 'Profile integration must use the dedicated MongoDB test port');
assert.equal(target.dbName, 'dashboardthangtinhoc_mobile_auth_test');
assert.equal(redisUrl.protocol, 'redis:');
assert.equal(redisUrl.hostname, '127.0.0.1');
assert.equal(redisUrl.port, '6382', 'Profile integration must use the dedicated Redis test port');
assert.equal(process.env.MOBILE_MULTI_SESSION_AUTH, 'true', 'Mobile multi-session auth is enabled only in this test process');
assert.equal(process.env.MONGODB_URI || '', '', 'Profile integration must not set the runtime MongoDB URI');

const Student = require('../../../DASHBOARDTHANGTINHOC-mobile-profile-api/models/Student');
const Teacher = require('../../../DASHBOARDTHANGTINHOC-mobile-profile-api/models/Teacher');
const AuthSession = require('../../../DASHBOARDTHANGTINHOC-mobile-profile-api/models/AuthSession');
require('../../../DASHBOARDTHANGTINHOC-mobile-profile-api/models/Branch');
const authRoutes = require('../../../DASHBOARDTHANGTINHOC-mobile-profile-api/routes/authRoutes');
const studentRoutes = require('../../../DASHBOARDTHANGTINHOC-mobile-profile-api/routes/studentRoutes');
const teacherRoutes = require('../../../DASHBOARDTHANGTINHOC-mobile-profile-api/routes/teacherRoutes');
const { csrfProtection } = require('../../../DASHBOARDTHANGTINHOC-mobile-profile-api/middleware/csrf');
const { closeRedis, getRedis } = require('../../../DASHBOARDTHANGTINHOC-mobile-profile-api/config/redis');
const { MobileAuthApi } = require('../src/services/mobileAuthApi.ts');
const { createMobileAuthService } = require('../src/services/mobileAuthService.ts');
const { createApiClient } = require('../src/services/apiClient.ts');
const { profileService } = require('../src/services/profileService.ts');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}

function makeStorage() {
  let current = null;
  return {
    async loadAuth() { return current; },
    async saveAuth(next) { current = next; },
    async clearAuth() { current = null; },
  };
}

function waitForRedisReady(client) {
  if (client.status === 'ready') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Dedicated Redis test service did not become ready'));
    }, 5000);
    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = (error) => {
      cleanup();
      reject(error);
    };
    function cleanup() {
      clearTimeout(timeout);
      client.removeListener('ready', onReady);
      client.removeListener('error', onError);
    }
    client.once('ready', onReady);
    client.once('error', onError);
  });
}

function cookieAwareFetch() {
  let csrfCookie = '';
  return async (url, init = {}) => {
    const headers = new Headers(init.headers);
    if (csrfCookie) headers.set('cookie', csrfCookie);
    const response = await fetch(url, { ...init, headers });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) csrfCookie = setCookie.split(';')[0];
    return response;
  };
}

function phone(prefix) {
  return `${prefix}${String(crypto.randomInt(0, 10_000_000)).padStart(7, '0')}`;
}

async function runIntegration() {
  let server;
  let mongoConnected = false;
  const studentIds = [];
  const teacherIds = [];
  const authServices = [];
  let redis;
  try {
    await mongoose.connect(target.uri, { serverSelectionTimeoutMS: 5000 });
    mongoConnected = true;
    await Promise.all([Student.init(), Teacher.init()]);
    redis = getRedis();
    assert.ok(redis, 'REDIS_URL must initialize the dedicated Redis client');
    await waitForRedisReady(redis);
    await redis.ping();

    const fixtureId = crypto.randomBytes(6).toString('hex');
    const student = await Student.create({
      name: 'Mobile Profile Integration Student',
      phone: phone('096'),
      password: 'mobile-profile-test-password',
      email: `profile-student-before-${fixtureId}@example.test`,
      zalo: `student-${fixtureId}`,
      address: 'Student address',
      course: 'Profile test course',
      price: 0,
      status: 'active',
      tokenVersion: 0,
    });
    studentIds.push(student._id);
    const teacher = await Teacher.create({
      name: 'Mobile Profile Integration Teacher',
      phone: phone('097'),
      password: 'mobile-profile-test-password',
      email: `profile-teacher-before-${fixtureId}@example.test`,
      zalo: `teacher-${fixtureId}`,
      address: 'Teacher address',
      bio: 'Before update',
      voiceRegion: 'bac',
      age: 30,
      status: 'active',
      role: 'teacher',
      tokenVersion: 0,
    });
    teacherIds.push(teacher._id);

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api', csrfProtection);
    app.use('/api/auth', authRoutes);
    app.use('/api/students', studentRoutes);
    app.use('/api/teachers', teacherRoutes);
    app.set('io', null);
    server = http.createServer(app);
    const port = await listen(server);
    const api = new MobileAuthApi(`http://127.0.0.1:${port}`, cookieAwareFetch());

    const studentAuth = createMobileAuthService({ api, storage: makeStorage(), platform: 'android' });
    authServices.push(studentAuth);
    await studentAuth.signIn('student', student.phone, 'mobile-profile-test-password');
    const studentClient = createApiClient((path, options) => studentAuth.request(path, options));
    const studentProfile = await profileService.getProfile(studentClient, 'student', String(student._id));
    assert.equal(studentProfile.name, student.name);
    assert.equal(studentProfile.email, student.email);
    assert.equal(studentProfile.course, 'Profile test course');

    const studentUpdate = await profileService.updateProfile(studentClient, 'student', String(student._id), {
      email: `profile-student-after-${fixtureId}@example.test`,
      zalo: `student-updated-${fixtureId}`,
      address: 'Updated student address',
    });
    assert.equal(studentUpdate.email, `profile-student-after-${fixtureId}@example.test`);
    assert.equal(studentUpdate.address, 'Updated student address');
    const studentDb = await Student.findById(student._id).lean();
    assert.equal(studentDb.phone, student.phone);
    assert.equal(studentDb.password === 'mobile-profile-test-password', false);
    assert.equal(studentDb.status, 'active');

    const studentToTeacher = await studentClient.get(`/api/teachers/${teacher._id}`).then(
      () => ({ status: 200 }),
      (error) => ({ status: error.status, code: error.code }),
    );
    assert.equal(studentToTeacher.status, 403);

    const teacherAuth = createMobileAuthService({ api, storage: makeStorage(), platform: 'android' });
    authServices.push(teacherAuth);
    await teacherAuth.signIn('teacher', teacher.phone, 'mobile-profile-test-password');
    const teacherClient = createApiClient((path, options) => teacherAuth.request(path, options));
    const teacherProfile = await profileService.getProfile(teacherClient, 'teacher', String(teacher._id));
    assert.equal(teacherProfile.name, teacher.name);
    assert.equal(teacherProfile.email, teacher.email);
    assert.equal(teacherProfile.bio, 'Before update');

    const teacherUpdate = await profileService.updateProfile(teacherClient, 'teacher', String(teacher._id), {
      email: `profile-teacher-after-${fixtureId}@example.test`,
      zalo: `teacher-updated-${fixtureId}`,
      bio: 'Updated teacher bio',
      voiceRegion: 'nam',
      address: 'Updated teacher address',
      age: 31,
    });
    assert.equal(teacherUpdate.email, `profile-teacher-after-${fixtureId}@example.test`);
    assert.equal(teacherUpdate.bio, 'Updated teacher bio');
    const teacherDb = await Teacher.findById(teacher._id).lean();
    assert.equal(teacherDb.phone, teacher.phone);
    assert.equal(teacherDb.status, 'active');
    assert.equal(teacherDb.age, 31);
    assert.notEqual(studentAuth.getSessionId(), teacherAuth.getSessionId());

    const teacherToStudent = await teacherClient.get(`/api/students/${student._id}`).then(
      () => ({ status: 200 }),
      (error) => ({ status: error.status, code: error.code }),
    );
    assert.equal(teacherToStudent.status, 403);
    await assert.rejects(
      profileService.updateProfile(teacherClient, 'teacher', String(teacher._id), {
        email: `profile-teacher-after-${fixtureId}@example.test`,
        zalo: `teacher-updated-${fixtureId}`,
        bio: 'Invalid age',
        voiceRegion: 'nam',
        address: 'Updated teacher address',
        age: 17,
      }),
      (error) => error.status === 400,
    );

    const unauthorizedResponse = await fetch(`http://127.0.0.1:${port}/api/students/${student._id}`);
    assert.equal(unauthorizedResponse.status, 401);
    assert.ok(studentAuth.getSessionId());
    assert.ok(teacherAuth.getSessionId());
  } finally {
    const cleanupErrors = [];
    const sessionIds = authServices.map((auth) => auth.getSessionId()).filter(Boolean);
    for (const auth of authServices.reverse()) {
      try {
        await auth.signOut();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    if (sessionIds.length) await AuthSession.deleteMany({ sessionId: { $in: sessionIds } });
    if (studentIds.length) await Student.deleteMany({ _id: { $in: studentIds } });
    if (teacherIds.length) await Teacher.deleteMany({ _id: { $in: teacherIds } });
    if (mongoConnected) await mongoose.disconnect();
    await closeRedis();
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Profile integration auth cleanup failed.');
  }
}

const timeout = setTimeout(() => {
  console.error('Mobile Profile API integration timed out.');
  process.exit(1);
}, 60000);
timeout.unref();
runIntegration().then(() => {
  clearTimeout(timeout);
  console.log('Mobile Profile API integration passed.');
  process.exit(0);
}, (error) => {
  clearTimeout(timeout);
  console.error(error);
  process.exit(1);
});
