/** SDT Viet Nam: 10 chu so, bat dau 0[3|5|7|8|9] */
export function isValidVNPhone(value) {
  return /^0[35789]\d{8}$/.test(normalizePhone(value));
}

export function isValidEmail(value) {
  return /^[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}$/.test(String(value || '').trim());
}

export function normalizePhone(value) {
  const raw = String(value || '').trim();
  if (!raw || !/^\+?[\d\s.\-()]+$/.test(raw) || raw.slice(1).includes('+')) return '';
  const compact = raw.replace(/[\s.\-()]/g, '');
  const canonical = compact.startsWith('+84')
    ? `0${compact.slice(3)}`
    : compact.startsWith('+') ? '' : compact;
  return /^0[35789]\d{8}$/.test(canonical) ? canonical : '';
}

const MOJIBAKE_RE = /\u00c3.|\u00e1\u00ba|\u00e1\u00bb|\u00c4|\u00c6\u00b0/;

export function fixMojibakeText(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (!MOJIBAKE_RE.test(text)) return text;
  try {
    const bytes = new Uint8Array([...text].map((ch) => ch.charCodeAt(0) & 0xff));
    const fixed = new TextDecoder('utf-8').decode(bytes);
    if (fixed && !fixed.includes('\uFFFD')) return fixed;
  } catch {
    return text;
  }
  return text;
}

export function displayFileName(name) {
  return fixMojibakeText(name || '');
}