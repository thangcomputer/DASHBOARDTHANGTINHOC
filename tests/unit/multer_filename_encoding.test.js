'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fixMulterFilename } = require('../../utils/escapeRegex');

test('preserves valid Vietnamese Unicode filenames', () => {
  const filename = 'ĐỀ THI THỰC HÀNH KỸ NĂNG MICROSOFT WORD 2026.pdf';
  assert.equal(fixMulterFilename(filename), filename);
});

test('repairs Latin-1 decoded UTF-8 filenames from multipart uploads', () => {
  const filename = 'ĐỀ THI THỰC HÀNH KỸ NĂNG MICROSOFT WORD 2026.pdf';
  const mojibake = Buffer.from(filename, 'utf8').toString('latin1');
  assert.equal(fixMulterFilename(mojibake), filename);
});

test('does not further corrupt filenames that already contain replacement characters', () => {
  const filename = '\u0010� THI TH�C H�NH K� N\u0002NG.pdf';
  assert.equal(fixMulterFilename(filename), filename);
});
