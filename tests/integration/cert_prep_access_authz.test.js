'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { PERMISSIONS, HIGH_ADMIN_DEFAULT_PERMISSIONS } = require('../../constants/permissions');
const { checkPermission } = require('../../middleware/auth');
const Teacher = require('../../models/Teacher');
const ENT = require('../../shared/constants/permissions');
const map = require('../../shared/constants/legacyPermissionMapping');
const {
  CertPrepError,
  assertSessionOwner,
  isAccessCurrentlyValid,
  assertRetakeAllowed,
  isSessionExpired,
  computeScore,
} = require('../../services/certPrepService');

const STAFF_ID = '507f1f77bcf86cd799439011';
const STUDENT_A = '507f1f77bcf86cd7994390aa';
const STUDENT_B = '507f1f77bcf86cd7994390bb';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

function stubTeacher(doc) {
  const orig = Teacher.findById;
  Teacher.findById = () => ({
    select() {
      return { lean: async () => doc };
    },
  });
  return () => { Teacher.findById = orig; };
}

async function runGate(reqUser) {
  const mw = checkPermission(PERMISSIONS.MANAGE_CERT_PREP);
  const req = { user: reqUser };
  const res = mockRes();
  let next = false;
  await mw(req, res, () => { next = true; });
  return { next, res };
}

test('LIVE catalog includes manage_cert_prep', () => {
  assert.equal(PERMISSIONS.MANAGE_CERT_PREP, 'manage_cert_prep');
});

test('enterprise mapping MATCH cert_prep:manage, not exam or student_training', () => {
  assert.equal(ENT.CERT_PREP_MANAGE, 'cert_prep:manage');
  assert.deepEqual(map.resolve('manage_cert_prep'), [ENT.CERT_PREP_MANAGE]);
  assert.equal(map.getMappingStatus('manage_cert_prep'), 'MATCH');
  const codes = map.resolve('manage_cert_prep');
  assert.ok(!codes.includes(ENT.EXAM_MANAGE));
  assert.ok(!codes.includes(ENT.STUDENT_TRAINING_MANAGE));
});

test('HIGH_ADMIN default does not include manage_cert_prep', () => {
  assert.ok(!HIGH_ADMIN_DEFAULT_PERMISSIONS.includes(PERMISSIONS.MANAGE_CERT_PREP));
});

test('unauthenticated staff gate → 401', async () => {
  const { next, res } = await runGate(null);
  assert.equal(next, false);
  assert.equal(res.statusCode, 401);
});

test('authenticated without permission → 403', async () => {
  const restore = stubTeacher({
    adminRole: 'STAFF',
    permissions: [PERMISSIONS.MANAGE_STUDENTS],
    role: 'staff',
  });
  try {
    const { next, res } = await runGate({ id: STAFF_ID, role: 'staff' });
    assert.equal(next, false);
    assert.equal(res.statusCode, 403);
  } finally {
    restore();
  }
});

test('HIGH_ADMIN without manage_cert_prep → 403', async () => {
  const restore = stubTeacher({
    adminRole: 'HIGH_ADMIN',
    permissions: [...HIGH_ADMIN_DEFAULT_PERMISSIONS],
    role: 'admin',
  });
  try {
    const { next, res } = await runGate({ id: STAFF_ID, role: 'admin' });
    assert.equal(next, false);
    assert.equal(res.statusCode, 403);
  } finally {
    restore();
  }
});

test('admin with manage_cert_prep → ALLOW', async () => {
  const restore = stubTeacher({
    adminRole: 'STAFF',
    permissions: [PERMISSIONS.MANAGE_CERT_PREP],
    role: 'staff',
  });
  try {
    const { next, res } = await runGate({ id: STAFF_ID, role: 'staff' });
    assert.equal(next, true);
    assert.equal(res.statusCode, 200);
  } finally {
    restore();
  }
});

test('SUPER_ADMIN bypasses manage_cert_prep gate', async () => {
  const restore = stubTeacher({
    adminRole: 'SUPER_ADMIN',
    permissions: [],
    role: 'admin',
  });
  try {
    const { next } = await runGate({ id: STAFF_ID, role: 'admin' });
    assert.equal(next, true);
  } finally {
    restore();
  }
});

