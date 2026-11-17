import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import {
  PRACTICE_VIDEO_TOKEN,
  buildPracticeSequence,
  movePracticeOrderToken,
  splitPracticeSequence,
} from '../../shared/dailyPractice/practiceSequence.mjs';

const require = createRequire(import.meta.url);
const cjs = require('../../shared/dailyPractice/practiceSequence.cjs');

const sampleQuestions = [
  { _id: '650000000000000000000001', prompt: 'Q1' },
  { _id: '650000000000000000000002', prompt: 'Q2' },
  { _id: '650000000000000000000003', prompt: 'Q3' },
];

test('practiceSequence: có video nhưng itemOrder rỗng thì video mặc định ở vị trí #1', () => {
  const seq = buildPracticeSequence({ hasVideo: true, itemOrder: [], questions: sampleQuestions });
  assert.deepEqual(
    seq.map((item) => item.key),
    [PRACTICE_VIDEO_TOKEN, '650000000000000000000001', '650000000000000000000002', '650000000000000000000003'],
  );
  const split = splitPracticeSequence(seq);
  assert.equal(split.videoInsertIndex, 0);
  assert.equal(split.orderedQuestions.length, 3);
});

test('practiceSequence: giữ đúng vị trí video và câu hỏi theo itemOrder của admin, bổ sung câu mới vào cuối', () => {
  const seq = buildPracticeSequence({
    hasVideo: true,
    itemOrder: ['650000000000000000000002', PRACTICE_VIDEO_TOKEN, '650000000000000000000001'],
    questions: sampleQuestions,
  });
  assert.deepEqual(
    seq.map((item) => item.key),
    ['650000000000000000000002', PRACTICE_VIDEO_TOKEN, '650000000000000000000001', '650000000000000000000003'],
  );
  const split = splitPracticeSequence(seq);
  assert.equal(split.videoInsertIndex, 1);
  assert.deepEqual(split.orderedQuestions.map((q) => q.prompt), ['Q2', 'Q1', 'Q3']);
});

test('practiceSequence: không có video thì bỏ qua token video kể cả khi itemOrder còn lưu cũ', () => {
  const seq = buildPracticeSequence({
    hasVideo: false,
    itemOrder: [PRACTICE_VIDEO_TOKEN, '650000000000000000000003', '650000000000000000000001'],
    questions: sampleQuestions,
  });
  assert.deepEqual(
    seq.map((item) => item.key),
    ['650000000000000000000003', '650000000000000000000001', '650000000000000000000002'],
  );
  assert.equal(splitPracticeSequence(seq).videoInsertIndex, -1);
});

test('practiceSequence: movePracticeOrderToken dịch chuyển đúng vị trí & khớp bản CJS', () => {
  const moved = movePracticeOrderToken([PRACTICE_VIDEO_TOKEN, 'a', 'b', 'c'], 0, 2);
  assert.deepEqual(moved, ['a', 'b', PRACTICE_VIDEO_TOKEN, 'c']);
  assert.deepEqual(
    cjs.buildPracticeSequence({ hasVideo: true, itemOrder: moved, questions: [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }] })
      .map((i) => i.key),
    ['a', 'b', PRACTICE_VIDEO_TOKEN, 'c'],
  );
});
