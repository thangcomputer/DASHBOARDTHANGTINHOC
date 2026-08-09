export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HIGH_ADMIN: 'HIGH_ADMIN',
  ADMIN_STAFF: 'ADMIN_STAFF',
  SUPPORT_AGENT: 'SUPPORT_AGENT',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
};

export const hasAdminAccess = (roleCode) => {
  return [UserRole.SUPER_ADMIN, UserRole.HIGH_ADMIN, UserRole.ADMIN_STAFF].includes(roleCode);
};

export const isSuperAdmin = (roleCode) => roleCode === UserRole.SUPER_ADMIN;
export const isHighAdmin = (roleCode) => roleCode === UserRole.HIGH_ADMIN;
export const isAdminStaff = (roleCode) => roleCode === UserRole.ADMIN_STAFF;
export const isSupportAgent = (roleCode) => roleCode === UserRole.SUPPORT_AGENT;
export const isTeacher = (roleCode) => roleCode === UserRole.TEACHER;
export const isStudent = (roleCode) => roleCode === UserRole.STUDENT;

export const getRoleDisplayName = (roleCode, userDisplayName, userJobTitle) => {
  if (userJobTitle) return userJobTitle;
  
  switch (roleCode) {
    case UserRole.SUPER_ADMIN: return 'Quản trị hệ thống';
    case UserRole.HIGH_ADMIN: return 'Quản trị cấp cao';
    case UserRole.ADMIN_STAFF: return 'Nhân viên quản trị';
    case UserRole.SUPPORT_AGENT: return 'Chuyên viên hỗ trợ';
    case UserRole.TEACHER: return 'Giảng viên';
    case UserRole.STUDENT: return 'Học viên';
    default: return userDisplayName || 'Người dùng';
  }
};
