'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isLessonAntiSeekEnabled,
  parseLessonDurationSeconds,
  requiredWatchSeconds,
  findLessonInCourse,
  clampWatchProgressIncrease,
} = require('../../utils/antiSeekPolicy');

test('SoT: antiSeek !== false => enabled', () => {
  assert.equal(isLessonAntiSeekEnabled({ antiSeek: true }), true);
  assert.equal(isLessonAntiSeekEnabled({ antiSeek: false }), false);
  assert.equal(isLessonAntiSeekEnabled({}), true);
  assert.equal(isLessonAntiSeekEnabled(null), true);
  assert.equal(isLessonAntiSeekEnabled(undefined), true);
});

test('requiredWatchSeconds is ceil(2/3)', () => {
  assert.equal(requiredWatchSeconds(900), 600);
  assert.equal(requiredWatchSeconds(10), 7);
  assert.equal(requiredWatchSeconds(0), 0);
});

test('parseLessonDurationSeconds supports number and mm:ss', () => {
  assert.equal(parseLessonDurationSeconds(900), 900);
  assert.equal(parseLessonDurationSeconds('15:00'), 900);
  assert.equal(parseLessonDurationSeconds('1:30'), 90);
  assert.equal(parseLessonDurationSeconds(''), 0);
});

test('findLessonInCourse walks lessons/videos/chapters', () => {
  const course = {
    chapters: [
      { lessons: [{ id: 'a', antiSeek: true, duration: 100 }] },
      { lessons: [{ _id: 'b', antiSeek: false, duration: 200 }] },
    ],
  };
  assert.equal(findLessonInCourse(course, 'b').antiSeek, false);
  assert.equal(findLessonInCourse(course, 'a').duration, 100);
  assert.equal(findLessonInCourse(course, 'missing'), null);
});

test('clampWatchProgressIncrease blocks one-shot inflate', () => {
  const now = Date.now();
  const next = clampWatchProgressIncrease({
    previous: 100,
    incoming: 900,
    lastWatchedAt: new Date(now - 5000),
    maxSeconds: 900,
  });
  assert.ok(next < 200, `expected modest bump, got ${next}`);
  assert.ok(next >= 100);
});

test('clampWatchProgressIncrease first save accepts incoming (bounded by max)', () => {
  const next = clampWatchProgressIncrease({
    previous: 0,
    incoming: 50,
    lastWatchedAt: null,
    maxSeconds: 900,
  });
  assert.equal(next, 50);
});

test('complete-lesson route source enforces ANTI_SEEK_PROGRESS_REQUIRED', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../../routes/trainingRoutes.js'), 'utf8');
  assert.ok(src.includes('ANTI_SEEK_PROGRESS_REQUIRED'));
  assert.ok(src.includes('isLessonAntiSeekEnabled'));
  assert.ok(src.includes('clampWatchProgressIncrease'));
  assert.ok(src.includes('credited < minRequired'));
});

test('FE players do not override Admin antiSeek via localStorage', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const student = fs.readFileSync(
    path.join(__dirname, '../../client/src/components/StudentTrainingLMS.jsx'),
    'utf8'
  );
  const teacher = fs.readFileSync(
    path.join(__dirname, '../../client/src/components/TeacherTrainingLMS.jsx'),
    'utf8'
  );
  assert.ok(!student.includes('student_anti_seek_disabled'));
  assert.ok(!student.includes('admin_anti_seek_disabled'));
  assert.ok(!student.includes('if (false)'));
  assert.ok(student.includes('isLessonAntiSeekEnabled'));
  assert.ok(!teacher.includes('teacher_anti_seek'));
  assert.ok(!teacher.includes('Tắt chống tua bài này'));
  assert.ok(teacher.includes('isLessonAntiSeekEnabled'));
});