test('hardcoded admin id bypasses gate', async () => {
  const { next } = await runGate({ id: 'admin', role: 'admin' });
  assert.equal(next, true);
});

test('teacher role cannot pass staff permission gate', async () => {
  const { next, res } = await runGate({
    id: STAFF_ID,
    role: 'teacher',
    permissions: [PERMISSIONS.MANAGE_CERT_PREP],
  });
  assert.equal(next, false);
  assert.equal(res.statusCode, 403);
});

test('session ownership: owner ok, other student 403', () => {
  const session = { studentId: STUDENT_A };
  assert.doesNotThrow(() => assertSessionOwner(session, STUDENT_A));
  try {
    assertSessionOwner(session, STUDENT_B);
    assert.fail('expected 403');
  } catch (err) {
    assert.equal(err instanceof CertPrepError, true);
    assert.equal(err.status, 403);
  }
});

test('student access record: active and unexpired', () => {
  const now = new Date('2026-08-15T00:00:00.000Z');
  assert.equal(isAccessCurrentlyValid({ isActive: true, expiresAt: null }, now), true);
  assert.equal(isAccessCurrentlyValid({ isActive: false, expiresAt: null }, now), false);
  assert.equal(isAccessCurrentlyValid(null, now), false);
  assert.equal(isAccessCurrentlyValid({
    isActive: true,
    expiresAt: new Date('2026-08-14T00:00:00.000Z'),
  }, now), false);
  assert.equal(isAccessCurrentlyValid({
    isActive: true,
    expiresAt: new Date('2026-08-16T00:00:00.000Z'),
  }, now), true);
});

test('retake: blocked when allowRetake false after a submit', () => {
  assert.doesNotThrow(() => assertRetakeAllowed({ allowRetake: false, maxAttempts: null }, 0));
  try {
    assertRetakeAllowed({ allowRetake: false, maxAttempts: null }, 1);
    assert.fail('expected 409');
  } catch (err) {
    assert.equal(err.status, 409);
  }
});

test('retake: maxAttempts enforced; null is unlimited', () => {
  assert.doesNotThrow(() => assertRetakeAllowed({ allowRetake: true, maxAttempts: 2 }, 1));
  try {
    assertRetakeAllowed({ allowRetake: true, maxAttempts: 2 }, 2);
    assert.fail('expected 409');
  } catch (err) {
    assert.equal(err.status, 409);
  }
  assert.doesNotThrow(() => assertRetakeAllowed({ allowRetake: true, maxAttempts: null }, 99));
});

test('timer: expired when elapsed >= timeLimitMinutes', () => {
  const startedAt = new Date('2026-08-15T00:00:00.000Z');
  const session = { startedAt };
  assert.equal(isSessionExpired(session, 50, new Date('2026-08-15T00:49:59.000Z')), false);
  assert.equal(isSessionExpired(session, 50, new Date('2026-08-15T00:50:00.000Z')), true);
  assert.equal(isSessionExpired(session, 50, new Date('2026-08-15T01:00:00.000Z')), true);
});

test('submit idempotency contract: score functions are pure', () => {
  assert.equal(computeScore(40, 45), 889);
  assert.equal(computeScore(40, 45), 889);
});

test('routes use authMiddleware + checkPermission, no role===admin bypass', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/certPrepRoutes.js'), 'utf8');
  assert.ok(src.includes('authMiddleware'));
  assert.ok(src.includes("checkPermission(PERMISSIONS.MANAGE_CERT_PREP)"));
  assert.equal(src.includes("role === 'admin'"), false);
  assert.ok(src.includes("req.user.id"));
  assert.ok(!src.includes('filesCutoverGate'));
  assert.ok(src.includes("fileService.createUploader('images')"));
});

test('no modules/cert-prep directory', () => {
  const dir = path.join(__dirname, '../../modules/cert-prep');
  assert.equal(fs.existsSync(dir), false);
});
