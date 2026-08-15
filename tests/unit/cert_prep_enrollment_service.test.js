'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');

const Course = require('../../models/Course');
const CertPrepCourse = require('../../models/CertPrepCourse');
const CertPrepEnrollmentMapping = require('../../models/CertPrepEnrollmentMapping');
const StudentCertPrepAccess = require('../../models/StudentCertPrepAccess');
const Student = require('../../models/Student');
const {
  isQualifyingEnrollment,
  mergeExpiresAt,
  syncEnrollmentToCertPrepAccess,
  syncStudentEnrollments,
  safeSyncStudentEnrollments,
  upsertAccess,
} = require('../../services/certPrepEnrollmentService');

const STUDENT_A = '507f1f77bcf86cd7994390aa';
const STUDENT_B = '507f1f77bcf86cd7994390bb';
const LMS_COURSE_A = '507f1f77bcf86cd7994390c1';
const LMS_COURSE_B = '507f1f77bcf86cd7994390c2';
const CERT_A = '507f1f77bcf86cd7994390d1';
const CERT_B = '507f1f77bcf86cd7994390d2';

function store() {
  return {
    mappings: [],
    accesses: [],
  };
}

function installStubs(db) {
  const orig = {
    mapFind: CertPrepEnrollmentMapping.find,
    mapFindOne: CertPrepEnrollmentMapping.findOne,
    accessFind: StudentCertPrepAccess.find,
    accessFindOne: StudentCertPrepAccess.findOne,
    accessCreate: StudentCertPrepAccess.create,
    courseFindById: Course.findById,
    courseFindOne: Course.findOne,
    certFindById: CertPrepCourse.findById,
    studentFindById: Student.findById,
  };

  CertPrepEnrollmentMapping.find = (q = {}) => ({
    select() { return this; },
    populate() { return this; },
    sort() { return this; },
    lean: async () => db.mappings.filter((m) => {
      if (q.certPrepCourseId && String(m.certPrepCourseId) !== String(q.certPrepCourseId)) return false;
      if (q.courseId && String(m.courseId) !== String(q.courseId)) return false;
      if (q.isActive != null && m.isActive !== q.isActive) return false;
      return true;
    }),
  });
  CertPrepEnrollmentMapping.findOne = (q) => ({
    lean: async () => db.mappings.find((m) => {
      if (q.courseId && String(m.courseId) !== String(q.courseId)) return false;
      if (q.certPrepCourseId && String(m.certPrepCourseId) !== String(q.certPrepCourseId)) return false;
      if (q.isActive != null && m.isActive !== q.isActive) return false;
      return true;
    }) || null,
  });
  StudentCertPrepAccess.find = (q = {}) => ({
    lean: async () => db.accesses.filter((a) => {
      if (q.studentId && String(a.studentId) !== String(q.studentId)) return false;
      if (q.isActive === true && a.isActive === false) return false;
      if (q.isActive === false && a.isActive !== false) return false;
      return true;
    }),
  });
  StudentCertPrepAccess.findOne = async (q) => {
    const hit = db.accesses.find((a) => String(a.studentId) === String(q.studentId) && String(a.courseId) === String(q.courseId));
    if (!hit) return null;
    return {
      ...hit,
      async save() {
        const idx = db.accesses.findIndex((a) => a === hit || (String(a.studentId) === String(hit.studentId) && String(a.courseId) === String(hit.courseId)));
        if (idx >= 0) db.accesses[idx] = this;
        return this;
      },
      toObject() { return { ...this }; },
    };
  };
  StudentCertPrepAccess.create = async (doc) => {
    const row = { ...doc, _id: `acc-${db.accesses.length + 1}` };
    db.accesses.push(row);
    return { toObject() { return { ...row }; } };
  };

  return () => {
    CertPrepEnrollmentMapping.find = orig.mapFind;
    CertPrepEnrollmentMapping.findOne = orig.mapFindOne;
    StudentCertPrepAccess.find = orig.accessFind;
    StudentCertPrepAccess.findOne = orig.accessFindOne;
    StudentCertPrepAccess.create = orig.accessCreate;
    Course.findById = orig.courseFindById;
    Course.findOne = orig.courseFindOne;
    CertPrepCourse.findById = orig.certFindById;
    Student.findById = orig.studentFindById;
  };
}

test('CASE 1: unmapped course enrollment does not create access', async () => {
  const db = store();
  const restore = installStubs(db);
  try {
    const out = await syncEnrollmentToCertPrepAccess({
      studentId: STUDENT_A,
      courseId: LMS_COURSE_A,
      enrollment: { status: 'active', learningAccess: true },
    });
    assert.equal(out.action, 'noop');
    assert.equal(db.accesses.length, 0);
  } finally {
    restore();
  }
});

