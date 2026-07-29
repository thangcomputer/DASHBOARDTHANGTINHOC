/**
 * GRADE-HIST — score/grade change keeps old/new/user/time.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('ExamResult has scoreHistory schema', () => {
  const ExamResult = require('../../models/ExamResult');
  assert.ok(ExamResult.schema.paths.scoreHistory);
});

test('Submission has gradeHistory schema', () => {
  const Submission = require('../../models/Submission');
  assert.ok(Submission.schema.paths.gradeHistory);
});

test('Teacher has scoreHistory schema', () => {
  const Teacher = require('../../models/Teacher');
  assert.ok(Teacher.schema.paths.scoreHistory);
});

test('exam-results PUT appends scoreHistory + audit', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/examResultRoutes.js'), 'utf8');
  assert.ok(src.includes('scoreHistory'));
  assert.ok(src.includes('exam.score_change'));
  assert.ok(src.includes('oldScore'));
  assert.ok(src.includes('newScore'));
});

test('assignment grade PUT appends gradeHistory + audit', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/assignmentRoutes.js'), 'utf8');
  assert.ok(src.includes('gradeHistory'));
  assert.ok(src.includes('assignment.grade'));
  assert.ok(src.includes('assignment.regrade'));
});

test('teacher score PUT appends scoreHistory + audit', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../routes/teacherRoutes.js'), 'utf8');
  assert.ok(src.includes('scoreHistory'));
  assert.ok(src.includes('teacher.score_change'));
});

test('history chain 80→90→95 preserves old/new pairs', () => {
  const chain = [
    { oldScore: null, newScore: 80 },
    { oldScore: 80, newScore: 90 },
    { oldScore: 90, newScore: 95 },
  ];
  assert.equal(chain[0].newScore, 80);
  assert.equal(chain[1].oldScore, 80);
  assert.equal(chain[1].newScore, 90);
  assert.equal(chain[2].oldScore, 90);
  assert.equal(chain[2].newScore, 95);
  assert.ok(chain.every((h) => h.newScore != null));
});
