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
  if (s.startsWith('/uploads/')) return true;
  return false;
}

export function looksLikeInitials(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  if (isAvatarUrl(s)) return false;
  return /^[\p{L}\p{N}]{1,4}$/u.test(s);
}

export function resolveAvatarUrl({ avatar, role = 'student', adminRole = null } = {}) {
  const raw = String(avatar || '').trim();
  // Ưu tiên ảnh tùy chỉnh thực sự do người dùng upload (/uploads/ hoặc URL/base64)
  if (isAvatarUrl(raw)) return raw;

  const r = String(role || 'student').toLowerCase();
  if (r === 'admin' || adminRole === 'SUPER_ADMIN' || r === 'super_admin') return DEFAULT_AVATARS.admin;
  if (r === 'staff' || adminRole === 'STAFF') return DEFAULT_AVATARS.staff;
  if (r === 'teacher') return DEFAULT_AVATARS.teacher;
  if (r === 'group') return DEFAULT_AVATARS.admin;
  return DEFAULT_AVATARS.student;
}

export function getDefaultAvatar(role = 'student', adminRole = null) {
  return resolveAvatarUrl({ role, adminRole });
}
