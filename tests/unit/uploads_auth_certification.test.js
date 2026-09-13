'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { canReadCertificationSubmission } = require('../../middleware/uploadsAuth');

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
