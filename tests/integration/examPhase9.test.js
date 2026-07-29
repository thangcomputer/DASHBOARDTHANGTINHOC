/**
 * Phase 9 — Exam lifecycle (unlock / attempt SM / violation / deep link).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  toCanonical,
  toLegacyStorage,
  canTransitionExam,
  assertExamTransition,
  voidSubjectProgress,
  TRANSITIONS,
  CANONICAL,
} = require('../../services/examLifecycleService');
const { applyStudentExamProgress } = require('../../services/examProgressService');
const { getTemplate } = require('../../constants/notificationTemplates');
const { DEEP_LINKS, resolveDeepLink } = require('../../constants/deepLinks');

test('canonical SM covers ADR states', () => {
  for (const s of ['locked', 'unlocked', 'in_progress', 'submitted', 'graded', 'pass', 'fail', 'void', 'violation']) {
    assert.ok(CANONICAL.includes(s), s);
  }
  assert.ok(TRANSITIONS.locked.includes('unlocked'));
  assert.ok(TRANSITIONS.in_progress.includes('pass'));
  assert.ok(TRANSITIONS.in_progress.includes('violation'));
});

test('legacy ↔ canonical mapping', () => {
  assert.equal(toCanonical('dang_thi'), 'in_progress');
  assert.equal(toCanonical('dat'), 'pass');
  assert.equal(toCanonical('khong_dat'), 'fail');
  assert.equal(toCanonical('chua_thi', { roomUnlocked: true }), 'unlocked');
  assert.equal(toCanonical('chua_thi', { roomUnlocked: false }), 'locked');
  assert.equal(toLegacyStorage('in_progress'), 'dang_thi');
  assert.equal(toLegacyStorage('pass'), 'dat');
  assert.equal(toLegacyStorage('violation'), 'violation');
});

test('happy path: unlocked → in_progress → pass', () => {
  assert.equal(canTransitionExam('unlocked', 'in_progress'), true);
  assert.equal(canTransitionExam('in_progress', 'pass'), true);
  assert.equal(canTransitionExam('pass', 'in_progress'), false);
});

test('violation path from in_progress', () => {
  assert.doesNotThrow(() => assertExamTransition('in_progress', 'violation'));
  assert.equal(canTransitionExam('violation', 'unlocked'), true);
  assert.equal(canTransitionExam('void', 'pass'), false);
});

test('applyStudentExamProgress enforces SM (chua_thi → dang_thi)', () => {
  const student = {
    studentExamUnlocked: true,
    examProgress: [],
  };
  const { entry } = applyStudentExamProgress(student, 'word', { status: 'dang_thi' });
  assert.equal(entry.status, 'dang_thi');
  assert.equal(entry.attemptStatus, 'in_progress');
});

test('applyStudentExamProgress rejects jump locked→pass', () => {
  const student = {
    studentExamUnlocked: false,
    examProgress: [{ id: 'excel', status: 'chua_thi' }],
  };
  assert.throws(
    () => applyStudentExamProgress(student, 'excel', { status: 'dat' }),
    /Không thể chuyển/,
  );
});

test('voidSubjectProgress sets void', () => {
  const next = voidSubjectProgress({ id: 'word', status: 'dang_thi', attemptStatus: 'in_progress' }, 'admin void');
  assert.equal(next.attemptStatus, 'void');
  assert.equal(next.status, 'void');
});

test('EXAM templates + deep link subject', () => {
  assert.ok(getTemplate('EXAM_UNLOCKED'));
  assert.ok(getTemplate('EXAM_VIOLATION'));
  assert.ok(getTemplate('EXAM_LOCKED'));
  assert.ok(getTemplate('EXAM_RESULT'));
  assert.equal(DEEP_LINKS.STUDENT_EXAM, '/student/exam');
  assert.equal(resolveDeepLink('STUDENT_EXAM_SUBJECT', { subjectId: 'word' }), '/student/exam/word');
});

test('unlock/lock routes use examLifecycleService', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/studentRoutes.js'), 'utf8');
  assert.ok(src.includes('unlockStudentExam'));
  assert.ok(src.includes('lockStudentExam'));
  assert.ok(src.includes('examLifecycleService'));
});

test('proctor audit wires violation lock path', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../services/proctorAuditService.js'), 'utf8');
  assert.ok(src.includes('lockStudentExam'));
  assert.ok(src.includes('exam_terminate'));
  assert.ok(src.includes('autoLock'));
});

test('Student examProgress has attemptStatus field', () => {
  const Student = require('../../models/Student');
  const sub = Student.schema.path('examProgress').schema;
  assert.ok(sub.paths.attemptStatus);
  assert.ok(sub.paths.violationReason);
});
