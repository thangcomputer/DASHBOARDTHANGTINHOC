'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const NotificationService = require('../../services/NotificationService');
const {
  detectDeviceType,
  detectOsFamily,
  consolidateKnownDevices,
  recordStudentKnownDevice,
  notifyIfNewStudentDevice,
  buildStudentLockedResponse,
} = require('../../services/studentKnownDevices');
const authRouter = require('../../routes/authRoutes');

const UA_LAPTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
const UA_LAPTOP_2 = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36';
const UA_PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const UA_TABLET = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1';
const UA_ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 13; SM-T870) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36';

function makeStudent(overrides = {}) {
  return {
    _id: '65f000000000000000000101',
    name: 'NGUYEN VAN A',
    phone: '0912345678',
    branchId: null,
    knownDevices: [],
    knownDeviceCount: 0,
    knownDeviceSummary: '',
    accountLocked: false,
    accountLockReason: '',
    tokenVersion: 1,
    refreshToken: 'refresh-tok',
    deviceFingerprint: 'fp-laptop-1',
    markModified() {},
    async save() { return this; },
    ...overrides,
  };
}

test('detectDeviceType distinguishes Laptop, Dien thoai, and Tablet accurately', () => {
  assert.deepEqual(detectDeviceType(UA_LAPTOP), { deviceType: 'laptop', deviceLabel: 'Laptop' });
  assert.deepEqual(detectDeviceType(UA_PHONE), { deviceType: 'phone', deviceLabel: 'Điện thoại' });
  assert.deepEqual(detectDeviceType(UA_TABLET), { deviceType: 'tablet', deviceLabel: 'Tablet' });
  assert.deepEqual(detectDeviceType(UA_ANDROID_TABLET), { deviceType: 'tablet', deviceLabel: 'Tablet' });
  assert.deepEqual(detectDeviceType('', 'android'), { deviceType: 'phone', deviceLabel: 'Điện thoại' });
});

test('Same known device logging in from multiple different IPs/locations is allowed without lock or alert', () => {
  const student = makeStudent();

  const first = recordStudentKnownDevice(student, 'fp-laptop-1', { userAgent: UA_LAPTOP, ip: '14.161.10.5' });
  assert.equal(first.isNew, true);
  assert.equal(first.shouldAlert, false);
  assert.equal(first.shouldLock, false);

  const cafe = recordStudentKnownDevice(student, 'fp-laptop-1', { userAgent: UA_LAPTOP, ip: '171.244.8.20' });
  assert.equal(cafe.isNew, false);
  assert.equal(cafe.locationChanged, true);
  assert.equal(cafe.shouldAlert, false);
  assert.equal(cafe.shouldLock, false);

  const school = recordStudentKnownDevice(student, 'fp-laptop-1', { userAgent: UA_LAPTOP, ip: '27.72.90.3' });
  assert.equal(school.isNew, false);
  assert.equal(school.shouldAlert, false);
  assert.equal(school.shouldLock, false);
  assert.equal(student.accountLocked, false);
  assert.equal(student.knownDeviceCount, 1);
  assert.deepEqual(student.knownDevices[0].locations, ['14.161.10.0/24', '171.244.8.0/24', '27.72.90.0/24']);
});

test('Student logging in across 3 distinct device types (Laptop, Phone, Tablet) notifies Admin without locking', async () => {
  const notifications = [];
  const origNotify = NotificationService.notifyBranchAdmins;
  NotificationService.notifyBranchAdmins = async (_io, opts) => { notifications.push(opts); };

  try {
    const student = makeStudent();

    const r1 = recordStudentKnownDevice(student, 'fp-laptop', { userAgent: UA_LAPTOP, ip: '14.161.10.5' });
    const r2 = recordStudentKnownDevice(student, 'fp-phone', { userAgent: UA_PHONE, ip: '171.244.8.20' });
    const r3 = recordStudentKnownDevice(student, 'fp-tablet', { userAgent: UA_TABLET, ip: '27.72.90.3' });

    assert.equal(r1.shouldAlert, false);
    assert.equal(r2.shouldAlert, false);
    assert.equal(r3.isNew, true);
    assert.equal(r3.count, 3);
    assert.equal(r3.shouldAlert, true);
    assert.equal(r3.shouldLock, false);
    assert.equal(student.accountLocked, false);
    assert.equal(student.knownDeviceSummary, 'Laptop, Điện thoại, Tablet');

    await notifyIfNewStudentDevice(null, student, r3);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0].title, /3 thiết bị/i);
    assert.equal(notifications[0].payload.locked, false);
    assert.equal(notifications[0].payload.deviceSummary, 'Laptop, Điện thoại, Tablet');
  } finally {
    NotificationService.notifyBranchAdmins = origNotify;
  }
});

