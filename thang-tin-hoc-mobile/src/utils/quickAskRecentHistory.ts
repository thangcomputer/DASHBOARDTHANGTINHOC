import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  QUICK_ASK_RECENT_STORAGE_PREFIX,
  parseQuickAskRecentList,
  pushQuickAskRecentQuestion,
} from '../../../shared/ai/quickAskRecentHistory.mjs';
import {
  QUICK_ASK_THREAD_STORAGE_PREFIX,
  parseQuickAskThread,
  serializeQuickAskThread,
} from '../../../shared/ai/quickAskThreadPersistence.mjs';
import {
  SESSION_ARCHIVE_PREFIX,
  SESSION_LIST_PREVIEW,
  formatSessionRelativeTime,
  getActiveQuickAskSession,
  getQuickAskSessionById,
  hydrateArchiveFromLegacyThread,
  listQuickAskSessions,
  parseSessionArchive,
  pruneSessionArchive,
  rotateQuickAskSession,
  setActiveQuickAskSession,
  upsertActiveQuickAskSession,
} from '../../../shared/ai/quickAskSessionArchive.mjs';

export {
  SESSION_LIST_PREVIEW,
  formatSessionRelativeTime,
  getQuickAskSessionById,
  listQuickAskSessions,
};

export type QuickAskSessionEntry = {
  id: string;
  updatedAt: number;
  preview: string;
  messages: unknown[];
  active: boolean;
};

export type QuickAskSessionArchive = {
  activeSessionId: string;
  sessions: QuickAskSessionEntry[];
};

export function getQuickAskRecentScopeId(
  user: { _id?: string; id?: string } | null | undefined,
  role: string,
) {
  const safeRole = role === 'teacher' ? 'teacher' : 'student';
  const id = user?._id || user?.id;
  return id ? `${safeRole}:${id}` : `anonymous:${safeRole}`;
}

function storageKey(scopeId: string) {
  return `${QUICK_ASK_RECENT_STORAGE_PREFIX}${scopeId}`;
}

export async function loadQuickAskRecentQuestions(scopeId: string) {
  try {
    const raw = await AsyncStorage.getItem(storageKey(scopeId));
    return parseQuickAskRecentList(raw);
  } catch {
    return [];
  }
}

export async function rememberQuickAskQuestion(scopeId: string, question: string) {
  const prev = await loadQuickAskRecentQuestions(scopeId);
  const next = pushQuickAskRecentQuestion(prev, question);
  try {
    await AsyncStorage.setItem(storageKey(scopeId), JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

function threadKey(scopeId: string) {
  return `${QUICK_ASK_THREAD_STORAGE_PREFIX}${scopeId}`;
}

function archiveKey(scopeId: string) {
  return `${SESSION_ARCHIVE_PREFIX}${scopeId}`;
}

export async function loadQuickAskThreadMessages(scopeId: string) {
  try {
    const raw = await AsyncStorage.getItem(threadKey(scopeId));
    return parseQuickAskThread(raw);
  } catch {
    return [];
  }
}

export async function persistQuickAskSessionArchive(
  scopeId: string,
  archive: QuickAskSessionArchive,
): Promise<QuickAskSessionArchive> {
  const pruned: QuickAskSessionArchive = {
    activeSessionId: String(archive?.activeSessionId || ''),
    sessions: pruneSessionArchive(archive?.sessions || []) as QuickAskSessionEntry[],
  };
  try {
    await AsyncStorage.setItem(archiveKey(scopeId), JSON.stringify(pruned));
    const active = getActiveQuickAskSession(pruned);
    if (active?.messages?.length) {
      await AsyncStorage.setItem(
        threadKey(scopeId),
        JSON.stringify(serializeQuickAskThread(active.messages)),
      );
    }
  } catch {
    /* ignore */
  }
  return pruned;
}

export async function loadQuickAskSessionArchive(scopeId: string): Promise<QuickAskSessionArchive> {
  try {
    const raw = await AsyncStorage.getItem(archiveKey(scopeId));
    let rawCount = 0;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        rawCount = Array.isArray(parsed?.sessions) ? parsed.sessions.length : 0;
      } catch {
        rawCount = 0;
      }
    }
    let archive = parseSessionArchive(raw) as QuickAskSessionArchive;
    if (rawCount > (archive.sessions?.length || 0)) {
      archive = await persistQuickAskSessionArchive(scopeId, archive);
    }
    if (!archive.sessions?.length) {
      const legacy = await loadQuickAskThreadMessages(scopeId);
      if (legacy.length) {
        archive = hydrateArchiveFromLegacyThread(archive, legacy) as QuickAskSessionArchive;
        archive = await persistQuickAskSessionArchive(scopeId, archive);
      }
    }
    return archive;
  } catch {
    return { activeSessionId: '', sessions: [] };
  }
}

export async function syncQuickAskSessions(
  scopeId: string,
  messages: unknown[],
  activeSessionId = '',
): Promise<QuickAskSessionArchive> {
  const archive = await loadQuickAskSessionArchive(scopeId);
  const next = upsertActiveQuickAskSession(
    archive,
    messages,
    activeSessionId || archive.activeSessionId,
  ) as QuickAskSessionArchive;
  return persistQuickAskSessionArchive(scopeId, next);
}

export async function beginNewQuickAskSession(scopeId: string): Promise<QuickAskSessionArchive> {
  const archive = await loadQuickAskSessionArchive(scopeId);
  const next = rotateQuickAskSession(archive) as QuickAskSessionArchive;
  return persistQuickAskSessionArchive(scopeId, next);
}

export async function activateQuickAskSession(
  scopeId: string,
  sessionId: string,
): Promise<QuickAskSessionArchive> {
  const archive = await loadQuickAskSessionArchive(scopeId);
  const next = setActiveQuickAskSession(archive, sessionId) as QuickAskSessionArchive;
  return persistQuickAskSessionArchive(scopeId, next);
}

export async function persistQuickAskThreadMessages(
  scopeId: string,
  messages: unknown[],
) {
  await syncQuickAskSessions(scopeId, messages);
}

export async function clearQuickAskThreadMessages(scopeId: string) {
  try {
    await AsyncStorage.removeItem(threadKey(scopeId));
  } catch {
    /* ignore */
  }
}
