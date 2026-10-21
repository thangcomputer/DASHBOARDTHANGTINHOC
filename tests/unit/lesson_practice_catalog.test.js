'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('registered courses with fewer than three subjects open a subject directly', async () => {
  const { getDirectCourseSubject } = await import(
    '../../client/src/utils/lessonPracticeCatalog.js'
  );
  const oneSubject = { id: 'subject-1', opened: true };

  assert.equal(getDirectCourseSubject({
    enrolled: true,
    subjects: [oneSubject],
  }), oneSubject);
  assert.equal(getDirectCourseSubject({
    enrolled: true,
    subjects: [{ id: 'subject-1' }, { id: 'subject-2' }],
  }).id, 'subject-1');
  assert.equal(getDirectCourseSubject({
    enrolled: false,
    offerType: 'single',
    subjects: [oneSubject],
  }), oneSubject);
  assert.equal(getDirectCourseSubject({
    enrolled: false,
    offerType: 'bundle',
    subjects: [oneSubject],
  }), null);
  assert.equal(getDirectCourseSubject({
    enrolled: false,
    offerType: 'single',
    deliveryMode: 'instructor',
    subjects: [oneSubject],
  }), null);
  assert.equal(getDirectCourseSubject({
    enrolled: false,
    offerType: 'single',
    subjects: [{ id: '1' }, { id: '2' }, { id: '3' }],
  }), null);
  assert.equal(getDirectCourseSubject({
    enrolled: true,
    subjects: [{ id: '1' }, { id: '2' }, { id: '3' }],
  }), null);
});

test('course card progress is the aggregate completed-unit percentage', async () => {
  const { getCourseProgressPercent } = await import(
    '../../client/src/utils/lessonPracticeCatalog.js'
  );
  const course = {
    subjects: [
      { id: 'subject-1', completedUnitCount: 1, totalUnitCount: 2 },
      { id: 'subject-2', completedUnitCount: 0, totalUnitCount: 2 },
    ],
  };

  assert.equal(getCourseProgressPercent(course, new Map()), 25);
  assert.equal(getCourseProgressPercent({
    subjects: [{ id: 'subject-1' }],
  }, new Map()), 0);
  assert.equal(getCourseProgressPercent({
    subjects: [{ id: 'subject-1', completedUnitCount: 9, totalUnitCount: 2 }],
  }, new Map()), 100);
});

test('covered single-subject enrollments are represented by their matching bundle', async () => {
  const { groupCoveredEnrolledCourses } = await import(
    '../../client/src/utils/lessonPracticeCatalog.js'
  );
  const subjects = ['word', 'excel', 'powerpoint', 'computer'].map((id) => ({
    id,
    name: id,
    opened: true,
    totalUnitCount: 2,
    completedUnitCount: 0,
  }));
  const courses = [
    ...subjects.map((subject) => ({
      id: `single-${subject.id}`,
      enrolled: true,
      offerType: 'single',
      deliveryMode: 'video',
      subjects: [subject],
    })),
    {
      id: 'office-bundle',
      enrolled: false,
      hiddenByEnrollment: true,
      offerType: 'bundle',
      deliveryMode: 'video',
      subjects,
    },
    {
      id: 'unrelated-course',
      enrolled: true,
      offerType: 'single',
      deliveryMode: 'video',
      subjects: [{ id: 'other-subject', name: 'other-subject' }],
    },
  ];

  const grouped = groupCoveredEnrolledCourses(courses);
  assert.equal(grouped[0].id, 'office-bundle');
  assert.equal(grouped[0].enrolled, true);
  assert.deepEqual(grouped[0].subjects.map((subject) => subject.id), [
    'word', 'excel', 'powerpoint', 'computer',
  ]);
  assert.deepEqual(grouped.slice(1).map((course) => course.id), ['unrelated-course']);
});

test('does not group courses unless a matching covered bundle exists', async () => {
  const { groupCoveredEnrolledCourses } = await import(
    '../../client/src/utils/lessonPracticeCatalog.js'
  );
  const course = {
    id: 'single-word',
    enrolled: true,
    offerType: 'single',
    deliveryMode: 'video',
    subjects: [{ id: 'word' }],
  };

  assert.deepEqual(groupCoveredEnrolledCourses([course]), [course]);
});
