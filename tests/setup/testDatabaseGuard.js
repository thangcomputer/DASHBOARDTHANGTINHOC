'use strict';

const { parseMongoTarget, redactMongoUri } = require('../../utils/mongoUriUtils');

function flagEnabled(value) {
  return ['1', 'true', 'yes'].includes(String(value || '').trim().toLowerCase());
}

function assertTestDatabaseEnvironment(env = process.env) {
  if (env.NODE_ENV !== 'test') {
    throw new Error('Database test chỉ được phép khi NODE_ENV=test');
  }
  const rawTestUri = String(env.TEST_DATABASE_URI || '').trim();
  if (!rawTestUri) {
    throw new Error('Thiếu TEST_DATABASE_URI; không được fallback sang MONGODB_URI');
  }

  const testTarget = parseMongoTarget(rawTestUri, 'TEST_DATABASE_URI');
  if (!/^test_/i.test(testTarget.dbName) && !/_test$/i.test(testTarget.dbName)) {
    throw new Error('Tên database test phải bắt đầu bằng test_ hoặc kết thúc bằng _test');
  }

  const runtimeUri = String(env.MONGODB_URI || '').trim();
  if (runtimeUri) {
    if (runtimeUri === rawTestUri) {
      throw new Error('TEST_DATABASE_URI không được trùng MONGODB_URI runtime');
    }
    const runtimeTarget = parseMongoTarget(runtimeUri, 'MONGODB_URI');
    if (
      runtimeTarget.hostname === testTarget.hostname
      && !flagEnabled(env.ALLOW_TEST_DB_HOST_MATCH)
    ) {
      throw new Error(
        'Host TEST_DATABASE_URI trùng host runtime; cần ALLOW_TEST_DB_HOST_MATCH=true sau khi xác nhận cách ly',
      );
    }
  }

  return testTarget;
}

function assertTestDatabaseResetAllowed(env = process.env) {
  const target = assertTestDatabaseEnvironment(env);
  if (!flagEnabled(env.ALLOW_TEST_DB_RESET)) {
    throw new Error('Cleanup database test yêu cầu ALLOW_TEST_DB_RESET=true');
  }
  return target;
}

module.exports = {
  assertTestDatabaseEnvironment,
  assertTestDatabaseResetAllowed,
  parseMongoTarget,
  redactMongoUri,
};
