'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  assertTestDatabaseEnvironment,
  assertTestDatabaseResetAllowed,
  redactMongoUri,
} = require('../setup/testDatabaseGuard');

const SAFE_URI = 'mongodb://127.0.0.1:27019/dashboardthangtinhoc_phase15_test';

test('test DB guard rejects missing, runtime-equal and unsafe names', () => {
  assert.throws(
    () => assertTestDatabaseEnvironment({ NODE_ENV: 'test' }),
    /TEST_DATABASE_URI/,
  );
  assert.throws(() => assertTestDatabaseEnvironment({
    NODE_ENV: 'test',
    TEST_DATABASE_URI: SAFE_URI,
    MONGODB_URI: SAFE_URI,
    ALLOW_TEST_DB_HOST_MATCH: 'true',
  }), /không được trùng/);
  assert.throws(() => assertTestDatabaseEnvironment({
    NODE_ENV: 'test',
    TEST_DATABASE_URI: 'mongodb://127.0.0.1:27019/dashboardthangtinhoc',
  }), /Tên database test/);
});

test('test DB guard requires explicit host-match and reset opt-ins', () => {
  const env = {
    NODE_ENV: 'test',
    TEST_DATABASE_URI: SAFE_URI,
    MONGODB_URI: 'mongodb://127.0.0.1:27017/dashboardthangtinhoc',
  };
  assert.throws(() => assertTestDatabaseEnvironment(env), /Host TEST_DATABASE_URI trùng host runtime/);
  const allowed = { ...env, ALLOW_TEST_DB_HOST_MATCH: 'true' };
  assert.equal(assertTestDatabaseEnvironment(allowed).dbName, 'dashboardthangtinhoc_phase15_test');
  assert.throws(() => assertTestDatabaseResetAllowed(allowed), /ALLOW_TEST_DB_RESET/);
  assert.equal(assertTestDatabaseResetAllowed({
    ...allowed,
    ALLOW_TEST_DB_RESET: 'true',
  }).dbName, 'dashboardthangtinhoc_phase15_test');
});

test('test DB guard redacts credentials', () => {
  const redacted = redactMongoUri('mongodb://user:secret@example.test/app_test');
  assert.equal(redacted.includes('secret'), false);
  assert.equal(redacted.includes('user'), false);
});
