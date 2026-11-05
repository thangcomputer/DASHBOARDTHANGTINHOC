import { AI_SUPPORT_PEER, isAiSupportConversationId } from '../utils/aiSupport';

/**
 * Tổng tin chưa đọc của những hội thoại Hộp thư thực sự hiển thị cho người xem — để badge
 * không báo tin mà người dùng không mở được (cùng quy tắc lọc trong Inbox.jsx):
 * - bỏ Trợ lý AI;
 * - SUPER_ADMIN: chỉ thấy hội thoại với HIGH_ADMIN, không thấy nhóm;
 * - HIGH_ADMIN: không thấy hội thoại với học viên (trừ STAFF/SUPPORT).
 */
export function visibleInboxUnread(conversations, { userId = '', adminRole = '' } = {}) {
  const isSuperAdmin = String(userId) === 'admin' || adminRole === 'SUPER_ADMIN';
  const isHighAdmin = adminRole === 'HIGH_ADMIN';
  return (conversations || []).reduce((sum, conversation) => {
    if (!conversation) return sum;
    const peer = conversation.user || {};
    if (isAiSupportConversationId(conversation.id) || String(peer.id || '') === AI_SUPPORT_PEER.id) return sum;
    if (isSuperAdmin) {
      if (conversation.isGroup) return sum;
      if (String(peer.adminRole || '') !== 'HIGH_ADMIN') return sum;
    }
    if (isHighAdmin && !conversation.isGroup) {
      const peerIsStudent = String(peer.role || '').toLowerCase() === 'student';
      if (peerIsStudent && peer.adminRole !== 'STAFF' && peer.adminRole !== 'SUPPORT') return sum;
    }
    return sum + (Number(conversation.unread) || 0);
  }, 0);
}
