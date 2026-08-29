/**
 * Khớp họ / tên đệm / tên / SĐT (không dấu, từng từ khóa).
 * Dùng danh bạ Inbox + danh sách học viên phía client.
 */

const TOKEN_SPLIT = /[\s,;+/\\|_-]+/;
const MAX_TOKENS = 8;

export function unaccent(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

export function splitSearchTokens(query) {
  return String(query || '')
    .trim()
    .split(TOKEN_SPLIT)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TOKENS);
}

export function matchesPersonSearch(query, fields = {}) {
  const tokens = splitSearchTokens(query);
  if (!tokens.length) return true;
  const nameN = unaccent(fields.name);
  const extraN = unaccent(
    [fields.extra, fields.studentCode, fields.course, fields.zalo]
      .filter(Boolean)
      .join(' '),
  );
  const phoneDigits = String(fields.phone || '').replace(/\D/g, '');
  const zaloDigits = String(fields.zalo || '').replace(/\D/g, '');

  return tokens.every((tok) => {
    const tokN = unaccent(tok);
    if (tokN && (nameN.includes(tokN) || extraN.includes(tokN))) return true;
    const tokDigits = String(tok).replace(/\D/g, '');
    if (tokDigits.length >= 2 && (phoneDigits.includes(tokDigits) || zaloDigits.includes(tokDigits))) {
      return true;
    }
    return false;
  });
}
