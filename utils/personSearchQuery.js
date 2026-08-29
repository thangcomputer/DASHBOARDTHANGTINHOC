'use strict';

/**
 * Token search for student list: mỗi từ khóa khớp họ / tên đệm / tên / SĐT / mã / khóa.
 * Accent-insensitive (nguyen ≈ Nguyễn). Không đổi hành vi khi không có search.
 */

const TOKEN_SPLIT = /[\s,;+/\\|_-]+/;
const MAX_TOKENS = 8;
const MAX_TOKEN_LEN = 40;

const VI_GROUPS = [
  'aáàảãạăắằẳẵặâấầẩẫậ',
  'eéèẻẽẹêếềểễệ',
  'iíìỉĩị',
  'oóòỏõọôốồổỗộơớờởỡợ',
  'uúùủũụưứừửữự',
  'yýỳỷỹỵ',
  'dđ',
];

const CHAR_CLASS = Object.create(null);
for (const group of VI_GROUPS) {
  const cls = `[${group}]`;
  for (const ch of group) {
    CHAR_CLASS[ch] = cls;
    CHAR_CLASS[ch.toUpperCase()] = cls;
  }
}

function splitSearchTokens(query) {
  return String(query || '')
    .trim()
    .split(TOKEN_SPLIT)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, MAX_TOKENS);
}

function tokenToRegexSource(token) {
  const raw = String(token || '').slice(0, MAX_TOKEN_LEN);
  if (!raw) return '';
  let out = '';
  for (const ch of raw) {
    if (CHAR_CLASS[ch]) out += CHAR_CLASS[ch];
    else if (/[.*+?^${}()|[\]\\]/.test(ch)) out += `\\${ch}`;
    else out += ch;
  }
  return out;
}

function phoneFlexibleRegexSource(token) {
  const digits = String(token || '').replace(/\D/g, '');
  if (digits.length < 2 || digits.length > 15) return null;
  return digits.split('').join('\\s*');
}

function personFieldOr(sReg, extraRegs) {
  const or = [
    { name: sReg },
    { zalo: sReg },
    { phone: sReg },
    { course: sReg },
    { 'enrollments.courseName': sReg },
    { studentCode: sReg },
    { legacyStudentCodes: sReg },
  ];
  if (Array.isArray(extraRegs)) {
    extraRegs.forEach((reg) => {
      or.push({ phone: reg }, { zalo: reg });
    });
  }
  return { $or: or };
}

/**
 * @param {string} search
 * @returns {object[]} Mongo $and clauses (empty = không lọc theo search)
 */
function buildStudentSearchAndConditions(search) {
  const tokens = splitSearchTokens(search);
  const conds = [];
  for (const token of tokens) {
    const src = tokenToRegexSource(token);
    if (!src) continue;
    const sReg = { $regex: src, $options: 'i' };
    const phoneSrc = phoneFlexibleRegexSource(token);
    const extra = phoneSrc && phoneSrc !== src
      ? [{ $regex: phoneSrc, $options: 'i' }]
      : [];
    conds.push(personFieldOr(sReg, extra));
  }
  return conds;
}

module.exports = {
  splitSearchTokens,
  tokenToRegexSource,
  buildStudentSearchAndConditions,
};
