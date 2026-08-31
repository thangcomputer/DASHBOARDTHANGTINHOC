'use strict';

function flagEnabled(value) {
  return ['1', 'true', 'yes'].includes(String(value || '').trim().toLowerCase());
}

function redactMongoUri(uri) {
  try {
    const parsed = new URL(String(uri || ''));
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '<invalid MongoDB URI>';
  }
}

function parseMongoTarget(uri, label) {
  let parsed;
  try {
    parsed = new URL(String(uri || ''));
  } catch {
    throw new Error(`${label} không phải MongoDB URI hợp lệ`);
  }
  if (!['mongodb:', 'mongodb+srv:'].includes(parsed.protocol)) {
    throw new Error(`${label} phải dùng mongodb:// hoặc mongodb+srv://`);
  }
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+|\/+$/g, ''));
  if (!dbName || dbName.includes('/')) {
    throw new Error(`${label} phải chỉ rõ đúng một database`);
  }
  return {
    uri: String(uri),
    dbName,
    hostname: parsed.hostname.toLowerCase(),
  };
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
