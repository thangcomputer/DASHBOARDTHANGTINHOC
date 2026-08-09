/**
 * Canonical direct/group message send — shared by HTTP + Socket.
 * LIVE messaging only. Does not touch Enterprise RBAC.
 */
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Group = require('../models/Group');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const ConversationVisibility = require('../models/ConversationVisibility');
const { buildConversationId } = require('../utils/chatConversationId');
const { getMessagingRole } = require('../utils/messagingRoles');
const { assertCanDirectMessage } = require('./chatAccessService');
const { sanitizeMessageDoc } = require('../utils/messageFileRetention');

const isStaffAccount = (u = {}) =>
  u.role === 'staff' || u.adminRole === 'STAFF' || u.adminRole === 'SUPPORT';
const isSuperAdminAccount = (u = {}) => u.id === 'admin' || u.adminRole === 'SUPER_ADMIN';
const isHighAdminAccount = (u = {}) => u.adminRole === 'HIGH_ADMIN';
const isAdminLevelAccount = (u = {}) => isSuperAdminAccount(u) || isHighAdminAccount(u);

function toClientMessage(doc) {
  const plain = doc?.toObject ? doc.toObject() : { ...(doc || {}) };
  return sanitizeMessageDoc(plain);
}

/**
 * Persist + emit a private/group message.
 * Sender identity always from `sender` (JWT user), never from client body fields.
 *
 * @returns {Promise<{ ok: true, message, clientMessage, conversationId } | { ok: false, status: number, message: string }>}
 */
