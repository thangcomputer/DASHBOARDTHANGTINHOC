'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('../../services/lessonPracticeRules');
const { collectSubjectsFromCourses } = require('../../services/examSubjectCatalog');
const {
  effectiveCoursePrice,
  studentHasCourse,
} = require('../../services/lessonPracticePurchaseService');
const { isPreviewUnit } = require('../../services/lessonPracticeService');
const {
  calculateDiscountPrice,
  isCourseDiscountActive,
  effectiveCoursePrice: priceAtTime,
} = require('../../utils/coursePricing');

test('multi, match and drag grade only the full correct answer', () => {
  const multi = {
    type: 'multi',
    options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }, { id: 'c', text: 'C' }],
    correctOptionIds: ['a', 'c'],
  };
  assert.equal(rules.gradeObjective(multi, { choiceIds: ['c', 'a'] }).correct, true);
  assert.equal(rules.gradeObjective(multi, { choiceIds: ['a'] }).correct, false);
  const match = { type: 'match', pairs: [{ id: '1', left: 'Ứng dụng A', right: 'Mô tả A' }, { id: '2', left: 'Ứng dụng B', right: 'Mô tả B' }] };
  assert.equal(rules.gradeObjective(match, { matches: [{ leftId: '1', rightId: '1' }, { leftId: '2', rightId: '2' }] }).correct, true);
  assert.equal(rules.gradeObjective(match, { matches: [{ leftId: '1', rightId: '2' }, { leftId: '2', rightId: '1' }] }).correct, false);
  const drag = { type: 'drag', options: [{ id: 'a', text: '1' }, { id: 'b', text: '2' }] };
  assert.equal(rules.gradeObjective(drag, { order: ['a', 'b'] }).correct, true);
  assert.equal(rules.gradeObjective(drag, { order: ['b', 'a'] }).correct, false);
  assert.equal(rules.writtenPasses(71), true);
  assert.equal(rules.writtenPasses(70), false);
  assert.equal(rules.writtenPasses(100), true);
  const timed = rules.normalizeItem({
    type: 'mcq',
    prompt: 'Câu giờ',
    options: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }],
    correctOptionId: 'a',
    timeLimitSec: 90,
  });
  assert.equal(timed.timeLimitSec, 90);
  assert.equal(rules.normalizeItem({ ...timed, timeLimitSec: 99999 }).timeLimitSec, 3600);
  const imageItem = rules.normalizeItem({ ...timed, imageName: 'hinh-minh-hoa.jpg' });
  assert.equal(imageItem.imageName, 'hinh-minh-hoa.jpg');
  assert.equal(rules.normalizeItem({ ...timed, imageName: 'a'.repeat(300) }).imageName.length, 255);
  assert.equal(rules.publicItem({ _id: '1', type: 'mcq', timeLimitSec: 45 }).timeLimitSec, 45);
  assert.equal('imageName' in rules.publicItem({ _id: '1', type: 'mcq', imageName: 'hinh-minh-hoa.jpg' }), false);
  assert.equal(rules.clampTimeLimit(60), 60);
  assert.equal(rules.clampTimeLimit(0), 0);
  assert.equal(rules.clampTimeLimit(-5), 0);
});

test('hotspot accepts a click inside the region only', () => {
  const region = { x: 10, y: 20, w: 30, h: 15 };
  assert.equal(rules.pointInRegion(10, 20, region), true);
  assert.equal(rules.pointInRegion(40, 35, region), true);
  assert.equal(rules.pointInRegion(41, 20, region), false);
  assert.equal(rules.pointInRegion(15, 36, region), false);
});

test('lesson subject opens only when the registered course includes it', () => {
  const subjectA = { slug: 'subject-a', name: 'Môn A' };
  const subjectB = { slug: 'subject-b', name: 'Môn B' };
  assert.equal(rules.subjectOpenedByKeys(subjectA, ['subject-a']), true);
  assert.equal(rules.subjectOpenedByKeys(subjectB, ['subject-a']), false);
  assert.equal(rules.subjectOpenedByKeys({ slug: 'subject-c', name: 'Môn C' }, ['subject-a', 'subject-b']), false);
  assert.equal(rules.subjectOpenedByKeys({ slug: 'subject-d', examSubjectId: 'subject-d' }, ['subject-d']), true);
});

