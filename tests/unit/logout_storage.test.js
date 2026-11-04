'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const ROOT = path.join(__dirname, '../..');

function storageStub(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get length() { return store.size; },
    key: (i) => [...store.keys()][i] ?? null,
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

test('logout keeps pinned menu, PIN lock and device prefs but clears session data', async () => {
  globalThis.localStorage = storageStub({
    cms_sidebar_pinned: '1',
    cms_sidebar_groups: '{"admin":true}',
    'cms_pin_lock:student:42': '{"salt":"s","hash":"h","timeoutMinutes":5}',
    'cms_pin_last_active:student:42': '123',
    'cms_pin_locked:student:42': '1',
    cms_device_id_v1: 'device-1',
    'cms_login_alert_v2_42': '1',
    thvp_muted: 'true',
    student_access_token: 'secret-token',
    student_user: '{"id":"42"}',
    thvp_messages: '[{"content":"private"}]',
    cms_fm_draft_v1_conv: 'draft text',
  });
  globalThis.sessionStorage = storageStub({ tab: 'x' });

  const { clearStorageKeepingPreferences } = await import(
    pathToFileURL(path.join(ROOT, 'client/src/utils/logoutStorage.js')).href
  );
  clearStorageKeepingPreferences();

  const kept = Object.fromEntries(globalThis.localStorage.store);
  assert.deepEqual(Object.keys(kept).sort(), [
    'cms_device_id_v1',
    'cms_login_alert_v2_42',
    'cms_pin_lock:student:42',
    'cms_sidebar_groups',
    'cms_sidebar_pinned',
    'thvp_muted',
  ]);
  assert.equal(kept.cms_sidebar_pinned, '1');
  assert.equal(globalThis.sessionStorage.length, 0);
});

test('web logout paths use the preference-preserving cleanup', () => {
  for (const file of ['client/src/App.jsx', 'client/src/components/TeacherTest.jsx']) {
    const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
    assert.ok(src.includes('clearStorageKeepingPreferences()'), file);
    assert.ok(!src.includes('localStorage.clear()'), file);
  }
});
