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

export function looksLikeInitials(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  if (/^https?:\/\//i.test(s) || s.startsWith('/') || s.startsWith('data:')) return false;
  return /^[A-Za-z0-9\u00C0-\u024F]{1,3}$/.test(s);
}

export function resolveAvatarUrl({ avatar, role = 'student', adminRole = null } = {}) {
  const raw = String(avatar || '').trim();
  if (raw && !looksLikeInitials(raw)) return raw;

  const r = String(role || 'student').toLowerCase();
  if (r === 'staff' || adminRole === 'STAFF') return DEFAULT_AVATARS.staff;
  if (r === 'admin' || adminRole === 'SUPER_ADMIN') return DEFAULT_AVATARS.admin;
  if (r === 'teacher') return DEFAULT_AVATARS.teacher;
  return DEFAULT_AVATARS.student;
}

export function getDefaultAvatar(role = 'student', adminRole = null) {
  return resolveAvatarUrl({ role, adminRole });
}