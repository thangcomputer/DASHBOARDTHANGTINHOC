'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '../..');
const read = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function installBrowserStubs() {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
  };
  globalThis.window = { dispatchEvent: () => true };
  globalThis.CustomEvent = class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail; } };
  return store;
}

async function loadWebPinLock() {
  return import(pathToFileURL(path.join(ROOT, 'client/src/utils/pinLock.js')).href);
}

test('web PIN lock stores only a salted hash and verifies the PIN', async () => {
  const store = installBrowserStubs();
  const pin = await loadWebPinLock();

  for (const value of ['', '123456', 'Mã PIN']) {
    assert.equal(pin.sha256Hex(value), createHash('sha256').update(value).digest('hex'));
  }

  pin.savePin('student:1', '246810', 15);
  const raw = store.get('cms_pin_lock:student:1');
  assert.ok(raw);
  assert.equal(raw.includes('246810'), false);
  assert.equal(pin.readPinConfig('student:1').timeoutMinutes, 15);
  assert.equal(pin.verifyPin('student:1', '246810'), true);
  assert.equal(pin.verifyPin('student:1', '000000'), false);
  assert.equal(pin.verifyPin('teacher:1', '246810'), false);
  assert.throws(() => pin.savePin('student:1', '12345'));

  pin.setPinTimeout('student:1', 60);
  assert.equal(pin.readPinConfig('student:1').timeoutMinutes, 60);
  pin.removePin('student:1');
  assert.equal(pin.readPinConfig('student:1'), null);
});

test('web PIN lock expires only after the chosen idle time', async () => {
  installBrowserStubs();
  const pin = await loadWebPinLock();
  const now = Date.parse('2026-11-04T05:00:00Z');
  assert.equal(pin.isIdleExpired(now - 4 * 60 * 1000, 5, now), false);
  assert.equal(pin.isIdleExpired(now - 5 * 60 * 1000, 5, now), true);
  assert.equal(pin.isIdleExpired(0, 5, now), false);
  assert.deepEqual(pin.PIN_TIMEOUT_OPTIONS.map((option) => option.minutes), [1, 5, 15, 30, 60]);
});

test('mobile PIN lock uses the same rules as web', () => {
  const web = read('client/src/utils/pinLock.js');
  const mobile = read('thang-tin-hoc-mobile/src/services/pinLock.ts');
  for (const rule of [
    'export const PIN_LENGTH = 6;',
    'export const PIN_MAX_ATTEMPTS = 5;',
    'export const PIN_DEFAULT_TIMEOUT = 5;',
    'const HASH_ROUNDS = 1000;',
    "{ minutes: 60, label: '1 giờ' }",
    'digest = sha256Hex(`${salt}:${pin}:${digest}`);',
  ]) {
    assert.ok(web.includes(rule), `web missing ${rule}`);
    assert.ok(mobile.includes(rule), `mobile missing ${rule}`);
  }
  assert.ok(mobile.includes('SecureStore.setItemAsync(key, value)'));
});

test('PIN lock is reachable from every profile and guards every signed-in screen', () => {
  const layout = read('client/src/components/DashboardLayout.jsx');
  const sidebar = read('client/src/components/AppSidebar.jsx');
  const studentProfile = read('client/src/components/student/StudentProfileTab.jsx');
  const teacherProfile = read('client/src/components/teacher/TeacherProfileTab.jsx');
  const navigator = read('thang-tin-hoc-mobile/src/navigation/RootNavigator.tsx');
  const mobileProfile = read('thang-tin-hoc-mobile/src/screens/FeatureScreens.tsx');
  const auth = read('thang-tin-hoc-mobile/src/app/AuthContext.tsx');

  assert.ok(layout.includes('<PinLockGate userKey={pinUserKey}'));
  assert.ok(layout.includes('<PinLockSettingsModal userKey={pinUserKey} />'));
  assert.ok(sidebar.includes("{ key: 'pin-lock', icon: KeyRound, label: 'Khóa mã PIN', isPinLock: true }"));
  assert.ok(studentProfile.includes('onClick={openPinLockSettings}'));
  assert.ok(teacherProfile.includes('onClick={openPinLockSettings}'));
  assert.ok(navigator.includes('<PinLockGate'));
  assert.ok(navigator.includes('onTouchStart={notePinActivity}'));
  assert.equal((mobileProfile.match(/title="Khóa mã PIN"/g) || []).length, 2);
  assert.ok(auth.includes('await clearLastActive(pinUserKey(user))'));
});