test('a course is hidden only when active enrollments cover every subject it contains', () => {
  const ownedBundleSubjects = new Set(['subject-a-advanced', 'subject-b-advanced']);
  assert.equal(rules.courseSubjectsCovered(['subject-a-advanced'], ownedBundleSubjects), true);
  assert.equal(rules.courseSubjectsCovered(['subject-a-advanced', 'subject-b-advanced', 'subject-c-advanced'], ownedBundleSubjects), false);
  ownedBundleSubjects.add('subject-c-advanced');
  assert.equal(rules.courseSubjectsCovered(['subject-a-advanced', 'subject-b-advanced', 'subject-c-advanced'], ownedBundleSubjects), true);

  const ownedIndividualSubjects = new Set(['subject-a', 'subject-b']);
  assert.equal(rules.courseSubjectsCovered(['subject-a', 'subject-b', 'subject-c'], ownedIndividualSubjects), false);
  ownedIndividualSubjects.add('subject-c');
  assert.equal(rules.courseSubjectsCovered(['subject-a', 'subject-b', 'subject-c'], ownedIndividualSubjects), true);
  assert.equal(rules.courseSubjectsCovered([], ownedIndividualSubjects), false);
});

test('published courses do not generate new lesson subjects from course subject IDs', () => {
  const discovered = collectSubjectsFromCourses([
    { examSubjects: ['topic-a-basic', 'topic-b-advanced'] },
    { examSubjects: ['topic-a-basic'] },
  ], []);

  assert.deepEqual(discovered, []);
});

test('course cards use the exact matching lesson subject name instead of a nearby subject', () => {
  const subjects = [
    { id: '1', slug: 'topic-a-basic', name: 'CHỦ ĐỀ A CƠ BẢN', opened: false, totalUnitCount: 2, completedUnitCount: 1 },
    { id: '2', slug: 'topic-a-advanced', name: 'CHỦ ĐỀ A NÂNG CAO', opened: false, totalUnitCount: 4, completedUnitCount: 3 },
  ];
  const mapped = rules.mapCourseSubjectsToLessons(
    ['topic-a-advanced', 'topic-a-basic'],
    subjects,
    new Map(),
    [],
  );

  assert.deepEqual(mapped, [
    { id: '2', name: 'CHỦ ĐỀ A NÂNG CAO', opened: false, completedUnitCount: 3, totalUnitCount: 4 },
    { id: '1', name: 'CHỦ ĐỀ A CƠ BẢN', opened: false, completedUnitCount: 1, totalUnitCount: 2 },
  ]);
});

test('course purchases use the active discounted price and only treat accessible active enrollments as owned', () => {
  assert.equal(effectiveCoursePrice({ price: 100000, discountPrice: 80000, discountPercent: 20 }), 79000);
  assert.equal(effectiveCoursePrice({ price: 100000, discountPrice: 80000, discountPercent: 0 }), 100000);

  const course = { _id: 'course-1', name: 'Khóa học A' };
  assert.equal(studentHasCourse({
    enrollments: [{ courseId: 'course-1', status: 'active', learningAccess: true }],
  }, course), true);
  assert.equal(studentHasCourse({
    enrollments: [{ courseName: 'KHOA HOC A', status: 'active', learningAccess: true }],
  }, course), true);
  assert.equal(studentHasCourse({ course: 'Khóa học A', courseId: 'course-1' }, course), true);
  assert.equal(studentHasCourse({
    enrollments: [{ courseId: 'course-1', status: 'refunded', learningAccess: false }],
  }, course), false);
});

test('scheduled course discounts activate and expire at their configured timestamps', () => {
  const course = {
    price: 100000,
    discountPrice: 80000,
    discountPercent: 20,
    discountStartsAt: '2026-10-10T00:00:00.000Z',
    discountEndsAt: '2026-10-11T00:00:00.000Z',
  };
  assert.equal(isCourseDiscountActive(course, new Date('2026-10-09T23:59:59.999Z')), false);
  assert.equal(priceAtTime(course, new Date('2026-10-09T23:59:59.999Z')), 100000);
  assert.equal(isCourseDiscountActive(course, new Date('2026-10-10T00:00:00.000Z')), true);
  assert.equal(priceAtTime(course, new Date('2026-10-10T12:00:00.000Z')), 79000);
  assert.equal(isCourseDiscountActive(course, new Date('2026-10-11T00:00:00.000Z')), false);
  assert.equal(priceAtTime(course, new Date('2026-10-11T00:00:00.000Z')), 100000);
  assert.equal(isCourseDiscountActive({
    price: 100000,
    discountPrice: 80000,
    discountPercent: 20,
  }, new Date('2026-10-11T00:00:00.000Z')), true);
});

