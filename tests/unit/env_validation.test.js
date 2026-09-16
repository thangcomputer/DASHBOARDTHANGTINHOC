'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

function freshValidateEnv() {
  delete require.cache[require.resolve('../../config/validateEnv')];
  return require('../../config/validateEnv');
}

const STRONG_JWT = 'j'.repeat(40);
const STRONG_REFRESH = 'r'.repeat(40);
const STRONG_SESSION = 's'.repeat(40);

const MANAGED_KEYS = [
  'NODE_ENV',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'SESSION_SECRET',
  'MASTER_ADMIN_PHONE',
  'MASTER_ADMIN_PASSWORD',
  'CLIENT_URL',
  'SEPAY_API_KEY',
  'SEPAY_SECRET_KEY',
  'REDIS_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
];

let savedEnv;

beforeEach(() => {
  savedEnv = {};
  for (const key of MANAGED_KEYS) savedEnv[key] = process.env[key];

  // Valid production baseline; individual tests override the field under test.
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG_JWT;
  process.env.JWT_REFRESH_SECRET = STRONG_REFRESH;
  process.env.SESSION_SECRET = STRONG_SESSION;
  process.env.MASTER_ADMIN_PHONE = '0900000001';
  delete process.env.MASTER_ADMIN_PASSWORD;
  process.env.CLIENT_URL = 'https://example.com';
  process.env.SEPAY_API_KEY = 'test-sepay-key';
  process.env.SEPAY_SECRET_KEY = 'test-sepay-secret';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user';
  process.env.SMTP_PASS = 'pass';
});

afterEach(() => {
  for (const key of MANAGED_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

describe('config/validateEnv — Phase 2 secrets & environment hardening', () => {
  it('Test 1: production + missing JWT_SECRET fails', () => {
    delete process.env.JWT_SECRET;
    assert.throws(() => freshValidateEnv()(), /JWT_SECRET must be at least/);
  });

  it('Test 2: production + JWT_SECRET=secret fails', () => {
    process.env.JWT_SECRET = 'secret';
    assert.throws(() => freshValidateEnv()(), /JWT_SECRET must not use a known insecure\/default value/);
  });

  it('Test 3: production + missing JWT_REFRESH_SECRET fails', () => {
    delete process.env.JWT_REFRESH_SECRET;
    assert.throws(() => freshValidateEnv()(), /JWT_REFRESH_SECRET must be at least/);
  });

  it('Test 4: production + JWT_REFRESH_SECRET=refresh_secret fails', () => {
    process.env.JWT_REFRESH_SECRET = 'refresh_secret';
    assert.throws(() => freshValidateEnv()(), /JWT_REFRESH_SECRET must not use a known insecure\/default value/);
  });

  it('Test 5: production + missing SESSION_SECRET fails', () => {
    delete process.env.SESSION_SECRET;
    assert.throws(() => freshValidateEnv()(), /SESSION_SECRET must be at least/);
  });

  it('Test 6: production + SESSION_SECRET=session_secret fails', () => {
    process.env.SESSION_SECRET = 'session_secret';
    assert.throws(() => freshValidateEnv()(), /SESSION_SECRET must not use a known insecure\/default value/);
  });

  it('Test 7: production + valid strong values passes', () => {
    assert.doesNotThrow(() => freshValidateEnv()());
  });

  it('Test 8: whitespace-only SESSION_SECRET fails', () => {
    process.env.SESSION_SECRET = '   ';
    assert.throws(() => freshValidateEnv()(), /SESSION_SECRET must be at least/);
  });

  it('Test 8b: whitespace-only JWT_SECRET fails', () => {
    process.env.JWT_SECRET = '   ';
    assert.throws(() => freshValidateEnv()(), /JWT_SECRET must be at least/);
  });

  it('Test 9: .env.example placeholder values cannot pass production validation', () => {
    // These are exactly the blank/known-bad values .env.example ships with.
    process.env.JWT_SECRET = '';
    assert.throws(() => freshValidateEnv()(), /JWT_SECRET must be at least/);

    process.env.JWT_SECRET = STRONG_JWT;
    process.env.SESSION_SECRET = '';
    assert.throws(() => freshValidateEnv()(), /SESSION_SECRET must be at least/);

    process.env.SESSION_SECRET = STRONG_SESSION;
    process.env.MASTER_ADMIN_PASSWORD = 'admin123';
    assert.throws(() => freshValidateEnv()(), /MASTER_ADMIN_PASSWORD must not use a known insecure\/default value/);
  });

  it('Test 10: validation error must never contain the actual secret value', () => {
    process.env.JWT_SECRET = 'super-leaked-value-should-not-appear-anywhere';
    try {
      freshValidateEnv()();
      assert.fail('expected validateEnv to throw');
    } catch (err) {
      assert.equal(err.message.includes('super-leaked-value-should-not-appear-anywhere'), false);
    }
  });

  it('Master Admin: MASTER_ADMIN_PASSWORD is not required in production', () => {
    delete process.env.MASTER_ADMIN_PASSWORD;
    assert.doesNotThrow(() => freshValidateEnv()());
  });

  it('Master Admin: MASTER_ADMIN_PASSWORD=admin fails when set', () => {
    process.env.MASTER_ADMIN_PASSWORD = 'admin';
    assert.throws(() => freshValidateEnv()(), /MASTER_ADMIN_PASSWORD must not use a known insecure\/default value/);
  });

  it('Master Admin: MASTER_ADMIN_PASSWORD=admin123 fails when set', () => {
    process.env.MASTER_ADMIN_PASSWORD = 'admin123';
    assert.throws(() => freshValidateEnv()(), /MASTER_ADMIN_PASSWORD must not use a known insecure\/default value/);
  });

  it('Master Admin: a strong MASTER_ADMIN_PASSWORD is accepted', () => {
    process.env.MASTER_ADMIN_PASSWORD = 'a-reasonably-strong-value-123!';
    assert.doesNotThrow(() => freshValidateEnv()());
  });
});
