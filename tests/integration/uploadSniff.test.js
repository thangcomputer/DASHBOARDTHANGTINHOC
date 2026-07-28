const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bufferMatchesExt, validateUploadedFileMagic } = require('../../utils/uploadSniff');

test('bufferMatchesExt accepts real PNG/JPEG/PDF headers', () => {
  assert.equal(bufferMatchesExt(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), '.png'), true);
  assert.equal(bufferMatchesExt(Buffer.from([0xff, 0xd8, 0xff, 0xe0]), '.jpg'), true);
  assert.equal(bufferMatchesExt(Buffer.from('%PDF-1.4'), '.pdf'), true);
  assert.equal(bufferMatchesExt(Buffer.from([0x50, 0x4b, 0x03, 0x04]), '.docx'), true);
});

test('bufferMatchesExt rejects spoofed extension', () => {
  assert.equal(bufferMatchesExt(Buffer.from('not-an-image'), '.png'), false);
  assert.equal(bufferMatchesExt(Buffer.from([0xff, 0xd8, 0xff]), '.pdf'), false);
});

test('validateUploadedFileMagic reads disk and unlinks spoof path conceptually', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-sniff-'));
  const good = path.join(dir, 'a.png');
  fs.writeFileSync(good, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]));
  assert.equal(validateUploadedFileMagic(good, 'a.png').ok, true);

  const bad = path.join(dir, 'b.png');
  fs.writeFileSync(bad, Buffer.from('MZ-executable-fake'));
  assert.equal(validateUploadedFileMagic(bad, 'b.png').ok, false);

  fs.rmSync(dir, { recursive: true, force: true });
});