test('discounted course prices round to the nearest ten thousand', () => {
  assert.equal(calculateDiscountPrice(1699000, 11), 1509000);
  assert.equal(calculateDiscountPrice(599000, 34), 399000);
  assert.equal(calculateDiscountPrice(749000, 0), 749000);
  assert.equal(calculateDiscountPrice(100000, 10.5), 89000);
  assert.equal(calculateDiscountPrice(100000, 10.6), 89000);
  assert.equal(calculateDiscountPrice(100000, 5), 99000);
  assert.equal(calculateDiscountPrice(100000, 5.01), 89000);
  assert.equal(calculateDiscountPrice(599000, 16), 499000);
  assert.equal(
    priceAtTime({ price: 1699000, discountPrice: 1512110, discountPercent: 11 }),
    1509000,
  );
});

test('preview access is enabled only for units explicitly opened by an admin', () => {
  assert.equal(isPreviewUnit({ isPreviewAllowed: true }), true);
  assert.equal(isPreviewUnit({ isPreviewAllowed: false }), false);
  assert.equal(isPreviewUnit({}), false);
  assert.equal(isPreviewUnit(null), false);
});

test('a unit completes only after video, reading and practice', () => {
  const unit = { videoUrl: 'https://youtu.be/abc', note: 'Nội dung' };
  assert.equal(rules.unitChecklist(unit, {}, false).completed, false);
  assert.equal(rules.unitChecklist(unit, { videoDone: true, noteDone: true }, true).completed, true);
  assert.equal(rules.unitChecklist({ videoUrl: '', note: '' }, {}, true).completed, true);
  assert.equal(rules.unitChecklist(unit, { status: 'completed' }, false).videoDone, true);
});

test('multiple videos and lesson contents must each be completed', () => {
  const unit = {
    videos: [{ id: 'v1', url: 'https://youtu.be/one' }, { id: 'v2', url: 'https://youtu.be/two' }],
    contents: [{ id: 'n1', content: 'Phần một' }, { id: 'n2', content: 'Phần hai' }],
  };
  const firstDone = rules.unitChecklist(unit, {
    completedVideoIds: ['v1'],
    completedNoteIds: ['n1', 'n2'],
    practiceDone: true,
  });
  assert.equal(firstDone.videoDone, false);
  assert.equal(firstDone.noteDone, true);
  assert.equal(firstDone.completed, false);

  const allDone = rules.unitChecklist(unit, {
    completedVideoIds: ['v1', 'v2'],
    completedNoteIds: ['n1', 'n2'],
    practiceDone: true,
  });
  assert.equal(allDone.completed, true);

  const expandedCompletedLegacyUnit = rules.unitChecklist({
    videos: [{ id: 'legacy-video', url: 'https://youtu.be/old' }, { id: 'v2', url: 'https://youtu.be/new' }],
    contents: [{ id: 'legacy-note', content: 'Cũ' }, { id: 'n2', content: 'Mới' }],
  }, { status: 'completed' });
  assert.equal(expandedCompletedLegacyUnit.videoDone, false);
  assert.equal(expandedCompletedLegacyUnit.noteDone, false);
  assert.deepEqual(expandedCompletedLegacyUnit.videoDoneIds, ['legacy-video']);
  assert.deepEqual(expandedCompletedLegacyUnit.noteDoneIds, ['legacy-note']);
});

test('optional sections do not block an empty unit, but every added requirement blocks the next unit', () => {
  assert.equal(rules.unitChecklist({}, {}, true).completed, true);
  assert.equal(rules.unitChecklist({
    videos: [{ id: 'v1', url: 'https://youtu.be/one' }],
    contents: [],
  }, {}, true).completed, false);
  assert.equal(rules.unitChecklist({
    videos: [],
    contents: [{ id: 'n1', content: 'Bài đọc' }],
  }, {}, true).completed, false);
  assert.equal(rules.unitChecklist({
    videos: [],
    contents: [],
  }, {}, false).completed, false);

  const expandedCompletedUnit = {
    videos: [{ id: 'v1', url: 'https://youtu.be/one' }, { id: 'v2', url: 'https://youtu.be/two' }],
    contents: [{ id: 'n1', content: 'Bài đọc cũ' }, { id: 'n2', content: 'Bài đọc mới' }],
  };
  const check = rules.unitChecklist(expandedCompletedUnit, {
    status: 'completed',
    completedVideoIds: ['v1'],
    completedNoteIds: ['n1'],
    practiceDone: true,
  }, false);
  assert.equal(check.completed, false);
  assert.equal(rules.isUnitLocked(
    [{ _id: 'one', sortOrder: 1 }, { _id: 'two', sortOrder: 2 }],
    new Set(),
    'two',
  ), true);
});

