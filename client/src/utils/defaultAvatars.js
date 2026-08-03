/**
 * Avatar mac dinh phong cach cartoon chu de giao duc.
 * Chi dung khi user chua co anh tuy chinh.
 */

export const DEFAULT_AVATARS = {
  admin: '/avatars/admin.png',
  staff: '/avatars/staff.png',
  teacher: '/avatars/teacher.png',
  student: '/avatars/student.png',
};

/** Chi chap nhan gia tri that su la URL/path anh */
export function isAvatarUrl(value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return true;
  if (s.startsWith('data:image/')) return true;
  // Absolute path toi file anh (bo qua initials / chu thuan)
  if (s.startsWith('/') && /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(s)) return true;
  if (s.startsWith('/uploads/') || s.startsWith('/avatars/')) return true;
  return false;
}

export function looksLikeInitials(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  if (isAvatarUrl(s)) return false;
  // 1–4 ky tu chu/so (gom tieng Viet), khong phai URL
  return /^[\p{L}\p{N}]{1,4}$/u.test(s);
}

export function resolveAvatarUrl({ avatar, role = 'student', adminRole = null } = {}) {
  const raw = String(avatar || '').trim();
  // Chi dung avatar custom khi dung la URL/path anh
  if (isAvatarUrl(raw)) return raw;

  const r = String(role || 'student').toLowerCase();
  if (r === 'staff' || adminRole === 'STAFF') return DEFAULT_AVATARS.staff;
  if (r === 'admin' || adminRole === 'SUPER_ADMIN') return DEFAULT_AVATARS.admin;
  if (r === 'teacher') return DEFAULT_AVATARS.teacher;
  if (r === 'group') return DEFAULT_AVATARS.admin;
  return DEFAULT_AVATARS.student;
}

export function getDefaultAvatar(role = 'student', adminRole = null) {
  return resolveAvatarUrl({ role, adminRole });
}
