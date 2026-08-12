const test = require('node:test');
const assert = require('node:assert/strict');

const {
  clampCount,
  toLessonQuestion,
  DEFAULT_COUNT,
} = require('../../shared/ai/QuizGeneratorProvider');

test('clampCount defaults to 10', () => {
  assert.equal(clampCount(undefined), DEFAULT_COUNT);
  assert.equal(clampCount(10), 10);
  assert.equal(clampCount(2), 5);
  assert.equal(clampCount(99), 15);
});

test('toLessonQuestion maps AI quiz shape to LessonQuiz form', () => {
  const q = toLessonQuestion({
    question: 'Phím tắt lưu Word?',
    options: ['Ctrl+S', 'Ctrl+C', 'Ctrl+V'],
    correct: 0,
    explanation: 'Save',
  });
  assert.equal(q.questionText, 'Phím tắt lưu Word?');
  assert.equal(q.options.length, 4);
  assert.equal(q.correctAnswer, 0);
  assert.equal(q.explanation, 'Save');
});
