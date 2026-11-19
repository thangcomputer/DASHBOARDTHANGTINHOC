'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const cookieParser = require('cookie-parser');
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
const Branch = require('../../models/Branch');
const SystemSettings = require('../../models/SystemSettings');
const RegisteredDevice = require('../../models/RegisteredDevice');
const UserDeviceSession = require('../../models/UserDeviceSession');
const AuthSession = require('../../models/AuthSession');
const { authMiddleware } = require('../../middleware/auth');
const authRoutes = require('../../routes/authRoutes');
const studentRoutes = require('../../routes/studentRoutes');

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

async function requestJson(baseUrl, path, { method = 'GET', token = '', headers = {}, body = null } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return {
    status: res.status,
    json,
    setCookies: typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [],
  };
}

test('Real MongoDB + Express flow: Reset thiết bị clears all login machine history, 2 fixed slots, Web/Mobile sessions, and lets a brand-new machine log in', {
  timeout: 30000,
  skip: hasTestDb ? false : 'TEST_DATABASE_URI (test_* or *_test DB) not set',
}, async () => {
  process.env.NODE_ENV = 'test';
  const target = assertTestDatabaseEnvironment(process.env);

  const suffix = crypto.randomBytes(4).toString('hex');
  const phone = `09${String(parseInt(suffix, 16) % 100000000).padStart(8, '0')}`;
  const rawPassword = `ResetPass@${suffix}`;
  const socketEmits = [];
  const disconnectedRooms = [];

  const mockIo = {
    to(room) {
      return {
        emit(event, payload) {
          socketEmits.push({ kind: 'to', room, event, payload });
        },
      };
    },
    in(room) {
      return {
        emit(event, payload) {
          socketEmits.push({ kind: 'in', room, event, payload });
        },
        disconnectSockets(close) {
          disconnectedRooms.push({ room, close });
        },
      };
    },
  };

  let connected = false;
  let server = null;
  let branch = null;
  let student = null;
  let createdSettingsMain = false;

  try {
    await mongoose.connect(target.uri, { serverSelectionTimeoutMS: 5000 });
    connected = true;
    await Promise.all([
      Student.init(),
      Branch.init(),
      RegisteredDevice.init(),
      UserDeviceSession.init(),
      AuthSession.init(),
    ]);

    const existingSettings = await SystemSettings.findOne({ _key: 'main' }).lean();
    if (!existingSettings) {
      await SystemSettings.create({ _key: 'main', adminTokenVersion: 0 });
      createdSettingsMain = true;
    }
    const settingsDoc = await SystemSettings.findOne({ _key: 'main' }).lean();

    branch = await Branch.create({
      name: `Branch Reset Test ${suffix}`,
      code: `BR${suffix.slice(0, 6).toUpperCase()}`,
    });

    student = await Student.create({
      name: `HV Reset Test ${suffix}`,
      phone,
      zalo: phone,
      course: 'Tin học văn phòng',
      price: 0,
      password: rawPassword,
      status: 'active',
      freePortal: true,
      branchId: branch._id,
      branchCode: branch.code,
    });

    const app = express();
    app.set('io', mockIo);
    app.use(cookieParser());
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/students', studentRoutes);
    app.get('/api/test-me', authMiddleware, (req, res) => {
      res.json({ success: true, user: req.user });
    });

    server = await listen(app);
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    // 1. Machine A logs in -> claims Slot 1 + creates UserDeviceSession + knownDevices[0]
    const loginA = await requestJson(baseUrl, '/api/auth/login/public', {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
      },
      body: {
        identifier: phone,
        password: rawPassword,
        role: 'student',
        deviceKey: `pc-a-${suffix}`,
        platform: 'web',
        force: true,
      },
    });
    assert.equal(loginA.status, 200, JSON.stringify(loginA.json));
    assert.equal(loginA.json?.data?.registeredDeviceSlot, 1);
    const tokenA = loginA.json?.data?.accessToken;
    const secretA = loginA.json?.data?.deviceSecret;
    const proofCookieA = (loginA.setCookies || []).find((c) => c.startsWith(`cms_dp_${student._id}=`));
    assert.ok(tokenA);
    assert.ok(secretA);
    assert.ok(proofCookieA, 'Must set HttpOnly device proof cookie on registration');
    const cookieHeaderA = proofCookieA.split(';')[0];

    // 1b. Student logs OUT on Machine A and logs back in with saved deviceSecret -> succeeds without Admin reset
    const logoutA = await requestJson(baseUrl, '/api/auth/logout', {
      method: 'POST',
      token: tokenA,
      body: { refreshToken: loginA.json?.data?.refreshToken },
    });
    assert.equal(logoutA.status, 200);

    const reloginWithSecret = await requestJson(baseUrl, '/api/auth/login/public', {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
      },
      body: {
        identifier: phone,
        password: rawPassword,
        role: 'student',
        deviceKey: `pc-a-${suffix}`,
        deviceSecret: secretA,
        platform: 'web',
      },
    });
    assert.equal(reloginWithSecret.status, 200, JSON.stringify(reloginWithSecret.json));
    assert.equal(reloginWithSecret.json?.data?.registeredDeviceSlot, 1);

    // 1c. Even if localStorage deviceSecret is empty, HttpOnly backup cookie proves browser & heals deviceSecret
    const reloginWithCookieFallback = await requestJson(baseUrl, '/api/auth/login/public', {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
        cookie: cookieHeaderA,
      },
      body: {
        identifier: phone,
        password: rawPassword,
        role: 'student',
        deviceKey: `pc-a-${suffix}`,
        deviceSecret: '',
        platform: 'web',
        force: true,
      },
    });
    assert.equal(reloginWithCookieFallback.status, 200, JSON.stringify(reloginWithCookieFallback.json));
    assert.equal(reloginWithCookieFallback.json?.data?.deviceSecret, secretA);

    // 1d. Spoofing same hardware deviceKey from another browser WITHOUT secret & WITHOUT cookie must still fail
    const spoofedA = await requestJson(baseUrl, '/api/auth/login/public', {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0 Safari/537.36',
      },
      body: {
        identifier: phone,
        password: rawPassword,
        role: 'student',
        deviceKey: `pc-a-${suffix}`,
        deviceSecret: '',
        platform: 'web',
        force: true,
      },
    });
    assert.equal(spoofedA.status, 403);
    assert.equal(spoofedA.json?.code, 'DEVICE_PROOF_INVALID');

    // 2. Machine B logs in -> claims Slot 2 + creates UserDeviceSession + knownDevices[1]
    const loginB = await requestJson(baseUrl, '/api/auth/login/public', {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
      },
      body: {
        identifier: phone,
        password: rawPassword,
        role: 'student',
        deviceKey: `mac-b-${suffix}`,
        platform: 'web',
        force: true,
      },
    });
    assert.equal(loginB.status, 200, JSON.stringify(loginB.json));
    assert.equal(loginB.json?.data?.registeredDeviceSlot, 2);
    const tokenB = loginB.json?.data?.accessToken;
    assert.ok(tokenB);

    // 3. Also seed a Mobile AuthSession history row for this student
    await AuthSession.create({
      sessionId: `mob-reset-${suffix}`,
      userId: student._id,
      role: 'student',
      clientType: 'mobile',
      platform: 'android',
      createdAt: new Date(),
      lastUsedAt: new Date(),
      absoluteExpiresAt: new Date(Date.now() + 60_000),
      refreshFamilyId: new mongoose.Types.ObjectId().toString(),
      currentRefreshJtiHash: crypto.createHash('sha256').update(`jti-${suffix}`).digest('hex'),
    });

    // Confirm 3rd machine C is blocked BEFORE reset
    const blockedC = await requestJson(baseUrl, '/api/auth/login/public', {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0',
      },
      body: {
        identifier: phone,
        password: rawPassword,
        role: 'student',
        deviceKey: `linux-c-${suffix}`,
        platform: 'web',
        force: true,
      },
    });
    assert.equal(blockedC.status, 403);
    assert.equal(blockedC.json?.code, 'DEVICE_NOT_REGISTERED_LIMIT_REACHED');

    // Verify Machine B token currently accesses protected endpoint
    const meBeforeReset = await requestJson(baseUrl, '/api/test-me', { token: tokenB });
    assert.equal(meBeforeReset.status, 200);

    // 4. Admin invokes Reset thiết bị
    const adminToken = jwt.sign(
      {
        id: 'admin',
        name: 'Admin Test',
        role: 'admin',
        adminRole: 'SUPER_ADMIN',
        tokenVersion: Number(settingsDoc?.adminTokenVersion || 0),
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' },
    );

    const resetRes = await requestJson(baseUrl, `/api/students/${student._id}/reset-devices`, {
      method: 'POST',
      token: adminToken,
    });
    assert.equal(resetRes.status, 200, JSON.stringify(resetRes.json));
    assert.equal(resetRes.json?.success, true);
    assert.equal(resetRes.json?.data?.clearedRegisteredDevices, 2);
    assert.equal(resetRes.json?.data?.clearedWebSessions, 4);
    assert.equal(resetRes.json?.data?.clearedMobileSessions, 1);

    // 5. Verify ALL MongoDB collections & Student fields are completely clean
    const [regCount, webCount, mobCount, updatedStudent] = await Promise.all([
      RegisteredDevice.countDocuments({ userId: String(student._id), role: 'student' }),
      UserDeviceSession.countDocuments({ userId: String(student._id), role: 'student' }),
      AuthSession.countDocuments({ userId: student._id, role: 'student' }),
      Student.findById(student._id).select('+knownDevices +refreshToken +deviceFingerprint tokenVersion knownDeviceCount knownDeviceSummary accountLockReason'),
    ]);

    assert.equal(regCount, 0);
    assert.equal(webCount, 0);
    assert.equal(mobCount, 0);
    assert.deepEqual(updatedStudent.knownDevices, []);
    assert.equal(updatedStudent.knownDeviceCount, 0);
    assert.equal(updatedStudent.knownDeviceSummary, '');
    assert.equal(updatedStudent.accountLockReason, '');
    assert.equal(updatedStudent.refreshToken ?? null, null);
    assert.equal(updatedStudent.deviceFingerprint ?? null, null);
    assert.ok(Number(updatedStudent.tokenVersion) >= 1);

    // Admin Security Tab APIs must also return zero registered devices and zero login session history
    const [regApiRes, sessApiRes] = await Promise.all([
      requestJson(baseUrl, `/api/auth/registered-devices?userId=${student._id}&role=student`, { token: adminToken }),
      requestJson(baseUrl, `/api/auth/device-sessions?scope=all&status=all&search=${encodeURIComponent(updatedStudent.name || phone)}`, { token: adminToken }),
    ]);
    assert.equal(regApiRes.status, 200);
    assert.deepEqual(regApiRes.json?.data?.devices || [], []);
    assert.equal(sessApiRes.status, 200);
    assert.equal(
      (sessApiRes.json?.data?.sessions || []).filter((s) => String(s.userId) === String(student._id)).length,
      0,
    );

    // Confirm targeted socket logout events were emitted (never global broadcast)
    assert.ok(
      socketEmits.some(
        (e) => e.kind === 'to'
          && e.room === String(student._id)
          && e.event === 'auth:forceLogout'
          && e.payload?.reason === 'devices_reset',
      ),
    );
    assert.ok(disconnectedRooms.length >= 2);

    // 6. Verify old token B from pre-reset machine is rejected immediately
    const meAfterReset = await requestJson(baseUrl, '/api/test-me', { token: tokenB });
    assert.equal(meAfterReset.status, 401);

    // 7. Brand-new Machine C can now log in cleanly and take Slot 1
    const loginC = await requestJson(baseUrl, '/api/auth/login/public', {
      method: 'POST',
      headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Firefox/131.0',
      },
      body: {
        identifier: phone,
        password: rawPassword,
        role: 'student',
        deviceKey: `linux-c-${suffix}`,
        platform: 'web',
      },
    });
    assert.equal(loginC.status, 200, JSON.stringify(loginC.json));
    assert.equal(loginC.json?.data?.registeredDeviceSlot, 1);

    const postLoginRegDevices = await RegisteredDevice.find({ userId: String(student._id) }).lean();
    assert.equal(postLoginRegDevices.length, 1);
    assert.equal(postLoginRegDevices[0].slot, 1);
    assert.equal(postLoginRegDevices[0].deviceKey, `linux-c-${suffix}`);
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (connected && student) {
      await Promise.all([
        RegisteredDevice.deleteMany({ userId: String(student._id) }),
        UserDeviceSession.deleteMany({ userId: String(student._id) }),
        AuthSession.deleteMany({ userId: student._id }),
        Student.deleteOne({ _id: student._id }),
      ]);
    }
    if (connected && branch) {
      await Branch.deleteOne({ _id: branch._id });
    }
    if (connected && createdSettingsMain) {
      await SystemSettings.deleteOne({ _key: 'main' });
    }
    if (connected) {
      await mongoose.disconnect();
    }
  }
});
