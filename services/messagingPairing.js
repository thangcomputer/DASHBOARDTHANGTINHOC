/**
 * Phase 8.24 — Messaging pairing allow-list + canonical peer resolution.
 * LIVE messaging ACL only. Does not touch Enterprise RBAC.
 *
 * Product roles: SUPER_ADMIN | HIGH_ADMIN | STAFF | SUPPORT | TEACHER | STUDENT
 * Transport roles for conversationId: admin | staff | teacher | student
 * SUPPORT transport remains `staff` (distinguished by adminRole on identity payload).
 */
'use strict';

const mongoose = require('mongoose');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const { getMessagingRole } = require('../utils/messagingRoles');
const { buildConversationId } = require('../utils/chatConversationId');
const { studentMatchesTeacher } = require('./enrollmentService');

const PRODUCT_ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  HIGH_ADMIN: 'HIGH_ADMIN',
  STAFF: 'STAFF',
  SUPPORT: 'SUPPORT',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  AI_SUPPORT: 'AI_SUPPORT',
});

function resolveProductRole(user = {}) {
  const id = String(user.id || user._id || '');
  const adminRole = String(user.adminRole || '').toUpperCase();
  const role = String(user.role || '').toLowerCase();

  if (id === 'admin' || adminRole === 'SUPER_ADMIN') return PRODUCT_ROLES.SUPER_ADMIN;
  if (adminRole === 'HIGH_ADMIN') return PRODUCT_ROLES.HIGH_ADMIN;
  if (adminRole === 'SUPPORT') return PRODUCT_ROLES.SUPPORT;
  if (adminRole === 'STAFF' || role === 'staff') return PRODUCT_ROLES.STAFF;
  if (role === 'student') return PRODUCT_ROLES.STUDENT;
  if (role === 'teacher') return PRODUCT_ROLES.TEACHER;
  // JWT role=admin without elevated adminRole — treat as unresolved elevated hint, not STAFF
  if (role === 'admin' && !adminRole) return PRODUCT_ROLES.SUPER_ADMIN;
  return null;
}

function isElevatedProduct(pr) {
  return pr === PRODUCT_ROLES.SUPER_ADMIN || pr === PRODUCT_ROLES.HIGH_ADMIN;
}

function normalizeBranchId(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'object' && v._id != null) return String(v._id);
  return String(v);
}

function branchKey(doc = {}) {
  const bid = normalizeBranchId(doc.branchId);
  if (bid) return `id:${bid}`;
  if (doc.branchCode) return `code:${String(doc.branchCode).trim().toUpperCase()}`;
  return '';
}

/**
 * Same branch if branchId matches OR branchCode matches.
 * Avoids false DENY when one side only has code and the other only has id
 * (legacy branchKey string compare could never match id:* vs code:*).
 */
function sameBranch(a = {}, b = {}) {
  const aId = normalizeBranchId(a?.branchId);
  const bId = normalizeBranchId(b?.branchId);
  if (aId && bId && aId === bId) return true;
  if (a?.branchCode && b?.branchCode
    && String(a.branchCode).trim().toUpperCase() === String(b.branchCode).trim().toUpperCase()) {
    return true;
  }
  return false;
}

/**
 * Structural allow-list (before branch / assignment scope).
 * Deny: STUDENT↔STUDENT, TEACHER↔TEACHER.
 */
