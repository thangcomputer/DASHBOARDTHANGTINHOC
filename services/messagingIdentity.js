/**
 * Phase 8.21/8.22 — Canonical messaging identity (LIVE only).
 * Transport role for conversationId remains: admin | staff | teacher | student.
 * Display identity NEVER collapses ADMIN_STAFF/SUPPORT/HIGH onto SUPER_ADMIN by role alone.
 */
const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const { getMessagingRole } = require('../utils/messagingRoles');
const { sanitizeMessageDoc } = require('../utils/messageFileRetention');

const DISPLAY_ROLE = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  HIGH_ADMIN: 'HIGH_ADMIN',
  ADMIN_STAFF: 'ADMIN_STAFF',
  SUPPORT: 'SUPPORT',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  LEGACY_ROOT: 'LEGACY_ROOT',
  UNKNOWN: 'UNKNOWN',
});

function resolveDisplayRole(user = {}) {
  const id = String(user.id || user._id || '');
  if (id === 'admin') return DISPLAY_ROLE.LEGACY_ROOT;
  if (user.adminRole === 'SUPER_ADMIN') return DISPLAY_ROLE.SUPER_ADMIN;
  if (user.adminRole === 'HIGH_ADMIN') return DISPLAY_ROLE.HIGH_ADMIN;
  if (user.adminRole === 'SUPPORT') return DISPLAY_ROLE.SUPPORT;
  if (user.adminRole === 'STAFF' || user.role === 'staff') return DISPLAY_ROLE.ADMIN_STAFF;
  if (user.role === 'teacher') return DISPLAY_ROLE.TEACHER;
  if (user.role === 'student') return DISPLAY_ROLE.STUDENT;
  // JWT admin without adminRole — only elevate when id is literal root
  if (user.role === 'admin' && id === 'admin') return DISPLAY_ROLE.LEGACY_ROOT;
  if (user.role === 'admin') return DISPLAY_ROLE.UNKNOWN;
  return DISPLAY_ROLE.UNKNOWN;
}

/**
 * Resolve authenticated sender/receiver identity for message payloads.
 * id is always the authenticated user id (never remapped to "admin" except true root).
 */
function resolveMessagingIdentity(user = {}) {
  const id = String(user.id || user._id || '');
  const transportRole = getMessagingRole(user);
  const displayName = String(user.name || user.fullName || user.displayName || '').trim() || 'Người dùng';
  const avatar = user.avatar || user.avatarUrl || '';
  const raw = {
    id,
    role: transportRole,
    displayRole: resolveDisplayRole(user),
    adminRole: user.adminRole || null,
    displayName,
    avatar,
  };
  return assertDisplayIdentitySafe(raw);
}

/**
 * Phase 8.22 — Never elevate to SUPER by transport role alone.
 * SUPER/LEGACY_ROOT only when id==="admin" OR adminRole===SUPER_ADMIN.
 */