async function sendCanonicalMessage({
  sender,
  receiverId,
  receiverName,
  receiverRole,
  content,
  messageType = 'text',
  fileUrl = '',
  fileName = '',
  isGroup = false,
  groupId = null,
  notifyUser,
  io,
} = {}) {
  if (!sender) return { ok: false, status: 401, message: 'Chua xac thuc' };

  const senderId = String(sender.id || sender._id || '');
  const senderRole = getMessagingRole(sender);
  const senderName = sender.name || 'User';

  const rid = String(receiverId || '');
  const rRole = String(receiverRole || '').toLowerCase();
  const isBroadcast =
    rid === 'ALL_USERS' || rid === 'ALL_STUDENTS' || rid === 'ALL_TEACHERS' || rid.startsWith('ALL_BRANCH_');

  if (isBroadcast) {
    return { ok: false, status: 400, message: 'Broadcast phai dung endpoint/socket broadcast rieng' };
  }

  if (isGroup && groupId) {
    const group = await Group.findById(groupId).select('participants').lean();
    if (!group) return { ok: false, status: 404, message: 'Không tìm thấy nhóm chat' };
    const isMember = (group.participants || []).some((p) => String(p.userId) === senderId);
    if (!isMember && !isAdminLevelAccount(sender)) {
      return { ok: false, status: 403, message: 'Bạn không thuộc nhóm chat này' };
    }
  } else {
    const access = await assertCanDirectMessage(sender, rid, rRole);
    if (!access.ok) {
      return { ok: false, status: 403, message: access.message || 'Không được nhắn tin đến người này' };
    }
  }

  let conversationId;
  if (isGroup && groupId) {
    conversationId = `group_${groupId}`;
  } else {
    conversationId = buildConversationId(senderRole, senderId, rRole, rid);
  }

  let sBranch = '';
  if (senderId === 'admin') {
    sBranch = 'HỆ THỐNG';
  } else if (mongoose.Types.ObjectId.isValid(senderId)) {
    if (senderRole === 'teacher' || senderRole === 'admin' || senderRole === 'staff') {
      const t = await Teacher.findById(senderId).select('branchCode').lean();
      sBranch = t?.branchCode || '';
    } else if (senderRole === 'student') {
      const s = await Student.findById(senderId).select('branchCode').lean();
      sBranch = s?.branchCode || '';
    }
  }

  let rBranch = '';
  let resolvedReceiverName = receiverName;
  if (!isGroup) {
    if (rid === 'admin') {
      rBranch = 'HỆ THỐNG';
      if (!resolvedReceiverName) resolvedReceiverName = 'Admin';
    } else if (mongoose.Types.ObjectId.isValid(rid)) {
      if (rRole === 'teacher' || rRole === 'admin' || rRole === 'staff' || rRole === 'support') {
        const t = await Teacher.findById(rid).select('branchCode name').lean();
        rBranch = t?.branchCode || '';
        if (!resolvedReceiverName) resolvedReceiverName = t?.name || 'Người nhận';
      } else if (rRole === 'student') {
        const s = await Student.findById(rid).select('branchCode name').lean();
        rBranch = s?.branchCode || '';
        if (!resolvedReceiverName) resolvedReceiverName = s?.name || 'Học viên';
      }
    }
  }
  if (!resolvedReceiverName && !isGroup) resolvedReceiverName = 'Người nhận';

  // Cross-branch: staff/admin (non-super) → student
  if (
    !isAdminLevelAccount(sender)
    && (senderRole === 'admin' || senderRole === 'staff' || isStaffAccount(sender))
    && rRole === 'student'
  ) {
    if (sBranch && rBranch && sBranch !== rBranch) {
      return { ok: false, status: 403, message: 'Bạn không được phép nhắn tin cho học viên chi nhánh khác' };
    }
  }

  let finalReceiverId = isGroup ? groupId : rid;
  let finalReceiverName = isGroup ? 'Group' : resolvedReceiverName;
  let finalReceiverRole = isGroup ? 'admin' : rRole;

  // Student → generic admin contact: deliver to legacy root id "admin"
  // but conversationId already canonical (admin_admin only when senderRole/receiverRole are admin).
  if (
    !isGroup
    && senderRole === 'student'
    && (rRole === 'admin' || rRole === 'staff' || rRole === 'support')
  ) {
    if (rid === 'admin' || !mongoose.Types.ObjectId.isValid(rid)) {
      finalReceiverId = 'admin';
      finalReceiverName = resolvedReceiverName || 'Quản trị viên';
      finalReceiverRole = 'admin';
    }
  }

  const message = await Message.create({
    conversationId,
    senderId,
    senderName,
    senderRole,
    senderBranchCode: sBranch,
    receiverId: finalReceiverId,
    receiverName: finalReceiverName,
    receiverRole: finalReceiverRole,
    receiverBranchCode: rBranch,
    content: String(content || '').trim(),
    messageType: messageType || 'text',
    fileUrl: fileUrl || '',
    fileName: fileName || '',
    isGroup: Boolean(isGroup),
    groupId: isGroup ? groupId : null,
  });

  if (isGroup && groupId) {
    await Group.findByIdAndUpdate(groupId, {
      lastMessage: { content: message.content, senderName, sentAt: new Date() },
    });
  }

  const unhideIds = [...new Set(
    [senderId, String(finalReceiverId)].filter(Boolean).map(String),
  )];
  if (unhideIds.length) {
    await ConversationVisibility.findOneAndUpdate(
      { conversationId },
      { $pullAll: { hiddenByUsers: unhideIds } },
      { upsert: true },
    );
  }

  const clientMessage = toClientMessage(message);

  if (io && typeof notifyUser === 'function') {
    if (isGroup && groupId) {
      io.to(`group_${groupId}`).emit('message:receive', clientMessage);
    } else {
      notifyUser(finalReceiverRole, finalReceiverId, 'message:receive', clientMessage);
      notifyUser(senderRole, senderId, 'message:sent', clientMessage);
    }
  }

  return {
    ok: true,
    message,
    clientMessage,
    conversationId,
  };
}

module.exports = {
  sendCanonicalMessage,
  toClientMessage,
  isAdminLevelAccount,
  getMessagingRole,
};
