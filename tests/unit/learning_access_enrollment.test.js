'use strict';

/**
 * Unit tests for Student Learning Access Gate SoT.
 * Mirrors client/src/utils/enrollments.js:
 *   hasLearningAccessEnrollment = getClientEnrollments(student).some(e => e.status === 'active')
 * (getActiveClientEnrollments still includes completed — intentionally different.)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function getClientEnrollments(student) {
  if (!student) return [];
  if (Array.isArray(student.courses) && student.courses.length > 0) {
    return student.courses.map((c, idx) => ({
      ...c,
      status: c.status || 'active',
      enrollmentId: c.enrollmentId || c.id || `course-${idx}`,
    }));
  }
  if (Array.isArray(student.enrollments) && student.enrollments.length > 0) {
    return student.enrollments.map((e, idx) => ({
      ...e,
      status: e.status || 'active',
      enrollmentId: e._id ? String(e._id) : `enr-${idx}`,
    }));
  }
  if (student.course && String(student.course).trim()) {
    return [{
      status: student.status === 'Hoàn thành' ? 'completed' : 'active',
      enrollmentId: 'main',
      courseName: student.course,
    }];
  }
  return [];
}

function getActiveClientEnrollments(student) {
  return getClientEnrollments(student).filter(
    (e) => e?.status !== 'cancelled' && e?.status !== 'refunded',
  );
}

function getLearningAccessEnrollments(student) {
  return getClientEnrollments(student).filter(
    (e) => String(e?.status || '').toLowerCase() === 'active',
  );
}

function hasLearningAccessEnrollment(student) {
  return getLearningAccessEnrollments(student).length > 0;
}

describe('hasLearningAccessEnrollment SoT (status === active)', () => {
  it('allows when ≥1 enrollment is active', () => {
    assert.equal(hasLearningAccessEnrollment({
      enrollments: [{ courseName: 'A', status: 'active' }],
    }), true);
  });

  it('blocks cancelled-only', () => {
    assert.equal(hasLearningAccessEnrollment({
      enrollments: [{ courseName: 'A', status: 'cancelled', refundedAmount: 4_000_000 }],
    }), false);
  });

  it('blocks refunded-only', () => {
    assert.equal(hasLearningAccessEnrollment({
      enrollments: [{ courseName: 'A', status: 'refunded' }],
    }), false);
  });

  it('blocks completed-only (unlike getActiveClientEnrollments)', () => {
    const student = { enrollments: [{ courseName: 'A', status: 'completed' }] };
    assert.equal(hasLearningAccessEnrollment(student), false);
    assert.equal(getActiveClientEnrollments(student).length, 1);
  });

  it('allows multi-course when one remains active after cancel', () => {
    assert.equal(hasLearningAccessEnrollment({
      enrollments: [
        { courseName: 'Old', status: 'cancelled' },
        { courseName: 'New', status: 'active' },
      ],
    }), true);
  });

  it('blocks empty / no enrollments', () => {
    assert.equal(hasLearningAccessEnrollment(null), false);
    assert.equal(hasLearningAccessEnrollment({}), false);
    assert.equal(hasLearningAccessEnrollment({ enrollments: [] }), false);
  });

  it('uses courses[] when present', () => {
    assert.equal(hasLearningAccessEnrollment({
      courses: [{ name: 'X', status: 'cancelled' }],
    }), false);
    assert.equal(hasLearningAccessEnrollment({
      courses: [{ name: 'X', status: 'active' }],
    }), true);
  });
});

describe('static: student learning routes gated vs ungated', () => {
  const root = path.join(__dirname, '..', '..');
  const appSrc = fs.readFileSync(path.join(root, 'client', 'src', 'App.jsx'), 'utf8');
  const sidebarSrc = fs.readFileSync(path.join(root, 'client', 'src', 'components', 'AppSidebar.jsx'), 'utf8');
  const enrollmentsSrc = fs.readFileSync(path.join(root, 'client', 'src', 'utils', 'enrollments.js'), 'utf8');

  it('exports hasLearningAccessEnrollment helper', () => {
    assert.match(enrollmentsSrc, /export function hasLearningAccessEnrollment/);
    assert.match(enrollmentsSrc, /status === 'active'/);
  });

  it('gates /student and exam routes; leaves inbox/feed/news ungated', () => {
    assert.match(appSrc, /StudentLearningAccessGate/);
    assert.match(appSrc, /path="\/student"/);
    assert.match(appSrc, /path="\/student\/exam"/);
    assert.match(appSrc, /path="\/student\/exam\/:subjectId"/);

    // Ungated surfaces must not be wrapped by Gate in the same element tree as learning-only
    const inboxBlock = appSrc.slice(appSrc.indexOf('path="/student/inbox"'), appSrc.indexOf('path="/student/feed"'));
    assert.doesNotMatch(inboxBlock, /StudentLearningAccessGate/);

    const feedBlock = appSrc.slice(appSrc.indexOf('path="/student/feed"'), appSrc.indexOf('path="/student/news"'));
    assert.doesNotMatch(feedBlock, /StudentLearningAccessGate/);
  });

  it('sidebar marks learning items requiresLearningAccess', () => {
    assert.match(sidebarSrc, /requiresLearningAccess:\s*true/);
    assert.match(sidebarSrc, /hasLearningAccessEnrollment/);
  });
});
