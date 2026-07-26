/** SDT Viet Nam: 10 chu so, bat dau 0[3|5|7|8|9] */
export function isValidVNPhone(value) {
  const v = String(value || '').replace(/\s/g, '');
  return /^0[35789]\d{8}$/.test(v);
}

export function isValidEmail(value) {
  return /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(String(value || '').trim());
}

export function normalizePhone(value) {
  return String(value || '').replace(/\s/g, '').trim();
}

const MOJIBAKE_RE = /\u00c3.|\u00e1\u00ba|\u00e1\u00bb|\u00c4|\u00c6\u00b0/;

export function fixMojibakeText(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (!MOJIBAKE_RE.test(text)) return text;
  try {
    const bytes = new Uint8Array([...text].map((ch) => ch.charCodeAt(0) & 0xff));
    const fixed = new TextDecoder('utf-8').decode(bytes);
    if (fixed && !fixed.includes('\uFFFD')) return fixed;
  } catch (_) {}
  return text;
}

export function displayFileName(name) {
  return fixMojibakeText(name || '');
}