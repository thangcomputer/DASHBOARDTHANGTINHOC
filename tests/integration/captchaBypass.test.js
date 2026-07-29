/**
 * AUTH-CONC-02 support — CAPTCHA_BYPASS only when NODE_ENV=test.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('authRoutes defines isCaptchaBypassEnabled gated on NODE_ENV=test', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/authRoutes.js'), 'utf8');
  assert.ok(src.includes('isCaptchaBypassEnabled'));
  assert.ok(src.includes("NODE_ENV === 'test'"));
  assert.ok(src.includes('CAPTCHA_BYPASS'));
  assert.ok(src.includes('bypassed: true'));
  // Must not bypass in production even if env set
  assert.ok(src.includes("process.env.NODE_ENV === 'test' && String(process.env.CAPTCHA_BYPASS || '') === '1'"));
});

test('captcha response may expose answer only under bypass hook', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/authRoutes.js'), 'utf8');
  assert.ok(src.includes('payload.answer = captcha.text'));
  assert.ok(src.includes('isCaptchaBypassEnabled()'));
});
