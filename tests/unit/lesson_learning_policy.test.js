'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isLessonAllowEarlyAccess,
  resolveCanAccessLesson,
  evaluateCompletionRequirement,
  resolveLessonLearningState,
  LESSON_COMPLETION_REQUIREMENT_CODE,
} = require('../../utils/lessonLearningPolicy');

const course = {
  chapters: [
    {
      lessons: [
        { id: 'l1', antiSeek: true, duration: 90 },
        { id: 'l2', antiSeek: false, duration: 90 },
        { id: 'l3', antiSeek: true, duration: 90, allowEarlyAccess: true },
        { id: 'l4', antiSeek: false, duration: 90, allowEarlyAccess: true },
      ],
    },
  ],
};

test('allowEarlyAccess defaults false', () => {
  assert.equal(isLessonAllowEarlyAccess({}), false);
  assert.equal(isLessonAllowEarlyAccess({ allowEarlyAccess: false }), false);
  assert.equal(isLessonAllowEarlyAccess({ allowEarlyAccess: true }), true);
});

test('ACCESS: lesson 1 always open', () => {
  const a = resolveCanAccessLesson({
    course,
    lessonId: 'l1',
    lesson: course.chapters[0].lessons[0],
    completedLessonIds: [],
  });
  assert.equal(a.canAccess, true);
  assert.equal(a.isFirstLesson, true);
});

test('ACCESS: lesson 2 locked without prerequisite', () => {
  const a = resolveCanAccessLesson({
    course,
    lessonId: 'l2',
    lesson: course.chapters[0].lessons[1],
    completedLessonIds: [],
  });
  assert.equal(a.canAccess, false);
  assert.equal(a.prerequisiteCompleted, false);
});

test('ACCESS: lesson 2 opens after lesson 1 completed', () => {
  const a = resolveCanAccessLesson({
    course,
    lessonId: 'l2',
    lesson: course.chapters[0].lessons[1],
    completedLessonIds: ['l1'],
  });
  assert.equal(a.canAccess, true);
});

test('ACCESS: allowEarlyAccess opens without prerequisite', () => {
  const a = resolveCanAccessLesson({
    course,
    lessonId: 'l3',
    lesson: course.chapters[0].lessons[2],
    completedLessonIds: [],
  });
  assert.equal(a.canAccess, true);
  assert.equal(a.allowEarlyAccess, true);
  assert.equal(a.prerequisiteCompleted, false);
});

test('COMPLETION: always requires >= 2/3 regardless of flags', () => {
  const under = evaluateCompletionRequirement({ watchedSeconds: 50, effectiveDuration: 90 });
  assert.equal(under.requiredSeconds, 60);
  assert.equal(under.completionEligible, false);

  const ok = evaluateCompletionRequirement({ watchedSeconds: 60, effectiveDuration: 90 });
  assert.equal(ok.completionEligible, true);
});

test('COMPLETION: duration 0 is unknown (not fake required=1)', () => {
  const zero = evaluateCompletionRequirement({ watchedSeconds: 0, effectiveDuration: 0 });
  assert.equal(zero.requiredSeconds, 0);
  assert.equal(zero.completionEligible, false);
  assert.equal(zero.durationUnknown, true);
  const still = evaluateCompletionRequirement({ watchedSeconds: 5, effectiveDuration: 0 });
  assert.equal(still.completionEligible, false);
  assert.equal(still.durationUnknown, true);
});

test('COMPLETION: YouTube duration drives 2/3 when admin was 0', () => {
  const {
    resolveEffectiveDuration,
  } = require('../../utils/antiSeekPolicy');
  const eff = resolveEffectiveDuration(0, 900);
  assert.equal(eff, 900);
  const ok = evaluateCompletionRequirement({ watchedSeconds: 600, effectiveDuration: eff });
  assert.equal(ok.requiredSeconds, 600);
  assert.equal(ok.completionEligible, true);
  assert.equal(ok.durationUnknown, false);
});

