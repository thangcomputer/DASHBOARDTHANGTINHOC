import { normalizeQuickQuery } from './quickSearchMemory.mjs';

export const QUICK_ASK_RECENT_MAX = 5;
export const QUICK_ASK_RECENT_STORAGE_PREFIX = 'dewskill:quick-ask-recent:v1:';
export const QUICK_ASK_RECENT_MIN_CHARS = 3;

export function normalizeQuickAskRecentText(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

export function foldQuickAskRecentKey(text) {
  return normalizeQuickQuery(normalizeQuickAskRecentText(text));
}

export function parseQuickAskRecentList(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    const seen = new Set();
    const out = [];
    for (const item of parsed) {
      const text = normalizeQuickAskRecentText(item);
      if (text.length < QUICK_ASK_RECENT_MIN_CHARS) continue;
      const key = foldQuickAskRecentKey(text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(text);
      if (out.length >= QUICK_ASK_RECENT_MAX) break;
    }
    return out;
  } catch {
    return [];
  }
}

export function pushQuickAskRecentQuestion(list, question, { max = QUICK_ASK_RECENT_MAX } = {}) {
  const text = normalizeQuickAskRecentText(question);
  if (text.length < QUICK_ASK_RECENT_MIN_CHARS) return list || [];
  const key = foldQuickAskRecentKey(text);
  const prev = Array.isArray(list) ? list : [];
  const next = [text, ...prev.filter((item) => foldQuickAskRecentKey(item) !== key)];
  return next.slice(0, max);
}

/**
 * @param {string[]} recent
 * @param {{ query?: string, exclude?: string[], limit?: number }} [opts]
 */
export function filterRecentQuickAskForDisplay(recent, opts = {}) {
  const limit = Math.min(QUICK_ASK_RECENT_MAX, Math.max(1, Number(opts.limit) || QUICK_ASK_RECENT_MAX));
  const excludeKeys = new Set(
    (opts.exclude || []).map((s) => foldQuickAskRecentKey(s)).filter(Boolean),
  );
  const qFold = foldQuickAskRecentKey(opts.query || '');
  let items = (recent || []).filter((item) => !excludeKeys.has(foldQuickAskRecentKey(item)));
  if (qFold.length >= 2) {
    items = items.filter((item) => foldQuickAskRecentKey(item).includes(qFold));
  }
  return items.slice(0, limit);
}