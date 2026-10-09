'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

let teacherMatchesCourse;
let mergeExamCatalog;

test.before(async () => {
  ({ teacherMatchesCourse, mergeExamCatalog } = await import('../../client/src/utils/examSubjects.js'));
});

test('teacher matching requires a real subject overlap and ignores basic-only qualification', () => {
  const thvpCourse = {
    name: 'KHOA THVP NÂNG CAO',
    examSubjects: ['coban', 'word', 'excel', 'powerpoint'],
  };

  assert.equal(teacherMatchesCourse({ subjectIds: ['coban'] }, thvpCourse), false);
  assert.equal(teacherMatchesCourse({
    specialty: 'GV CHỈ KHÓA CƠ BẢN VÀ KHÓA LẺ',
    subjectIds: ['coban'],
  }, thvpCourse), false);
  assert.equal(teacherMatchesCourse({ subjectIds: ['excel'] }, thvpCourse), false);
  assert.equal(teacherMatchesCourse({ specialty: 'Excel' }, thvpCourse), false);
  assert.equal(
    teacherMatchesCourse({ subjectIds: ['word', 'excel', 'powerpoint'] }, thvpCourse),
    true,
  );
  assert.equal(
    teacherMatchesCourse({ subjectIds: ['coban', 'word', 'excel', 'powerpoint'] }, thvpCourse),
    true,
  );
});

test('teacher matching supports custom course subject IDs and rejects unrelated specialties', () => {
  const catalog = mergeExamCatalog([{ id: 'custom-accounting', label: 'Kế toán cơ bản' }]);
  const course = { name: 'Khóa chuyên đề', examSubjects: ['custom-accounting'] };
  const singleSubjectCourse = { name: 'Excel', examSubjects: ['coban', 'excel'] };

  assert.equal(teacherMatchesCourse({ subjectIds: ['custom-accounting'] }, course, catalog), true);
  assert.equal(teacherMatchesCourse({ subjectIds: ['photoshop'] }, course, catalog), false);
  assert.equal(teacherMatchesCourse({ specialty: 'Giảng viên toàn môn' }, course, catalog), false);
  assert.equal(teacherMatchesCourse({ subjectIds: ['excel'] }, singleSubjectCourse), true);
  assert.equal(teacherMatchesCourse({ subjectIds: ['coban'] }, singleSubjectCourse), false);
});
