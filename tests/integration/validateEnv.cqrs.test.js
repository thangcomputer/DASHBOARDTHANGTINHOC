'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function freshValidateEnv() {
  delete require.cache[require.resolve('../../config/validateEnv')];
  delete require.cache[require.resolve('../../shared/cqrs/flags')];
  return require('../../config/validateEnv');
}

const STRONG = 'a'.repeat(40);
const STRONG2 = 'b'.repeat(40);

function setProdBase() {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  process.env.CLIENT_URL = 'https://example.com';
  process.env.SEPAY_API_KEY = 'test-sepay-key';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
}

test('validateEnv: rejects short JWT_SECRET', () => {
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = 'short';
  process.env.JWT_REFRESH_SECRET = STRONG;
  assert.throws(() => freshValidateEnv()(), /JWT_SECRET must be at least/);
});

test('validateEnv: rejects identical JWT secrets', () => {
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG;
  assert.throws(() => freshValidateEnv()(), /must not equal JWT_SECRET/);
});

test('validateEnv: CQRS in production requires replicaSet in MONGODB_URI', () => {
  setProdBase();
  process.env.ENABLE_CQRS_TEACHER = 'true';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/dashboardthangtinhoc';
  assert.throws(() => freshValidateEnv()(), /replica set/i);
  delete process.env.ENABLE_CQRS_TEACHER;
});

test('validateEnv: CQRS accepts replicaSet URI in production', () => {
  setProdBase();
  process.env.ENABLE_CQRS_TEACHER = 'true';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/db?replicaSet=rs0';
  assert.doesNotThrow(() => freshValidateEnv()());
  delete process.env.ENABLE_CQRS_TEACHER;
});

test('validateEnv: CQRS accepts mongodb+srv', () => {
  setProdBase();
  process.env.ENABLE_CQRS_INVOICE = 'true';
  process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/db';
  assert.doesNotThrow(() => freshValidateEnv()());
  delete process.env.ENABLE_CQRS_INVOICE;
});