function assertDisplayIdentitySafe(identity = {}) {
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

/**
 * Enrich a lean Teacher/Student doc into messaging identity.
 */
function identityFromDoc(doc, fallbackRole) {
  if (!doc) {
    return assertDisplayIdentitySafe({
      id: '',
      role: fallbackRole || 'staff',
      displayRole: DISPLAY_ROLE.UNKNOWN,
      adminRole: null,
      displayName: 'Người dùng',
      avatar: '',
    });
  }
  const u = {
    id: doc._id || doc.id,
    role: doc.role || fallbackRole,
    adminRole: doc.adminRole,
    name: doc.name,
    avatar: doc.avatar,
  };
  return resolveMessagingIdentity(u);
}

function toPlainMessage(doc) {
  const plain = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  return sanitizeMessageDoc(plain);
}

function identityFromHint({ id, role, name, avatar, adminRole }) {
  const sid = String(id || '');
  if (sid === 'admin') {
    return assertDisplayIdentitySafe({
      id: 'admin',
      role: 'admin',
      displayRole: DISPLAY_ROLE.LEGACY_ROOT,
      adminRole: 'SUPER_ADMIN',
      displayName: name || 'Admin hệ thống',
      avatar: avatar || '',
    });
  }
  return assertDisplayIdentitySafe({
    id: sid,
    role: role || 'unknown',
    displayRole: resolveDisplayRole({ id: sid, role, adminRole }),
    adminRole: adminRole || null,
    displayName: name || 'Người dùng',
    avatar: avatar || '',
  });
}

function attachIdentitiesToPlain(plain, senderIdentity, receiverIdentity) {
  const sender = assertDisplayIdentitySafe(senderIdentity);
  const receiver = assertDisplayIdentitySafe(receiverIdentity);
  return {
    ...plain,
    senderName: sender.displayName || plain.senderName,
    senderAvatar: sender.avatar || '',
    receiverName: receiver.displayName || plain.receiverName,
    receiverAvatar: receiver.avatar || '',
    sender: {
      id: sender.id,
      role: sender.role,
      displayRole: sender.displayRole,
      adminRole: sender.adminRole,
      displayName: sender.displayName,
      avatar: sender.avatar || '',
    },
    receiver: {
      id: receiver.id,
      role: receiver.role,
      displayRole: receiver.displayRole,
      adminRole: receiver.adminRole,
      displayName: receiver.displayName,
      avatar: receiver.avatar || '',
    },
  };
}

/**
 * Batch enrich messages for history/sync/realtime (no DB schema change).
 * Lookup by participant ID — never by transport role "admin" alone.
 */
async function enrichMessageIdentities(messages = []) {
  const list = Array.isArray(messages) ? messages : [];
  if (!list.length) return [];

  const plains = list.map((m) => toPlainMessage(m));
  const idSet = new Set();
  for (const m of plains) {
    const sid = String(m.senderId || '');
    const rid = String(m.receiverId || '');
    if (sid && sid !== 'admin' && mongoose.Types.ObjectId.isValid(sid)) idSet.add(sid);
    if (rid && rid !== 'admin' && mongoose.Types.ObjectId.isValid(rid)) idSet.add(rid);
  }
  const ids = [...idSet];

  const [teachers, students] = await Promise.all([
    ids.length
      ? Teacher.find({ _id: { $in: ids } }).select('name avatar role adminRole').lean()
      : Promise.resolve([]),
    ids.length
      ? Student.find({ _id: { $in: ids } }).select('name avatar role').lean()
      : Promise.resolve([]),
  ]);

  const byId = new Map();
  for (const t of teachers) {
    byId.set(String(t._id), { kind: 'teacher', doc: t });
  }
  for (const s of students) {
    byId.set(String(s._id), { kind: 'student', doc: s });
  }

  function resolveSide(id, role, name) {
    const sid = String(id || '');
    if (sid === 'admin') {
      return identityFromHint({
        id: 'admin',
        role: 'admin',
        name: name || 'Admin hệ thống',
        adminRole: 'SUPER_ADMIN',
      });
    }
    const hit = byId.get(sid);
    if (hit?.kind === 'student') {
      return identityFromDoc({ ...hit.doc, id: sid, role: 'student' }, 'student');
    }
    if (hit?.kind === 'teacher') {
      return identityFromDoc({
        ...hit.doc,
        id: sid,
        role: hit.doc.role || role,
        adminRole: hit.doc.adminRole,
      }, role || 'staff');
    }
    return identityFromHint({
      id: sid,
      role: role || 'unknown',
      name: name || 'Người dùng',
    });
  }

  return plains.map((m) => {
    const sender = resolveSide(m.senderId, m.senderRole, m.senderName);
    const receiver = resolveSide(m.receiverId, m.receiverRole, m.receiverName);
    return attachIdentitiesToPlain(m, sender, receiver);
  });
}

module.exports = {
  DISPLAY_ROLE,
  resolveDisplayRole,
  resolveMessagingIdentity,
  identityFromDoc,
  getMessagingRole,
  assertDisplayIdentitySafe,
  enrichMessageIdentities,
  attachIdentitiesToPlain,
  toPlainMessage,
};
