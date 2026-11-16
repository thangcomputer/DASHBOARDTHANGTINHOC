/**
 * Avatar mac dinh nen trong / chu cai dau khi user chua co anh upload that.
 * Khong su dung anh cartoon mac dinh.
 */

export const BLANK_AVATAR_SVG =
  'data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2064%2064%22%3E%3Crect%20width%3D%2264%22%20height%3D%2264%22%20rx%3D%2232%22%20fill%3D%22%23F1F5F9%22%2F%3E%3C%2Fsvg%3E';

export const DEFAULT_AVATARS = {
  admin: BLANK_AVATAR_SVG,
  admin_male: BLANK_AVATAR_SVG,
  admin_female: BLANK_AVATAR_SVG,
  admin_unknown: BLANK_AVATAR_SVG,

  staff: BLANK_AVATAR_SVG,
  staff_male: BLANK_AVATAR_SVG,
  staff_female: BLANK_AVATAR_SVG,
  staff_unknown: BLANK_AVATAR_SVG,

  support: BLANK_AVATAR_SVG,
  support_male: BLANK_AVATAR_SVG,
  support_female: BLANK_AVATAR_SVG,
  support_unknown: BLANK_AVATAR_SVG,

  teacher: BLANK_AVATAR_SVG,
  teacher_male: BLANK_AVATAR_SVG,
  teacher_female: BLANK_AVATAR_SVG,
  teacher_unknown: BLANK_AVATAR_SVG,

  student: BLANK_AVATAR_SVG,
  student_male: BLANK_AVATAR_SVG,
  student_female: BLANK_AVATAR_SVG,
  student_unknown: BLANK_AVATAR_SVG,
};

/**
 * Chuan hoa gender ve: male | female | unknown.
 * Source of truth: field gender tu DB/session - khong doan tu ten/avatar/role.
 */
export function normalizeGender(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'unknown';

  if (
    raw === 'female'
    || raw === 'f'
    || raw === 'nữ'
    || raw === 'nu'
    || raw === 'nữ giới'
    || raw === 'nu gioi'
  ) {
    return 'female';
  }

  if (
    raw === 'male'
    || raw === 'm'
    || raw === 'nam'
    || raw === 'nam giới'
    || raw === 'nam gioi'
  ) {
    return 'male';
  }

  return 'unknown';
}

/** Chi chap nhan gia tri that su la URL/path anh upload. */
export function isAvatarUrl(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (s.startsWith('data:image/')) return true;
  if (s.startsWith('/uploads/')) return true;
  return false;
}

/** Alias canonical - uploaded/real image detection. */
export function isRealAvatar(value) {
  return isAvatarUrl(value);
}

export function looksLikeInitials(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  if (isAvatarUrl(s)) return false;
  return /^[\p{L}\p{N}]{1,4}$/u.test(s);
}

export function getNameInitial(name = '', fallback = '') {
  const raw = String(name || '').trim();
  if (raw) {
    return raw.charAt(0).toLocaleUpperCase('vi-VN');
  }
  const fb = String(fallback || '').trim();
  return fb ? fb.charAt(0).toLocaleUpperCase('vi-VN') : '';
}

export function buildInitialAvatarDataUrl(name = '') {
  const initial = getNameInitial(name).replace(/[<>&"']/g, '');
  const svg = initial
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#E2E8F0"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#334155" font-family="system-ui,-apple-system,sans-serif" font-size="26" font-weight="700">${initial}</text></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="#F1F5F9"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Resolve avatar hien thi.
 * Chi dung anh upload that; neu chua co anh thi tra ve avatar chu cai dau hoac nen trong.
 */
export function resolveAvatarUrl(userObj = {}) {
  let avatar, name;
  if (typeof userObj === 'string') {
    avatar = userObj;
  } else if (userObj && typeof userObj === 'object') {
    avatar = userObj.avatar
      ?? userObj.avatarUrl
      ?? userObj.photo
      ?? userObj.photoUrl
      ?? userObj.src;
    name = userObj.name ?? userObj.fullName ?? userObj.username ?? '';
  }

  const raw = String(avatar || '').trim();
  if (isRealAvatar(raw)) return raw;

  return buildInitialAvatarDataUrl(name);
}

export function getDefaultAvatar(_role = 'student', _adminRole = null, _gender = '', name = '') {
  return buildInitialAvatarDataUrl(name);
}
