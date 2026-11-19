'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

function installBrowserMocks(initialStorage = {}) {
  const store = new Map(Object.entries(initialStorage));
  const sessionMap = new Map([['temp', '1']]);

  globalThis.localStorage = {
    get length() { return store.size; },
    key(idx) { return Array.from(store.keys())[idx] ?? null; },
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(String(k), String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); },
  };
  globalThis.sessionStorage = {
    clear() { sessionMap.clear(); },
  };
  Object.defineProperty(globalThis, 'window', {
    value: { screen: { width: 1920, height: 1080, colorDepth: 24 } },
    configurable: true,
    writable: true,
  });
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', platform: 'Win32' },
    configurable: true,
    writable: true,
  });
  return store;
}

test('clearStorageKeepingPreferences preserves Web & Mobile device secrets across logout', async () => {
  const store = installBrowserMocks({
    cms_device_id_v1: 'dev-hw-1',
    cms_device_secret_v1: 'secret-global',
    'cms_device_secret_v1:student:0372496936': 'secret-stu-a',
    'cms_device_secret_v1:teacher:0900000001': 'secret-tea-b',
    cms_registered_device_key_v1: 'mob-key-1',
    cms_registered_device_secret_v1: 'mob-secret-global',
    'cms_registered_device_secret_v1:student:0372496936': 'mob-secret-a',
    student_access_token: 'jwt-to-clear',
    student_refresh_token: 'refresh-to-clear',
    student_user: '{"id":"1"}',
  });

  const logoutUrl = pathToFileURL(
    path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'logoutStorage.js'),
  ).href;
  const { clearStorageKeepingPreferences } = await import(`${logoutUrl}?v=${Date.now()}`);

  clearStorageKeepingPreferences();

  assert.equal(store.get('cms_device_id_v1'), 'dev-hw-1');
  assert.equal(store.get('cms_device_secret_v1'), 'secret-global');
  assert.equal(store.get('cms_device_secret_v1:student:0372496936'), 'secret-stu-a');
  assert.equal(store.get('cms_device_secret_v1:teacher:0900000001'), 'secret-tea-b');
  assert.equal(store.get('cms_registered_device_key_v1'), 'mob-key-1');
  assert.equal(store.get('cms_registered_device_secret_v1'), 'mob-secret-global');
  assert.equal(store.get('cms_registered_device_secret_v1:student:0372496936'), 'mob-secret-a');
  assert.equal(store.has('student_access_token'), false);
  assert.equal(store.has('student_refresh_token'), false);
  assert.equal(store.has('student_user'), false);
});

test('deviceFingerprint scopes deviceSecret per account so logging into a second account does not clobber the first', async () => {
  installBrowserMocks();
  const fpUrl = pathToFileURL(
    path.join(__dirname, '..', '..', 'client', 'src', 'utils', 'deviceFingerprint.js'),
  ).href;
  const { getDeviceAuthFields, rememberDeviceSecret } = await import(`${fpUrl}?v=${Date.now()}`);

  rememberDeviceSecret('secret-account-1', { role: 'student', identifier: '0372496936' });
  rememberDeviceSecret('secret-account-2', { role: 'student', identifier: '0911111111' });

  const fields1 = getDeviceAuthFields({ role: 'student', identifier: '0372496936' });
  const fields2 = getDeviceAuthFields({ role: 'student', identifier: '0911111111' });

  assert.equal(fields1.deviceSecret, 'secret-account-1');
  assert.equal(fields2.deviceSecret, 'secret-account-2');
  assert.equal(fields1.deviceKey, fields2.deviceKey);
});

test('Web auth components use clearStorageKeepingPreferences, save FreePortal deviceSecret, and guard re-enroll button', () => {
  const root = path.join(__dirname, '..', '..');
  const loginSrc = fs.readFileSync(path.join(root, 'client', 'src', 'components', 'LoginPage.jsx'), 'utf8');
  const freeSrc = fs.readFileSync(path.join(root, 'client', 'src', 'components', 'FreePortalPage.jsx'), 'utf8');
  const stuProf = fs.readFileSync(path.join(root, 'client', 'src', 'components', 'student', 'StudentProfileTab.jsx'), 'utf8');
  const teaProf = fs.readFileSync(path.join(root, 'client', 'src', 'components', 'teacher', 'TeacherProfileTab.jsx'), 'utf8');

  assert.match(loginSrc, /getDeviceAuthFields\(deviceScope\)/);
  assert.match(loginSrc, /rememberDeviceSecret\(data\.data\?\.deviceSecret,\s*deviceScope\)/);
  assert.match(loginSrc, /DEVICE_PROOF_INVALID/);
  assert.match(loginSrc, /\)\s*:\s*reEnrollError\s*&&\s*\(/);

  assert.match(freeSrc, /getDeviceAuthFields\(deviceScope\)/);
  assert.match(freeSrc, /rememberDeviceSecret\(data\?\.deviceSecret,\s*scope\)/);

  assert.doesNotMatch(stuProf, /localStorage\.clear\(/);
  assert.doesNotMatch(teaProf, /localStorage\.clear\(/);
  assert.match(stuProf, /clearStorageKeepingPreferences\(/);
  assert.match(teaProf, /clearStorageKeepingPreferences\(/);
});
