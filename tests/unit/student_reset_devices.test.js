'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  resetAllForAccount,
  decideRegisteredDeviceAccess,
} = require('../../services/registeredDeviceService');
const deviceSessionService = require('../../services/deviceSessionService');

test('registeredDeviceService.resetAllForAccount removes active and revoked device slots for student', async () => {
  const rows = [
    { _id: 'r1', userId: 'stu-1', role: 'student', slot: 1, deviceKey: 'dev-a', status: 'active' },
    { _id: 'r2', userId: 'stu-1', role: 'student', slot: 2, deviceKey: 'dev-b', status: 'active' },
    { _id: 'r3', userId: 'stu-1', role: 'student', slot: 1, deviceKey: 'dev-old', status: 'revoked' },
    { _id: 'r4', userId: 'stu-2', role: 'student', slot: 1, deviceKey: 'dev-other', status: 'active' },
  ];

  const stubModel = {
    async deleteMany(filter) {
      let deletedCount = 0;
      for (let i = rows.length - 1; i >= 0; i -= 1) {
        const matchUser = rows[i].userId === String(filter.userId);
        const matchRole = !filter.role || rows[i].role === filter.role;
        if (matchUser && matchRole) {
          rows.splice(i, 1);
          deletedCount += 1;
        }
      }
      return { deletedCount };
    },
  };

  const result = await resetAllForAccount({ userId: 'stu-1', role: 'student' }, { model: stubModel });
  assert.equal(result.deletedCount, 3);
  assert.deepEqual(rows.map((r) => r.userId), ['stu-2']);

  // After reset, the student can register a brand-new machine into slot 1 cleanly.
  const decision = decideRegisteredDeviceAccess({
    activeDevices: rows.filter((r) => r.userId === 'stu-1' && r.status === 'active'),
    deviceKey: 'brand-new-pc',
    deviceSecret: '',
    platform: 'web',
  });
  assert.equal(decision.allow, true);
  assert.equal(decision.action, 'register');
  assert.equal(decision.slot, 1);
});

test('deviceSessionService.resetAccountDeviceSessions revokes cache, disconnects sockets, and deletes Web + Mobile history', async () => {
  const webDocs = [
    { sessionId: 'web-active-1', userId: 'stu-9', role: 'student', revokedAt: null },
    { sessionId: 'web-revoked-old', userId: 'stu-9', role: 'student', revokedAt: new Date() },
    { sessionId: 'web-other', userId: 'stu-other', role: 'student', revokedAt: null },
  ];
  const mobileDocs = [
    { sessionId: 'mob-1', userId: 'stu-9', role: 'student', revokedAt: null },
    { sessionId: 'mob-old', userId: 'stu-9', role: 'student', revokedAt: new Date() },
    { sessionId: 'mob-other', userId: 'stu-other', role: 'student', revokedAt: null },
  ];

  const mobileRevokeCalls = [];
  const socketEvents = [];
  const disconnectedRooms = [];
  const fakeIo = {
    in(room) {
      return {
        emit(event, payload) {
          socketEvents.push({ room, event, payload });
        },
        disconnectSockets(close) {
          disconnectedRooms.push({ room, close });
        },
      };
    },
  };

  const fakeWebModel = {
    find(filter) {
      return {
        select() {
          return {
            async lean() {
              return webDocs.filter((d) => (
                d.userId === String(filter.userId)
                && (!filter.role || d.role === filter.role)
                && d.revokedAt === null
              ));
            },
          };
        },
      };
    },
    async deleteMany(filter) {
      let deletedCount = 0;
      for (let i = webDocs.length - 1; i >= 0; i -= 1) {
        if (webDocs[i].userId === String(filter.userId) && (!filter.role || webDocs[i].role === filter.role)) {
          webDocs.splice(i, 1);
          deletedCount += 1;
        }
      }
      return { deletedCount };
    },
  };

  const fakeAuthModel = {
    async deleteMany(filter) {
      let deletedCount = 0;
      for (let i = mobileDocs.length - 1; i >= 0; i -= 1) {
        if (mobileDocs[i].userId === String(filter.userId) && (!filter.role || mobileDocs[i].role === filter.role)) {
          mobileDocs.splice(i, 1);
          deletedCount += 1;
        }
      }
      return { deletedCount };
    },
  };

  const res = await deviceSessionService.resetAccountDeviceSessions(
    { userId: 'stu-9', role: 'student', reason: 'devices_reset', io: fakeIo },
    {
      UserDeviceSessionModel: fakeWebModel,
      AuthSessionModel: fakeAuthModel,
      revokeMobileFn: async (args) => {
        mobileRevokeCalls.push(args);
        return { revokedCount: 1 };
      },
    },
  );

  assert.equal(res.clearedWebSessions, 2);
  assert.equal(res.clearedMobileSessions, 2);
  assert.equal(res.revokedActiveWebCount, 1);

  assert.equal(mobileRevokeCalls.length, 1);
  assert.equal(mobileRevokeCalls[0].reason, 'devices_reset');
  assert.deepEqual(webDocs.map((d) => d.userId), ['stu-other']);
  assert.deepEqual(mobileDocs.map((d) => d.userId), ['stu-other']);

  // Active Web session must immediately fail validation in cache even after DB deletion.
  assert.equal(await deviceSessionService.isDeviceSessionRevoked('web-active-1'), true);
  assert.ok(socketEvents.some((e) => e.room === 'dsid:web-active-1' && e.event === 'auth:forceLogout' && e.payload.reason === 'devices_reset'));
  assert.ok(disconnectedRooms.some((r) => r.room === 'dsid:web-active-1' && r.close === true));
});

