import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getExamProgressDisplayStatus,
  summarizeExamProgress,
} from '../../client/src/utils/examProgressStats.js';

test('classifies passed multiple-choice exams without a practical file as waiting to submit', () => {
  assert.equal(
    getExamProgressDisplayStatus({
      status: 'dang_thi',
      tracNghiem: { score: 8, total: 10 },
      thucHanh: 'chua_nop',
    }),
    'cho_nop',
  );
});

test('classifies flattened admin rows with a submitted file as waiting for grading', () => {
  assert.equal(
    getExamProgressDisplayStatus({
      status: 'dang_thi',
      thucHanh: 'da_nop',
      essayScore: null,
      score: 1,
      total: 1,
    }),
    'cho_cham',
  );
});

test('summarizes exam states using the same display rules as admin rows', () => {
  assert.deepEqual(
    summarizeExamProgress([{
      examProgress: [
        { status: 'dang_thi', tracNghiem: { score: 8, total: 10 }, thucHanh: 'chua_nop' },
        { status: 'dang_thi', tracNghiem: { score: 8, total: 10 }, thucHanh: 'da_nop', essayScore: null },
        { status: 'dat', tracNghiem: { score: 9, total: 10 }, thucHanh: 'da_nop', essayScore: 7 },
        { status: 'chua_thi' },
      ],
    }]),
    { total: 3, dat: 1, choNop: 1, choCham: 1, dangThi: 0, khongDat: 0 },
  );
});
