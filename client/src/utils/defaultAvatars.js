/**
 * Avatar mac dinh phong cach cartoon chu de giao duc.
 * Chi dung khi user chua co anh tuy chinh (upload that).
 *
 * Assets trong client/public/avatars/ (PNG gender-specific + SVG trung tinh).
 */

/**
 * Canonical map: role + gender → asset path.
 * unknown → role PNG trung tinh (student.png / teacher.png / ...) - KHONG doan male.
 * staff default KHONG dung staff_female.
 */
export const DEFAULT_AVATARS = {
  admin: '/avatars/admin.png',
  admin_male: '/avatars/admin_male.png',
  admin_female: '/avatars/admin_female.png',
  admin_unknown: '/avatars/admin.png',

  staff: '/avatars/staff.png',
  staff_male: '/avatars/staff_male.png',
  staff_female: '/avatars/staff_female.png',
  staff_unknown: '/avatars/staff.png',

  support: '/avatars/support_male.png',
  support_male: '/avatars/support_male.png',
  support_female: '/avatars/support_female.png',
  support_unknown: '/avatars/support_male.png',

  teacher: '/avatars/teacher.png',
  teacher_male: '/avatars/teacher_male.png',
  teacher_female: '/avatars/teacher_female.png',
  teacher_unknown: '/avatars/teacher.png',

  student: '/avatars/student.png',
  student_male: '/avatars/student_male.png',
  student_female: '/avatars/student_female.png',
  student_unknown: '/avatars/student.png',
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
