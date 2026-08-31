'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadExamSubjects() {
  const file = path.join(__dirname, '../../client/src/utils/examSubjects.js');
  return import(pathToFileURL(file).href);
}

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
    courseName: 'Tin học văn phòng',
    examSubjects: ['word', 'excel', 'powerpoint'],
    completedSessions: 4,
    totalSessions: 12,
    examUnlocked: false,
  }];
  const student = {
    course: 'Tin học văn phòng',
    completedSessions: 4,
    totalSessions: 12,
    studentExamUnlocked: false,
  };
  assert.equal(canStartCertificationSubject({
    student,
    enrollments,
    subjectId: 'word',
    catalog,
    examProgressEntry: { status: 'chua_thi' },
  }), true);
  assert.equal(canStartCertificationSubject({
    student,
    enrollments,
    subjectId: 'excel',
    catalog,
    examProgressEntry: { status: 'chua_thi' },
  }), false);
  assert.equal(canStartCertificationSubject({
    student,
    enrollments,
    subjectId: 'word',
    catalog,
    examProgressEntry: { status: 'khong_dat' },
  }), false);
});
