import { apiFetch } from './api';

async function parseJsonSafe(res, fallbackMessage) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    return {
      success: false,
      status: res.status,
      message: body?.message || fallbackMessage || `Lỗi máy chủ (HTTP ${res.status})`,
      data: body?.data || null,
    };
  }
  return body || { success: true, data: null };
}

export const aiAutoReplyAPI = {
  getGlobal: async () => {
    const res = await apiFetch('/messages/ai-auto-reply/global');
    return parseJsonSafe(res, 'Không tải được cấu hình AI toàn hệ thống.');
  },
  updateGlobal: async (data) => {
    const res = await apiFetch('/messages/ai-auto-reply/global', {
      method: 'PUT',
      body: JSON.stringify(data || {}),
    });
    return parseJsonSafe(res, 'Không cập nhật được cấu hình AI toàn hệ thống.');
  },
  getHistory: async ({ page = 1, limit = 25, status = '', conversationId = '' } = {}) => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (status) params.set('status', status);
    if (conversationId) params.set('conversationId', conversationId);
    const res = await apiFetch(`/messages/ai-auto-reply/history?${params.toString()}`);
    return parseJsonSafe(res, 'Không tải được lịch sử AI tự động trả lời.');
  },
  adminDisable: async (conversationId) => {
    const res = await apiFetch(`/messages/ai-auto-reply/${encodeURIComponent(conversationId)}/admin-disable`, {
      method: 'POST',
    });
    return parseJsonSafe(res, 'Không tắt được AI trong cuộc hội thoại.');
  },
  getConversation: async (conversationId) => {
    const res = await apiFetch(`/messages/ai-auto-reply/${encodeURIComponent(conversationId)}`);
    return parseJsonSafe(res, 'Không tải được trạng thái AI của cuộc hội thoại.');
  },
  updateConversation: async (conversationId, data) => {
    const res = await apiFetch(`/messages/ai-auto-reply/${encodeURIComponent(conversationId)}`, {
      method: 'PUT',
      body: JSON.stringify(data || {}),
    });
    return parseJsonSafe(res, 'Không lưu được cài đặt AI của cuộc hội thoại.');
  },
};

export default aiAutoReplyAPI;
