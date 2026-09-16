'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  destructiveResetGuard,
  isDestructiveResetAllowed,
} = require('../../middleware/destructiveResetGuard');

function fakeRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

test('isDestructiveResetAllowed: non-production always allows (dev/test convenience)', () => {
  assert.equal(isDestructiveResetAllowed({ NODE_ENV: 'development' }), true);
  assert.equal(isDestructiveResetAllowed({ NODE_ENV: 'test' }), true);
  assert.equal(isDestructiveResetAllowed({}), true);
});

test('isDestructiveResetAllowed: production + flag=false denies (Test A)', () => {
  assert.equal(
    isDestructiveResetAllowed({ NODE_ENV: 'production', ALLOW_DESTRUCTIVE_RESET: 'false' }),
    false,
  );
});

test('isDestructiveResetAllowed: production + flag missing denies (Test B)', () => {
  assert.equal(isDestructiveResetAllowed({ NODE_ENV: 'production' }), false);
});

test('isDestructiveResetAllowed: production + flag=true allows explicit opt-in', () => {
  assert.equal(
    isDestructiveResetAllowed({ NODE_ENV: 'production', ALLOW_DESTRUCTIVE_RESET: 'true' }),
    true,
  );
  assert.equal(
    isDestructiveResetAllowed({ NODE_ENV: 'production', ALLOW_DESTRUCTIVE_RESET: '1' }),
    true,
  );
});

test('isDestructiveResetAllowed: production + garbage value denies (fail closed)', () => {
  assert.equal(
    isDestructiveResetAllowed({ NODE_ENV: 'production', ALLOW_DESTRUCTIVE_RESET: 'yes-please' }),
    false,
  );
});

test('destructiveResetGuard: blocks with 403 in production when flag is false (Test A)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ALLOW_DESTRUCTIVE_RESET;
  process.env.NODE_ENV = 'production';
  process.env.ALLOW_DESTRUCTIVE_RESET = 'false';

  let nextCalled = false;
  const res = fakeRes();
  try {
    destructiveResetGuard({}, res, () => { nextCalled = true; });
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.ALLOW_DESTRUCTIVE_RESET;
    else process.env.ALLOW_DESTRUCTIVE_RESET = originalFlag;
  }

  assert.equal(nextCalled, false, 'next() must not be called — no route handler, no deleteMany() reached');
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, 'DESTRUCTIVE_RESET_DISABLED');
});

test('destructiveResetGuard: blocks with 403 in production when flag is entirely unset (Test B)', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ALLOW_DESTRUCTIVE_RESET;
  process.env.NODE_ENV = 'production';
  delete process.env.ALLOW_DESTRUCTIVE_RESET;

  let nextCalled = false;
  const res = fakeRes();
  try {
    destructiveResetGuard({}, res, () => { nextCalled = true; });
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.ALLOW_DESTRUCTIVE_RESET;
    else process.env.ALLOW_DESTRUCTIVE_RESET = originalFlag;
  }

  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'DESTRUCTIVE_RESET_DISABLED');
});

test('destructiveResetGuard: calls next() (does not block) outside production', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalFlag = process.env.ALLOW_DESTRUCTIVE_RESET;
  process.env.NODE_ENV = 'test';
  delete process.env.ALLOW_DESTRUCTIVE_RESET;

  let nextCalled = false;
  const res = fakeRes();
  try {
    destructiveResetGuard({}, res, () => { nextCalled = true; });
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.ALLOW_DESTRUCTIVE_RESET;
    else process.env.ALLOW_DESTRUCTIVE_RESET = originalFlag;
  }

  assert.equal(nextCalled, true);
  assert.equal(res.statusCode, null, 'res.status() must never be called when allowed');
});