test('POST /api/students/:id/reset-devices clears knownDevices, RegisteredDevice, sessions, tokenVersion, and UI copy', () => {
  const routesSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'routes', 'studentRoutes.js'), 'utf8');
  const start = routesSrc.indexOf("router.post('/:id/reset-devices'");
  const end = routesSrc.indexOf("router.post('/:id/lock-account'", start);
  assert.ok(start !== -1 && end > start, 'reset-devices route block must exist before lock-account');
  const block = routesSrc.slice(start, end);

  assert.match(block, /knownDevices:\s*\[\]/);
  assert.match(block, /knownDeviceCount:\s*0/);
  assert.match(block, /\$inc:\s*\{\s*tokenVersion:\s*1\s*\}/);
  assert.match(block, /\$unset:\s*\{[^}]*refreshToken[^}]*deviceFingerprint/);
  assert.match(block, /resetRegisteredDevicesForAccount\(/);
  assert.match(block, /resetAccountDeviceSessions\(/);
  assert.match(block, /reason:\s*'devices_reset'/);
  assert.doesNotMatch(block, /reason:\s*'account_locked'/);
  assert.match(block, /emitUser\(io,\s*student\._id,\s*'auth:forceLogout'/);
  assert.doesNotMatch(block, /\bio\.emit\('auth:forceLogout'/);

  const tabSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'client', 'src', 'components', 'admin', 'tabs', 'AdminStudentsTab.jsx'),
    'utf8',
  );
  const modalSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'client', 'src', 'components', 'StudentDetailModal.jsx'),
    'utf8',
  );
  assert.match(tabSrc, /Xóa toàn bộ lịch sử thiết bị đã đăng nhập/);
  assert.match(modalSrc, /Xóa toàn bộ lịch sử thiết bị đã đăng nhập/);
});

test('POST /api/dewskill-students/:id/reset-devices clears RegisteredDevice slots, sessions, and UI exposes reset', () => {
  const routesSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'routes', 'dewskillStudentRoutes.js'), 'utf8');
  assert.match(routesSrc, /RegisteredDevice\.find\(/);

  const start = routesSrc.indexOf("router.post('/:id/reset-devices'");
  const end = routesSrc.indexOf("router.delete('/:id'", start);
  assert.ok(start !== -1 && end > start, 'dewskill reset-devices route block must exist before DELETE /:id');
  const block = routesSrc.slice(start, end);

  assert.match(block, /DEWSKILL_STUDENT_FILTER/);
  assert.match(block, /knownDevices:\s*\[\]/);
  assert.match(block, /knownDeviceCount:\s*0/);
  assert.match(block, /\$inc:\s*\{\s*tokenVersion:\s*1\s*\}/);
  assert.match(block, /\$unset:\s*\{[^}]*refreshToken[^}]*deviceFingerprint/);
  assert.match(block, /resetRegisteredDevicesForAccount\(/);
  assert.match(block, /resetAccountDeviceSessions\(/);
  assert.match(block, /reason:\s*'devices_reset'/);
  assert.match(block, /emitUser\(io,\s*student\._id,\s*'auth:forceLogout'/);
  assert.doesNotMatch(block, /\bio\.emit\('auth:forceLogout'/);

  const dewskillTabSrc = fs.readFileSync(
    path.join(__dirname, '..', '..', 'client', 'src', 'components', 'admin', 'tabs', 'AdminDewskillStudentsTab.jsx'),
    'utf8',
  );
  assert.match(dewskillTabSrc, /dewskillStudentApi\.resetDevices\(/);
  assert.match(dewskillTabSrc, /MoreVertical/);
  assert.match(dewskillTabSrc, /Reset thiết bị/);
  assert.match(dewskillTabSrc, /Xóa toàn bộ lịch sử thiết bị đã đăng nhập/);
});
