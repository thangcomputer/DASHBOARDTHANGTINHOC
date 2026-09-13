'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateOwnedCertificationFile } = require('../../utils/certificationFilePolicy');

test('allows an owned active certification file', () => {
  assert.deepEqual(
    validateOwnedCertificationFile(
      { relatedType: 'certification_submission', uploadedBy: 'student-1' },
      'student-1',
    ),
    { ok: true, found: true },
  );
});

test('rejects a certification file owned by another student', () => {
  assert.equal(
    validateOwnedCertificationFile(
      { relatedType: 'certification_submission', uploadedBy: 'student-1' },
      'student-2',
    ).status,
    403,
  );
});

test('rejects an expired certification file', () => {
  assert.equal(
    validateOwnedCertificationFile(
      {
        relatedType: 'certification_submission',
        uploadedBy: 'student-1',
        expiresAt: new Date(1000),
      },
      'student-1',
      2000,
    ).status,
    400,
  );
});

test('keeps legacy unregistered file URLs compatible', () => {
  assert.deepEqual(
    validateOwnedCertificationFile(null, 'student-1'),
    { ok: true, found: false },
  );
});
