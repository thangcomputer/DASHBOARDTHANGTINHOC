/**
 * Avatar mac dinh phong cach cartoon chu de giao duc.
 * Chi dung khi user chua co anh tuy chinh.
 */

export const DEFAULT_AVATARS = {
  admin: '/avatars/admin_male.png',
  admin_male: '/avatars/admin_male.png',
  admin_female: '/avatars/admin_female.png',

  staff: '/avatars/staff_female.png',
  staff_male: '/avatars/staff_male.png',
  staff_female: '/avatars/staff_female.png',

  support: '/avatars/support_male.png',
  support_male: '/avatars/support_male.png',
  support_female: '/avatars/support_female.png',

  teacher: '/avatars/teacher_male.png',
  teacher_male: '/avatars/teacher_male.png',
  teacher_female: '/avatars/teacher_female.png',

  student: '/avatars/student_male.png',
  student_male: '/avatars/student_male.png',
  student_female: '/avatars/student_female.png',
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
  let avatar, role, adminRole, permissions, name, id, gender;
  if (typeof userObj === 'string') {
    avatar = userObj;
  } else if (userObj && typeof userObj === 'object') {
    avatar = userObj.avatar;
    role = userObj.role;
    adminRole = userObj.adminRole;
    permissions = userObj.permissions;
    name = userObj.name;
    id = userObj.id || userObj._id;
    gender = userObj.gender || userObj.genderCode;
  }

  const raw = String(avatar || '').trim();
  // Ưu tiên ảnh tùy chỉnh thực sự do người dùng upload (/uploads/ hoặc URL/base64)
  if (isAvatarUrl(raw)) return raw;

  const r = String(role || '').toLowerCase();
  const ar = String(adminRole || '').toUpperCase();
  const uid = String(id || '').toLowerCase();
  const uname = String(name || '').toLowerCase();
  const perms = Array.isArray(permissions) ? permissions : [];

  // Phân định giới tính trực tiếp từ gender chọn trong form (KHÔNG dùng thuật toán đoán tên)
  const gRaw = String(gender || '').trim().toLowerCase();
  const isFemale = gRaw === 'female' || gRaw === 'nữ';
  const isMale = gRaw === 'male' || gRaw === 'nam';

  // 1. Super Admin / Giám Đốc
  if (uid === 'admin' || ar === 'SUPER_ADMIN' || uname.includes('super admin') || uname.includes('p đào tạo')) {
    if (isFemale) return DEFAULT_AVATARS.admin_female;
    return DEFAULT_AVATARS.admin_male;
  }

  // 2. Hỗ trợ viên chuyên trách (Hồ Sỹ Hiếu / Hỗ trợ viên / chỉ nhắn tin)
  const isSupportOnly = perms.length === 1 && perms.includes('manage_messages');
  if (
    uname.includes('hỗ trợ viên') ||
    uname.includes('hồ sĩ hiếu') ||
    uname.includes('hồ sỹ hiếu') ||
    isSupportOnly ||
    r === 'support'
  ) {
    if (isFemale) return DEFAULT_AVATARS.support_female;
    return DEFAULT_AVATARS.support_male;
  }

  // 3. ADMIN-STAFF Chi nhánh (Hồ Thị Nga, Staff chi nhánh, v.v...)
  if (r === 'staff' || ar === 'STAFF') {
    if (isMale) return DEFAULT_AVATARS.staff_male;
    return DEFAULT_AVATARS.staff_female;
  }

  // 4. Admin chung
  if (r === 'admin' || r === 'super_admin') {
    if (isFemale) return DEFAULT_AVATARS.admin_female;
    return DEFAULT_AVATARS.admin_male;
  }

  // 5. Giảng viên
  if (r === 'teacher') {
    if (isFemale) return DEFAULT_AVATARS.teacher_female;
    return DEFAULT_AVATARS.teacher_male;
  }

  // 6. Nhóm chat
  if (r === 'group') return DEFAULT_AVATARS.admin_male;

  // 7. Học viên mặc định
  if (isFemale) return DEFAULT_AVATARS.student_female;
  return DEFAULT_AVATARS.student_male;
}

export function getDefaultAvatar(role = 'student', adminRole = null, gender = '') {
  return resolveAvatarUrl({ role, adminRole, gender });
}
