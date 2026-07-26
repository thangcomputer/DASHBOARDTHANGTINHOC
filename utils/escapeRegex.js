/**
 * Escape chuỗi user input trước khi dùng trong MongoDB $regex — tránh ReDoS.
 */
function escapeRegex(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MOJIBAKE_RE = /\u00c3.|\u00e1\u00ba|\u00e1\u00bb|\u00c4|\u00c6\u00b0/;

function fixMulterFilename(name) {
  if (!name) return '';
  try {
    return Buffer.from(String(name), 'latin1').toString('utf8');
  } catch {
    return String(name);
  }
}

function fixMojibakeText(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (!MOJIBAKE_RE.test(text)) return text;
  try {
    const fixed = Buffer.from(text, 'latin1').toString('utf8');
    if (fixed && !/\uFFFD/.test(fixed)) return fixed;
  } catch (_) {}
  return text;
}

function normalizeMulterFile(file) {
  if (!file || !file.originalname) return file;
  file.originalname = fixMulterFilename(file.originalname);
  return file;
}

module.exports = {
  escapeRegex,
  MOJIBAKE_RE,
  fixMulterFilename,
  fixMojibakeText,
  normalizeMulterFile,
};
