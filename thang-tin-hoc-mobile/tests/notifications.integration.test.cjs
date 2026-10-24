const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const Module = require('node:module');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');

global.__DEV__ = false;
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

const testDatabaseUri = 'mongodb://127.0.0.1:27019/dashboardthangtinhoc_mobile_notifications_test';
const redisUrl = 'redis://127.0.0.1:6382/15';
const backendRoot = path.resolve(String(process.env.MOBILE_TEST_BACKEND_ROOT || ''));
const apiBaseUrl = 'http://127.0.0.1:8082';
const interactiveQa = process.env.MOBILE_NOTIFICATIONS_INTERACTIVE_QA === 'true';

process.env.NODE_ENV = 'test';
process.env.MOBILE_MULTI_SESSION_AUTH = 'true';
process.env.TEST_DATABASE_URI = testDatabaseUri;
process.env.REDIS_URL = redisUrl;
process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(48).toString('hex');
process.env.JWT_EXPIRES_IN = '1s';
process.env.JWT_REFRESH_EXPIRES_IN = '30d';
process.env.EXPO_PUBLIC_API_BASE_URL = apiBaseUrl;
process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL = apiBaseUrl;
process.env.EXPO_PUBLIC_MOBILE_NOTIFICATIONS_API = 'true';
process.env.EXPO_PUBLIC_MOBILE_AUTH_POC = 'true';
process.env.EXPO_PUBLIC_MOBILE_AUTH_PLATFORM = 'android';

function makePhone(prefix) {
  return `${prefix}${String(crypto.randomInt(0, 10_000_000)).padStart(7, '0')}`;
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}

function waitForRedisReady(client) {
  if (client.status === 'ready') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Isolated Redis client did not become ready.'));
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
      clearTimeout(timer);
      client.removeListener('ready', onReady);
      client.removeListener('error', onError);
    }
    client.once('ready', onReady);
    client.once('error', onError);
  });
}

