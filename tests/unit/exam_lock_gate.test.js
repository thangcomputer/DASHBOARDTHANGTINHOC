'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadExamSubjects() {
  const file = path.join(__dirname, '../../client/src/utils/examSubjects.js');
  return import(pathToFileURL(file).href);
}

test('exam subject options include admin-created subjects but ignore unverified stored entries', async () => {
  const {
    BUILTIN_EXAM_SUBJECTS,
    getExamSubjectOptions,
    getSubjectIdsForEnrollment,
    mapCourseToExamSubjectIds,
    mergeExamCatalog,
  } = await loadExamSubjects();
  const configuredCatalog = mergeExamCatalog([
    { id: 'course-a', label: 'Khóa A', group: 'admin' },
    { id: 'legacy-subject-id', label: 'Môn cũ' },
    { id: 'mon-moi', label: 'Môn mới', createdByAdmin: true },
  ]);

  assert.equal(Object.keys(BUILTIN_EXAM_SUBJECTS).length, 1);
  assert.deepEqual(getExamSubjectOptions(configuredCatalog), [
    { id: 'mon-kiem-thu', label: 'Môn kiểm thử', group: 'admin' },
    { id: 'mon-moi', label: 'Môn mới', group: 'admin' },
  ]);
  assert.deepEqual(getExamSubjectOptions(), [
    { id: 'mon-kiem-thu', label: 'Môn kiểm thử', group: 'admin' },
  ]);
  assert.deepEqual(mapCourseToExamSubjectIds('Môn kiểm thử'), ['mon-kiem-thu']);
  assert.deepEqual(mapCourseToExamSubjectIds('Môn mới', configuredCatalog), ['mon-moi']);
  assert.deepEqual(mapCourseToExamSubjectIds('Microsoft Excel'), []);
  assert.deepEqual(getSubjectIdsForEnrollment({
    examSubjects: ['legacy-subject-id', 'course-a', 'mon-moi', 'mon-kiem-thu'],
  }, configuredCatalog), ['mon-moi', 'mon-kiem-thu']);
  const { buildExamSubjectsFromProgress } = await loadExamSubjects();
  assert.deepEqual(
    buildExamSubjectsFromProgress(
      [{ id: 'legacy-subject-id' }, { id: 'course-a' }, { id: 'mon-kiem-thu' }],
      ['legacy-subject-id', 'course-a', 'mon-moi', 'mon-kiem-thu'],
      configuredCatalog,
    )
      .map(({ id }) => id),
    ['mon-moi', 'mon-kiem-thu'],
  );
  assert.deepEqual(getExamSubjectOptions(mergeExamCatalog([
    { id: 'legacy-subject-id', label: 'Môn cũ' },
  ])), [{ id: 'mon-kiem-thu', label: 'Môn kiểm thử', group: 'admin' }]);
});

