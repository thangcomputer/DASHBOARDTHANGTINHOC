/**
 * Avatar mac dinh phong cach cartoon chu de giao duc.
 * Chi dung khi user chua co anh tuy chinh (upload that).
 *
 * Assets trong client/public/avatars/ (PNG gender-specific + SVG trung tinh).
 */

/**
 * Canonical map: role + gender → asset path.
 * unknown → role PNG trung tinh (student.png / teacher.png / ...) — KHONG doan male.
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
 * Source of truth: field gender tu DB/session — khong doan tu ten/avatar/role.
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

/** Alias canonical — uploaded/real image detection. */
export function isRealAvatar(value) {
  return isAvatarUrl(value);
}

export function looksLikeInitials(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  if (isAvatarUrl(s)) return false;
  return /^[\p{L}\p{N}]{1,4}$/u.test(s);
}

function pickRoleGenderAsset(roleKey, gender) {
  const g = normalizeGender(gender);
  const base = String(roleKey || 'student').toLowerCase();
  if (g === 'female') return DEFAULT_AVATARS[`${base}_female`] || DEFAULT_AVATARS[base] || DEFAULT_AVATARS.student;
  if (g === 'male') return DEFAULT_AVATARS[`${base}_male`] || DEFAULT_AVATARS[base] || DEFAULT_AVATARS.student;
  return DEFAULT_AVATARS[`${base}_unknown`] || DEFAULT_AVATARS[base] || DEFAULT_AVATARS.student;
}

/**
 * Resolve avatar hien thi.
 * Thu tu: upload that → default theo role + gender → role neutral.
 * Khong bien unknown thanh male.
 */
export function resolveAvatarUrl(userObj = {}) {
  let avatar, role, adminRole, name, id, gender;
  if (typeof userObj === 'string') {
    avatar = userObj;
  } else if (userObj && typeof userObj === 'object') {
    avatar = userObj.avatar ?? userObj.src;
    role = userObj.role;
    adminRole = userObj.adminRole;
    name = userObj.name;
    id = userObj.id || userObj._id;
    gender = userObj.gender ?? userObj.genderCode;
  }

  const raw = String(avatar || '').trim();
  if (isRealAvatar(raw)) return raw;

  const r = String(role || '').toLowerCase();
  const ar = String(adminRole || '').toUpperCase();
  const uid = String(id || '').toLowerCase();
  const g = normalizeGender(gender);

  // Phase 8.21: STAFF/SUPPORT by adminRole BEFORE generic role==="admin"
  // (JWT staff often has role=admin — must NOT resolve SUPER avatar).
  if (ar === 'SUPPORT' || r === 'support') {
    return pickRoleGenderAsset('support', g);
  }

  if (ar === 'STAFF' || r === 'staff') {
    return pickRoleGenderAsset('staff', g);
  }

  // Legacy root id OR explicit SUPER/HIGH adminRole
  if (uid === 'admin' || ar === 'SUPER_ADMIN' || ar === 'HIGH_ADMIN') {
    return pickRoleGenderAsset('admin', g);
  }

  // JWT admin without adminRole (true root-style session)
  if (r === 'admin' || r === 'super_admin') {
    return pickRoleGenderAsset('admin', g);
  }

  if (r === 'teacher') {
    return pickRoleGenderAsset('teacher', g);
  }

  if (r === 'group') {
    return DEFAULT_AVATARS.admin_unknown;
  }

  return pickRoleGenderAsset('student', g);
}

export function getDefaultAvatar(role = 'student', adminRole = null, gender = '') {
  return resolveAvatarUrl({ role, adminRole, gender });
}
