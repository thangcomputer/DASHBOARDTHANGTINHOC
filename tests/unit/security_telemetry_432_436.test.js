'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const deviceSessionService = require('../../services/deviceSessionService');
const adminOtp2faService = require('../../services/adminOtp2faService');
const telemetryService = require('../../services/telemetryService');

test('4.3.2 deviceSessionService.parseUserAgent detects browsers, OS, and deviceType', () => {
  const winChrome = deviceSessionService.parseUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  );
  assert.equal(winChrome.browser, 'Google Chrome');
  assert.equal(winChrome.os, 'Windows 10/11');
  assert.equal(winChrome.deviceType, 'desktop');

  const iosSafari = deviceSessionService.parseUserAgent(
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  );
  assert.equal(iosSafari.browser, 'Apple Safari');
  assert.equal(iosSafari.os, 'iOS');
  assert.equal(iosSafari.deviceType, 'mobile');

  const winEdge = deviceSessionService.parseUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Edg/126.0.0.0',
  );
  assert.equal(winEdge.browser, 'Microsoft Edge');
});

test('4.3.2 deviceSessionService revocation cache marks session revoked immediately', async () => {
  const sid = deviceSessionService.createDeviceSessionId();
  assert.equal(await deviceSessionService.isDeviceSessionRevoked(sid), false);
  deviceSessionService.markRevokedInCache(sid);
  assert.equal(await deviceSessionService.isDeviceSessionRevoked(sid), true);
});

test('4.3.2 adminOtp2faService masks contacts, tracks attempts, and verifies OTP securely', async () => {
  assert.equal(adminOtp2faService.maskEmail('admin@thangtinhoc.vn'), 'ad***@thangtinhoc.vn');

  const issued = await adminOtp2faService.createAndSendOtpChallenge({
    userId: 'admin',
    role: 'admin',
    purpose: 'setup_otp',
    channel: 'both',
    phone: '0912345678',
    email: 'admin@thangtinhoc.vn',
    userName: 'Super Admin',
    meta: { channel: 'both', phone: '0912345678' },
  });

  assert.ok(issued.challengeId);
  assert.equal(issued.maskedEmail, 'ad***@thangtinhoc.vn');

  // Cooldown immediately blocks rapid resend
  const tooSoon = await adminOtp2faService.resendOtpChallenge(issued.challengeId);
  assert.equal(tooSoon.ok, false);
  assert.equal(tooSoon.status, 429);

  // Override stored hash cleanly to test deterministic verification without logging plaintext
  const store = adminOtp2faService._challengeStoreForTest;
  const entry = store.get(issued.challengeId);
  assert.ok(entry);
  entry.otpHash = crypto.createHash('sha256').update('654321').digest('hex');

  const wrong = adminOtp2faService.verifyOtpChallenge(issued.challengeId, '000000', 'admin', 'setup_otp');
  assert.equal(wrong.ok, false);
  assert.equal(wrong.status, 401);

  const ok = adminOtp2faService.verifyOtpChallenge(issued.challengeId, '654321', 'admin', 'setup_otp');
  assert.equal(ok.ok, true);
  assert.equal(ok.meta.channel, 'both');
  assert.equal(store.has(issued.challengeId), false);
});

test('4.3.6 telemetryService computes Core Web Vitals ratings, Sentry fingerprints, DSN, and scrubs secrets', () => {
  assert.equal(telemetryService.computeVitalRating('LCP', 1900), 'good');
  assert.equal(telemetryService.computeVitalRating('LCP', 3200), 'needs-improvement');
  assert.equal(telemetryService.computeVitalRating('LCP', 4500), 'poor');

  assert.equal(telemetryService.computeVitalRating('INP', 120), 'good');
  assert.equal(telemetryService.computeVitalRating('CLS', 0.05), 'good');
  assert.equal(telemetryService.computeVitalRating('CLS', 0.31), 'poor');

  const scrubbed = telemetryService.sanitizeText('Auth failed Bearer abc.def.ghi otp=123456');
  assert.ok(!scrubbed.includes('abc.def.ghi'));
  assert.ok(!scrubbed.includes('123456'));
  assert.ok(scrubbed.includes('[REDACTED]'));

  const fp1 = telemetryService.computeErrorFingerprint({
    source: 'frontend',
    name: 'TypeError',
    message: 'Cannot read property x for 65f0123456789abcdef01234',
    stack: 'TypeError: err\n    at renderDashboard (/assets/main.js:12:4)',
    route: '/admin',
  });
  const fp2 = telemetryService.computeErrorFingerprint({
    source: 'frontend',
    name: 'TypeError',
    message: 'Cannot read property x for 77a0123456789abcdef99999',
    stack: 'TypeError: err\n    at renderDashboard (/assets/main.js:12:4)',
    route: '/admin',
  });
  assert.equal(fp1, fp2);

  const dsn = telemetryService.parseSentryDsn('https://abc123@o100.ingest.sentry.io/450999');
  assert.equal(dsn.envelopeUrl, 'https://o100.ingest.sentry.io/api/450999/envelope/');
  assert.equal(dsn.maskedDsn, 'https://***@o100.ingest.sentry.io/450999');
});

