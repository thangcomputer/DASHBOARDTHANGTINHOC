'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

let teacherMatchesCourse;
let mergeExamCatalog;

test.before(async () => {
  ({ teacherMatchesCourse, mergeExamCatalog } = await import('../../client/src/utils/examSubjects.js'));
});

test('teacher matching uses only the configured test subject', () => {
  const course = {
    name: 'Khóa nhiều môn',
    examSubjects: ['mon-kiem-thu', 'subject-b', 'subject-c'],
  };

  assert.equal(teacherMatchesCourse({ subjectIds: ['subject-a'] }, course), false);
  assert.equal(teacherMatchesCourse({ specialty: 'Môn không liên quan' }, course), false);
  assert.equal(teacherMatchesCourse({ subjectIds: ['mon-kiem-thu'] }, course), true);
});

test('teacher matching supports explicitly created custom subjects', () => {
  const catalog = mergeExamCatalog([{
    id: 'custom-subject-a',
    label: 'Chủ đề A',
    createdByAdmin: true,
  }]);
  const course = { name: 'Khóa chuyên đề', examSubjects: ['custom-subject-a'] };
  const singleSubjectCourse = { name: 'Khóa kiểm thử', examSubjects: ['mon-kiem-thu'] };

  assert.equal(teacherMatchesCourse({ subjectIds: ['custom-subject-a'] }, course, catalog), true);
  assert.equal(teacherMatchesCourse({ subjectIds: ['subject-b'] }, course, catalog), false);
  assert.equal(teacherMatchesCourse({ specialty: 'Giảng viên toàn môn' }, course, catalog), false);
  assert.equal(teacherMatchesCourse({ subjectIds: ['mon-kiem-thu'] }, singleSubjectCourse), true);
  assert.equal(teacherMatchesCourse({ subjectIds: ['subject-b'] }, singleSubjectCourse), false);
});

test('training access supports custom subjects stored on teachers and materials', () => {
  const {
    resolveItemExamSubjects,
    resolveTeacherSubjectIds,
  } = require('../../utils/trainingSubjectAccess');

  assert.deepEqual(
    resolveItemExamSubjects({ examSubjects: ['custom-subject-a', 'mon-kiem-thu', 'sample-subject'] }),
    ['custom-subject-a', 'mon-kiem-thu', 'sample-subject'],
  );
  assert.deepEqual(
    resolveTeacherSubjectIds({ subjectIds: ['custom-subject-a', 'mon-kiem-thu', 'sample-subject'] }),
    ['custom-subject-a', 'mon-kiem-thu', 'sample-subject'],
  );
});
