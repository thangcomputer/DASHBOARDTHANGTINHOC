'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  applyStudentExamProgress,
} = require('../../services/examProgressService');

test('practical submission state keeps the uploaded essay file', () => {
  const student = {
    examProgress: [{
      id: 'powerpoint',
      status: 'dang_thi',
      attemptStatus: 'submitted',
      tracNghiem: { score: 1, total: 1 },
      thucHanh: 'chua_nop',
    }],
  };

  const { entry } = applyStudentExamProgress(student, 'powerpoint', {
    thucHanh: 'da_nop',
    essayFile: '/uploads/assignments/submission.pptx',
  });

  assert.equal(entry.thucHanh, 'da_nop');
  assert.equal(entry.essayFile, '/uploads/assignments/submission.pptx');
});
