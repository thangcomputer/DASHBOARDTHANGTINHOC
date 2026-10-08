'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const rules = require('../../services/lessonPracticeRules');

test('hotspot accepts a click inside the region only', () => {
  const region = { x: 10, y: 20, w: 30, h: 15 };
  assert.equal(rules.pointInRegion(10, 20, region), true);
  assert.equal(rules.pointInRegion(40, 35, region), true);
  assert.equal(rules.pointInRegion(41, 20, region), false);
  assert.equal(rules.pointInRegion(15, 36, region), false);
});

test('sequential mode locks a unit until earlier units are completed', () => {
  const units = [
    { _id: 'a', sortOrder: 1 },
    { _id: 'b', sortOrder: 2 },
    { _id: 'c', sortOrder: 3 },
  ];
  assert.equal(rules.isUnitLocked(units, new Set(), 'sequential', 'a'), false);
  assert.equal(rules.isUnitLocked(units, new Set(), 'sequential', 'b'), true);
  assert.equal(rules.isUnitLocked(units, new Set(['a']), 'sequential', 'b'), false);
  assert.equal(rules.isUnitLocked(units, new Set(['a']), 'sequential', 'c'), true);
  assert.equal(rules.isUnitLocked(units, new Set(), 'open', 'c'), false);
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
  const end = src.indexOf('async function completedUnitIds');
  const body = src.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.equal(body.includes('LessonAnswer'), false);
  assert.equal(body.includes('correct'), false);
  assert.equal(body.includes('explanation'), false);
});
