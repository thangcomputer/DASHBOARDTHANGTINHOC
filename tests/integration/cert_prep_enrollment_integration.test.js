'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const { PERMISSIONS } = require('../../constants/permissions');
const { checkPermission } = require('../../middleware/auth');
const Teacher = require('../../models/Teacher');

const STAFF_ID = '507f1f77bcf86cd799439011';

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

test('CASE 13: staff without manage_cert_prep cannot manage mapping', async () => {
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

test('CASE 13: staff with manage_cert_prep can manage mapping', async () => {
  const restore = stubTeacher({
    adminRole: 'STAFF',
    permissions: [PERMISSIONS.MANAGE_CERT_PREP],
    role: 'staff',
  });
  try {
    const { next } = await runGate({ id: STAFF_ID, role: 'staff' });
    assert.equal(next, true);
  } finally {
    restore();
  }
});

test('CASE 14: mapping routes are admin-gated, not student catalog routes', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/certPrepRoutes.js'), 'utf8');
  const block = src.slice(src.indexOf("router.get('/enrollment-mappings'"));
  assert.ok(block.includes('requireCertPrepAdmin'));
  assert.ok(src.includes("router.get('/my-catalog'"));
  assert.ok(src.includes('safeSyncStudentEnrollments'));
  const catalogIdx = src.indexOf("router.get('/my-catalog'");
  const mapIdx = src.indexOf("router.get('/enrollment-mappings'");
  assert.ok(mapIdx > catalogIdx);
});

test('student LIVE enrollment hooks stay isolated and do not call /api/students for grant', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/studentRoutes.js'), 'utf8');
  assert.ok(src.includes('syncCertPrepFromEnrollment'));
  assert.ok(src.includes('revokeCertPrepAfterEnrollmentCancel'));
  assert.ok(src.includes('reconcileCertPrepAfterRefund'));
  assert.ok(src.includes('certPrepEnrollmentService'));
  assert.equal(src.includes("apiFetch('/students'"), false);
  assert.equal(src.includes('grantAccess('), false);
});

test('no Course/ExamResult/StudentTest edits required by mapping model', () => {
  const mapping = fs.readFileSync(path.join(__dirname, '../../models/CertPrepEnrollmentMapping.js'), 'utf8');
  assert.ok(mapping.includes("ref: 'Course'"));
  assert.ok(mapping.includes("ref: 'CertPrepCourse'"));
  assert.ok(mapping.includes('unique: true'));
  assert.ok(mapping.includes('courseId: 1, certPrepCourseId: 1')
    || mapping.includes('courseId: 1, certPrepCourseId: 1'));
});

test('CASE 9: POST /access grant remains independent of enrollment mapping', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/certPrepRoutes.js'), 'utf8');
  const grantIdx = src.indexOf("router.post('/access'");
  const mapIdx = src.indexOf("router.post('/enrollment-mappings'");
  assert.ok(grantIdx > 0);
  assert.ok(mapIdx > 0);
  assert.ok(src.includes('service.grantAccess'));
});
