import { mobileApiRequest } from './apiClient';

export const AI_SUPPORT_STATUS = {
  AI_ACTIVE: 'AI_ACTIVE',
  WAITING_FOR_SUPPORT: 'WAITING_FOR_SUPPORT',
  SUPPORT_ACTIVE: 'SUPPORT_ACTIVE',
  SUPPORT_RESOLVED: 'SUPPORT_RESOLVED',
  CLOSED: 'CLOSED',
} as const;

export type AiSupportStatus = typeof AI_SUPPORT_STATUS[keyof typeof AI_SUPPORT_STATUS];

export const AI_SUPPORT_WELCOME_CHIPS = {
  teacher: [
    { id: 'lms', label: 'Hướng dẫn sử dụng LMS' },
    { id: 'schedule', label: 'Hướng dẫn tạo lịch dạy cho học viên' },
    { id: 'finance', label: 'Xem tài chính' },
  ],
  student: [
    { id: 'schedule', label: 'Lịch học' },
    { id: 'video', label: 'Học video' },
    { id: 'sumif', label: 'Cách sử dụng hàm SUMIF, SUMIFS' },
    { id: 'vlookup', label: 'Cách sử dụng hàm VLOOKUP' },
    { id: 'if', label: 'Cách sử dụng hàm IF' },
  ],
} as const;

type AiSupportSession = {
  status?: AiSupportStatus;
  escalated?: boolean;
};

export function isAiSupportWelcome(content: string) {
  return /Trợ lý AI Tin Học của Thắng Tin Học/.test(content)
    && /hỗ trợ Word, Excel, PowerPoint, MOS, LMS/i.test(content);
}

export function getAiSupportReplyPresentation(content: string) {
  const suggestions: string[] = [];
  const visibleContent = content
    .replace(/\[GỢI Ý:\s*(.*?)\]/gi, (_match, value: string) => {
      suggestions.push(...value.split('|').map((item) => item.trim()).filter(Boolean));
      return '';
    })
    .trim();

  return { content: visibleContent, suggestions };
}

type AiSupportOpenResponse = {
  data?: {
    conversationId?: string;
    session?: AiSupportSession;
  };
};

type AiSupportActionResponse = {
  data?: {
    session?: AiSupportSession;
  };
};

export async function openAiSupportConversation() {
  const payload = await mobileApiRequest<AiSupportOpenResponse>('/ai-support/open', {
    method: 'POST',
  });
  const conversationId = String(payload.data?.conversationId || '').trim();
  if (!conversationId || !conversationId.includes('system_ai_support')) {
    throw new Error('Máy chủ chưa trả về cuộc trò chuyện hỗ trợ hợp lệ.');
  }
  return {
    conversationId,
    status: payload.data?.session?.status || AI_SUPPORT_STATUS.AI_ACTIVE,
  };
}

export async function escalateAiSupportConversation(conversationId: string) {
  const payload = await mobileApiRequest<AiSupportActionResponse>('/ai-support/escalate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  });
  return payload.data?.session?.status || AI_SUPPORT_STATUS.WAITING_FOR_SUPPORT;
}

export async function resetAiSupportConversation(conversationId: string) {
  const payload = await mobileApiRequest<AiSupportActionResponse>('/ai-support/reset', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId }),
  });
  return payload.data?.session?.status || AI_SUPPORT_STATUS.AI_ACTIVE;
}
