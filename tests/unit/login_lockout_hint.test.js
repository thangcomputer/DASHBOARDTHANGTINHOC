'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');

const {
  LOGIN_MAX_ATTEMPTS,
  LOGIN_LOCK_DURATION_SECONDS,
  getAccountLockSeconds,
  incrementAccountLoginAttempts,
  getMasterAdminLockState,
  recordMasterAdminFailure,
  resetMasterAdminFailures,
  buildTemporarilyLockedPayload,
  buildWrongPasswordPayload,
} = require('../../services/loginAttemptService');
const authRateLimit = require('../../middleware/authRateLimit');

const ROOT = path.join(__dirname, '../..');

test('incrementAccountLoginAttempts counts down remaining attempts (4..1) then locks for 900s at 5', async () => {
  const doc = { loginAttempts: 0, lockUntil: null, async updateOne() {} };
  const baseNow = Date.now();

  for (let i = 1; i <= 4; i += 1) {
    const info = await incrementAccountLoginAttempts({ doc, lockField: 'lockUntil', nowMs: baseNow });
    assert.equal(info.attempts, i);
    assert.equal(info.maxAttempts, LOGIN_MAX_ATTEMPTS);
    assert.equal(info.remainingAttempts, 5 - i);
    assert.equal(info.isLocked, false);
    assert.equal(info.lockDurationSeconds, LOGIN_LOCK_DURATION_SECONDS);

    const payload = buildWrongPasswordPayload({
      basePayload: { success: false, code: 'INVALID_CREDENTIALS', publicMessage: true, message: 'Mật khẩu không đúng.' },
      attemptInfo: info,
    });
    assert.equal(payload.remainingAttempts, 5 - i);
    assert.equal(payload.maxAttempts, 5);
    assert.equal(payload.lockDurationSeconds, 900);
    assert.equal(payload.message, 'Mật khẩu không đúng.');
  }

  const lockedInfo = await incrementAccountLoginAttempts({ doc, lockField: 'lockUntil', nowMs: baseNow });
  assert.equal(lockedInfo.isLocked, true);
  assert.equal(lockedInfo.remainingAttempts, 0);
  assert.equal(lockedInfo.lockSeconds, 900);
  assert.equal(getAccountLockSeconds(doc, 'lockUntil', baseNow + 30_000), 870);

  const lockedPayload = buildTemporarilyLockedPayload(lockedInfo);
  assert.equal(lockedPayload.code, 'LOGIN_TEMPORARILY_LOCKED');
  assert.equal(lockedPayload.publicMessage, true);
  assert.equal(lockedPayload.retryAfterSeconds, 900);
  assert.equal(lockedPayload.lockDurationSeconds, 900);
  assert.equal(lockedPayload.message, 'Sai mật khẩu quá 5 lần.');

  // After lock expires, counter restarts cleanly from 1 -> 4 remaining
  const afterExpire = await incrementAccountLoginAttempts({
    doc,
    lockField: 'lockUntil',
    nowMs: baseNow + LOGIN_LOCK_DURATION_SECONDS * 1000 + 1000,
  });
  assert.equal(afterExpire.isLocked, false);
  assert.equal(afterExpire.attempts, 1);
  assert.equal(afterExpire.remainingAttempts, 4);
});

test('MASTER_ADMIN_PHONE per-IP tracker warns 4..1, locks 900s at 5, and resets on success', () => {
  const ip = '198.51.100.77';
  const phone = '0935758462';
  resetMasterAdminFailures(ip, phone);

  try {
    const t0 = 1_700_000_000_000;
    for (let i = 1; i <= 4; i += 1) {
      const st = recordMasterAdminFailure(ip, phone, t0);
      assert.equal(st.isLocked, false);
      assert.equal(st.remainingAttempts, 5 - i);
    }
    const locked = recordMasterAdminFailure(ip, phone, t0);
    assert.equal(locked.isLocked, true);
    assert.equal(locked.lockSeconds, 900);

    const checkMid = getMasterAdminLockState(ip, phone, t0 + 120_000);
    assert.equal(checkMid.isLocked, true);
    assert.equal(checkMid.lockSeconds, 780);

    resetMasterAdminFailures(ip, phone);
    assert.equal(getMasterAdminLockState(ip, phone, t0 + 121_000).isLocked, false);
  } finally {
    resetMasterAdminFailures(ip, phone);
  }
});