test('Locks student account when 3rd device duplicates a type at a different location or on 4th device', async () => {
  const notifications = [];
  const origNotify = NotificationService.notifyBranchAdmins;
  NotificationService.notifyBranchAdmins = async (_io, opts) => { notifications.push(opts); };

  try {
    // Scenario A: Laptop + Phone + another Laptop at different location -> lock
    const studentA = makeStudent();
    recordStudentKnownDevice(studentA, 'fp-laptop-1', { userAgent: UA_LAPTOP, ip: '14.161.10.5' });
    recordStudentKnownDevice(studentA, 'fp-phone-1', { userAgent: UA_PHONE, ip: '14.161.10.9' });
    const abnormal3 = recordStudentKnownDevice(studentA, 'fp-laptop-2', { userAgent: UA_LAPTOP_2, ip: '203.113.50.9' });

    assert.equal(abnormal3.shouldAlert, true);
    assert.equal(abnormal3.shouldLock, true);
    assert.equal(abnormal3.reason, 'abnormal_device_location');
    assert.equal(studentA.accountLocked, true);
    assert.ok(studentA.accountLockReason);

    await notifyIfNewStudentDevice(null, studentA, abnormal3);
    assert.equal(notifications.length, 1);
    assert.match(notifications[0].title, /Tự động khóa/i);
    assert.equal(notifications[0].payload.locked, true);

    const lockedPayload = buildStudentLockedResponse(studentA);
    assert.equal(lockedPayload.code, 'ACCOUNT_LOCKED');
    assert.equal(lockedPayload.isBan, true);

    // Scenario B: Laptop + Phone + Tablet (valid 3) -> then 4th device -> lock
    const studentB = makeStudent();
    recordStudentKnownDevice(studentB, 'fp-laptop', { userAgent: UA_LAPTOP, ip: '14.161.10.5' });
    recordStudentKnownDevice(studentB, 'fp-phone', { userAgent: UA_PHONE, ip: '14.161.10.6' });
    const valid3 = recordStudentKnownDevice(studentB, 'fp-tablet', { userAgent: UA_TABLET, ip: '14.161.10.7' });
    assert.equal(valid3.shouldLock, false);

    const fourth = recordStudentKnownDevice(studentB, 'fp-laptop-other', { userAgent: UA_LAPTOP_2, ip: '203.113.50.9' });
    assert.equal(fourth.shouldAlert, true);
    assert.equal(fourth.shouldLock, true);
    assert.equal(studentB.accountLocked, true);
  } finally {
    NotificationService.notifyBranchAdmins = origNotify;
  }
});

test('enforceStudentDeviceLockIfNeeded revokes state and returns 403 ACCOUNT_LOCKED', async () => {
  const notifications = [];
  const emitted = [];
  const origNotify = NotificationService.notifyBranchAdmins;
  NotificationService.notifyBranchAdmins = async (_io, opts) => { notifications.push(opts); };

  try {
    let saved = false;
    const student = makeStudent({
      async save() { saved = true; return this; },
    });
    recordStudentKnownDevice(student, 'fp-laptop-1', { userAgent: UA_LAPTOP, ip: '14.161.10.5' });
    recordStudentKnownDevice(student, 'fp-phone-1', { userAgent: UA_PHONE, ip: '14.161.10.9' });
    const record = recordStudentKnownDevice(student, 'fp-laptop-2', { userAgent: UA_LAPTOP_2, ip: '203.113.50.9' });

    const req = {
      app: {
        get(name) {
          if (name !== 'io') return null;
          return {
            in() { return { emit() {}, disconnectSockets() {} }; },
            emit(event, payload) { emitted.push({ event, payload }); },
          };
        },
      },
    };
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(body) { jsonBody = body; return this; },
    };

    const locked = await authRouter._test.enforceStudentDeviceLockIfNeeded(req, res, student, 'student', record);
    await new Promise((r) => setImmediate(r));

    assert.equal(locked, true);
    assert.equal(saved, true);
    assert.equal(student.accountLocked, true);
    assert.equal(student.tokenVersion, 2);
    assert.equal(student.refreshToken, undefined);
    assert.equal(student.deviceFingerprint, undefined);
    assert.equal(statusCode, 403);
    assert.equal(jsonBody?.code, 'ACCOUNT_LOCKED');
    assert.ok(emitted.some((e) => e.event === 'auth:forceLogout' && e.payload.userId === student._id));
    assert.equal(notifications.length, 1);
  } finally {
    NotificationService.notifyBranchAdmins = origNotify;
  }
});

