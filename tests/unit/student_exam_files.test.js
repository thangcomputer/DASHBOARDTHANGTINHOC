'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  sanitizeStudentExamFilesPayload,
  buildStudentExamFileUpdates,
} = require('../../utils/studentExamFiles');

test('sanitizes only safe student exam file metadata', () => {
  const result = sanitizeStudentExamFilesPayload({
    word: {
      fileUrl: '/uploads/training/word.docx',
      fileName: '  Word.docx ',
      fileType: 'docx',
    },
    invalid: { fileUrl: 'https://example.test/file.docx' },
    malformed: 'old value',
    nested: { fileUrl: '/not-uploads/file.pdf' },
  });

  assert.deepEqual(result, {
    word: {
      fileUrl: '/uploads/training/word.docx',
      fileName: 'Word.docx',
      fileType: 'DOCX',
    },
  });
});

test('builds atomic subject updates without deleting other subjects', () => {
  const updates = buildStudentExamFileUpdates({
    excel: {
      fileUrl: '/uploads/training/excel.pdf',
      fileName: 'Excel.pdf',
      fileType: 'pdf',
    },
  });

  assert.deepEqual(updates, {
    'studentExamFilesRaw.excel': {
      fileUrl: '/uploads/training/excel.pdf',
      fileName: 'Excel.pdf',
      fileType: 'PDF',
    },
  });
  assert.equal(Object.hasOwn(updates, 'studentExamFilesRaw.word'), false);
  assert.equal(Object.hasOwn(updates, 'studentExamFilesRaw.powerpoint'), false);
});
