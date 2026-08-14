/**
 * Phase 8.21/8.22 — Frontend messaging identity resolver.
 * NEVER map role==="admin" alone → SUPER_ADMIN profile when senderId is a real ObjectId.
 */
import { getMessagingRole } from './messagingRoles';

export const DISPLAY_ROLE = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  HIGH_ADMIN: 'HIGH_ADMIN',
  ADMIN_STAFF: 'ADMIN_STAFF',
  SUPPORT: 'SUPPORT',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  LEGACY_ROOT: 'LEGACY_ROOT',
  UNKNOWN: 'UNKNOWN',
});

export function resolveDisplayRole(user = {}) {
  const id = String(user.id || user._id || '');
  if (id === 'admin') return DISPLAY_ROLE.LEGACY_ROOT;
  if (user.adminRole === 'SUPER_ADMIN') return DISPLAY_ROLE.SUPER_ADMIN;
  if (user.adminRole === 'HIGH_ADMIN') return DISPLAY_ROLE.HIGH_ADMIN;
  if (user.adminRole === 'SUPPORT') return DISPLAY_ROLE.SUPPORT;
  if (user.adminRole === 'STAFF' || user.role === 'staff') return DISPLAY_ROLE.ADMIN_STAFF;
  if (user.role === 'teacher') return DISPLAY_ROLE.TEACHER;
  if (user.role === 'student') return DISPLAY_ROLE.STUDENT;
  return DISPLAY_ROLE.UNKNOWN;
}

/** Never elevate to SUPER by transport role alone. */
export function assertDisplayIdentitySafe(identity = {}) {
  const id = String(identity.id || '');
  const ar = identity.adminRole || null;
  let displayRole = identity.displayRole || DISPLAY_ROLE.UNKNOWN;
  const elevated = displayRole === DISPLAY_ROLE.SUPER_ADMIN
    || displayRole === DISPLAY_ROLE.LEGACY_ROOT;

  if (elevated) {
    const allowed = id === 'admin' || ar === 'SUPER_ADMIN';
    if (!allowed) {
      if (ar === 'HIGH_ADMIN') displayRole = DISPLAY_ROLE.HIGH_ADMIN;
      else if (ar === 'SUPPORT') displayRole = DISPLAY_ROLE.SUPPORT;
      else if (ar === 'STAFF' || identity.role === 'staff') displayRole = DISPLAY_ROLE.ADMIN_STAFF;
      else if (identity.role === 'teacher') displayRole = DISPLAY_ROLE.TEACHER;
      else if (identity.role === 'student') displayRole = DISPLAY_ROLE.STUDENT;
      else displayRole = DISPLAY_ROLE.UNKNOWN;
    }
  }

  return {
    id,
    role: identity.role || 'unknown',
    displayRole,
    adminRole: ar,
    displayName: String(identity.displayName || '').trim() || 'Người dùng',
    avatar: identity.avatar || '',
  };
}

export function displayRoleLabel(displayRole) {
  switch (displayRole) {
    case DISPLAY_ROLE.SUPER_ADMIN:
    case DISPLAY_ROLE.LEGACY_ROOT:
      return 'Super Admin';
    case DISPLAY_ROLE.HIGH_ADMIN:
      return 'Admin cấp cao';
    case DISPLAY_ROLE.ADMIN_STAFF:
      return 'Giáo vụ';
    case DISPLAY_ROLE.SUPPORT:
      return 'Hỗ trợ';
    case DISPLAY_ROLE.TEACHER:
      return 'Giảng viên';
    case DISPLAY_ROLE.STUDENT:
      return 'Học viên';
    default:
      return 'Người dùng';
  }
}

/**
 * Resolve actor for conversation list / message bubble.
 * Lookup by ID first. Legacy root id "admin" only then uses SUPER profile.
 * Prefer server-provided sender{} when present (via normalizeMessage).
 */
export function resolveMessagingActor(
  { id, role, name, avatar, adminRole, displayRole, displayName } = {},
  { teachers = [], students = [], staffs = [] } = {},
) {
  const actorId = String(id || '');
  if (!actorId) {
    return assertDisplayIdentitySafe({
      id: '',
      role: role || 'unknown',
      displayRole: DISPLAY_ROLE.UNKNOWN,
      adminRole: null,
      displayName: 'Người dùng',
      avatar: '',
    });
  }

  // Server already resolved — trust ID + adminRole, still run safety assert
  if (displayName && (displayRole || adminRole != null)) {
    return assertDisplayIdentitySafe({
      id: actorId,
      role: role || 'unknown',
      displayRole: displayRole || DISPLAY_ROLE.UNKNOWN,
      adminRole: adminRole || null,
      displayName,
      avatar: avatar || '',
    });
  }

  // Legacy root mailbox identity ONLY when id is literally "admin"
  if (actorId === 'admin') {
    const superDoc = teachers.find((t) => t.adminRole === 'SUPER_ADMIN')
      || staffs.find((st) => st.adminRole === 'SUPER_ADMIN');
    return assertDisplayIdentitySafe({
      id: 'admin',
      role: 'admin',
      displayRole: DISPLAY_ROLE.LEGACY_ROOT,
      adminRole: 'SUPER_ADMIN',
      displayName: superDoc?.name || name || 'Admin hệ thống',
      avatar: superDoc?.avatar || avatar || '',
    });
  }

  const matchedStudent = students.find((s) => String(s.id || s._id) === actorId);
  if (matchedStudent) {
    return assertDisplayIdentitySafe({
      id: actorId,
      role: 'student',
      displayRole: DISPLAY_ROLE.STUDENT,
      adminRole: null,
      displayName: matchedStudent.name || name || 'Học viên',
      avatar: matchedStudent.avatar || avatar || '',
    });
  }

  const matchedTeacher = teachers.find((t) => String(t.id || t._id) === actorId);
  const matchedStaff = staffs.find((st) => String(st.id || st._id) === actorId);
  const doc = matchedTeacher || matchedStaff;
  if (doc) {
    const u = {
      id: actorId,
      role: doc.role || role,
      adminRole: doc.adminRole || adminRole,
      name: doc.name || name,
      avatar: doc.avatar || avatar,
    };
    return assertDisplayIdentitySafe({
      id: actorId,
      role: getMessagingRole(u),
      displayRole: resolveDisplayRole(u),
      adminRole: u.adminRole || null,
      displayName: u.name || 'Người dùng',
      avatar: u.avatar || '',
    });
  }

  // Safe fallback — NEVER Super Admin
  return assertDisplayIdentitySafe({
    id: actorId,
    role: role || 'unknown',
    displayRole: DISPLAY_ROLE.UNKNOWN,
    adminRole: adminRole || null,
    displayName: name || 'Người dùng',
    avatar: avatar || '',
  });
}