test('CASE 2: mapped course enrollment creates access for student A / cert A', async () => {
  const db = store();
  db.mappings.push({ courseId: LMS_COURSE_A, certPrepCourseId: CERT_A, isActive: true });
  const restore = installStubs(db);
  try {
    const out = await syncEnrollmentToCertPrepAccess({
      studentId: STUDENT_A,
      courseId: LMS_COURSE_A,
      enrollment: { status: 'active', learningAccess: true },
    });
    assert.equal(out.action, 'upserted');
    assert.equal(db.accesses.length, 1);
    assert.equal(String(db.accesses[0].studentId), STUDENT_A);
    assert.equal(String(db.accesses[0].courseId), CERT_A);
    assert.equal(db.accesses[0].isActive, true);
  } finally {
    restore();
  }
});

test('CASE 2b: one LMS course can map to multiple CertPrep courses', async () => {
  const db = store();
  db.mappings.push(
    { courseId: LMS_COURSE_A, certPrepCourseId: CERT_A, isActive: true },
    { courseId: LMS_COURSE_A, certPrepCourseId: CERT_B, isActive: true },
  );
  const restore = installStubs(db);
  try {
    const out = await syncEnrollmentToCertPrepAccess({
      studentId: STUDENT_A,
      courseId: LMS_COURSE_A,
      enrollment: { status: 'active' },
    });
    assert.equal(out.action, 'upserted');
    assert.equal(db.accesses.length, 2);
    assert.deepEqual(
      out.certPrepCourseIds.sort(),
      [CERT_A, CERT_B].sort(),
    );
  } finally {
    restore();
  }
});

test('CASE 3: same enrollment twice is idempotent — one access', async () => {
  const db = store();
  db.mappings.push({ courseId: LMS_COURSE_A, certPrepCourseId: CERT_A, isActive: true });
  const restore = installStubs(db);
  try {
    const payload = {
      studentId: STUDENT_A,
      courseId: LMS_COURSE_A,
      enrollment: { status: 'active', learningAccess: true },
    };
    await syncEnrollmentToCertPrepAccess(payload);
    await syncEnrollmentToCertPrepAccess(payload);
    assert.equal(db.accesses.length, 1);
  } finally {
    restore();
  }
});

test('CASE 4/5: student A mapped to cert A does not grant student B or cert B', async () => {
  const db = store();
  db.mappings.push({ courseId: LMS_COURSE_A, certPrepCourseId: CERT_A, isActive: true });
  const restore = installStubs(db);
  try {
    await syncEnrollmentToCertPrepAccess({
      studentId: STUDENT_A,
      courseId: LMS_COURSE_A,
      enrollment: { status: 'active', learningAccess: true },
    });
    assert.equal(db.accesses.every((a) => String(a.studentId) === STUDENT_A), true);
    assert.equal(db.accesses.every((a) => String(a.courseId) === CERT_A), true);
    assert.equal(db.accesses.some((a) => String(a.studentId) === STUDENT_B), false);
    assert.equal(db.accesses.some((a) => String(a.courseId) === CERT_B), false);
  } finally {
    restore();
  }
});

test('CASE 6/7: mergeExpiresAt never shortens a later expiry', () => {
  const long = new Date('2026-12-31T00:00:00.000Z');
  const short = new Date('2026-09-30T00:00:00.000Z');
  assert.equal(mergeExpiresAt(long, short).toISOString(), long.toISOString());
  assert.equal(mergeExpiresAt(short, long).toISOString(), long.toISOString());
  assert.equal(mergeExpiresAt(long, null).toISOString(), long.toISOString());
});

test('CASE 8: existing manual access is reused, not duplicated', async () => {
  const db = store();
  db.mappings.push({ courseId: LMS_COURSE_A, certPrepCourseId: CERT_A, isActive: true });
  db.accesses.push({
    studentId: STUDENT_A,
    courseId: CERT_A,
    isActive: true,
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    grantedBy: 'manual',
  });
  const restore = installStubs(db);
  try {
    await syncEnrollmentToCertPrepAccess({
      studentId: STUDENT_A,
      courseId: LMS_COURSE_A,
      enrollment: { status: 'active', learningAccess: true },
    });
    assert.equal(db.accesses.length, 1);
    assert.equal(db.accesses[0].grantedBy, 'manual');
    assert.equal(new Date(db.accesses[0].expiresAt).toISOString(), '2026-12-31T00:00:00.000Z');
  } finally {
    restore();
  }
});

