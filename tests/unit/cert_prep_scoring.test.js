'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { computeScore, isPassed, gradeQuestion } = require('../../services/certPrepService');

test('rounding: 40/45 → 889', () => {
  assert.equal(computeScore(40, 45), 889);
});

test('all correct → 1000', () => {
  assert.equal(computeScore(45, 45), 1000);
});

test('0 correct → 0', () => {
  assert.equal(computeScore(0, 45), 0);
});

test('1/45 rounds to 22', () => {
  assert.equal(computeScore(1, 45), 22);
});

test('total 0 → 0 (fail closed)', () => {
  assert.equal(computeScore(0, 0), 0);
});

test('pass when score >= passingScore', () => {
  assert.equal(isPassed(700, 700), true);
  assert.equal(isPassed(889, 700), true);
  assert.equal(isPassed(699, 700), false);
  assert.equal(isPassed(0, 700), false);
});

const single = {
  type: 'single_choice',
  correctAnswer: 2,
};

test('single choice correct', () => {
  assert.equal(gradeQuestion(single, 2), true);
});

test('single choice wrong', () => {
  assert.equal(gradeQuestion(single, 0), false);
  assert.equal(gradeQuestion(single, 1), false);
  assert.equal(gradeQuestion(single, null), false);
});

const multi = {
  type: 'multiple_choice',
  correctIndices: [0, 2, 3],
};

test('multiple choice exact match', () => {
  assert.equal(gradeQuestion(multi, [0, 2, 3]), true);
  assert.equal(gradeQuestion(multi, [3, 0, 2]), true);
});

test('multiple choice wrong / partial not accepted', () => {
  assert.equal(gradeQuestion(multi, [0, 2]), false);
  assert.equal(gradeQuestion(multi, [0, 2, 3, 1]), false);
  assert.equal(gradeQuestion(multi, [0, 2, 1]), false);
  assert.equal(gradeQuestion(multi, []), false);
});

const matching = {
  type: 'matching',
  matchingPairs: [
    { itemId: 'a', targetId: 'copy' },
    { itemId: 'b', targetId: 'paste' },
    { itemId: 'c', targetId: 'cut' },
  ],
};

test('matching exact pairs', () => {
  assert.equal(gradeQuestion(matching, [
    { itemId: 'c', targetId: 'cut' },
    { itemId: 'a', targetId: 'copy' },
    { itemId: 'b', targetId: 'paste' },
  ]), true);
});

test('matching wrong / incomplete', () => {
  assert.equal(gradeQuestion(matching, [
    { itemId: 'a', targetId: 'copy' },
    { itemId: 'b', targetId: 'paste' },
  ]), false);
  assert.equal(gradeQuestion(matching, [
    { itemId: 'a', targetId: 'paste' },
    { itemId: 'b', targetId: 'copy' },
    { itemId: 'c', targetId: 'cut' },
  ]), false);
  assert.equal(gradeQuestion(matching, []), false);
});