test('server exam catalogs include explicitly created subjects but never discover them from courses', () => {
  const catalogs = [
    require('../../services/examSubjectCatalog'),
    require('../../modules/exam/services/examSubjectCatalog'),
  ];
  const configuredSubject = { id: 'course-a', label: 'Khóa A' };

  catalogs.forEach(({
    BUILTIN_EXAM_SUBJECTS,
    collectSubjectsFromCourses,
    getMergedExamCatalog,
    inferExamSubjectsFromCourseName,
    normalizeCustomList,
    sanitizeCustomExamSubjectEntry,
    sanitizeExamSubjects,
  }) => {
    const oldSubject = { id: 'legacy-subject-id', label: 'Môn cũ' };
    const createdSubject = {
      id: 'mon-moi',
      label: 'Môn mới',
      createdByAdmin: true,
    };
    const numberedSampleSubject = sanitizeCustomExamSubjectEntry({
      id: 'sample-subject-3',
      label: 'Môn mẫu 3',
    });
    const sampleSubject = sanitizeCustomExamSubjectEntry({
      id: 'sample-subject',
      label: 'Môn mẫu',
    });
    assert.deepEqual(BUILTIN_EXAM_SUBJECTS, [
      { id: 'mon-kiem-thu', label: 'Môn kiểm thử' },
    ]);
    assert.deepEqual(getMergedExamCatalog([configuredSubject]).map(({ id, label }) => ({ id, label })), [
      { id: 'mon-kiem-thu', label: 'Môn kiểm thử' },
    ]);
    assert.deepEqual(getMergedExamCatalog([]), [
      { id: 'mon-kiem-thu', label: 'Môn kiểm thử' },
    ]);
    assert.deepEqual(normalizeCustomList([configuredSubject]), []);
    assert.deepEqual(normalizeCustomList([oldSubject]), []);
    assert.deepEqual(
      normalizeCustomList([
        { id: 'word', label: 'Dữ liệu cũ không xác minh' },
        { id: 'word', label: 'Word', createdByAdmin: true },
      ]).map(({ id, label }) => ({ id, label })),
      [{ id: 'word', label: 'Word' }],
    );
    assert.deepEqual(getMergedExamCatalog([createdSubject]).map(({ id }) => id), [
      'mon-kiem-thu',
      'mon-moi',
    ]);
    assert.equal(numberedSampleSubject.id, 'sample-subject-3');
    assert.deepEqual(
      getMergedExamCatalog([numberedSampleSubject]).map(({ id }) => id),
      ['mon-kiem-thu', 'sample-subject-3'],
    );
    assert.equal(sampleSubject.id, 'sample-subject');
    assert.deepEqual(
      getMergedExamCatalog([sampleSubject]).map(({ id }) => id),
      ['mon-kiem-thu', 'sample-subject'],
    );
    assert.deepEqual(inferExamSubjectsFromCourseName('Course A', null, []), []);
    assert.deepEqual(inferExamSubjectsFromCourseName('Khóa A', null, [configuredSubject]), []);
    assert.deepEqual(inferExamSubjectsFromCourseName('Microsoft Excel', null, []), []);
    assert.deepEqual(inferExamSubjectsFromCourseName('Môn kiểm thử', null, []), ['mon-kiem-thu']);
    assert.deepEqual(getMergedExamCatalog([oldSubject]).map(({ id }) => id), ['mon-kiem-thu']);
    assert.deepEqual(
      sanitizeExamSubjects(['legacy-subject-id', 'course-a', 'mon-moi', 'mon-kiem-thu'], [createdSubject]),
      ['mon-moi', 'mon-kiem-thu'],
    );
    assert.deepEqual(
      sanitizeExamSubjects(['mon-moi'], [createdSubject]),
      ['mon-moi'],
    );
    assert.deepEqual(collectSubjectsFromCourses([
      { examSubjects: ['legacy-subject-id', 'course-b'] },
    ], []), []);
  });
});

test('a missing subject ID cannot pass the student exam-progress gate', () => {
  const { canStudentWriteExamProgress } = require('../../services/examProgressService');
  assert.equal(canStudentWriteExamProgress({
    studentExamUnlocked: true,
    enrollments: [{
      status: 'active',
      examSubjects: ['mon-kiem-thu'],
      examUnlocked: true,
    }],
  }, ''), false);
});

test('isExamProgressLocked: lockUntil future', async () => {
  const { isExamProgressLocked } = await loadExamSubjects();
  const now = 1_000_000;
  assert.equal(isExamProgressLocked({ status: 'chua_thi', lockUntil: now + 1000 }, now), true);
  assert.equal(isExamProgressLocked({ status: 'chua_thi', lockUntil: now - 1000 }, now), false);
});

test('isExamProgressLocked: khong_dat always locked until admin reset', async () => {
  const { isExamProgressLocked, canEnterCertificationExam } = await loadExamSubjects();
  const now = Date.now();
  assert.equal(isExamProgressLocked({ status: 'khong_dat', lockUntil: null }, now), true);
  assert.equal(canEnterCertificationExam({ status: 'khong_dat' }, now), false);
  assert.equal(canEnterCertificationExam({ status: 'khong_dat', lockUntil: now - 1 }, now), false);
});

