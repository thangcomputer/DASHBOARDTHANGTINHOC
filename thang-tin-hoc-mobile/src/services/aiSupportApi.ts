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

export function isMeaningfulAiReply(message: { senderId?: string; text?: string; recalled?: boolean; messageType?: string }): boolean {
  if (message.recalled || message.messageType === 'system') return false;
  if (message.senderId !== 'ai_support') return false;
  const content = String(message.text || '');
  if (isAiSupportWelcome(content)) return false;
  if (/Bạn có còn đó không/i.test(content)) return false;
  if (/lượt hỏi Trợ lý AI hôm nay/i.test(content)) return false;
  if (/Đã chuyển yêu cầu tới nhân viên hỗ trợ/i.test(content)) return false;
  return true;
}

export function lastMeaningfulAiReplyId(thread: any[], myId?: string): string {
  for (let i = thread.length - 1; i >= 0; i -= 1) {
    const m = thread[i];
    if (!m || m.recalled || m.messageType === 'system') continue;
    if (m.senderId !== 'ai_support') return '';
    if (!isMeaningfulAiReply(m)) return '';

    let userText = '';
    for (let j = i - 1; j >= 0; j -= 1) {
      const prev = thread[j];
      if (!prev || prev.recalled || prev.messageType === 'system') continue;
      if (prev.senderId === 'ai_support') continue;
      if (myId && prev.senderId && prev.senderId !== myId) continue;
      userText = String(prev.text || '');
      break;
    }
    const cleanUserText = userText.trim().toLowerCase().replace(/[.!?…,-]+$/g, '').trim();
    if (!cleanUserText) return '';
    if (/^(xin\s*chào|chào(\s+(bạn|em|cô|thầy|ad|admin))?|hello(\s+bạn)?|hi(\s+(bạn|there))?|hey|alo)$/i.test(cleanUserText)) {
      return '';
    }
    return String(m.id || '');
  }
  return '';
}

export function canOfferHumanEscalation(thread: any[], myId?: string): boolean {
  return Boolean(lastMeaningfulAiReplyId(thread, myId));
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
