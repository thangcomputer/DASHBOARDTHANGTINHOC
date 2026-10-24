const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cookieParser = require('cookie-parser');
const express = require('express');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Redis = require('ioredis');
const { createAdapter } = require('@socket.io/redis-adapter');
const { Server: SocketServer } = require('socket.io');
const { io: createSocketClient } = require('socket.io-client');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_REFRESH_SECRET = crypto.randomBytes(32).toString('hex');
process.env.MOBILE_MULTI_SESSION_AUTH = 'true';

const { assertTestDatabaseEnvironment } = require('../setup/testDatabaseGuard');
const Student = require('../../models/Student');
const Teacher = require('../../models/Teacher');
const AuthSession = require('../../models/AuthSession');
const { authMiddleware } = require('../../middleware/auth');
const { csrfProtection } = require('../../middleware/csrf');
const { socketAuthMiddleware } = require('../../middleware/socketAuth');
const authRoutes = require('../../routes/authRoutes');
const tokenBlacklist = require('../../middleware/tokenBlacklist');
const { getRedis, closeRedis } = require('../../config/redis');
const { revokeMobileSessionsForUser } = require('../../services/mobileAuthSessionSecurity');

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolve(server.address().port);
    });
  });
}

function connectRedisClient(url) {
  return new Promise((resolve, reject) => {
    const client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      connectTimeout: 2000,
    });
    client.once('error', reject);
    client.connect().then(() => {
      client.removeListener('error', reject);
      resolve(client);
    }, reject);
  });
}

function waitForRedisReady(client) {
  if (client.status === 'ready') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Isolated Redis client did not become ready'));
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

function connectSocket(port, accessToken) {
  return new Promise((resolve, reject) => {
    const socket = createSocketClient(`http://127.0.0.1:${port}`, {
      auth: { token: accessToken },
      transports: ['websocket'],
      reconnection: false,
      timeout: 5000,
    });
    const onError = (error) => {
      socket.close();
      reject(error);
    };
    socket.once('connect_error', onError);
    socket.once('connect', () => {
      socket.removeListener('connect_error', onError);
      resolve(socket);
    });
  });
}

function waitForDisconnect(socket) {
  if (!socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.removeListener('disconnect', onDisconnect);
      reject(new Error('Socket was not disconnected by session revocation'));
    }, 5000);
    const onDisconnect = () => {
      clearTimeout(timer);
      resolve();
    };
    socket.once('disconnect', onDisconnect);
  });
}