test('CASE 10: disabled mapping does not grant on new enrollment', async () => {
  const db = store();
  db.mappings.push({ courseId: LMS_COURSE_A, certPrepCourseId: CERT_A, isActive: false });
  const restore = installStubs(db);
  try {
    const out = await syncEnrollmentToCertPrepAccess({
      studentId: STUDENT_A,
      courseId: LMS_COURSE_A,
      enrollment: { status: 'active', learningAccess: true },
    });
    assert.equal(out.action, 'noop');
    assert.equal(db.accesses.length, 0);
  } finally {
    restore();
  }
});

test('pending_payment enrollment is not qualifying; active is (even if learningAccess false)', () => {
  assert.equal(isQualifyingEnrollment({ status: 'pending_payment', learningAccess: false }), false);
  assert.equal(isQualifyingEnrollment({ status: 'active', learningAccess: true }), true);
  assert.equal(isQualifyingEnrollment({ status: 'active', learningAccess: false }), true);
  assert.equal(isQualifyingEnrollment({ status: 'cancelled', learningAccess: false }), false);
});

test('CASE 12: sync failure is isolated and does not throw', async () => {
  const orig = CertPrepEnrollmentMapping.find;
  CertPrepEnrollmentMapping.find = () => { throw new Error('boom'); };
  try {
    const out = await safeSyncStudentEnrollments({
      _id: STUDENT_A,
      enrollments: [{ courseId: LMS_COURSE_A, status: 'active', learningAccess: true }],
    });
    assert.equal(out.ok, false);
  } finally {
    CertPrepEnrollmentMapping.find = orig;
  }
});

test('unmapped LMS course B does not grant cert A', async () => {
  const db = store();
  db.mappings.push({ courseId: LMS_COURSE_A, certPrepCourseId: CERT_A, isActive: true });
  const restore = installStubs(db);
  try {
    const student = {
      _id: STUDENT_A,
      enrollments: [{ courseId: LMS_COURSE_B, status: 'active', learningAccess: true }],
    };
    const out = await syncStudentEnrollments(student);
    assert.equal(out.granted, 0);
    assert.equal(db.accesses.length, 0);
  } finally {
    restore();
  }
});

test('CASE 15: upsertAccess does not delete historical fields on existing access', async () => {
  const db = store();
  db.accesses.push({
    studentId: STUDENT_A,
    courseId: CERT_A,
    isActive: false,
    expiresAt: new Date('2026-12-31T00:00:00.000Z'),
    grantedBy: 'manual',
  });
  const restore = installStubs(db);
  try {
    await upsertAccess({
      studentId: STUDENT_A,
      certPrepCourseId: CERT_A,
      grantedBy: 'enrollment-bridge',
    });
    assert.equal(db.accesses.length, 1);
    assert.equal(db.accesses[0].isActive, true);
    assert.equal(db.accesses[0].grantedBy, 'manual');
  } finally {
    restore();
  }
});

test('CASE 9: manual grantAccess route and Access UI remain', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/certPrepRoutes.js'), 'utf8');
  assert.ok(src.includes("router.post('/access'"));
  assert.ok(src.includes('service.grantAccess'));
  const ui = fs.readFileSync(path.join(__dirname, '../../client/src/components/admin/certPrep/CertPrepAccessManager.jsx'), 'utf8');
  assert.ok(ui.includes('certPrepApi.access.grant'));
});

test('CASE 11: cancel enrollment soft-deactivates CertPrep access, never deletes sessions', () => {
  const live = fs.readFileSync(path.join(__dirname, '../../routes/studentRoutes.js'), 'utf8');
  const delStart = live.indexOf("router.delete('/:id/enrollments/:enrollmentId'");
  assert.ok(delStart > 0);
  const nextStart = live.indexOf('\nrouter.', delStart + 40);
  const block = live.slice(delStart, nextStart > 0 ? nextStart : undefined);
  assert.ok(block.includes('revokeCertPrepAfterEnrollmentCancel'));
  assert.equal(block.includes('CertPrepSession'), false);
  assert.equal(/deleteMany|findByIdAndDelete/.test(block), false);
});

test('CASE 11b: cancel mapped enrollment deactivates access when no other qualifying enr', async () => {
  const {
    revokeCertPrepAccessForEnrollment,
  } = require('../../services/certPrepEnrollmentService');
  const db = store();
  db.mappings.push({ courseId: LMS_COURSE_A, certPrepCourseId: CERT_A, isActive: true });
  db.accesses.push({
    studentId: STUDENT_A,
    courseId: CERT_A,
    isActive: true,
    grantedBy: 'enrollment-bridge',
  });
  const restore = installStubs(db);
  try {
    const student = {
      _id: STUDENT_A,
      enrollments: [{
        courseId: LMS_COURSE_A,
        status: 'cancelled',
        learningAccess: false,
      }],
    };
    const out = await revokeCertPrepAccessForEnrollment(student, student.enrollments[0]);
    assert.equal(out.action, 'deactivated');
    assert.equal(db.accesses[0].isActive, false);
  } finally {
    restore();
  }
});

