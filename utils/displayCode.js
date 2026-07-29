/**
 * displayCode — pure helpers (ADR 0002). Không phụ thuộc Express/DB.
 */

const ROLE_PREFIX = Object.freeze({
  student: 'HV',
  teacher: 'GV',
  admin: 'AD',
  staff: 'ST',
});

function padSeq(seq, width = 3) {
  const n = Math.max(0, Number(seq) || 0);
  return String(n).padStart(width, '0');
}

/**
 * @param {'HV'|'GV'|'AD'|'ST'|string} rolePrefix
 * @param {number} seq
 * @param {string} branchCode
 */
function formatDisplayCode(rolePrefix, seq, branchCode) {
  const role = String(rolePrefix || '').trim().toUpperCase();
  const branch = String(branchCode || '').trim().toUpperCase();
  if (!role || !branch) return '';
  return `${role}${padSeq(seq)}-${branch}`;
}

/**
 * @param {string} nameOrSlug
 */
function courseTokenFromName(nameOrSlug) {
  const raw = String(nameOrSlug || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 16);
  return raw || 'COURSE';
}

/**
 * @param {string} displayCode HV001-CN1
 * @param {string} courseToken EXCELMOS
 */
function formatEnrollmentCode(displayCode, courseToken) {
  const base = String(displayCode || '').trim().toUpperCase();
  const token = courseTokenFromName(courseToken);
  if (!base) return '';
  return `${base}-${token}`;
}

/**
 * @param {string} code
 * @returns {{ rolePrefix: string, seq: number, branchCode: string } | null}
 */
function parseDisplayCode(code) {
  const m = String(code || '')
    .trim()
    .toUpperCase()
    .match(/^(HV|GV|AD|ST)(\d+)-([A-Z0-9]+)$/);
  if (!m) return null;
  return {
    rolePrefix: m[1],
    seq: parseInt(m[2], 10),
    branchCode: m[3],
  };
}

function rolePrefixForTeacherDoc(teacher) {
  if (!teacher) return ROLE_PREFIX.teacher;
  if (teacher.adminRole === 'SUPER_ADMIN' || teacher.adminRole === 'STAFF') {
    if (teacher.adminRole === 'SUPER_ADMIN' || teacher.role === 'admin') return ROLE_PREFIX.admin;
    return ROLE_PREFIX.staff;
  }
  if (teacher.role === 'admin') return ROLE_PREFIX.admin;
  if (teacher.role === 'staff') return ROLE_PREFIX.staff;
  return ROLE_PREFIX.teacher;
}

module.exports = {
  ROLE_PREFIX,
  padSeq,
  formatDisplayCode,
  courseTokenFromName,
  formatEnrollmentCode,
  parseDisplayCode,
  rolePrefixForTeacherDoc,
};