/** System / broadcast / group peer ids — never treated as deleted users. */
export function isSpecialMessagingPeerId(id) {
  const s = String(id || '');
  return !s || s === 'admin' || s.startsWith('ALL_') || s.startsWith('group_');
}

/**
 * True when peer is still a valid messaging counterpart.
 * Prefer server `contacts` (GET /api/messages/contacts) — local students/teachers/staffs
 * are incomplete for teacher/student and often empty for admin/staff until HV page loads.
 */
export function isAliveMessagingPeer(peerId, {
  students = [],
  teachers = [],
  staffs = [],
  contacts = [],
} = {}) {
  const id = String(peerId || '');
  if (isSpecialMessagingPeerId(id)) return true;
  if ((contacts || []).some((c) => String(c?.id) === id)) return true;
  if (students.some((s) => String(s?.id || s?._id) === id)) return true;
  if (teachers.some((t) => String(t?.id || t?._id) === id)) return true;
  if (staffs.some((st) => String(st?.id || st?._id) === id)) return true;
  return false;
}

/**
 * Canonical FE message shape — used for HTTP, socket, sync, optimistic merge.
 * Preserves senderId/senderRole/conversationId; prefers server sender{} identity.
 */
export function normalizeMessage(raw = {}) {
  const id = raw._id || raw.id;
  const conversationId = raw.conversationId || raw.convId;
  const senderId = String(raw.senderId || '');
  const receiverId = String(raw.receiverId || '');

  let sender = raw.sender;
  if (sender && typeof sender === 'object') {
    sender = assertDisplayIdentitySafe({
      id: sender.id || senderId,
      role: sender.role || raw.senderRole,
      displayRole: sender.displayRole,
      adminRole: sender.adminRole,
      displayName: sender.displayName || raw.senderName,
      avatar: sender.avatar || raw.senderAvatar || '',
    });
  } else {
    sender = assertDisplayIdentitySafe({
      id: senderId,
      role: raw.senderRole || 'unknown',
      displayRole: DISPLAY_ROLE.UNKNOWN,
      adminRole: null,
      displayName: raw.senderName || 'Người dùng',
      avatar: raw.senderAvatar || '',
    });
  }

  let receiver = raw.receiver;
  if (receiver && typeof receiver === 'object') {
    receiver = assertDisplayIdentitySafe({
      id: receiver.id || receiverId,
      role: receiver.role || raw.receiverRole,
      displayRole: receiver.displayRole,
      adminRole: receiver.adminRole,
      displayName: receiver.displayName || raw.receiverName,
      avatar: receiver.avatar || raw.receiverAvatar || '',
    });
  } else {
    receiver = assertDisplayIdentitySafe({
      id: receiverId,
      role: raw.receiverRole || 'unknown',
      displayRole: DISPLAY_ROLE.UNKNOWN,
      adminRole: null,
      displayName: raw.receiverName || 'Người dùng',
      avatar: raw.receiverAvatar || '',
    });
  }

  return {
    id,
    _id: raw._id || id,
    convId: conversationId,
    conversationId,
    groupId: raw.groupId,
    isGroup: Boolean(raw.isGroup),
    senderId,
    senderName: sender.displayName,
    senderRole: raw.senderRole,
    senderAvatar: sender.avatar || '',
    sender,
    receiverId,
    receiverName: receiver.displayName,
    receiverRole: raw.receiverRole,
    receiverAvatar: receiver.avatar || '',
    receiver,
    content: raw.content,
    messageType: raw.messageType || 'text',
    fileUrl: raw.fileUrl || '',
    fileName: raw.fileName || '',
    fileExpired: Boolean(raw.fileExpired),
    time: raw.time || (raw.createdAt ? new Date(raw.createdAt) : new Date()),
    createdAt: raw.createdAt,
    read: Boolean(raw.read ?? raw.isRead),
    isRead: Boolean(raw.isRead ?? raw.read),
    isRecalled: Boolean(raw.isRecalled),
    reactions: raw.reactions || [],
  };
}