function isPairStructurallyAllowed(senderProduct, peerProduct) {
  if (!senderProduct || !peerProduct) return false;
  if (senderProduct === PRODUCT_ROLES.STUDENT && peerProduct === PRODUCT_ROLES.STUDENT) return false;
  if (senderProduct === PRODUCT_ROLES.TEACHER && peerProduct === PRODUCT_ROLES.TEACHER) return false;

  // High Admin không nhắn học viên (cả hai chiều)
  if (
    (senderProduct === PRODUCT_ROLES.HIGH_ADMIN && peerProduct === PRODUCT_ROLES.STUDENT)
    || (senderProduct === PRODUCT_ROLES.STUDENT && peerProduct === PRODUCT_ROLES.HIGH_ADMIN)
  ) {
    return false;
  }

  if (senderProduct === PRODUCT_ROLES.SUPER_ADMIN) return true;
  if (senderProduct === PRODUCT_ROLES.HIGH_ADMIN) return true;
  if (senderProduct === PRODUCT_ROLES.SUPPORT) return true;

  if (senderProduct === PRODUCT_ROLES.STAFF) {
    return true; // scope applied later for teacher/student
  }

  if (senderProduct === PRODUCT_ROLES.TEACHER) {
    return (
      isElevatedProduct(peerProduct)
      || peerProduct === PRODUCT_ROLES.STAFF
      || peerProduct === PRODUCT_ROLES.SUPPORT
      || peerProduct === PRODUCT_ROLES.STUDENT
      || peerProduct === PRODUCT_ROLES.AI_SUPPORT
    );
  }

  if (senderProduct === PRODUCT_ROLES.STUDENT) {
    return (
      isElevatedProduct(peerProduct)
      || peerProduct === PRODUCT_ROLES.STAFF
      || peerProduct === PRODUCT_ROLES.SUPPORT
      || peerProduct === PRODUCT_ROLES.TEACHER
      || peerProduct === PRODUCT_ROLES.AI_SUPPORT
    );
  }

  return false;
}

/**
 * Load peer document + product/transport roles from DB (never trust client role).
 */
async function resolveCanonicalPeer(receiverId, clientReceiverRoleHint = '') {
  const rid = String(receiverId || '');
  const hint = String(clientReceiverRoleHint || '').toLowerCase();

  if (!rid) return { ok: false, message: 'Thieu nguoi nhan' };

  if (rid.startsWith('ALL_')) {
    return {
      ok: true,
      peer: { id: rid, role: 'admin' },
      productRole: PRODUCT_ROLES.SUPER_ADMIN,
      transportRole: 'admin',
      finalReceiverId: rid,
      isBroadcast: true,
    };
  }

  if (rid === 'admin' || (!mongoose.Types.ObjectId.isValid(rid) && hint === 'admin')) {
    return {
      ok: true,
      peer: { id: 'admin', role: 'admin', adminRole: 'SUPER_ADMIN', name: 'Admin' },
      productRole: PRODUCT_ROLES.SUPER_ADMIN,
      transportRole: 'admin',
      finalReceiverId: 'admin',
    };
  }

  if (rid === 'ai_support') {
    if (process.env.AI_SUPPORT_ENABLED !== '1') {
      return { ok: false, message: 'Trợ lý AI chưa được bật' };
    }
    return {
      ok: true,
      peer: { id: 'ai_support', role: 'system', name: 'Trợ lý Thắng Tin Học' },
      productRole: PRODUCT_ROLES.AI_SUPPORT,
      transportRole: 'system',
      finalReceiverId: 'ai_support',
    };
  }

  if (!mongoose.Types.ObjectId.isValid(rid)) {
    return { ok: false, message: 'Lien he khong hop le' };
  }

  let peer = null;
  const teacherSelect = 'name role adminRole branchId branchCode gender avatar phone status tenantId';
  const studentSelect = 'name role adminRole branchId branchCode teacherId enrollments gender avatar phone tenantId';

  if (hint === 'student') {
    peer = await Student.findById(rid)
      .select(studentSelect)
      .lean();
    if (peer) {
      return {
        ok: true,
        peer: { ...peer, id: String(peer._id) },
        productRole: PRODUCT_ROLES.STUDENT,
        transportRole: 'student',
        finalReceiverId: String(peer._id),
      };
    }
  }

  peer = await Teacher.findById(rid)
    .select(teacherSelect)
    .lean();
  if (peer) {
    const productRole = resolveProductRole({
      id: String(peer._id),
      role: peer.role,
      adminRole: peer.adminRole,
    }) || (peer.role === 'teacher' ? PRODUCT_ROLES.TEACHER : PRODUCT_ROLES.STAFF);
    const transportRole = getMessagingRole({
      id: String(peer._id),
      role: peer.role,
      adminRole: peer.adminRole,
    });
    return {
      ok: true,
      peer: { ...peer, id: String(peer._id) },
      productRole,
      transportRole,
      finalReceiverId: String(peer._id),
    };
  }

  peer = await Student.findById(rid)
    .select(studentSelect)
    .lean();
  if (peer) {
    return {
      ok: true,
      peer: { ...peer, id: String(peer._id) },
      productRole: PRODUCT_ROLES.STUDENT,
      transportRole: 'student',
      finalReceiverId: String(peer._id),
    };
  }

  return { ok: false, message: 'Không tìm thấy liên hệ' };
}

