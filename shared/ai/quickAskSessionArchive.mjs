import { serializeQuickAskThread } from './quickAskThreadPersistence.mjs';

export const SESSION_ARCHIVE_PREFIX = 'dewskill:quick-ask-sessions:v1:';
export const SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_STORE_MAX = 40;
export const SESSION_LIST_PREVIEW = 3;

export function buildSessionPreview(messages) {
  const userMsg = (messages || []).find((m) => m?.role === 'user' && String(m?.text || '').trim());
  const text = String(userMsg?.text || '').trim();
  if (text) return text.slice(0, 96);
  const att = (messages || []).find((m) => m?.role === 'user' && m?.attachment?.name);
  if (att?.attachment?.name) return `📎 ${String(att.attachment.name).slice(0, 80)}`;
  return 'Phiên chat DewSkill AI';
}

export function parseSessionArchive(raw) {
  if (!raw) return { activeSessionId: '', sessions: [] };
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const sessions = Array.isArray(parsed?.sessions) ? parsed.sessions : [];
    const normalized = sessions
      .map((s) => {
        const messages = serializeQuickAskThread(s?.messages || []);
        if (!messages.length) return null;
        const id = String(s?.id || '').trim() || `s_${s?.updatedAt || Date.now()}`;
        const updatedAt = Number(s?.updatedAt) || Date.now();
        return {
          id,
          updatedAt,
          preview: String(s?.preview || buildSessionPreview(messages)).slice(0, 120),
          messages,
          active: Boolean(s?.active),
        };
      })
      .filter(Boolean);
    return {
      activeSessionId: String(parsed?.activeSessionId || '').trim(),
      sessions: pruneSessionArchive(normalized),
    };
  } catch {
    return { activeSessionId: '', sessions: [] };
  }
}

export function pruneSessionArchive(sessions, now = Date.now()) {
  const list = Array.isArray(sessions) ? sessions : [];
  return list
    .filter((s) => now - (s.updatedAt || 0) < SESSION_RETENTION_MS)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, SESSION_STORE_MAX);
}

function newSessionId() {
  return `qa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function upsertActiveQuickAskSession(archive, messages, activeSessionId = '') {
  const payload = serializeQuickAskThread(messages);
  if (!payload.length) return archive;
  const now = Date.now();
  let id = String(activeSessionId || archive.activeSessionId || '').trim();
  if (!id) id = newSessionId();
  const nextSessions = [...(archive.sessions || [])];
  const idx = nextSessions.findIndex((s) => s.id === id);
  const entry = {
    id,
    updatedAt: now,
    preview: buildSessionPreview(payload),
    messages: payload,
    active: true,
  };
  if (idx >= 0) nextSessions[idx] = entry;
  else nextSessions.unshift(entry);
  const demoted = nextSessions.map((s) => ({ ...s, active: s.id === id }));
  return {
    activeSessionId: id,
    sessions: pruneSessionArchive(demoted),
  };
}

export function rotateQuickAskSession(archive) {
  const sessions = (archive?.sessions || []).map((s) => ({ ...s, active: false }));
  return {
    activeSessionId: newSessionId(),
    sessions: pruneSessionArchive(sessions),
  };
}

export function setActiveQuickAskSession(archive, sessionId) {
  const id = String(sessionId || '').trim();
  const sessions = (archive?.sessions || []).map((s) => ({
    ...s,
    active: s.id === id,
  }));
  return { activeSessionId: id, sessions: pruneSessionArchive(sessions) };
}

export function getInactiveQuickAskSessions(archive) {
  return (archive?.sessions || [])
    .filter((s) => !s.active)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

export function getActiveQuickAskSession(archive) {
  const id = archive?.activeSessionId;
  if (!id) return null;
  return (archive?.sessions || []).find((s) => s.id === id && s.active) || null;
}

export function hydrateArchiveFromLegacyThread(archive, legacyMessages) {
  const msgs = serializeQuickAskThread(legacyMessages);
  if (!msgs.length) return archive;
  return upsertActiveQuickAskSession(archive, msgs, archive.activeSessionId);
}

export function listQuickAskSessions(archive, { includeAll = false, previewLimit = SESSION_LIST_PREVIEW, now = Date.now() } = {}) {
  const valid = pruneSessionArchive(archive?.sessions, now);
  const limit = Math.max(1, Number(previewLimit) || SESSION_LIST_PREVIEW);
  return {
    items: includeAll ? valid : valid.slice(0, limit),
    totalCount: valid.length,
    hiddenCount: Math.max(0, valid.length - limit),
    hasMore: valid.length > limit,
  };
}

export function getQuickAskSessionById(archive, sessionId) {
  const id = String(sessionId || '').trim();
  if (!id) return null;
  return (archive?.sessions || []).find((s) => s.id === id) || null;
}

export function formatSessionRelativeTime(updatedAt, lang = 'vi', now = Date.now()) {
  const ts = Number(updatedAt);
  const isEn = String(lang || '').toLowerCase().startsWith('en');
  if (!Number.isFinite(ts) || ts <= 0) return isEn ? 'Recently' : 'Gần đây';
  const diffSec = Math.max(0, Math.floor((now - ts) / 1000));
  if (diffSec < 60) return isEn ? 'Just now' : 'Vừa xong';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return isEn ? `${diffMin}m ago` : `${diffMin} phút trước`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return isEn ? `${diffHours}h ago` : `${diffHours} giờ trước`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return isEn ? `${diffDays}d ago` : `${diffDays} ngày trước`;
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}