import type { ImageSourcePropType } from 'react-native';

export const ROLE_AVATAR_SOURCES: Record<string, ImageSourcePropType> = {
  teacher: require('../../assets/avatars/teacher.png'),
  student: require('../../assets/avatars/student.png'),
  support: require('../../assets/avatars/support_male.png'),
  staff: require('../../assets/avatars/staff.png'),
  admin: require('../../assets/avatars/admin.png'),
};

export function getContactAvatarSource(
  role?: string,
  adminRole?: string | null,
  avatarUri?: string,
): ImageSourcePropType | { uri: string } {
  if (avatarUri && (/^(https?:\/\/|data:image\/)/i.test(avatarUri) || avatarUri.startsWith('/uploads/'))) {
    return { uri: avatarUri };
  }
  const ar = String(adminRole || '').toUpperCase();
  const r = String(role || '').toLowerCase();
  if (ar === 'SUPPORT' || r === 'support') return ROLE_AVATAR_SOURCES.support;
  if (ar === 'STAFF' || r === 'staff' || r === 'recruitment') return ROLE_AVATAR_SOURCES.staff;
  if (r === 'teacher') return ROLE_AVATAR_SOURCES.teacher;
  if (r === 'student') return ROLE_AVATAR_SOURCES.student;
  if (r === 'admin') return ROLE_AVATAR_SOURCES.admin;
  return ROLE_AVATAR_SOURCES.support;
}

export function getRoleBadgeConfig(role?: string, adminRole?: string | null) {
  const ar = String(adminRole || '').toUpperCase();
  const r = String(role || '').toLowerCase();
  if (ar === 'SUPPORT' || r === 'support') {
    return { label: 'HT', bg: '#2563EB', ring: '#60A5FA' };
  }
  if (ar === 'STAFF' || r === 'staff' || r === 'recruitment') {
    return { label: 'NV', bg: '#475569', ring: '#94A3B8' };
  }
  if (r === 'teacher') {
    return { label: 'GV', bg: '#F59E0B', ring: '#FBBF24' };
  }
  if (r === 'student') {
    return { label: 'HV', bg: '#0EA5E9', ring: '#38BDF8' };
  }
  if (r === 'admin') {
    return { label: 'AD', bg: '#E11D48', ring: '#FB7185' };
  }
  if (r === 'group') {
    return { label: 'GR', bg: '#DC2626', ring: '#F87171' };
  }
  return { label: 'HT', bg: '#2563EB', ring: '#60A5FA' };
}
