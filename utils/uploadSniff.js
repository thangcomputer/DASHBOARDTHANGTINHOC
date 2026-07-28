/**
 * Sniff magic bytes cơ bản — từ chối file spoof ext/mime.
 * Không thay antivirus; chỉ chặn lệch header phổ biến.
 */
const fs = require('fs');

const IMAGE_JPEG = [0xff, 0xd8, 0xff];
const IMAGE_PNG = [0x89, 0x50, 0x4e, 0x47];
const IMAGE_GIF = [0x47, 0x49, 0x46];
const IMAGE_WEBP_RIFF = [0x52, 0x49, 0x46, 0x46];
const PDF = [0x25, 0x50, 0x44, 0x46]; // %PDF
const ZIP_PK = [0x50, 0x4b]; // zip / docx / xlsx / pptx
const RAR = [0x52, 0x61, 0x72, 0x21]; // Rar!
const SEVEN_Z = [0x37, 0x7a, 0xbc, 0xaf];
const MP3_ID3 = [0x49, 0x44, 0x33];
const WAV_RIFF = [0x52, 0x49, 0x46, 0x46];

function startsWith(buf, sig) {
  if (!buf || buf.length < sig.length) return false;
  return sig.every((b, i) => buf[i] === b);
}

/**
 * @param {Buffer} buf
 * @param {string} ext lowercase with dot, e.g. '.png'
 * @returns {boolean}
 */
function bufferMatchesExt(buf, ext) {
  const e = String(ext || '').toLowerCase();
  if (!e) return false;

  if (e === '.jpg' || e === '.jpeg') return startsWith(buf, IMAGE_JPEG);
  if (e === '.png') return startsWith(buf, IMAGE_PNG);
  if (e === '.gif') return startsWith(buf, IMAGE_GIF);
  if (e === '.webp') {
    return startsWith(buf, IMAGE_WEBP_RIFF) && buf.length >= 12 && buf.slice(8, 12).toString('ascii') === 'WEBP';
  }
  if (e === '.pdf') return startsWith(buf, PDF);
  if (e === '.zip' || e === '.docx' || e === '.xlsx' || e === '.pptx') return startsWith(buf, ZIP_PK);
  if (e === '.doc' || e === '.xls' || e === '.ppt') {
    // OLE compound: D0 CF 11 E0
    return startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0]) || startsWith(buf, ZIP_PK);
  }
  if (e === '.rar') return startsWith(buf, RAR);
  if (e === '.7z') return startsWith(buf, SEVEN_Z);
  if (e === '.mp3') {
    return startsWith(buf, MP3_ID3) || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
  }
  if (e === '.wav') {
    return startsWith(buf, WAV_RIFF) && buf.length >= 12 && buf.slice(8, 12).toString('ascii') === 'WAVE';
  }
  if (e === '.mp4' || e === '.webm') {
    // ftyp box thường ở offset 4; webm = EBML 1A 45 DF A3
    if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return true;
    if (buf.length >= 8 && buf.slice(4, 8).toString('ascii') === 'ftyp') return true;
    return false;
  }
  if (e === '.txt') {
    // Từ chối binary rõ (null trong 512 byte đầu)
    const sample = buf.slice(0, Math.min(512, buf.length));
    return !sample.includes(0);
  }
  return false;
}

/**
 * Đọc tối đa 64 byte đầu file trên disk và kiểm tra theo extension.
 * @returns {{ ok: boolean, reason?: string }}
 */
function validateUploadedFileMagic(filePath, originalNameOrExt) {
  try {
    const ext = String(originalNameOrExt || '').includes('.')
      ? require('path').extname(originalNameOrExt).toLowerCase()
      : String(originalNameOrExt || '').toLowerCase();
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(64);
    const n = fs.readSync(fd, buf, 0, 64, 0);
    fs.closeSync(fd);
    if (n <= 0) return { ok: false, reason: 'empty_file' };
    if (!bufferMatchesExt(buf.slice(0, n), ext)) {
      return { ok: false, reason: 'magic_mismatch' };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message || 'sniff_error' };
  }
}

module.exports = { bufferMatchesExt, validateUploadedFileMagic };