test('mobile auth works with isolated MongoDB and Redis across API and Socket.IO', {
  timeout: 60000,
}, async (t) => {
  const target = assertTestDatabaseEnvironment(process.env);
  const mongoUrl = new URL(target.uri);
  const redisUrl = new URL(String(process.env.REDIS_URL || ''));
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(mongoUrl.port, '27019');
  assert.equal(target.dbName, 'dashboardthangtinhoc_mobile_auth_test');
  assert.equal(redisUrl.protocol, 'redis:');
  assert.equal(redisUrl.hostname, '127.0.0.1');
  assert.equal(redisUrl.port, '6382');

  let mongoConnected = false;
  let httpPort;
  let socketPort;
  let apiServer;
  let socketServerA;
  let socketServerB;
  let redisPubA;
  let redisSubA;
  let redisPubB;
  let redisSubB;
  let requestSessionToken;
  let requestSessionCookie;
  let student;
  let otherStudent;
  let teacher;
  let pendingTeacher;
  let lockedTeacher;
  const studentIds = [];
  const teacherIds = [];
  const clientSockets = [];

  try {
    await mongoose.connect(target.uri, { serverSelectionTimeoutMS: 5000 });
    mongoConnected = true;
    await Promise.all([Student.init(), Teacher.init(), AuthSession.init()]);

    const authRedis = getRedis();
    assert.ok(authRedis, 'REDIS_URL must activate the configured Redis client');
    await waitForRedisReady(authRedis);
    assert.equal(await authRedis.ping(), 'PONG', 'Redis must be reachable, not memory fallback');

    redisPubA = await connectRedisClient(redisUrl.toString());
    redisSubA = await connectRedisClient(redisUrl.toString());
    redisPubB = await connectRedisClient(redisUrl.toString());
    redisSubB = await connectRedisClient(redisUrl.toString());

    student = await Student.create({
      name: 'Mobile Auth Integration Student',
      phone: `090${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`,
      password: 'mobile-test-password',
      zalo: 'mobile-auth-integration',
      course: 'Mobile Auth Integration Course',
      price: 0,
      status: 'active',
      tokenVersion: 0,
    });
    studentIds.push(student._id);

    otherStudent = await Student.create({
      name: 'Mobile Auth Other Student',
      phone: `091${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`,
      password: 'mobile-test-password',
      zalo: 'mobile-auth-other',
      course: 'Mobile Auth Other Course',
      price: 0,
      status: 'active',
      tokenVersion: 0,
    });
    studentIds.push(otherStudent._id);

    teacher = await Teacher.create({
      name: 'Mobile Auth Integration Teacher',
      phone: `092${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`,
      password: 'mobile-test-password',
      status: 'active',
      role: 'teacher',
    });
    teacherIds.push(teacher._id);

    pendingTeacher = await Teacher.create({
      name: 'Mobile Auth Pending Teacher',
      phone: `093${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`,
      password: 'mobile-test-password',
      status: 'pending',
      role: 'teacher',
    });
    teacherIds.push(pendingTeacher._id);

    lockedTeacher = await Teacher.create({
      name: 'Mobile Auth Locked Teacher',
      phone: `094${String(Math.floor(Math.random() * 10_000_000)).padStart(7, '0')}`,
      password: 'mobile-test-password',
      status: 'active',
      lockUntil: new Date(Date.now() + 60_000),
      role: 'teacher',
    });
    teacherIds.push(lockedTeacher._id);

    const app = express();
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api', csrfProtection);
    app.get('/api/mobile-auth-test/protected', authMiddleware, (req, res) => {
      res.json({ success: true, userId: req.user.id, role: req.user.role });
    });
    app.use('/api/auth', authRoutes);

    apiServer = http.createServer(app);
    socketServerA = new SocketServer(apiServer, { serveClient: false });
    socketServerB = new SocketServer(http.createServer(), { serveClient: false });
    for (const ioServer of [socketServerA, socketServerB]) {
      ioServer.use(socketAuthMiddleware);
      ioServer.on('connection', (socket) => {
        if (socket.sessionId) socket.join(`session:${socket.sessionId}`);
      });
    }
    socketServerA.adapter(createAdapter(redisPubA, redisSubA));
    socketServerB.adapter(createAdapter(redisPubB, redisSubB));
    app.set('io', socketServerA);
    httpPort = await listen(apiServer);
    socketPort = await listen(socketServerB.httpServer);

    const baseUrl = `http://127.0.0.1:${httpPort}`;
    const csrfResponse = await fetch(`${baseUrl}/api/auth/csrf-token`);
    assert.equal(csrfResponse.status, 200);
    const csrfBody = await csrfResponse.json();
    requestSessionToken = csrfBody.csrfToken;
    requestSessionCookie = (csrfResponse.headers.get('set-cookie') || '').split(';')[0];
    assert.ok(requestSessionToken);
    assert.match(requestSessionCookie, /^csrf_token=/);

    async function request(method, path, { body, accessToken, csrf = true } = {}) {
      const headers = {};
      if (body !== undefined) headers['content-type'] = 'application/json';
      if (csrf) {
        headers.cookie = requestSessionCookie;
        headers['x-csrf-token'] = requestSessionToken;
      }
      if (accessToken) headers.authorization = `Bearer ${accessToken}`;
      const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    }

    async function mobileLogin(user, role = 'student') {
      return request('POST', '/api/auth/login/mobile', {
        body: {
          identifier: user.phone,
          password: 'mobile-test-password',
          role,
          platform: 'android',
          deviceLabel: 'integration device',
          appVersion: 'test',
        },
      });
    }

    function tokenSet(response) {
      assert.equal(response.status, 200);
      assert.equal(response.body.success, true);
      const { accessToken, refreshToken, sessionId } = response.body.data;
      const access = jwt.decode(accessToken);
      const refresh = jwt.decode(refreshToken);
      assert.equal(access.aud, 'mobile');
      assert.equal(refresh.aud, 'mobile');
      assert.ok(access.sid);
      assert.ok(access.jti);
      assert.ok(refresh.sid);
      assert.ok(refresh.jti);
      assert.equal(access.sid, sessionId);
      assert.equal(refresh.sid, sessionId);
      return { accessToken, refreshToken, sessionId };
    }

    await t.test('feature flag defaults OFF and CSRF is required', async () => {
      delete process.env.MOBILE_MULTI_SESSION_AUTH;
      const disabled = await request('POST', '/api/auth/login/mobile', {
        body: { identifier: student.phone, password: 'mobile-test-password', role: 'student', platform: 'android' },
      });
      assert.equal(disabled.status, 404);
      assert.equal(disabled.body.code, 'MOBILE_SESSION_AUTH_DISABLED');

      process.env.MOBILE_MULTI_SESSION_AUTH = 'true';
      const missingCsrf = await request('POST', '/api/auth/login/mobile', {
        body: { identifier: student.phone, password: 'mobile-test-password', role: 'student', platform: 'android' },
        csrf: false,
      });
      assert.equal(missingCsrf.status, 403);
      assert.equal(missingCsrf.body.code, 'CSRF_INVALID');
    });

    let legacyAccessToken;
    await t.test('legacy web login remains available while mobile flag is OFF', async () => {
      process.env.MOBILE_MULTI_SESSION_AUTH = 'false';
      const response = await request('POST', '/api/auth/login', {
        body: { identifier: student.phone, password: 'mobile-test-password', role: 'student' },
      });
      assert.equal(response.status, 200);
      legacyAccessToken = response.body.data.accessToken;
      const claims = jwt.decode(legacyAccessToken);
      assert.equal(claims.aud, 'public');
      assert.equal(claims.sid, undefined);
      const protectedResponse = await request('GET', '/api/mobile-auth-test/protected', {
        accessToken: legacyAccessToken,
        csrf: false,
      });
      assert.equal(protectedResponse.status, 200);

      const disabledRefresh = await request('POST', '/api/auth/refresh', {
        body: { refreshToken: response.body.data.refreshToken },
      });
      assert.equal(disabledRefresh.status, 200);
      assert.equal(jwt.decode(disabledRefresh.body.accessToken).aud, 'public');

      const logout = await request('POST', '/api/auth/logout', {
        accessToken: disabledRefresh.body.accessToken,
        body: { refreshToken: disabledRefresh.body.refreshToken },
      });
      assert.equal(logout.status, 200);
      const loggedOut = await request('GET', '/api/mobile-auth-test/protected', {
        accessToken: disabledRefresh.body.accessToken,
        csrf: false,
      });
      assert.equal(loggedOut.status, 401);
      process.env.MOBILE_MULTI_SESSION_AUTH = 'true';
    });

    let studentA;
    let studentB;
    let studentC;
    let otherSession;
    let teacherSession;
    await t.test('Student and active Teacher logins issue independent mobile claims', async () => {
      studentA = tokenSet(await mobileLogin(student));
      studentB = tokenSet(await mobileLogin(student));
      teacherSession = tokenSet(await mobileLogin(teacher, 'teacher'));

      assert.notEqual(studentA.sessionId, studentB.sessionId);
      assert.equal((await AuthSession.countDocuments({ userId: student._id, revokedAt: null })), 2);
      assert.equal((await AuthSession.findOne({ sessionId: studentA.sessionId })).role, 'student');
      assert.equal((await AuthSession.findOne({ sessionId: teacherSession.sessionId })).role, 'teacher');

      const invalid = await request('POST', '/api/auth/login/mobile', {
        body: {
          identifier: student.phone,
          password: 'not-the-test-password',
          role: 'student',
          platform: 'android',
        },
      });
      assert.equal(invalid.status, 401);
      assert.equal(invalid.body.code, 'INVALID_CREDENTIALS');
    });

    await t.test('role boundary and existing Teacher status policy are preserved', async () => {
      for (const role of ['admin', 'staff']) {
        const denied = await request('POST', '/api/auth/login/mobile', {
          body: {
            identifier: student.phone,
            password: 'mobile-test-password',
            role,
            platform: 'android',
          },
        });
        assert.equal(denied.status, 403);
        assert.equal(denied.body.code, 'MOBILE_ROLE_NOT_ALLOWED');
      }

      const locked = await mobileLogin(lockedTeacher, 'teacher');
      assert.equal(locked.status, 403);
      const pending = tokenSet(await mobileLogin(pendingTeacher, 'teacher'));
      assert.equal(jwt.decode(pending.accessToken).role, 'teacher');
      assert.equal((await AuthSession.findOne({ sessionId: pending.sessionId })).role, 'teacher');
    });

    let studentANew;
    let studentBNew;
    await t.test('refresh race has one winner, while refresh state remains session-scoped', async () => {
      const raced = await Promise.all([
        request('POST', '/api/auth/refresh', { body: { refreshToken: studentA.refreshToken } }),
        request('POST', '/api/auth/refresh', { body: { refreshToken: studentA.refreshToken } }),
      ]);
      assert.deepEqual(raced.map((result) => result.status).sort(), [200, 401]);
      const winner = raced.find((result) => result.status === 200);
      assert.ok(winner);
      studentANew = {
        accessToken: winner.body.accessToken,
        refreshToken: winner.body.refreshToken,
        sessionId: winner.body.sessionId,
      };
      assert.equal(jwt.decode(studentANew.refreshToken).sid, studentA.sessionId);

      const key = `jwtbl:${tokenBlacklist.hashToken(studentA.refreshToken)}`;
      assert.equal(await getRedis().exists(key), 1, 'refresh revocation must be stored in isolated Redis');
      assert.ok(await tokenBlacklist.isBlacklisted(studentA.refreshToken));

      const oldReplay = await request('POST', '/api/auth/refresh', {
        body: { refreshToken: studentA.refreshToken },
      });
      assert.equal(oldReplay.status, 401);

      const refreshB = await request('POST', '/api/auth/refresh', {
        body: { refreshToken: studentB.refreshToken },
      });
      assert.equal(refreshB.status, 200);
      studentBNew = {
        accessToken: refreshB.body.accessToken,
        refreshToken: refreshB.body.refreshToken,
        sessionId: refreshB.body.sessionId,
      };
      assert.equal(studentBNew.sessionId, studentB.sessionId);

      const sessionARecord = await AuthSession.findOne({ sessionId: studentA.sessionId });
      const sessionBRecord = await AuthSession.findOne({ sessionId: studentB.sessionId });
      assert.equal(
        sessionARecord.currentRefreshJtiHash,
        require('../../services/mobileAuthSessionService').hashRefreshJti(jwt.decode(studentANew.refreshToken).jti),
      );
      assert.equal(
        sessionBRecord.currentRefreshJtiHash,
        require('../../services/mobileAuthSessionService').hashRefreshJti(jwt.decode(studentBNew.refreshToken).jti),
      );
      assert.notEqual(sessionARecord.currentRefreshJtiHash, sessionBRecord.currentRefreshJtiHash);
    });

    let socketA;
    let socketB;
    let socketC;
    await t.test('two Socket.IO instances authenticate independent sessions over Redis', async () => {
      socketA = await connectSocket(socketPort, studentANew.accessToken);
      socketB = await connectSocket(socketPort, studentBNew.accessToken);
      clientSockets.push(socketA, socketB);
      assert.equal(socketA.connected, true);
      assert.equal(socketB.connected, true);

      const protectedA = await request('GET', '/api/mobile-auth-test/protected', {
        accessToken: studentANew.accessToken,
        csrf: false,
      });
      const protectedB = await request('GET', '/api/mobile-auth-test/protected', {
        accessToken: studentBNew.accessToken,
        csrf: false,
      });
      assert.equal(protectedA.status, 200);
      assert.equal(protectedB.status, 200);
    });

    await t.test('logout revokes only current session and disconnects only its remote socket', async () => {
      const disconnected = waitForDisconnect(socketA);
      const logout = await request('POST', '/api/auth/logout', {
        accessToken: studentANew.accessToken,
        body: { refreshToken: studentANew.refreshToken },
      });
      assert.equal(logout.status, 200);
      await disconnected;

      const revokedAccess = await request('GET', '/api/mobile-auth-test/protected', {
        accessToken: studentANew.accessToken,
        csrf: false,
      });
      assert.equal(revokedAccess.status, 401);
      const revokedRefresh = await request('POST', '/api/auth/refresh', {
        body: { refreshToken: studentANew.refreshToken },
      });
      assert.equal(revokedRefresh.status, 401);

      const stillConnected = await request('GET', '/api/mobile-auth-test/protected', {
        accessToken: studentBNew.accessToken,
        csrf: false,
      });
      assert.equal(stillConnected.status, 200);
      assert.equal(socketB.connected, true);
    });

    await t.test('session list, cross-user isolation, and one-session revoke', async () => {
      studentC = tokenSet(await mobileLogin(student));
      otherSession = tokenSet(await mobileLogin(otherStudent));
      socketC = await connectSocket(socketPort, studentC.accessToken);
      clientSockets.push(socketC);

      const crossUserRevoke = await request('DELETE', `/api/auth/sessions/${otherSession.sessionId}`, {
        accessToken: studentC.accessToken,
      });
      assert.equal(crossUserRevoke.status, 404);

      const list = await request('GET', '/api/auth/sessions', {
        accessToken: studentC.accessToken,
        csrf: false,
      });
      assert.equal(list.status, 200);
      const listed = list.body.data;
      assert.ok(listed.some((session) => session.sessionId === studentA.sessionId && session.status === 'revoked'));
      assert.ok(listed.some((session) => session.sessionId === studentB.sessionId && session.status === 'active'));
      assert.ok(listed.some((session) => session.sessionId === studentC.sessionId && session.status === 'active'));
      assert.ok(listed.every((session) => session.sessionId !== otherSession.sessionId));
      assert.ok(listed.every((session) => !('currentRefreshJtiHash' in session)));

      const disconnected = waitForDisconnect(socketB);
      const revoked = await request('DELETE', `/api/auth/sessions/${studentB.sessionId}`, {
        accessToken: studentC.accessToken,
      });
      assert.equal(revoked.status, 200);
      await disconnected;

      const revokedB = await request('GET', '/api/mobile-auth-test/protected', {
        accessToken: studentBNew.accessToken,
        csrf: false,
      });
      assert.equal(revokedB.status, 401);
      const activeC = await request('GET', '/api/mobile-auth-test/protected', {
        accessToken: studentC.accessToken,
        csrf: false,
      });
      assert.equal(activeC.status, 200);

      const crossUserList = await request('GET', '/api/auth/sessions', {
        accessToken: otherSession.accessToken,
        csrf: false,
      });
      assert.equal(crossUserList.status, 200);
      assert.ok(crossUserList.body.data.every((session) => session.sessionId === otherSession.sessionId));
    });

    await t.test('security-event revoke invalidates Mongo session and remote socket', async () => {
      const teacherSocket = await connectSocket(socketPort, teacherSession.accessToken);
      clientSockets.push(teacherSocket);
      const disconnected = waitForDisconnect(teacherSocket);
      const result = await revokeMobileSessionsForUser({
        userId: teacher._id.toString(),
        role: 'teacher',
        reason: 'integration_security_event',
        io: socketServerA,
      });
      assert.equal(result.revokedCount, 1);
      assert.equal(result.disconnectedSocketRooms, 1);
      await disconnected;
      assert.equal(await AuthSession.findOne({ sessionId: teacherSession.sessionId }).then((s) => s.revokedAt != null), true);
    });

    await t.test('Redis remains the active blacklist backend', async () => {
      assert.equal(await getRedis().ping(), 'PONG');
      assert.equal(require('../../config/redis').isRedisReady(), true);
    });
  } finally {
    process.env.MOBILE_MULTI_SESSION_AUTH = 'false';
    for (const socket of clientSockets) socket.close();
    if (socketServerA) {
      await new Promise((resolve) => socketServerA.close(resolve));
    }
    if (socketServerB) {
      await new Promise((resolve) => socketServerB.close(resolve));
    }
    if (apiServer?.listening) {
      await new Promise((resolve) => apiServer.close(resolve));
    }
    for (const client of [redisPubA, redisSubA, redisPubB, redisSubB]) {
      if (client && client.status !== 'end') await client.quit();
    }
    if (mongoConnected) {
      const userIds = [...studentIds, ...teacherIds];
      if (userIds.length) await AuthSession.deleteMany({ userId: { $in: userIds } });
      if (studentIds.length) await Student.deleteMany({ _id: { $in: studentIds } });
      if (teacherIds.length) await Teacher.deleteMany({ _id: { $in: teacherIds } });
      await mongoose.disconnect();
    }
    await closeRedis();
  }
});
