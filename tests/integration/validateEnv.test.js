const test = require('node:test');
const assert = require('node:assert/strict');

function freshValidateEnv() {
  delete require.cache[require.resolve('../../config/validateEnv')];
  return require('../../config/validateEnv');
}

const STRONG = 'a'.repeat(40);
const STRONG2 = 'b'.repeat(40);

test.beforeEach(() => {
  process.env.MASTER_ADMIN_PHONE = '0900000001';
});

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

test('validateEnv: rejects short refresh secret', () => {
  process.env.NODE_ENV = 'development';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = 'tiny';
  assert.throws(() => freshValidateEnv()(), /JWT_REFRESH_SECRET must be at least/);
});

test('validateEnv: requires CLIENT_URL in production', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  delete process.env.CLIENT_URL;
  assert.throws(() => freshValidateEnv()(), /CLIENT_URL is required/);
});

test('validateEnv: passes with strong distinct secrets and CLIENT_URL', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  process.env.CLIENT_URL = 'https://example.com';
  process.env.SEPAY_API_KEY = 'test-sepay-key';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user';
  process.env.SMTP_PASS = 'pass';
  assert.doesNotThrow(() => freshValidateEnv()());
});

test('validateEnv: production requires a valid MASTER_ADMIN_PHONE', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  process.env.CLIENT_URL = 'https://example.com';
  delete process.env.MASTER_ADMIN_PHONE;
  assert.throws(() => freshValidateEnv()(), /MASTER_ADMIN_PHONE/);
});

test('validateEnv: requires REDIS_URL in production', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  process.env.CLIENT_URL = 'https://example.com';
  process.env.SEPAY_API_KEY = 'test-sepay-key';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user';
  process.env.SMTP_PASS = 'pass';
  delete process.env.REDIS_URL;
  assert.throws(() => freshValidateEnv()(), /REDIS_URL is required/);
});

test('validateEnv: requires SePay key in production', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  process.env.CLIENT_URL = 'https://example.com';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  delete process.env.SEPAY_API_KEY;
  delete process.env.SEPAY_SECRET_KEY;
  assert.throws(() => freshValidateEnv()(), /SEPAY_API_KEY or SEPAY_SECRET_KEY/);
});

test('validateEnv: production requires longer (>=32) secrets', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'a'.repeat(20);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(20);
  process.env.CLIENT_URL = 'https://example.com';
  assert.throws(() => freshValidateEnv()(), /at least 32 characters/);
});

test('validateEnv: CQRS in production without ALLOW forces legacy (no crash)', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  process.env.CLIENT_URL = 'https://example.com';
  process.env.SEPAY_API_KEY = 'test-sepay-key';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user';
  process.env.SMTP_PASS = 'pass';
  process.env.ENABLE_CQRS_STUDENT_CREATE = 'true';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/db?replicaSet=rs0';
  delete process.env.ALLOW_CQRS_IN_PRODUCTION;
  assert.doesNotThrow(() => freshValidateEnv()());
  assert.equal(process.env.ENABLE_CQRS_STUDENT_CREATE, 'false');
  assert.equal(process.env.ENABLE_CQRS, 'false');
  delete process.env.ENABLE_CQRS_STUDENT_CREATE;
  delete process.env.ENABLE_CQRS;
});

test('validateEnv: CQRS without opt-in / without RS forces legacy (no crash)', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  process.env.CLIENT_URL = 'https://example.com';
  process.env.SEPAY_API_KEY = 'test-sepay-key';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user';
  process.env.SMTP_PASS = 'pass';
  process.env.ENABLE_CQRS_STUDENT_CREATE = 'true';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/dashboardthangtinhoc';
  delete process.env.ALLOW_CQRS_IN_PRODUCTION;
  assert.doesNotThrow(() => freshValidateEnv()());
  assert.equal(process.env.ENABLE_CQRS_STUDENT_CREATE, 'false');
  delete process.env.ENABLE_CQRS_STUDENT_CREATE;
  delete process.env.ENABLE_CQRS;
});

test('validateEnv: CQRS with ALLOW but no replicaSet forces legacy (no crash)', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  process.env.CLIENT_URL = 'https://example.com';
  process.env.SEPAY_API_KEY = 'test-sepay-key';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user';
  process.env.SMTP_PASS = 'pass';
  process.env.ALLOW_CQRS_IN_PRODUCTION = 'true';
  process.env.ENABLE_CQRS_STUDENT_CREATE = 'true';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/dashboardthangtinhoc';
  assert.doesNotThrow(() => freshValidateEnv()());
  assert.equal(process.env.ENABLE_CQRS_STUDENT_CREATE, 'false');
  delete process.env.ENABLE_CQRS_STUDENT_CREATE;
  delete process.env.ALLOW_CQRS_IN_PRODUCTION;
  delete process.env.ENABLE_CQRS;
});
test('validateEnv: CQRS accepts replicaSet URI in production only with ALLOW opt-in', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  process.env.CLIENT_URL = 'https://example.com';
  process.env.SEPAY_API_KEY = 'test-sepay-key';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user';
  process.env.SMTP_PASS = 'pass';
  process.env.ALLOW_CQRS_IN_PRODUCTION = 'true';
  process.env.ENABLE_CQRS_STUDENT_CREATE = 'true';
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/db?replicaSet=rs0';
  assert.doesNotThrow(() => freshValidateEnv()());
  delete process.env.ENABLE_CQRS_STUDENT_CREATE;
  delete process.env.ALLOW_CQRS_IN_PRODUCTION;
});

test('validateEnv: CQRS accepts mongodb+srv with ALLOW opt-in', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  process.env.CLIENT_URL = 'https://example.com';
  process.env.SEPAY_API_KEY = 'test-sepay-key';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user';
  process.env.SMTP_PASS = 'pass';
  process.env.ALLOW_CQRS_IN_PRODUCTION = 'true';
  process.env.ENABLE_CQRS_INVOICE = 'true';
  process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/db';
  assert.doesNotThrow(() => freshValidateEnv()());
  delete process.env.ENABLE_CQRS_INVOICE;
  delete process.env.ALLOW_CQRS_IN_PRODUCTION;
});

test('validateEnv: production with all CQRS flags OFF passes without ALLOW opt-in', () => {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = STRONG;
  process.env.JWT_REFRESH_SECRET = STRONG2;
  process.env.CLIENT_URL = 'https://example.com';
  process.env.SEPAY_API_KEY = 'test-sepay-key';
  process.env.REDIS_URL = 'redis://127.0.0.1:6379';
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user';
  process.env.SMTP_PASS = 'pass';
  process.env.ENABLE_CQRS_TEACHER = 'false';
  process.env.ENABLE_CQRS_STUDENT_CREATE = 'false';
  process.env.ENABLE_CQRS_INVOICE = 'false';
  delete process.env.ALLOW_CQRS_IN_PRODUCTION;
  assert.doesNotThrow(() => freshValidateEnv()());
});
