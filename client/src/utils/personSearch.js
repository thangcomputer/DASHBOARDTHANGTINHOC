/**
 * Khớp họ / tên đệm / tên / SĐT (không dấu, từng từ khóa).
 * Dùng danh bạ Inbox + danh sách học viên phía client.
 */

const TOKEN_SPLIT = /[\s,;+/\\|_-]+/;
const NORMALIZED_TOKEN_SPLIT = /[^a-z0-9]+/;
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
  const queryN = unaccent(query);
  const tokens = queryN.split(NORMALIZED_TOKEN_SPLIT).filter(Boolean);
  if (!tokens.length) return true;
  const nameN = unaccent(fields.name);
  const extraN = unaccent(
    [fields.extra, fields.email, fields.studentCode, fields.course, fields.zalo]
      .filter(Boolean)
      .join(' '),
  );
  const haystack = [nameN, extraN, unaccent(fields.phone), unaccent(fields.zalo)]
    .filter(Boolean)
    .join(' ');
  const phoneDigits = normalizePhoneDigits(fields.phone);
  const zaloDigits = normalizePhoneDigits(fields.zalo);
  const textTokens = tokens.filter((token) => !/^\d+$/.test(token)).slice(0, MAX_TOKENS);
  const digitTokens = tokens.filter((token) => /^\d+$/.test(token)).slice(0, MAX_TOKENS);
  const queryDigits = normalizePhoneDigits(digitTokens.join(''));

  const textMatches = textTokens.every((token) => haystack.includes(token));
  if (!textMatches) return false;
  if (!digitTokens.length) return true;

  const digitsInText = digitTokens.every((token) => haystack.includes(token));
  const digitsInPhone = Boolean(
    queryDigits && (phoneDigits.includes(queryDigits) || zaloDigits.includes(queryDigits)),
  );
  return digitsInText || digitsInPhone;
}

function normalizePhoneDigits(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('84') && digits.length >= 4
    ? `0${digits.slice(2)}`
    : digits;
}
