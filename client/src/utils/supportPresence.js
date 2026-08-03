/**
 * Danh bạ chat nổi theo vai trò:
 * - Super Admin: mọi người đang online (HV / GV / Admin chi nhánh)
 * - Staff / GV / HV / admin chi nhánh: chỉ Admin Super hỗ trợ
 */
import { normalizeChatRole } from './chatConversationId';

export function isSuperAdminViewer(session) {
  if (!session) return false;
  const id = String(session?.id || session?._id || '');
  if (id === 'admin' || session?.adminRole === 'SUPER_ADMIN' || session?.role === 'admin' || session?.role === 'staff' || session?.adminRole === 'STAFF') {
    return true;
  }
  const perms = Array.isArray(session?.permissions) ? session.permissions : [];
  if (perms.includes('manage_messages')) return true;
  return false;
}

export function isSuperAdminPresence(u) {
  return String(u?.userId || '') === 'admin';
}

const ROLE_RANK = { admin: 0, staff: 0, teacher: 1, student: 2 };

function personFromPresence(u) {
  const rawRole = String(u.role || 'student').toLowerCase();
  const roleKey = normalizeChatRole(rawRole);
  const uid = String(u.userId || '');
  let labelRole = roleKey;
  if (rawRole === 'staff') labelRole = 'staff';
  return {
    id: uid,
    name: u.name || (rawRole === 'staff' ? 'Hỗ trợ viên' : roleKey === 'admin' ? 'Quản trị viên' : roleKey === 'teacher' ? 'Giảng viên' : 'Học viên'),
    role: rawRole === 'staff' ? 'staff' : roleKey,
    adminRole: u.adminRole || (rawRole === 'staff' ? 'STAFF' : null),
    displayRole: labelRole,
    avatar: u.avatar || '',
    online: true,
    branchId: u.branchId || null,
  };
}

/**
 * @returns {{ mode: 'directory'|'support_only', groups: Array<{ key: string, label: string, people: object[] }> }}
 */
export function buildSupportDirectory({ session, onlineUsers, meId }) {
  const me = String(meId || session?.id || session?._id || '');
  const users = Array.isArray(onlineUsers) ? onlineUsers : [];

  if (!isSuperAdminViewer(session)) {
    const online = users.find((u) => {
      const r = String(u.role || '').toLowerCase();
      return r === 'staff' || u.adminRole === 'STAFF' || isSuperAdminPresence(u);
    });
    return {
      mode: 'support_only',
      groups: [{
        key: 'support',
        label: 'Hỗ trợ viên trực tuyến',
        people: [{
          id: online?.userId || 'admin',
          name: online?.name || 'Hỗ trợ viên',
          role: 'staff',
          displayRole: 'staff',
          adminRole: 'STAFF',
          permissions: ['manage_messages'],
          avatar: online?.avatar || '',
          online: !!online,
        }],
      }],
    };
  }

  const seen = new Set();
  const buckets = {
    admin: [],
    teacher: [],
    student: [],
  };

  for (const u of users) {
    const uid = String(u.userId || '');
    if (!uid || uid === me) continue;
    // Super Admin không cần chat chính mình (id admin)
    if (uid === 'admin' && me === 'admin') continue;

    const rawRole = String(u.role || '').toLowerCase();
    const roleKey = normalizeChatRole(rawRole);
    const key = `${roleKey}_${uid}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const person = personFromPresence(u);
    if (roleKey === 'teacher') buckets.teacher.push(person);
    else if (roleKey === 'student') buckets.student.push(person);
    else buckets.admin.push(person); // admin + staff (chi nhánh)
  }

  const sortPeople = (arr) => arr.sort((a, b) => {
    const d = (ROLE_RANK[a.displayRole] ?? 9) - (ROLE_RANK[b.displayRole] ?? 9);
    if (d !== 0) return d;
    return String(a.name).localeCompare(String(b.name), 'vi');
  });

  const groups = [];
  if (buckets.admin.length) {
    groups.push({
      key: 'admin',
      label: `Hỗ trợ viên & Quản trị (${buckets.admin.length})`,
      people: sortPeople(buckets.admin),
    });
  }
  if (buckets.teacher.length) {
    groups.push({
      key: 'teacher',
      label: `Giảng viên (${buckets.teacher.length})`,
      people: sortPeople(buckets.teacher),
    });
  }
  if (buckets.student.length) {
    groups.push({
      key: 'student',
      label: `Học viên (${buckets.student.length})`,
      people: sortPeople(buckets.student),
    });
  }

  return { mode: 'directory', groups };
}

/** Flatten people for simple lists (FeedBoard) */
export function flattenSupportPeople(directory) {
  return (directory?.groups || []).flatMap((g) => g.people || []);
}
