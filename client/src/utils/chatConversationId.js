/** staff -> admin trong luong chat */
export function normalizeChatRole(role) {
  if (!role) return role;
  const r = String(role).toLowerCase();
  if (r === 'staff') return 'admin';
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

  if (sr === 'admin' && rr === 'student') {
    const adminSideId = sid === 'admin' || !isMongoObjectId24(sid) ? 'admin' : sid;
    return [`admin_${adminSideId}`, `student_${rid}`].sort().join('__');
  }
  if (sr === 'student' && rr === 'admin') {
    const adminSideId = rid === 'admin' || !isMongoObjectId24(rid) ? 'admin' : rid;
    return [`admin_${adminSideId}`, `student_${sid}`].sort().join('__');
  }

  return [`${sr}_${sid}`, `${rr}_${rid}`].sort().join('__');
}