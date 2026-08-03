export function normalizeChatRole(role) {
  if (!role) return role;
  const r = String(role).toLowerCase();
  return r;
}

function isMongoObjectId24(id) {
  const s = String(id || '');
  return /^[a-f0-9]{24}$/i.test(s);
}

/** Dong bo voi server utils/chatConversationId.js */
export function buildConversationId(senderRole, senderId, receiverRole, receiverId) {
  const sr = normalizeChatRole(senderRole);
  const rr = normalizeChatRole(receiverRole);
  const sid = String(senderId ?? '');
  const rid = String(receiverId ?? '');

  // Admin ↔ Student: Thống nhất duy nhất 1 thread cho Admin và Student
  if (sr === 'admin' && rr === 'student') {
    return [`admin_admin`, `student_${rid}`].sort().join('__');
  }
  if (sr === 'student' && rr === 'admin') {
    return [`admin_admin`, `student_${sid}`].sort().join('__');
  }

  return [`${sr}_${sid}`, `${rr}_${rid}`].sort().join('__');
}