test('canEnterCertificationExam: chua_thi / dang_thi allowed', async () => {
  const { canEnterCertificationExam } = await loadExamSubjects();
  const now = Date.now();
  assert.equal(canEnterCertificationExam({ status: 'chua_thi' }, now), true);
  assert.equal(canEnterCertificationExam({ status: 'dang_thi' }, now), true);
  assert.equal(canEnterCertificationExam(null, now), true);
  assert.equal(canEnterCertificationExam({ status: 'dat' }, now), false);
  assert.equal(canEnterCertificationExam({ status: 'dang_thi', lockUntil: now + 99999 }, now), false);
});

test('canStartCertificationSubject: unlocked or milestone, not locked fail', async () => {
  const { canStartCertificationSubject } = await loadExamSubjects();
  const catalog = undefined;
  const enrollments = [{
    courseName: 'Khóa nội bộ',
    examSubjects: ['mon-kiem-thu', 'subject-a', 'subject-b'],
    completedSessions: 12,
    totalSessions: 12,
    examUnlocked: false,
  }];
  const student = {
    course: 'Khóa nội bộ',
    completedSessions: 12,
    totalSessions: 12,
    studentExamUnlocked: false,
  };
  assert.equal(canStartCertificationSubject({
    student,
    enrollments,
    subjectId: 'mon-kiem-thu',
    catalog,
    examProgressEntry: { status: 'chua_thi' },
  }), true);
  assert.equal(canStartCertificationSubject({
    student,
    enrollments,
    subjectId: 'subject-a',
    catalog,
    examProgressEntry: { status: 'chua_thi' },
  }), false);
  assert.equal(canStartCertificationSubject({
    student,
    enrollments,
    subjectId: 'mon-kiem-thu',
    catalog,
    examProgressEntry: { status: 'khong_dat' },
  }), false);
});

test('course filter returns only the test subject from enrollment mappings', async () => {
  const { getSubjectIdsForCourseFilter } = await loadExamSubjects();
  const enrollment = {
    courseName: 'Khóa nâng cao A',
    examSubjects: ['subject-a-advanced', 'mon-kiem-thu', 'subject-c-advanced'],
  };

  assert.deepEqual(
    getSubjectIdsForCourseFilter([enrollment], enrollment.courseName),
    ['mon-kiem-thu'],
  );
});

test('course filter excludes unsupported IDs from partial enrollment configuration', async () => {
  const { getSubjectIdsForCourseFilter } = await loadExamSubjects();
  const enrollment = {
    courseName: 'Khóa nâng cao A',
    examSubjects: ['subject-a', 'mon-kiem-thu'],
  };

  assert.deepEqual(
    getSubjectIdsForCourseFilter([enrollment], enrollment.courseName),
    ['mon-kiem-thu'],
  );
});

test('course filter returns no subjects when enrollment has no explicit subject mapping', async () => {
  const { getSubjectIdsForCourseFilter } = await loadExamSubjects();
  assert.deepEqual(
    getSubjectIdsForCourseFilter([{ courseName: 'Khóa nâng cao A' }], 'Khóa nâng cao A'),
    [],
  );
});

test('all-courses filter only unions the test subject from active enrollments', async () => {
  const { getSubjectIdsForCourseFilter } = await loadExamSubjects();
  assert.deepEqual(
    getSubjectIdsForCourseFilter([
      { courseName: 'Khóa A', examSubjects: ['mon-kiem-thu'], status: 'active' },
      { courseName: 'Khóa B', examSubjects: ['subject-b'], status: 'completed' },
      { courseName: 'Khóa đã hủy', examSubjects: ['mon-kiem-thu'], status: 'cancelled' },
      { courseName: 'Khóa chưa cấu hình', status: 'active' },
    ], 'all'),
    ['mon-kiem-thu'],
  );
});
