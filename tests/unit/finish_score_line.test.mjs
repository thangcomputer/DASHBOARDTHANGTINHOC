import assert from 'node:assert/strict';
import test from 'node:test';
import { formatPracticeScoreQuestions } from '../../shared/dailyPractice/finishScoreLine.mjs';

test('formatPracticeScoreQuestions', () => {
  assert.equal(formatPracticeScoreQuestions(7, 7), '7 câu trên 7 câu');
  assert.equal(formatPracticeScoreQuestions(3, 10), '3 câu trên 10 câu');
});
