'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isLessonAntiSeekEnabled,
  parseLessonDurationSeconds,
  requiredWatchSeconds,
  resolveEffectiveDuration,
  findLessonInCourse,
  clampWatchProgressIncrease,
  listCourseLessonIds,
  previousLessonId,
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

test('resolveEffectiveDuration prefers sane YouTube duration', () => {
  assert.equal(resolveEffectiveDuration(600, 580), 580);
  assert.equal(resolveEffectiveDuration('10:00', 580), 580);
  assert.equal(resolveEffectiveDuration(600, 0), 600);
  assert.equal(resolveEffectiveDuration(0, 580), 580);
  // Client under-reports (<45% admin) → fail-closed to admin
  assert.equal(resolveEffectiveDuration(600, 200), 600);
});

test('previousLessonId / listCourseLessonIds sequential order', () => {
  const course = {
    chapters: [
      { lessons: [{ id: 'a' }, { id: 'b' }] },
      { lessons: [{ _id: 'c' }] },
    ],
  };
  assert.deepEqual(listCourseLessonIds(course), ['a', 'b', 'c']);
  assert.equal(previousLessonId(course, 'a'), null);
  assert.equal(previousLessonId(course, 'b'), 'a');
  assert.equal(previousLessonId(course, 'c'), 'b');
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

test('complete-lesson route source enforces completion + sequential prev', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../../routes/trainingRoutes.js'), 'utf8');
  assert.ok(src.includes('LESSON_COMPLETION_REQUIREMENT_CODE'));
  assert.ok(src.includes('PREVIOUS_LESSON_REQUIRED'));
  assert.ok(src.includes('resolveEffectiveDuration'));
  assert.ok(src.includes('contentLocked'));
  assert.ok(src.includes('evaluateCompletionRequirement'));
  assert.ok(src.includes('clampWatchProgressIncrease'));
  assert.ok(src.includes('completionEligible'));
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
  assert.ok(student.includes('videoDuration'));
  assert.ok(student.includes('resolveEffectiveDuration'));
  assert.ok(!teacher.includes('teacher_anti_seek'));
  assert.ok(!teacher.includes('Tắt chống tua bài này'));
  assert.ok(teacher.includes('isLessonAntiSeekEnabled'));
  assert.ok(teacher.includes('videoDuration'));
});
