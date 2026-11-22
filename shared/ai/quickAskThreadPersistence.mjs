export const QUICK_ASK_THREAD_MAX = 20;
export const QUICK_ASK_THREAD_STORAGE_PREFIX = 'dewskill:quick-ask-thread:v1:';

function sanitizeQuickAskThreadMessage(msg) {
  if (!msg || !msg.id) return null;
  const role = String(msg.role || '');
  if (role !== 'user' && role !== 'assistant') return null;

  const out = {
    id: String(msg.id),
    role,
    text: String(msg.text || '').slice(0, 16_000),
  };

  if (msg.question) out.question = String(msg.question).slice(0, 600);
  if (msg.source) out.source = String(msg.source).slice(0, 40);
  if (msg.model) out.model = String(msg.model).slice(0, 80);
  if (msg.retryQuestion) out.retryQuestion = String(msg.retryQuestion).slice(0, 600);
  if (Array.isArray(msg.actions) && msg.actions.length) {
    out.actions = msg.actions.slice(0, 8).map((a) => {
      const target = String(a?.path || a?.href || '').slice(0, 240);
      return {
        label: String(a?.label || '').slice(0, 120),
        path: target,
        href: target,
      };
    }).filter((a) => a.label);
  }
  if (msg.attachment) {
    out.attachment = {
      name: String(msg.attachment.name || msg.attachmentMeta?.name || 'file').slice(0, 160),
      isImage: Boolean(msg.attachment.isImage ?? msg.attachmentMeta?.isImage),
    };
  } else if (msg.attachmentMeta?.name) {
    out.attachment = {
      name: String(msg.attachmentMeta.name).slice(0, 160),
      isImage: Boolean(msg.attachmentMeta.isImage),
    };
  }

  return out.text || out.attachment ? out : null;
}

export function serializeQuickAskThread(messages, { max = QUICK_ASK_THREAD_MAX } = {}) {
  const list = Array.isArray(messages) ? messages : [];
  const sanitized = list.map(sanitizeQuickAskThreadMessage).filter(Boolean);
  return sanitized.slice(-max);
}

export function parseQuickAskThread(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return serializeQuickAskThread(parsed);
  } catch {
    return [];
  }
}