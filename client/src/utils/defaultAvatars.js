/**
 * Avatar mac dinh phong cach cartoon chu de giao duc.
 * Chi dung khi user chua co anh tuy chinh.
 */

export const DEFAULT_AVATARS = {
  admin: '/avatars/admin.png',
  staff: '/avatars/staff.png',
  support: '/avatars/support_male.png',
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

export function resolveAvatarUrl(userObj = {}) {
  let avatar, role, adminRole, permissions, name, id;
  if (typeof userObj === 'string') {
    avatar = userObj;
  } else if (userObj && typeof userObj === 'object') {
    avatar = userObj.avatar;
    role = userObj.role;
    adminRole = userObj.adminRole;
    permissions = userObj.permissions;
    name = userObj.name;
    id = userObj.id || userObj._id;
  }

  const raw = String(avatar || '').trim();
  // Ưu tiên ảnh tùy chỉnh thực sự do người dùng upload (/uploads/ hoặc URL/base64)
  if (isAvatarUrl(raw)) return raw;

  const r = String(role || '').toLowerCase();
  const ar = String(adminRole || '').toUpperCase();
  const uid = String(id || '').toLowerCase();
  const uname = String(name || '').toLowerCase();
  const perms = Array.isArray(permissions) ? permissions : [];

  // 1. Super Admin / Giám Đốc
  if (uid === 'admin' || ar === 'SUPER_ADMIN' || uname.includes('super admin') || uname.includes('p đào tạo')) {
    return DEFAULT_AVATARS.admin;
  }

  // 2. Hỗ trợ viên (Hồ Sỹ Hiếu / Hỗ trợ viên / support) -> Nam hỗ trợ đeo tai nghe
  const isSupportOnly = perms.length === 1 && perms.includes('manage_messages');
  if (uname.includes('hỗ trợ viên') || uname.includes('hồ sĩ hiếu') || uname.includes('hồ sỹ hiếu') || isSupportOnly || r === 'staff') {
    return DEFAULT_AVATARS.support;
  }

  // 3. Staff / Admin chi nhánh -> Nữ nhân viên
  if (ar === 'STAFF') {
    return DEFAULT_AVATARS.staff;
  }

  // 4. Admin chung
  if (r === 'admin' || r === 'super_admin') {
    return DEFAULT_AVATARS.admin;
  }

  // 5. Giảng viên
  if (r === 'teacher') return DEFAULT_AVATARS.teacher;

  // 6. Nhóm chat
  if (r === 'group') return DEFAULT_AVATARS.admin;

  // 7. Học viên mặc định
  return DEFAULT_AVATARS.student;
}

export function getDefaultAvatar(role = 'student', adminRole = null) {
  return resolveAvatarUrl({ role, adminRole });
}
