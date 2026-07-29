/**
 * Phase 6 — Course soft-delete + enrollment state machine.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canTransitionEnrollment,
  assertEnrollmentTransition,
  computeLearningAccess,
  applyEnrollmentStatus,
  ENROLLMENT_STATUSES,
} = require('../../services/enrollmentLifecycle');
const { activeCourseFilter } = require('../../services/courseLifecycleService');
const { getTemplate } = require('../../constants/notificationTemplates');

test('ENROLLMENT_STATUSES includes pending_payment and refunded', () => {
  assert.ok(ENROLLMENT_STATUSES.includes('pending_payment'));
  assert.ok(ENROLLMENT_STATUSES.includes('refunded'));
  assert.ok(ENROLLMENT_STATUSES.includes('active'));
});

test('canTransitionEnrollment pending_payment → active', () => {
  assert.equal(canTransitionEnrollment('pending_payment', 'active'), true);
  assert.equal(canTransitionEnrollment('pending_payment', 'completed'), false);
  assert.equal(canTransitionEnrollment('active', 'paused'), true);
  assert.equal(canTransitionEnrollment('completed', 'active'), false);
});

test('assertEnrollmentTransition throws on illegal move', () => {
  assert.throws(() => assertEnrollmentTransition('cancelled', 'active'), /Không thể chuyển/);
});

test('computeLearningAccess by status', () => {
  assert.equal(computeLearningAccess('active'), true);
  assert.equal(computeLearningAccess('paused'), true);
  assert.equal(computeLearningAccess('pending_payment'), false);
  assert.equal(computeLearningAccess('cancelled'), false);
  assert.equal(computeLearningAccess('active', false), false);
});

test('applyEnrollmentStatus sets activatedAt', () => {
  const enr = { status: 'pending_payment' };
  applyEnrollmentStatus(enr, 'active');
  assert.equal(enr.status, 'active');
  assert.equal(enr.learningAccess, true);
  assert.ok(enr.activatedAt);
});

test('activeCourseFilter excludes soft-deleted', () => {
  assert.deepEqual(activeCourseFilter({ status: 'published' }), {
    deletedAt: null,
    status: 'published',
  });
});

test('COURSE_SOFT_DELETED template exists', () => {
  const t = getTemplate('COURSE_SOFT_DELETED');
  assert.ok(t);
  assert.equal(t.type, 'COURSE');
});

test('Course schema has soft-delete fields', () => {
  const Course = require('../../models/Course');
  assert.ok(Course.schema.paths.deletedAt);
  assert.ok(Course.schema.paths.deletedBy);
  assert.ok(Course.schema.paths.deleteReason);
});

test('Student enrollment enum includes pending_payment', () => {
  const Student = require('../../models/Student');
  const statusPath = Student.schema.path('enrollments').schema.path('status');
  assert.ok(statusPath.enumValues.includes('pending_payment'));
  assert.ok(statusPath.enumValues.includes('refunded'));
  assert.ok(Student.schema.path('enrollments').schema.path('learningAccess'));
});

test('courseRoutes DELETE uses softDeleteCourse', () => {
  const fs = require('fs');
  const path = require('path');
  const src = fs.readFileSync(path.join(__dirname, '../../routes/courseRoutes.js'), 'utf8');
  assert.ok(src.includes('softDeleteCourse'));
  assert.ok(!src.includes('findByIdAndDelete'));
  assert.ok(src.includes('restoreCourse'));
  assert.ok(src.includes('activeCourseFilter'));
});
