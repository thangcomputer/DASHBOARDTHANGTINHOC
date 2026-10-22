/**
 * Replicates the inline Multer fileFilter logic from routes/messageRoutes.js
 * to verify acceptance of allowed types and rejection of dangerous types.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const allowedMsgExt = /\.(jpe?g|png|gif|webp|pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|mp4|webm|mp3|wav)$/i;
const allowedMsgMime = /^(image\/(jpeg|png|gif|webp)|application\/pdf|application\/zip|application\/x-zip-compressed|application\/x-rar-compressed|application\/vnd\.rar|application\/x-7z-compressed|application\/vnd\.[a-z0-9.+-]+|application\/msword|application\/x-ole-storage|application\/octet-stream|text\/plain|video\/(mp4|webm)|audio\/(mpeg|mp3|wav|x-wav|wave))$/i;

function fileFilter(file) {
  const okMime = allowedMsgMime.test(file.mimetype || '');
  const okExt = allowedMsgExt.test(file.originalname || '');
  if (okMime && okExt) return { ok: true };
  return { ok: false, err: 'Định dạng file không được phép' };
}

const accepted = [
  { originalname: 'photo.jpg', mimetype: 'image/jpeg' },
  { originalname: 'doc.pdf', mimetype: 'application/pdf' },
  { originalname: 'report.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  { originalname: 'legacy.doc', mimetype: 'application/x-ole-storage' },
  { originalname: 'legacy.xls', mimetype: 'application/x-ole-storage' },
  { originalname: 'legacy.ppt', mimetype: 'application/x-ole-storage' },
  { originalname: 'sheet.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { originalname: 'slides.pptx', mimetype: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  { originalname: 'archive.zip', mimetype: 'application/zip' },
  { originalname: 'note.txt', mimetype: 'text/plain' },
  { originalname: 'clip.mp4', mimetype: 'video/mp4' },
  { originalname: 'song.mp3', mimetype: 'audio/mpeg' },
];

for (const f of accepted) {
  test('messageUpload accepts ' + f.originalname, () => {
    assert.equal(fileFilter(f).ok, true);
  });
}

const rejected = [
  { originalname: 'shell.sh', mimetype: 'application/x-sh' },
  { originalname: 'binary.exe', mimetype: 'application/octet-stream' },
  { originalname: 'page.html', mimetype: 'text/html' },
  { originalname: 'evil.php', mimetype: 'application/x-php' },
  { originalname: 'archive.tar.gz', mimetype: 'application/gzip' },
  { originalname: 'not-office.doc', mimetype: 'text/html' },
];

for (const f of rejected) {
  test('messageUpload rejects ' + f.originalname, () => {
    const r = fileFilter(f);
    assert.equal(r.ok, false);
    assert.match(r.err, /không được phép/);
  });
}