test('CASE matrix: ACCESS/SEEK/COMPLETION independence via resolveLessonLearningState', () => {
  // CASE 1: antiSeek ON, early OFF, no progress
  const c1 = resolveLessonLearningState({
    lesson: course.chapters[0].lessons[1],
    index: 1,
    course,
    completedLessonIds: [],
    watchedSeconds: 10,
  });
  assert.equal(c1.canAccess, false);
  assert.equal(c1.antiSeekEnabled, false); // l2 antiSeek false
  assert.equal(c1.completionEligible, false);

  // CASE 1b: l1 antiSeek ON
  const c1b = resolveLessonLearningState({
    lesson: course.chapters[0].lessons[0],
    index: 0,
    course,
    completedLessonIds: [],
    watchedSeconds: 10,
  });
  assert.equal(c1b.canAccess, true);
  assert.equal(c1b.antiSeekEnabled, true);
  assert.equal(c1b.completionEligible, false);

  // CASE 2: antiSeek OFF, early OFF, unlocked after prev
  const c2 = resolveLessonLearningState({
    lesson: course.chapters[0].lessons[1],
    index: 1,
    course,
    completedLessonIds: ['l1'],
    watchedSeconds: 10,
  });
  assert.equal(c2.canAccess, true);
  assert.equal(c2.antiSeekEnabled, false);
  assert.equal(c2.canSeekFreely, true);
  assert.equal(c2.completionEligible, false);

  // CASE 3: antiSeek OFF, early ON
  const c3 = resolveLessonLearningState({
    lesson: course.chapters[0].lessons[3],
    index: 3,
    course,
    completedLessonIds: [],
    watchedSeconds: 10,
  });
  assert.equal(c3.canAccess, true);
  assert.equal(c3.allowEarlyAccess, true);
  assert.equal(c3.antiSeekEnabled, false);
  assert.equal(c3.completionEligible, false);

  // CASE 4: antiSeek ON, early ON + enough watch
  const c4 = resolveLessonLearningState({
    lesson: course.chapters[0].lessons[2],
    index: 2,
    course,
    completedLessonIds: [],
    watchedSeconds: 60,
  });
  assert.equal(c4.canAccess, true);
  assert.equal(c4.antiSeekEnabled, true);
  assert.equal(c4.completionEligible, true);
});

test('complete-lesson route always enforces completion code (not antiSeek-gated)', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '../../routes/trainingRoutes.js'), 'utf8');
  assert.ok(src.includes('LESSON_COMPLETION_REQUIREMENT_CODE'));
  assert.ok(src.includes('evaluateCompletionRequirement'));
  assert.ok(src.includes('isLessonAllowEarlyAccess'));
  assert.ok(src.includes('resolveLessonLearningState'));
  assert.ok(src.includes('PREVIOUS_LESSON_REQUIRED'));
  // Must NOT gate completion only inside antiSeekOn block
  assert.ok(!/if\s*\(\s*antiSeekOn\s*\)\s*\{[\s\S]*?completionEligible/.test(src));
  assert.equal(LESSON_COMPLETION_REQUIREMENT_CODE, 'LESSON_COMPLETION_REQUIREMENT_NOT_MET');
});

test('FE players no longer complete immediately when antiSeek off', () => {
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
  assert.ok(!student.includes('if (!antiSeekEnabled) {\n      eligibilitySentRef.current = true'));
  assert.ok(student.includes('evaluateCompletionRequirement'));
  assert.ok(teacher.includes('evaluateCompletionRequirement'));
  assert.ok(student.includes('isCompletionRequirementCode'));
  assert.ok(teacher.includes('isCompletionRequirementCode'));
});

test('Admin Course Builder exposes both antiSeek and allowEarlyAccess', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const admin = fs.readFileSync(
    path.join(__dirname, '../../client/src/components/AdminCourseBuilder.jsx'),
    'utf8'
  );
  assert.ok(admin.includes('allowEarlyAccess'));
  assert.ok(admin.includes('tempAllowEarlyAccess'));
  assert.ok(admin.includes('vẫn phải đạt 2/3 thời lượng để hoàn thành'));
  assert.ok(admin.includes('mở bài này trước khi hoàn thành bài trước'));
});