test('practice completion is independent from video completion', () => {
  const unit = { videos: [{ id: 'video-1' }, { id: 'video-2' }] };
  const onlyPracticeDone = rules.unitChecklist(unit, {
    practiceDone: true,
    completedVideoIds: ['video-1'],
  }, true);
  assert.equal(onlyPracticeDone.practiceDone, true);
  assert.equal(onlyPracticeDone.videoDone, false);
  assert.equal(onlyPracticeDone.completed, false);

  const allSectionsDone = rules.unitChecklist(unit, {
    practiceDone: true,
    completedVideoIds: ['video-1', 'video-2'],
  }, true);
  assert.equal(allSectionsDone.practiceDone, true);
  assert.equal(allSectionsDone.videoDone, true);
  assert.equal(allSectionsDone.completed, true);
});

test('later units stay locked until every previous unit is completed', () => {
  const units = [
    { _id: 'a', sortOrder: 1 },
    { _id: 'b', sortOrder: 2 },
    { _id: 'c', sortOrder: 3 },
  ];
  assert.equal(rules.isUnitLocked(units, new Set(), 'a'), false);
  assert.equal(rules.isUnitLocked(units, new Set(), 'b'), true);
  assert.equal(rules.isUnitLocked(units, new Set(['a']), 'b'), false);
  assert.equal(rules.isUnitLocked(units, new Set(['a']), 'c'), true);
});

test('an explicitly preview-enabled unit can open before earlier units are completed', () => {
  const units = [
    { _id: 'a', sortOrder: 1 },
    { _id: 'b', sortOrder: 2 },
    { _id: 'c', sortOrder: 3 },
  ];
  assert.equal(rules.isUnitLocked(units, new Set(), 'c', new Set(['c'])), false);
  assert.equal(rules.isUnitLocked(units, new Set(), 'b'), true);
});

test('admin progress summary has no score fields', () => {
  const summary = rules.describeProgress(
    [
      { _id: 'u1', title: 'Buổi 1', sortOrder: 1, isActive: true },
      { _id: 'u2', title: 'Buổi 2', sortOrder: 2, isActive: true },
    ],
    [{ unitId: 'u1', status: 'completed' }, { unitId: 'u2', status: 'in_progress' }],
  );
  assert.deepEqual(summary, {
    completedUnitCount: 1,
    totalUnitCount: 2,
    currentUnitTitle: 'Buổi 2',
    status: 'in_progress',
  });
  assert.equal('score' in summary, false);
  assert.equal('correct' in summary, false);
});

test('student item hides the answer key until confirmed', () => {
  const item = {
    _id: 'q1',
    type: 'mcq',
    prompt: 'Phím nào lưu?',
    options: [{ id: 'a', text: 'Ctrl+S' }, { id: 'b', text: 'Ctrl+P' }],
    correctOptionId: 'a',
    explanation: 'Ctrl+S là Save.',
    rubric: 'không lộ',
  };
  const hidden = rules.publicItem(item);
  assert.equal('correctOptionId' in hidden, false);
  assert.equal('explanation' in hidden, false);
  assert.equal('rubric' in hidden, false);
  const shown = rules.withConfirmedAnswer(item, {
    correct: false,
    explanation: 'Ctrl+S là Save.',
    answer: { choiceId: 'b' },
  });
  assert.equal(shown.correctOptionId, 'a');
  assert.equal(shown.explanation, 'Ctrl+S là Save.');
  assert.equal('rubric' in shown, false);
});

test('admin progress loader does not read lesson answers', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../services/lessonPracticeService.js'), 'utf8');
  const start = src.indexOf('async function listProgress');
  const end = src.indexOf('async function completionStates');
  const body = src.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.equal(body.includes('LessonAnswer'), false);
  assert.equal(body.includes('correct'), false);
  assert.equal(body.includes('explanation'), false);
});
