'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  canReadCertificationSubmission,
  isPublicUploadPath,
} = require('../../middleware/uploadsAuth');

test('public upload matching fails closed for traversal paths', () => {
  assert.equal(isPublicUploadPath('/images/../assignments/private.docx'), false);
  assert.equal(isPublicUploadPath('/images/logo.png'), true);
});

test('certification submission files are readable by their uploader', () => {
  assert.equal(
    canReadCertificationSubmission(
      { relatedType: 'certification_submission', uploadedBy: 'student-1' },
      { role: 'student', id: 'student-1' },
    ),
    true,
  );
});

test('certification submission files reject another student', () => {
  assert.equal(
    canReadCertificationSubmission(
      { relatedType: 'certification_submission', uploadedBy: 'student-1' },
      { role: 'student', id: 'student-2' },
    ),
    false,
  );
});

test('staff roles can read certification submissions', () => {
  for (const role of ['admin', 'staff', 'teacher']) {
    assert.equal(
      canReadCertificationSubmission(
        { relatedType: 'certification_submission', uploadedBy: 'student-1' },
        { role, id: 'staff-1' },
      ),
      true,
    );
  }
});

test('unregistered legacy files keep existing authenticated access', () => {
  assert.equal(
    canReadCertificationSubmission(
      { relatedType: 'assignment', uploadedBy: 'student-1' },
      { role: 'student', id: 'student-2' },
    ),
    true,
  );
});
