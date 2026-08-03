const mongoose = require('mongoose');

function normalizeChatRole(role) {
  if (!role) return role;
  const r = String(role).toLowerCase();
  return r;
}

function isMongoObjectId24(id) {
  const s = String(id || '');
  return mongoose.Types.ObjectId.isValid(s) && s.length === 24;
}

function buildConversationId(senderRole, senderId, receiverRole, receiverId) {
  const sr = normalizeChatRole(senderRole);
  const rr = normalizeChatRole(receiverRole);
  const sid = String(senderId == null ? '' : senderId);
  const rid = String(receiverId == null ? '' : receiverId);

  // Admin ↔ Student: Thống nhất duy nhất 1 thread giữa Admin và Student
  if (sr === 'admin' && rr === 'student') {
    return ['admin_admin', 'student_' + rid].sort().join('__');
  }
  if (sr === 'student' && rr === 'admin') {
    return ['admin_admin', 'student_' + sid].sort().join('__');
  }

  return [sr + '_' + sid, rr + '_' + rid].sort().join('__');
}

module.exports = { buildConversationId, normalizeChatRole, isMongoObjectId24 };
