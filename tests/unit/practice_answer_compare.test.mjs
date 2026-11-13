import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RETRY_BASELINE_EMPTY,
  canSubmitRetryAfterWrong,
  retryAnswerChanged,
  serializePracticeAnswer,
} from '../../shared/dailyPractice/practiceAnswerCompare.mjs';

test('retryAnswerChanged: chỉ true khi đổi đáp án', () => {
  const base = serializePracticeAnswer({ items: ['a', 'b'] });
  assert.equal(retryAnswerChanged({ items: ['a', 'b'] }, base), false);
  assert.equal(retryAnswerChanged({ items: ['b', 'a'] }, base), true);
  assert.equal(retryAnswerChanged(null, base), false);
});

test('canSubmitRetryAfterWrong: ghép cặp đủ sau reset', () => {
  const pairs = { pairs: [{ left: 'A', right: '1' }, { left: 'B', right: '2' }] };
  assert.equal(
    canSubmitRetryAfterWrong({ pending: pairs, retryBaselineKey: RETRY_BASELINE_EMPTY, questionType: 'match' }),
    true,
  );
  assert.equal(
    canSubmitRetryAfterWrong({ pending: null, retryBaselineKey: RETRY_BASELINE_EMPTY, questionType: 'match' }),
    false,
  );
});
