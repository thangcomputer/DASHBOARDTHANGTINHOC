/**
 * Phase 1 — display code helpers + audit redact (không cần Mongo).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatDisplayCode,
  formatEnrollmentCode,
  courseTokenFromName,
  parseDisplayCode,
  rolePrefixForTeacherDoc,
  ROLE_PREFIX,
} = require('../../utils/displayCode');
const { redact } = require('../../services/auditLogService');

test('formatDisplayCode HV001-CN1', () => {
  assert.equal(formatDisplayCode('HV', 1, 'cn1'), 'HV001-CN1');
  assert.equal(formatDisplayCode('GV', 12, 'CS1'), 'GV012-CS1');
});

test('parseDisplayCode round-trip', () => {
  const p = parseDisplayCode('HV003-CN2');
  assert.deepEqual(p, { rolePrefix: 'HV', seq: 3, branchCode: 'CN2' });
  assert.equal(parseDisplayCode('bad'), null);
});

test('courseToken + enrollmentCode', () => {
  assert.equal(courseTokenFromName('Excel MOS'), 'EXCELMOS');
  assert.equal(courseTokenFromName('Tin học văn phòng CB'), 'TINHOCVANPHONGCB');
  assert.equal(
    formatEnrollmentCode('HV001-CN1', 'Excel MOS'),
    'HV001-CN1-EXCELMOS'
  );
});

test('rolePrefixForTeacherDoc', () => {
  assert.equal(rolePrefixForTeacherDoc({ role: 'teacher' }), ROLE_PREFIX.teacher);
  assert.equal(rolePrefixForTeacherDoc({ role: 'admin', adminRole: 'SUPER_ADMIN' }), ROLE_PREFIX.admin);
  assert.equal(rolePrefixForTeacherDoc({ role: 'staff', adminRole: 'STAFF' }), ROLE_PREFIX.staff);
});

test('audit redact strips password fields', () => {
  const out = redact({ name: 'A', password: 'secret', nested: { otp: '123456', ok: 1 } });
  assert.equal(out.password, '[REDACTED]');
  assert.equal(out.nested.otp, '[REDACTED]');
  assert.equal(out.nested.ok, 1);
  assert.equal(out.name, 'A');
});