test('CASE 11c: keep access when another qualifying enrollment maps to same CertPrep', async () => {
  const {
    revokeCertPrepAccessForEnrollment,
  } = require('../../services/certPrepEnrollmentService');
  const db = store();
  db.mappings.push(
    { courseId: LMS_COURSE_A, certPrepCourseId: CERT_A, isActive: true },
    { courseId: LMS_COURSE_B, certPrepCourseId: CERT_A, isActive: true },
  );
  db.accesses.push({
    studentId: STUDENT_A,
    courseId: CERT_A,
    isActive: true,
    grantedBy: 'enrollment-bridge',
  });
  const restore = installStubs(db);
  try {
    const student = {
      _id: STUDENT_A,
      enrollments: [
        { courseId: LMS_COURSE_A, status: 'cancelled', learningAccess: false },
        { courseId: LMS_COURSE_B, status: 'active', learningAccess: true },
      ],
    };
    const out = await revokeCertPrepAccessForEnrollment(student, student.enrollments[0]);
    assert.equal(out.action, 'noop');
    assert.ok(out.reason === 'still-qualifying' || out.reason === 'still-qualifying-or-inactive');
    assert.equal(db.accesses[0].isActive, true);
  } finally {
    restore();
  }
});

test('CASE 11d: reconcile leaves pure-manual CertPrep (no LMS mapping) active', async () => {
  const {
    reconcileStudentCertPrepAccess,
  } = require('../../services/certPrepEnrollmentService');
  const db = store();
  db.accesses.push({
    studentId: STUDENT_A,
    courseId: CERT_B,
    isActive: true,
    grantedBy: 'manual',
  });
  const restore = installStubs(db);
  try {
    const out = await reconcileStudentCertPrepAccess({
      _id: STUDENT_A,
      enrollments: [],
    });
    assert.equal(out.deactivated, 0);
    assert.equal(db.accesses[0].isActive, true);
  } finally {
    restore();
  }
});

test('CASE 15: enrollment bridge never hard-deletes sessions or access docs', () => {
  const svc = fs.readFileSync(path.join(__dirname, '../../services/certPrepEnrollmentService.js'), 'utf8');
  assert.equal(svc.includes('CertPrepSession'), false);
  assert.equal(/deleteMany|findByIdAndDelete|findOneAndDelete/.test(svc), false);
  assert.ok(svc.includes('isActive = false') || svc.includes('isActive: false'));
});

test('student cert-prep routes are learning-gated', () => {
  const app = fs.readFileSync(path.join(__dirname, '../../client/src/App.jsx'), 'utf8');
  assert.ok(app.includes("path=\"/student/cert-prep\""));
  assert.ok(app.includes('StudentLearningAccessGate'));
  const certBlock = app.slice(app.indexOf("path=\"/student/cert-prep\""));
  assert.ok(certBlock.includes('StudentLearningAccessGate'));
  const side = fs.readFileSync(path.join(__dirname, '../../client/src/components/AppSidebar.jsx'), 'utf8');
  assert.ok(side.includes("path: '/student/cert-prep', requiresLearningAccess: true")
    || side.includes('path: \'/student/cert-prep\', requiresLearningAccess: true')
    || /cert-prep.*requiresLearningAccess:\s*true/.test(side));
});

test('routes: mapping endpoints are manage_cert_prep gated; no modules/cert-prep', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/certPrepRoutes.js'), 'utf8');
  assert.ok(src.includes("router.get('/enrollment-mappings'"));
  assert.ok(src.includes("router.post('/enrollment-mappings'"));
  assert.ok(src.includes('...requireCertPrepAdmin'));
  assert.equal(src.includes('modules/cert-prep'), false);
  const live = fs.readFileSync(path.join(__dirname, '../../routes/studentRoutes.js'), 'utf8');
  assert.ok(live.includes('syncCertPrepFromEnrollment'));
  assert.ok(live.includes('revokeCertPrepAfterEnrollmentCancel'));
  assert.ok(live.includes('reconcileCertPrepAfterRefund'));
  assert.ok(!live.includes("if (course.name.includes('IC3')"));
  assert.ok(live.includes("router.put('/:id/pay'"));
  const payStart = live.indexOf("router.put('/:id/pay'");
  const payEnd = live.indexOf("router.put('/:id/refund'");
  assert.ok(live.slice(payStart, payEnd).includes('syncCertPrepFromEnrollment'));
});
