'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateQuestion,
  validateSingleChoiceQuestion,
  validateMultipleChoiceQuestion,
  validateMatchingQuestion,
} = require('../../services/certPrepQuestionValidation');

const validSingle = {
  type: 'single_choice',
  locale: 'vi',
  questionText: 'Phím tắt Copy là gì?',
  options: [
    { text: 'Ctrl+C' },
    { text: 'Ctrl+V' },
    { text: 'Ctrl+X' },
    { text: 'Ctrl+Z' },
  ],
  correctAnswer: 0,
};

test('valid single choice', () => {
  assert.equal(validateSingleChoiceQuestion(validSingle).ok, true);
  assert.equal(validateQuestion(validSingle).ok, true);
});

test('invalid single: fewer than 2 options', () => {
  const r = validateSingleChoiceQuestion({ options: [{ text: 'A' }], correctAnswer: 0 });
  assert.equal(r.ok, false);
});

test('invalid single: no correct answer', () => {
  const r = validateSingleChoiceQuestion({ ...validSingle, correctAnswer: null });
  assert.equal(r.ok, false);
});

test('invalid single: correctAnswer out of range', () => {
  const r = validateSingleChoiceQuestion({ ...validSingle, correctAnswer: 9 });
  assert.equal(r.ok, false);
});

test('invalid single: empty option text', () => {
  const r = validateSingleChoiceQuestion({
    ...validSingle,
    options: [{ text: 'A' }, { text: '' }],
    correctAnswer: 0,
  });
  assert.equal(r.ok, false);
});

const validMulti = {
  type: 'multiple_choice',
  locale: 'en',
  questionText: 'Select two',
  options: [
    { text: 'A' },
    { text: 'B' },
    { text: 'C' },
    { text: 'D' },
  ],
  correctIndices: [1, 3],
  minSelect: 2,
};

test('valid multiple choice', () => {
  assert.equal(validateMultipleChoiceQuestion(validMulti).ok, true);
  assert.equal(validateQuestion(validMulti).ok, true);
});

test('invalid multiple: no correct indices', () => {
  const r = validateMultipleChoiceQuestion({ ...validMulti, correctIndices: [] });
  assert.equal(r.ok, false);
});

test('invalid multiple: duplicate indices', () => {
  const r = validateMultipleChoiceQuestion({ ...validMulti, correctIndices: [1, 1] });
  assert.equal(r.ok, false);
});

test('invalid multiple: index out of range', () => {
  const r = validateMultipleChoiceQuestion({ ...validMulti, correctIndices: [1, 8] });
  assert.equal(r.ok, false);
});

test('invalid multiple: minSelect exceeds correct count', () => {
  const r = validateMultipleChoiceQuestion({ ...validMulti, minSelect: 3 });
  assert.equal(r.ok, false);
});

const validMatching = {
  type: 'matching',
  locale: 'vi',
  questionText: 'Ghép phím tắt',
  matchingItems: [
    { id: 'i1', text: 'Ctrl+C' },
    { id: 'i2', text: 'Ctrl+V' },
  ],
  matchingTargets: [
    { id: 't1', text: 'Copy' },
    { id: 't2', text: 'Paste' },
  ],
  matchingPairs: [
    { itemId: 'i1', targetId: 't1' },
    { itemId: 'i2', targetId: 't2' },
  ],
};

test('valid matching', () => {
  assert.equal(validateMatchingQuestion(validMatching).ok, true);
  assert.equal(validateQuestion(validMatching).ok, true);
});

test('invalid matching: missing pairs', () => {
  const r = validateMatchingQuestion({ ...validMatching, matchingPairs: [] });
  assert.equal(r.ok, false);
});

test('invalid matching: unknown id', () => {
  const r = validateMatchingQuestion({
    ...validMatching,
    matchingPairs: [{ itemId: 'i1', targetId: 'nope' }],
  });
  assert.equal(r.ok, false);
});

test('invalid matching: duplicate item pairing', () => {
  const r = validateMatchingQuestion({
    ...validMatching,
    matchingPairs: [
      { itemId: 'i1', targetId: 't1' },
      { itemId: 'i1', targetId: 't2' },
    ],
  });
  assert.equal(r.ok, false);
});

test('validateQuestion rejects unknown type', () => {
  const r = validateQuestion({ type: 'hotspot', questionText: 'x', locale: 'vi' });
  assert.equal(r.ok, false);
});

test('validateQuestion rejects empty stem', () => {
  const r = validateQuestion({ ...validSingle, questionText: '  ' });
  assert.equal(r.ok, false);
});

test('validateQuestion does not auto-fix invalid payload', () => {
  const payload = { type: 'single_choice', questionText: 'Q', options: [{ text: 'A' }], correctAnswer: 0 };
  const r = validateQuestion(payload);
  assert.equal(r.ok, false);
  assert.equal(payload.options.length, 1);
});