test('authRateLimit 429 response returns publicMessage, retryAfterSeconds, lockDurationSeconds, and Retry-After', async () => {
  const prevEnv = process.env.NODE_ENV;
  const prevBurst = process.env.RATE_LIMIT_LOGIN_BURST_MAX;
  process.env.NODE_ENV = 'test';
  process.env.RATE_LIMIT_LOGIN_BURST_MAX = '2';

  const app = express();
  app.set('trust proxy', false);
  app.use(express.json());
  app.use((req, _res, next) => {
    Object.defineProperty(req, 'ip', { value: '198.51.100.91', configurable: true });
    next();
  });
  app.post('/test-rl', authRateLimit.loginLimiter, (_req, res) => res.status(401).json({ success: false }));
  const srv = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const url = `http://127.0.0.1:${srv.address().port}/test-rl`;
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const blocked = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    const body = await blocked.json();
    assert.equal(blocked.status, 429);
    assert.equal(body.code, 'RATE_LIMITED');
    assert.equal(body.publicMessage, true);
    assert.ok(Number(body.retryAfterSeconds) >= 1 && Number(body.retryAfterSeconds) <= 10);
    assert.equal(body.lockDurationSeconds, 10);
    assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
    assert.match(body.message, /giây/);
  } finally {
    srv.close();
    process.env.NODE_ENV = prevEnv;
    if (prevBurst === undefined) delete process.env.RATE_LIMIT_LOGIN_BURST_MAX;
    else process.env.RATE_LIMIT_LOGIN_BURST_MAX = prevBurst;
  }
});

test('Web and Mobile login screens render concise remaining attempts and live lock countdown without static policy note', () => {
  const countdownHook = fs.readFileSync(path.join(ROOT, 'client/src/hooks/useLoginLockCountdown.js'), 'utf8');
  const lockNotice = fs.readFileSync(path.join(ROOT, 'client/src/components/ui/LoginLockNotice.jsx'), 'utf8');
  const loginPage = fs.readFileSync(path.join(ROOT, 'client/src/components/LoginPage.jsx'), 'utf8');
  const adminLoginPage = fs.readFileSync(path.join(ROOT, 'client/src/components/AdminLoginPage.jsx'), 'utf8');
  const freePortalPage = fs.readFileSync(path.join(ROOT, 'client/src/components/FreePortalPage.jsx'), 'utf8');
  const mobileApiClient = fs.readFileSync(path.join(ROOT, 'thang-tin-hoc-mobile/src/services/apiClient.ts'), 'utf8');
  const mobileLogin = fs.readFileSync(path.join(ROOT, 'thang-tin-hoc-mobile/src/screens/LoginScreen.tsx'), 'utf8');

  assert.doesNotMatch(countdownHook, /LOGIN_LOCK_POLICY_NOTE/);
  assert.match(countdownHook, /formatLoginErrorText/);
  assert.match(countdownHook, /formatRetryButtonText/);
  assert.match(lockNotice, /Còn \$\{remainingAttempts\}\/\$\{maxAttempts\} lần thử \(khóa \$\{lockDurationSeconds\} giây\)/);
  assert.match(lockNotice, /Tạm khóa \$\{lockDurationSeconds\} giây — thử lại sau \$\{lockSecondsLeft\}s/);
  assert.match(lockNotice, /attempts left \(\$\{lockDurationSeconds\}s lock\)/);
  assert.match(lockNotice, /Locked \$\{lockDurationSeconds\}s — retry in \$\{lockSecondsLeft\}s/);

  for (const webSrc of [loginPage, adminLoginPage, freePortalPage]) {
    assert.match(webSrc, /useLoginLockCountdown/);
    assert.doesNotMatch(webSrc, /LOGIN_LOCK_POLICY_NOTE/);
    assert.match(webSrc, /LoginLockStatusBanner/);
    assert.match(webSrc, /formatLoginErrorText/);
    assert.match(webSrc, /formatRetryButtonText/);
  }

  assert.match(mobileApiClient, /remainingAttempts\?: number/);
  assert.match(mobileApiClient, /retryAfterSeconds\?: number/);
  assert.doesNotMatch(mobileLogin, /LOGIN_LOCK_POLICY_NOTE/);
  assert.match(mobileLogin, /Thử lại sau \$\{lockSecondsLeft\}s/);
  assert.match(mobileLogin, /Còn \$\{remainingAttempts\}\/\$\{maxAttempts\} lần thử \(khóa \$\{lockDurationSeconds\} giây\)/);
});