function createTestClient(MobileAuthApi, createMobileAuthService) {
  const cookies = new Map();
  const calls = [];
  let latestAccessToken = '';
  const fetcher = async (input, init = {}) => {
    const url = String(input);
    const headers = new Headers(init.headers || {});
    const authorization = headers.get('authorization');
    if (authorization) latestAccessToken = authorization.replace(/^Bearer\s+/i, '');
    calls.push({ path: new URL(url).pathname, method: init.method || 'GET' });

    if (cookies.size) {
      headers.set('cookie', [...cookies].map(([name, value]) => `${name}=${value}`).join('; '));
    }
    const response = await fetch(url, { ...init, headers });
    const setCookies = response.headers.getSetCookie?.() || [];
    for (const setCookie of setCookies) {
      const pair = setCookie.split(';', 1)[0];
      const separator = pair.indexOf('=');
      if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  };
  const api = new MobileAuthApi(apiBaseUrl, fetcher);
  let persistedSession = null;
  let invalidations = 0;
  const auth = createMobileAuthService({
    api,
    platform: 'android',
    storage: {
      async loadAuth() { return persistedSession; },
      async saveAuth(session) { persistedSession = session; },
      async clearAuth() { persistedSession = null; },
    },
    onSessionInvalidated() { invalidations += 1; },
  });
  return {
    auth,
    api,
    calls,
    get latestAccessToken() { return latestAccessToken; },
    get invalidations() { return invalidations; },
    request: (endpoint, options) => auth.request(endpoint, options),
  };
}

function notificationRows(Notification, receivers, readUserId, role, count) {
  const studentTypes = ['SYSTEM', 'COURSE', 'FINANCE', 'EVALUATION', 'MESSAGE', 'EXAM', 'SCHEDULE'];
  const teacherTypes = ['MESSAGE', 'SCHEDULE', 'COURSE'];
  const types = role === 'student' ? studentTypes : teacherTypes;
  const now = Date.now();
  const rows = Array.from({ length: count }, (_, index) => {
    const type = role === 'student' && index === 8 ? 'SYSTEM' : types[index % types.length];
    let notificationPath = '';
    if (index === 0) notificationPath = role === 'student' ? '/student/schedule' : '/teacher/schedule';
    if (index === 4) notificationPath = role === 'student' ? '/student/inbox' : '/teacher/inbox';
    if (role === 'student' && index === 5) notificationPath = '/student/exam';
    if (role === 'student' && index === 8) notificationPath = '/unmapped/mobile-target';
    if (role === 'student' && index === 24) notificationPath = '/student/schedule';
    return {
      type,
      title: `${role} integration notification ${String(index + 1).padStart(2, '0')}`,
      content: `Disposable ${role} integration fixture ${index + 1}`,
      sender_id: 'mobile-notifications-integration',
      receivers: [].concat(receivers[index] || receivers[0]),
      read_by: index === 0 ? [readUserId] : [],
      dismissed_by: [],
      payload: { integrationFixture: true },
      path: notificationPath,
      createdAt: new Date(now - index * 60_000),
      updatedAt: new Date(now - index * 60_000),
    };
  });
  return Notification.insertMany(rows);
}

async function integrationClientModules() {
  const { MobileAuthApi } = require('../src/services/mobileAuthApi.ts');
  const { createMobileAuthService } = require('../src/services/mobileAuthService.ts');
  const { notificationService, isNotificationsApiEnabled } = require('../src/features/notifications/notificationService.ts');
  const { resolveNotificationDestination } = require('../src/features/notifications/notificationRouting.ts');
  assert.equal(isNotificationsApiEnabled, true);
  return { MobileAuthApi, createMobileAuthService, notificationService, resolveNotificationDestination };
}

test('real Notifications REST client integrates with isolated backend routes and auth', {
  timeout: 600_000,
}, async (t) => {
  assert.ok(process.env.MOBILE_TEST_BACKEND_ROOT, 'Set MOBILE_TEST_BACKEND_ROOT to an isolated backend source worktree.');
  assert.ok(fs.existsSync(path.join(backendRoot, 'package.json')), 'The isolated backend worktree must contain package.json.');
  assert.equal(process.env.MONGODB_URI, undefined, 'Runtime MONGODB_URI must not be set during isolated integration.');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.MOBILE_MULTI_SESSION_AUTH, 'true');
  assert.equal(new URL(testDatabaseUri).hostname, '127.0.0.1');
  assert.equal(new URL(testDatabaseUri).port, '27019');
  assert.match(new URL(testDatabaseUri).pathname, /_test$/);
  assert.equal(new URL(redisUrl).hostname, '127.0.0.1');
  assert.equal(new URL(redisUrl).port, '6382');
  assert.equal(new URL(redisUrl).pathname, '/15');

  process.env.NODE_PATH = process.env.NODE_PATH || path.resolve(backendRoot, '..', 'DASHBOARDTHANGTINHOC-fresh', 'node_modules');
  Module._initPaths();
  const backendRequire = Module.createRequire(path.join(backendRoot, 'package.json'));
  const express = backendRequire('express');
  const cookieParser = backendRequire('cookie-parser');
  const cors = backendRequire('cors');
  const mongoose = backendRequire('mongoose');
  const Student = backendRequire('./models/Student');
  const Teacher = backendRequire('./models/Teacher');
  const AuthSession = backendRequire('./models/AuthSession');
  const Notification = backendRequire('./models/Notification');
  const authRoutes = backendRequire('./routes/authRoutes');
  const notificationRoutes = backendRequire('./routes/notificationRoutes');
  const { csrfProtection } = backendRequire('./middleware/csrf');
  const { assertTestDatabaseEnvironment } = backendRequire('./tests/setup/testDatabaseGuard');
  const { getRedis, closeRedis } = backendRequire('./config/redis');
  const testTarget = assertTestDatabaseEnvironment(process.env);
  assert.equal(testTarget.uri, testDatabaseUri);
  assert.equal(testTarget.dbName, 'dashboardthangtinhoc_mobile_notifications_test');

  let mongoConnected = false;
  let server;
  let apiClientModules;
  const studentIds = [];
  const teacherIds = [];
  let fixtureNotificationIds = [];
  let interactiveFinished = false;
  let finishInteractive;
  const interactiveDone = new Promise((resolve) => {
    finishInteractive = () => {
      interactiveFinished = true;
      resolve();
    };
  });
  const interactivePassword = crypto.randomBytes(24).toString('base64url');
  const student = {
    name: 'Disposable Notifications Integration Student',
    phone: makePhone('090'),
    password: interactivePassword,
    zalo: 'notifications-integration-student',
    course: 'Disposable Integration Course',
    price: 0,
    status: 'active',
    tokenVersion: 0,
  };
  const secondStudent = {
    name: 'Disposable Notifications Isolation Student',
    phone: makePhone('091'),
    password: interactivePassword,
    zalo: 'notifications-integration-isolation-student',
    course: 'Disposable Isolation Course',
    price: 0,
    status: 'active',
    tokenVersion: 0,
  };
  const teacher = {
    name: 'Disposable Notifications Integration Teacher',
    phone: makePhone('092'),
    password: interactivePassword,
    status: 'active',
    role: 'teacher',
  };

  try {
    await mongoose.connect(testDatabaseUri, { serverSelectionTimeoutMS: 5000 });
    mongoConnected = true;
    await Promise.all([Student.init(), Teacher.init(), AuthSession.init(), Notification.init()]);
    const redis = getRedis();
    assert.ok(redis, 'The test Redis URL must activate the configured Redis client.');
    await waitForRedisReady(redis);
    assert.equal(await redis.ping(), 'PONG');

    const studentDoc = await Student.create(student);
    const secondStudentDoc = await Student.create(secondStudent);
    const teacherDoc = await Teacher.create(teacher);
    studentIds.push(studentDoc._id, secondStudentDoc._id);
    teacherIds.push(teacherDoc._id);
    const studentReceivers = Array.from({ length: 25 }, (_, index) => (
      index === 24 ? [String(studentDoc._id), String(secondStudentDoc._id)] : String(studentDoc._id)
    ));
    const teacherReceivers = Array.from({ length: 25 }, () => String(teacherDoc._id));
    const studentFixtures = await notificationRows(
      Notification,
      studentReceivers,
      String(studentDoc._id),
      'student',
      25,
    );
    const teacherFixtures = await notificationRows(
      Notification,
      teacherReceivers,
      String(teacherDoc._id),
      'teacher',
      25,
    );
    fixtureNotificationIds = [...studentFixtures, ...teacherFixtures].map((item) => item._id);
    assert.equal(fixtureNotificationIds.length, 50);

    const app = express();
    const allowedOrigins = ['http://localhost:8081', 'http://127.0.0.1:8081'];
    app.use(cors({ origin: allowedOrigins, credentials: true }));
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api', csrfProtection);
    app.use('/api/auth', authRoutes);
    app.use('/api/notifications', notificationRoutes);
    app.get('/__test/credentials', (req, res) => {
      if (!interactiveQa || !allowedOrigins.includes(req.get('origin'))) return res.sendStatus(404);
      res.json({
        student: { phone: student.phone, password: interactivePassword },
        teacher: { phone: teacher.phone, password: interactivePassword },
      });
    });
    app.post('/__test/complete', (req, res) => {
      if (!interactiveQa || !allowedOrigins.includes(req.get('origin'))) return res.sendStatus(404);
      res.json({ success: true });
      finishInteractive();
    });

    server = http.createServer(app);
    await listen(server, 8082);
    apiClientModules = await integrationClientModules();

    const studentClient = createTestClient(apiClientModules.MobileAuthApi, apiClientModules.createMobileAuthService);
    const secondStudentClient = createTestClient(apiClientModules.MobileAuthApi, apiClientModules.createMobileAuthService);
    const teacherClient = createTestClient(apiClientModules.MobileAuthApi, apiClientModules.createMobileAuthService);
    const studentUser = await studentClient.auth.signIn('student', student.phone, interactivePassword);
    assert.equal(studentUser.role, 'student');
    const secondStudentUser = await secondStudentClient.auth.signIn('student', secondStudent.phone, interactivePassword);
    assert.equal(secondStudentUser.role, 'student');
    process.env.JWT_EXPIRES_IN = '8h';
    const teacherUser = await teacherClient.auth.signIn('teacher', teacher.phone, interactivePassword);
    assert.equal(teacherUser.role, 'teacher');

    await t.test('Student and Teacher logins authenticate to their own real notification lists', async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const studentFirstPage = await apiClientModules.notificationService.list('student', {}, studentClient.request);
      assert.equal(studentFirstPage.items.length, 20);
      assert.equal(studentFirstPage.pagination.page, 1);
      assert.equal(studentFirstPage.pagination.limit, 20);
      assert.equal(studentFirstPage.pagination.total, 25);
      assert.equal(studentFirstPage.pagination.pages, 2);
      assert.equal(studentFirstPage.items[0].id, String(studentFixtures[0]._id));
      assert.equal(studentFirstPage.unread, 24);
      assert.equal(studentClient.calls.filter((call) => call.path === '/api/auth/refresh').length, 1);

      const studentSecondPage = await apiClientModules.notificationService.list(
        'student',
        { page: 2, limit: 20 },
        studentClient.request,
      );
      assert.equal(studentSecondPage.items.length, 5);
      assert.equal(studentSecondPage.pagination.total, 25);
      const allStudentIds = [...studentFirstPage.items, ...studentSecondPage.items].map((item) => item.id);
      assert.equal(new Set(allStudentIds).size, 25);
      assert.deepEqual(new Set(allStudentIds), new Set(studentFixtures.map((item) => String(item._id))));

      const customPage = await apiClientModules.notificationService.list(
        'student',
        { page: 2, limit: 7 },
        studentClient.request,
      );
      assert.equal(customPage.items.length, 7);
      assert.equal(customPage.pagination.pages, 4);
      assert.equal(customPage.pagination.limit, 7);

      const teacherPage = await apiClientModules.notificationService.list('teacher', {}, teacherClient.request);
      assert.equal(teacherPage.items.length, 20);
      assert.equal(teacherPage.pagination.total, 25);
      assert.equal(teacherPage.unread, 24);
      const teacherSecondPage = await apiClientModules.notificationService.list(
        'teacher',
        { page: 2, limit: 20 },
        teacherClient.request,
      );
      assert.equal(teacherSecondPage.items.length, 5);
      assert.equal(new Set([...teacherPage.items, ...teacherSecondPage.items].map((item) => item.id)).size, 25);
    });

    await t.test('type filters cover every backend-supported notification type', async () => {
      const expectedTypes = ['SYSTEM', 'COURSE', 'FINANCE', 'EVALUATION', 'MESSAGE', 'EXAM', 'SCHEDULE'];
      for (const type of expectedTypes) {
        const page = await apiClientModules.notificationService.list('student', { type, limit: 100 }, studentClient.request);
        assert.ok(page.items.length > 0, `${type} fixture should exist`);
        assert.ok(page.items.every((item) => item.type === type));
        assert.equal(page.pagination.total, studentFixtures.filter((item) => item.type === type).length);
      }
      const teacherTypes = ['MESSAGE', 'SCHEDULE', 'COURSE'];
      for (const type of teacherTypes) {
        const page = await apiClientModules.notificationService.list('teacher', { type, limit: 100 }, teacherClient.request);
        assert.ok(page.items.length > 0, `${type} teacher fixture should exist`);
        assert.ok(page.items.every((item) => item.type === type));
      }
    });

    await t.test('unread filtering and count endpoint are user-scoped', async () => {
      const unread = await apiClientModules.notificationService.list(
        'student',
        { unreadOnly: true, limit: 100 },
        studentClient.request,
      );
      assert.equal(unread.items.length, 24);
      assert.ok(unread.items.every((item) => item.unread));
      assert.equal(unread.unread, 24);
      const studentCount = await studentClient.request('/api/notifications/count');
      assert.equal(studentCount.success, true);
      assert.equal(studentCount.count, 24);

      const teacherCount = await teacherClient.request('/api/notifications/count');
      assert.equal(teacherCount.success, true);
      assert.equal(teacherCount.count, 24);
      const secondStudentList = await apiClientModules.notificationService.list(
        'student',
        { limit: 100 },
        secondStudentClient.request,
      );
      assert.deepEqual(secondStudentList.items.map((item) => item.id), [String(studentFixtures[24]._id)]);
    });

    await t.test('mark-one, dismiss and mark-all persist per-user server state', async () => {
      const oneUnread = studentFixtures[1];
      const shared = studentFixtures[24];
      await apiClientModules.notificationService.markRead('student', String(oneUnread._id), studentClient.request);
      const afterOne = await studentClient.request('/api/notifications/count');
      assert.equal(afterOne.count, 23);
      const unreadAfterOne = await apiClientModules.notificationService.list(
        'student',
        { unreadOnly: true, limit: 100 },
        studentClient.request,
      );
      assert.ok(!unreadAfterOne.items.some((item) => item.id === String(oneUnread._id)));

      const foreignOnly = studentFixtures[2];
      await assert.rejects(
        apiClientModules.notificationService.markRead(
          'student',
          String(foreignOnly._id),
          secondStudentClient.request,
        ),
        (error) => error.status === 404,
      );
      await assert.rejects(
        apiClientModules.notificationService.hide(String(foreignOnly._id), secondStudentClient.request),
        (error) => error.status === 404,
      );
      const secondStudentBeforeDismiss = await apiClientModules.notificationService.list(
        'student',
        { limit: 100 },
        secondStudentClient.request,
      );
      assert.deepEqual(secondStudentBeforeDismiss.items.map((item) => item.id), [String(shared._id)]);
      assert.equal(secondStudentBeforeDismiss.items[0].unread, true);

      await apiClientModules.notificationService.hide(String(shared._id), studentClient.request);
      const studentAfterDismiss = await apiClientModules.notificationService.list(
        'student',
        { limit: 100 },
        studentClient.request,
      );
      assert.ok(!studentAfterDismiss.items.some((item) => item.id === String(shared._id)));
      const secondStudentAfterDismiss = await apiClientModules.notificationService.list(
        'student',
        { limit: 100 },
        secondStudentClient.request,
      );
      assert.equal(secondStudentAfterDismiss.items.length, 1);
      assert.equal(secondStudentAfterDismiss.items[0].id, String(shared._id));
      assert.equal(secondStudentAfterDismiss.items[0].unread, true);
      assert.equal(secondStudentAfterDismiss.items[0].targetPath, '/student/schedule');

      const afterDismiss = await studentClient.request('/api/notifications/count');
      assert.equal(afterDismiss.count, 22);
      await apiClientModules.notificationService.markAllRead('student', studentClient.request);
      const afterAll = await studentClient.request('/api/notifications/count');
      assert.equal(afterAll.count, 0);
      const allStudentItems = await apiClientModules.notificationService.list(
        'student',
        { limit: 100 },
        studentClient.request,
      );
      assert.equal(allStudentItems.items.length, 24);
      assert.ok(allStudentItems.items.every((item) => !item.unread));

      await apiClientModules.notificationService.markRead(
        'teacher',
        String(teacherFixtures[1]._id),
        teacherClient.request,
      );
      assert.equal((await teacherClient.request('/api/notifications/count')).count, 23);
      await apiClientModules.notificationService.markAllRead('teacher', teacherClient.request);
      assert.equal((await teacherClient.request('/api/notifications/count')).count, 0);
    });

    await t.test('CSRF is enforced and shared Auth client refreshes and clears revoked sessions', async () => {
      const missingCsrf = await fetch(`${apiBaseUrl}/api/notifications/mark-read`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${studentClient.latestAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notificationId: String(studentFixtures[1]._id) }),
      });
      assert.equal(missingCsrf.status, 403);
      assert.equal((await missingCsrf.json()).code, 'CSRF_INVALID');

      const session = studentClient.auth.getStoredSession();
      assert.ok(session);
      await studentClient.api.request('/api/auth/logout', {
        method: 'POST',
        body: { refreshToken: session.refreshToken },
        accessToken: studentClient.latestAccessToken,
      });
      await assert.rejects(
        studentClient.request('/api/notifications/count'),
        (error) => [401, 403].includes(error.status),
      );
      assert.equal(studentClient.auth.getStoredSession(), null);
      assert.ok(studentClient.invalidations > 0);
    });

    await t.test('backend paths map known, unknown and Web-only destinations safely', async () => {
      const studentList = await apiClientModules.notificationService.list(
        'student',
        { limit: 100 },
        secondStudentClient.request,
      );
      const sharedNotification = studentList.items[0];
      assert.deepEqual(
        apiClientModules.resolveNotificationDestination(sharedNotification, 'student'),
        { kind: 'tab', name: 'Schedule' },
      );

      const webOnly = apiClientModules.resolveNotificationDestination({
        ...sharedNotification,
        type: 'EXAM',
        targetPath: '/student/exam',
      }, 'student');
      assert.deepEqual(webOnly, { kind: 'unsupported', reason: 'web-only' });
      const unknown = apiClientModules.resolveNotificationDestination({
        ...sharedNotification,
        type: 'SYSTEM',
        targetPath: '/unmapped/mobile-target',
      }, 'student');
      assert.deepEqual(unknown, { kind: 'unsupported', reason: 'unknown' });
    });

    await t.test('Expo Web interactive QA can use disposable real Student and Teacher accounts', async () => {
      if (!interactiveQa) {
        t.diagnostic('Interactive Expo Web QA was not requested for this run.');
        return;
      }
      let interactiveTimeout;
      await Promise.race([
        interactiveDone,
        new Promise((resolve) => {
          interactiveTimeout = setTimeout(resolve, 300_000);
        }),
      ]);
      clearTimeout(interactiveTimeout);
      assert.equal(interactiveFinished, true, 'Expo Web QA did not call the local completion endpoint.');

      await Notification.updateMany(
        { _id: { $in: fixtureNotificationIds } },
        { $set: { read_by: [], dismissed_by: [] } },
      );
      await Notification.updateOne(
        { _id: studentFixtures[0]._id },
        { $addToSet: { read_by: String(studentDoc._id) } },
      );
      await Notification.updateOne(
        { _id: teacherFixtures[0]._id },
        { $addToSet: { read_by: String(teacherDoc._id) } },
      );
    });
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (fixtureNotificationIds.length) {
      await Notification.deleteMany({ _id: { $in: fixtureNotificationIds } });
    }
    if (studentIds.length) {
      await AuthSession.deleteMany({ userId: { $in: studentIds.map(String) } });
      await Student.deleteMany({ _id: { $in: studentIds } });
    }
    if (teacherIds.length) {
      await AuthSession.deleteMany({ userId: { $in: teacherIds.map(String) } });
      await Teacher.deleteMany({ _id: { $in: teacherIds } });
    }
    if (mongoConnected) await mongoose.disconnect();
    await closeRedis();
  }
});
