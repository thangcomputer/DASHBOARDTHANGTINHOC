/**
 * Escape chuỗi user input trước khi dùng trong MongoDB $regex - tránh ReDoS.
 */
function escapeRegex(str) {
  if (str == null || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const MOJIBAKE_RE = /\u00c3.|\u00e1\u00ba|\u00e1\u00bb|\u00c4|\u00c6\u00b0/;

function fixMulterFilename(name) {
  if (!name) return '';
  const original = String(name);
  if (!MOJIBAKE_RE.test(original) || original.includes('\uFFFD')) return original;
  try {
    const fixed = Buffer.from(original, 'latin1').toString('utf8');
    return fixed && !fixed.includes('\uFFFD') ? fixed : original;
  } catch {
    return original;
  }
}

function fixMojibakeText(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (!MOJIBAKE_RE.test(text)) return text;
  try {
    const fixed = Buffer.from(text, 'latin1').toString('utf8');
    if (fixed && !/\uFFFD/.test(fixed)) return fixed;
  } catch {
    // ignore invalid mojibake conversion
  }
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