async function assertPairScope(sender, senderProduct, peer, peerProduct) {
  if (isElevatedProduct(senderProduct) || senderProduct === PRODUCT_ROLES.SUPPORT) {
    return { ok: true };
  }

  if (senderProduct === PRODUCT_ROLES.STAFF) {
    if (peerProduct === PRODUCT_ROLES.STUDENT || peerProduct === PRODUCT_ROLES.TEACHER) {
      const me = sender.id === 'admin'
        ? null
        : await Teacher.findById(sender.id).select('branchId branchCode adminRole').lean();
      if (!me || me.adminRole === 'SUPER_ADMIN' || me.adminRole === 'HIGH_ADMIN') {
        return { ok: true };
      }
      // Bidirectional soft-allow with TEACHER→STAFF / STUDENT→STAFF:
      // empty branch on either side → allow; otherwise require same branch.
      if (!branchKey(me) || !branchKey(peer) || sameBranch(me, peer)) return { ok: true };
      return {
        ok: false,
        message: peerProduct === PRODUCT_ROLES.STUDENT
          ? 'Khong duoc nhan tin hoc vien chi nhanh khac'
          : 'Khong duoc nhan tin giao vien chi nhanh khac',
      };
    }
    return { ok: true };
  }

  if (senderProduct === PRODUCT_ROLES.TEACHER) {
    if (peerProduct === PRODUCT_ROLES.AI_SUPPORT) {
      return { ok: true };
    }
    if (peerProduct === PRODUCT_ROLES.STUDENT) {
      if (studentMatchesTeacher(peer, sender.id)) return { ok: true };
      const st = await Student.findById(peer.id || peer._id)
        .select('teacherId enrollments')
        .lean();
      if (st && studentMatchesTeacher(st, sender.id)) return { ok: true };
      return { ok: false, message: 'Chi nhan tin hoc vien duoc phan cong' };
    }
    if (peerProduct === PRODUCT_ROLES.STAFF) {
      const me = await Teacher.findById(sender.id).select('branchId branchCode').lean();
      if (!branchKey(me) || !branchKey(peer) || sameBranch(me, peer)) return { ok: true };
      return { ok: false, message: 'Chi nhan tin giao vu cung chi nhanh' };
    }
    if (peerProduct === PRODUCT_ROLES.SUPPORT || isElevatedProduct(peerProduct)) {
      return { ok: true };
    }
  }

  if (senderProduct === PRODUCT_ROLES.STUDENT) {
    if (peerProduct === PRODUCT_ROLES.AI_SUPPORT) {
      return { ok: true };
    }
    if (peerProduct === PRODUCT_ROLES.TEACHER) {
      const st = await Student.findById(sender.id).select('teacherId enrollments').lean();
      if (!st) return { ok: false, message: 'Khong tim thay hoc vien' };
      if (studentMatchesTeacher(st, peer.id || peer._id)) return { ok: true };
      return { ok: false, message: 'Chi nhan tin giao vien dang day ban' };
    }
    if (peerProduct === PRODUCT_ROLES.STAFF) {
      const st = await Student.findById(sender.id).select('branchId branchCode').lean();
      if (!branchKey(st) || !branchKey(peer) || sameBranch(st, peer)) return { ok: true };
      if (!branchKey(peer)) return { ok: true };
      return { ok: false, message: 'Chi nhan tin giao vu cung chi nhanh' };
    }
    if (peerProduct === PRODUCT_ROLES.SUPPORT || isElevatedProduct(peerProduct)) {
      return { ok: true };
    }
  }

  return { ok: true };
}