test('Multiple browsers on the same device (Chrome, Edge, Firefox, Coc Coc, Incognito) count as 1 device', () => {
  const UA_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';
  const UA_EDGE = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
  const UA_FIREFOX = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
  const UA_COCCOC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 coc_coc_browser/130.0 Safari/537.36';

  assert.equal(detectOsFamily(UA_CHROME), 'windows');
  assert.equal(detectOsFamily(UA_EDGE), 'windows');
  assert.equal(detectOsFamily(UA_FIREFOX), 'windows');
  assert.equal(detectOsFamily(UA_COCCOC), 'windows');

  const student = makeStudent();

  const b1 = recordStudentKnownDevice(student, 'fp-chrome-old', { userAgent: UA_CHROME, ip: '14.161.10.5' });
  const b2 = recordStudentKnownDevice(student, 'fp-edge-old', { userAgent: UA_EDGE, ip: '14.161.10.5' });
  const b3 = recordStudentKnownDevice(student, 'fp-firefox-old', { userAgent: UA_FIREFOX, ip: '14.161.10.9' });
  const b4 = recordStudentKnownDevice(student, 'fp-coccoc-old', { userAgent: UA_COCCOC, ip: '14.161.10.12' });
  const b5 = recordStudentKnownDevice(student, 'fp-incognito-old', { userAgent: UA_CHROME, ip: '127.0.0.1' });

  for (const res of [b2, b3, b4, b5]) {
    assert.equal(res.isNew, false);
    assert.equal(res.shouldAlert, false);
    assert.equal(res.shouldLock, false);
    assert.equal(res.count, 1);
  }
  assert.equal(b1.count, 1);
  assert.equal(student.knownDeviceCount, 1);
  assert.equal(student.knownDevices.length, 1);
  assert.equal(student.accountLocked, false);
  assert.equal(student.knownDevices[0].fingerprints.length, 5);

  // Sau khi mang máy đó sang quán cafe (IP mới) và mở bằng Firefox (fingerprint đã ghi nhận trên thiết bị này) -> vẫn tính là 1 thiết bị
  const cafeFirefox = recordStudentKnownDevice(student, 'fp-firefox-old', { userAgent: UA_FIREFOX, ip: '171.244.8.20' });
  assert.equal(cafeFirefox.isNew, false);
  assert.equal(cafeFirefox.shouldAlert, false);
  assert.equal(cafeFirefox.shouldLock, false);
  assert.equal(cafeFirefox.count, 1);
  assert.equal(student.knownDevices.length, 1);
});

test('consolidateKnownDevices merges legacy multi-browser entries from the same device into 1', () => {
  const consolidated = consolidateKnownDevices([
    { fingerprint: 'legacy-1', userAgent: UA_LAPTOP, deviceType: 'laptop', ip: '14.161.10.5', networkKey: '14.161.10.0/24', locations: ['14.161.10.0/24'] },
    { fingerprint: 'legacy-2', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0', deviceType: 'laptop', ip: '14.161.10.8', networkKey: '14.161.10.0/24', locations: ['14.161.10.0/24'] },
    { fingerprint: 'legacy-3', userAgent: UA_LAPTOP, deviceType: 'laptop', ip: '127.0.0.1', networkKey: 'local', locations: ['local'] },
    { fingerprint: 'phone-1', userAgent: UA_PHONE, deviceType: 'phone', ip: '171.244.8.20', networkKey: '171.244.8.0/24', locations: ['171.244.8.0/24'] },
  ]);

  assert.equal(consolidated.length, 2);
  assert.equal(consolidated[0].deviceType, 'laptop');
  assert.deepEqual(consolidated[0].fingerprints, ['legacy-1', 'legacy-2', 'legacy-3']);
  assert.equal(consolidated[1].deviceType, 'phone');
});


