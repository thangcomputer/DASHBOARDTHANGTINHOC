'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyStudentExamProgress,
  canStudentWriteExamProgress,
  examMilestoneMet,
} = require('../../services/examProgressService');

test('examMilestoneMet: Word first of 3 subjects at 4/12 buổi', () => {
  assert.equal(examMilestoneMet(['word', 'excel', 'powerpoint'], 'word', 4, 12), true);
  assert.equal(examMilestoneMet(['word', 'excel', 'powerpoint'], 'excel', 4, 12), false);
  assert.equal(examMilestoneMet(['word', 'excel', 'powerpoint'], 'excel', 8, 12), true);
});

test('canStudentWriteExamProgress: global unlock still works', () => {
  assert.equal(canStudentWriteExamProgress({
    studentExamUnlocked: true,
    examProgress: [],
  }, 'word'), true);
});

test('canStudentWriteExamProgress: milestone without global unlock', () => {
  const student = {
    studentExamUnlocked: false,
    completedSessions: 4,
    totalSessions: 12,
    enrollments: [{
      courseName: 'Tin hoc van phong',
      examSubjects: ['word', 'excel', 'powerpoint'],
      completedSessions: 4,
      totalSessions: 12,
      examUnlocked: false,
    }],
  };
  assert.equal(canStudentWriteExamProgress(student, 'word'), true);
  assert.equal(canStudentWriteExamProgress(student, 'excel'), false);
});

test('canStudentWriteExamProgress: dang_thi resumes without unlock', () => {
  assert.equal(canStudentWriteExamProgress({
    studentExamUnlocked: false,
    examProgress: [{ id: 'word', status: 'dang_thi' }],
  }, 'word'), true);
});

test('applyStudentExamProgress: khong_dat cannot self-reset after lockUntil expired', () => {
  const student = {
    examProgress: [{ id: 'word', status: 'khong_dat', lockUntil: Date.now() - 1000 }],
  };
  assert.throws(
    () => applyStudentExamProgress(student, 'word', { status: 'chua_thi' }),
    (err) => err.status === 403,
  );
});

test('applyStudentExamProgress: cannot set dat without score', () => {
  const student = { examProgress: [{ id: 'word', status: 'dang_thi' }] };
  assert.throws(
    () => applyStudentExamProgress(student, 'word', { status: 'dat' }),
    (err) => err.status === 403,
  );
});

test('applyStudentExamProgress: submit pass with score still allowed', () => {
  const student = { examProgress: [{ id: 'word', status: 'dang_thi' }] };
  const { entry } = applyStudentExamProgress(student, 'word', {
    status: 'dat',
    tracNghiem: { score: 20, total: 30 },
  });
  assert.equal(entry.status, 'dat');
  assert.equal(entry.tracNghiem.score, 20);
});