/**
 * @param {object} [options]
 * @param {object} [options.resolved] pre-resolved peer from resolveCanonicalPeer (avoid duplicate DB lookup)
 */
async function assertMessagingPairAllowed(sender, receiverId, clientReceiverRoleHint = '', options = {}) {
  if (!sender) return { ok: false, message: 'Chua xac thuc' };

  const senderProduct = resolveProductRole(sender);
  if (!senderProduct) return { ok: false, message: 'Khong xac dinh role nguoi gui' };

  const resolved = options.resolved || await resolveCanonicalPeer(receiverId, clientReceiverRoleHint);
  if (!resolved.ok) return resolved;
  if (resolved.isBroadcast) return { ok: true, ...resolved };

  if (!isPairStructurallyAllowed(senderProduct, resolved.productRole)) {
    return { ok: false, message: 'Khong duoc nhan tin den doi tuong nay' };
  }

  const scope = await assertPairScope(sender, senderProduct, resolved.peer, resolved.productRole);
  if (!scope.ok) return scope;

  return {
    ok: true,
    peer: resolved.peer,
    productRole: resolved.productRole,
    transportRole: resolved.transportRole,
    finalReceiverId: resolved.finalReceiverId,
    senderProduct,
  };
}

function buildCanonicalConversationId(sender, peerTransportRole, peerId) {
  const senderRole = getMessagingRole(sender);
  const senderId = String(sender.id || sender._id || '');
  return buildConversationId(senderRole, senderId, peerTransportRole, peerId);
}

function aliasStaffMislabelledConversationId(conversationId) {
  const cid = String(conversationId || '');
  if (!cid || cid.startsWith('group_')) return { conversationId: cid, aliased: false };

  const parts = cid.split('__');
  if (parts.length !== 2) return { conversationId: cid, aliased: false };

  let changed = false;
  const next = parts.map((part) => {
    const idx = part.indexOf('_');
    if (idx === -1) return part;
    const role = part.slice(0, idx);
    const id = part.slice(idx + 1);
    if (role === 'admin' && id !== 'admin' && mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
      changed = true;
      return `staff_${id}`;
    }
    return part;
  });

  if (!changed) return { conversationId: cid, aliased: false };
  return { conversationId: next.sort().join('__'), aliased: true, from: cid };
}

function expandConversationIdAliases(conversationId) {
  const { conversationId: canonical, aliased, from } = aliasStaffMislabelledConversationId(conversationId);
  const ids = new Set([String(conversationId), canonical]);
  if (aliased && from) ids.add(from);

  const parts = String(canonical).split('__');
  if (parts.length === 2) {
    const legacy = parts.map((part) => {
      const idx = part.indexOf('_');
      if (idx === -1) return part;
      const role = part.slice(0, idx);
      const id = part.slice(idx + 1);
      if (role === 'staff' && mongoose.Types.ObjectId.isValid(id) && id.length === 24) {
        return `admin_${id}`;
      }
      return part;
    }).sort().join('__');
    if (legacy !== canonical) ids.add(legacy);
  }

  return { canonical, ids: [...ids] };
}

module.exports = {
  PRODUCT_ROLES,
  resolveProductRole,
  isPairStructurallyAllowed,
  resolveCanonicalPeer,
  assertMessagingPairAllowed,
  buildCanonicalConversationId,
  aliasStaffMislabelledConversationId,
  expandConversationIdAliases,
  sameBranch,
};
