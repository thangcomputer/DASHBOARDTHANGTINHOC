'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateAdminExamProgress } = require('../../utils/adminExamProgressPolicy');

const base = {
  id: 'word',
  thucHanh: 'da_nop',
  tracNghiem: { score: 8, total: 10 },
};

test('allows a valid practical grade', () => {
  assert.deepEqual(
    validateAdminExamProgress([{ ...base, essayScore: 7.5 }]),
    { ok: true },
  );
});

test('rejects grading without a submitted file', () => {
  assert.equal(
    validateAdminExamProgress([{ ...base, thucHanh: 'chua_nop', essayScore: 7 }]).status,
    409,
  );
});

test('rejects grading with an invalid practical score', () => {
  assert.equal(
    validateAdminExamProgress([{ ...base, essayScore: 11 }]).status,
    400,
  );
});

test('rejects grading when the multiple-choice result is missing', () => {
  assert.equal(
    validateAdminExamProgress([{ ...base, tracNghiem: {}, essayScore: 7 }]).status,
    409,
  );
});

test('rejects grading when multiple-choice score is below 50 percent', () => {
  assert.equal(
    validateAdminExamProgress([{
      ...base,
      tracNghiem: { score: 4, total: 10 },
      essayScore: 7,
    }]).status,
    409,
  );
});

test('allows admin reset entries with no essay score', () => {
  assert.deepEqual(
    validateAdminExamProgress([{ ...base, thucHanh: 'chua_nop', essayScore: null }]),
    { ok: true },
  );
});

test('rejects an achieved status below the practical pass mark', () => {
  assert.equal(
    validateAdminExamProgress([{ ...base, essayScore: 4.5, status: 'dat' }]).status,
    409,
  );
});

test('rejects a failed status at or above the practical pass mark', () => {
  assert.equal(
    validateAdminExamProgress([{ ...base, essayScore: 5, status: 'khong_dat' }]).status,
    409,
  );
});
