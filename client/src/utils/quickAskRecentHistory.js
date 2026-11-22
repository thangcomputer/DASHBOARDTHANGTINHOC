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
  getInactiveQuickAskSessions,
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

const AUTH_ROLES = ['student', 'teacher', 'admin', 'staff'];

export function normalizeQuickAskRoleKey(role) {
  const r = String(role || '').toLowerCase();
  return AUTH_ROLES.includes(r) ? r : 'student';
}

export function getQuickAskScopeIdForRole(role, userId = '') {
  const storageRole = normalizeQuickAskRoleKey(role);
  const explicit = String(userId || '').trim();
  if (explicit) return `${storageRole}:${explicit}`;
  try {
    const user = JSON.parse(localStorage.getItem(`${storageRole}_user`) || 'null');
    const fromLs = user?._id || user?.id;
    if (fromLs) return `${storageRole}:${fromLs}`;
  } catch {
    /* ignore */
  }
  return `anonymous:${storageRole}`;
}

function recentStorageKey(role, userId) {
  return `${QUICK_ASK_RECENT_STORAGE_PREFIX}${getQuickAskScopeIdForRole(role, userId)}`;
}

function threadStorageKey(role, userId) {
  return `${QUICK_ASK_THREAD_STORAGE_PREFIX}${getQuickAskScopeIdForRole(role, userId)}`;
}

function sessionArchiveStorageKey(role, userId) {
  return `${SESSION_ARCHIVE_PREFIX}${getQuickAskScopeIdForRole(role, userId)}`;
}

export function loadQuickAskSessionArchive(role = 'student', userId = '') {
  try {
    const rawStr = localStorage.getItem(sessionArchiveStorageKey(role, userId));
    let rawCount = 0;
    if (rawStr) {
      try {
        const rawObj = JSON.parse(rawStr);
        rawCount = Array.isArray(rawObj?.sessions) ? rawObj.sessions.length : 0;
      } catch {
        rawCount = 0;
      }
    }
    let archive = parseSessionArchive(rawStr);
    if (rawCount > (archive.sessions?.length || 0)) {
      archive = persistQuickAskSessionArchive(archive, role, userId);
    }
    const legacy = loadQuickAskThreadMessages(role, userId);
    if (!archive.sessions?.length && legacy.length) {
      archive = hydrateArchiveFromLegacyThread(archive, legacy);
      archive = persistQuickAskSessionArchive(archive, role, userId);
    }
    return archive;
  } catch {
    return { activeSessionId: '', sessions: [] };
  }
}

export function persistQuickAskSessionArchive(archive, role = 'student', userId = '') {
  try {
    const pruned = {
      activeSessionId: archive.activeSessionId,
      sessions: pruneSessionArchive(archive.sessions),
    };
    localStorage.setItem(sessionArchiveStorageKey(role, userId), JSON.stringify(pruned));
    const active = getActiveQuickAskSession(pruned);
    if (active?.messages?.length) {
      try {
        localStorage.setItem(threadStorageKey(role, userId), JSON.stringify(serializeQuickAskThread(active.messages)));
      } catch {
        /* ignore */
      }
    }
    return pruned;
  } catch {
    return archive;
  }
}

export function syncQuickAskSessions(messages, role = 'student', userId = '', activeSessionId = '') {
  const archive = loadQuickAskSessionArchive(role, userId);
  const next = upsertActiveQuickAskSession(archive, messages, activeSessionId || archive.activeSessionId);
  return persistQuickAskSessionArchive(next, role, userId);
}

export function beginNewQuickAskSession(role = 'student', userId = '') {
  const archive = loadQuickAskSessionArchive(role, userId);
  const next = rotateQuickAskSession(archive);
  return persistQuickAskSessionArchive(next, role, userId);
}

export function activateQuickAskSession(sessionId, role = 'student', userId = '') {
  const archive = loadQuickAskSessionArchive(role, userId);
  const next = setActiveQuickAskSession(archive, sessionId);
  return persistQuickAskSessionArchive(next, role, userId);
}

export function listQuickAskSessionHistory(archive, { includeAll = false } = {}) {
  const inactive = getInactiveQuickAskSessions(archive);
  if (includeAll) return inactive;
  return inactive.slice(0, SESSION_LIST_PREVIEW);
}

export function getQuickAskActiveSessionMessages(archive) {
  const active = getActiveQuickAskSession(archive);
  return active?.messages?.length ? active.messages : [];
}

function loadLegacyThreadCandidates(role, userId) {
  const scope = getQuickAskScopeIdForRole(role, userId);
  const keys = new Set([
    threadStorageKey(role, userId),
    `${QUICK_ASK_THREAD_STORAGE_PREFIX}${scope}`,
    `${QUICK_ASK_THREAD_STORAGE_PREFIX}anonymous:${normalizeQuickAskRoleKey(role)}`,
    `${QUICK_ASK_THREAD_STORAGE_PREFIX}anonymous`,
  ]);
  for (const roleName of AUTH_ROLES) {
    try {
      const user = JSON.parse(localStorage.getItem(`${roleName}_user`) || 'null');
      const id = user?._id || user?.id;
      if (id) keys.add(`${QUICK_ASK_THREAD_STORAGE_PREFIX}${roleName}:${id}`);
    } catch {
      /* ignore */
    }
  }
  let best = [];
  for (const key of keys) {
    try {
      const parsed = parseQuickAskThread(localStorage.getItem(key));
      if (parsed.length > best.length) best = parsed;
    } catch {
      /* ignore */
    }
  }
  return best;
}

export function loadQuickAskRecentQuestions(role = 'student', userId = '') {
  try {
    return parseQuickAskRecentList(localStorage.getItem(recentStorageKey(role, userId)));
  } catch {
    return [];
  }
}

export function persistQuickAskRecentQuestions(list, role = 'student', userId = '') {
  try {
    localStorage.setItem(recentStorageKey(role, userId), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function rememberQuickAskQuestion(question, role = 'student', userId = '') {
  const next = pushQuickAskRecentQuestion(loadQuickAskRecentQuestions(role, userId), question);
  persistQuickAskRecentQuestions(next, role, userId);
  return next;
}

export function loadQuickAskThreadMessages(role = 'student', userId = '') {
  try {
    const direct = parseQuickAskThread(localStorage.getItem(threadStorageKey(role, userId)));
    if (direct.length) return direct;
    return loadLegacyThreadCandidates(role, userId);
  } catch {
    return [];
  }
}

export function persistQuickAskThreadMessages(messages, role = 'student', userId = '') {
  syncQuickAskSessions(messages, role, userId);
}

export function clearQuickAskThreadMessages(role = 'student', userId = '') {
  try {
    localStorage.removeItem(threadStorageKey(role, userId));
  } catch {
    /* ignore */
  }
}

export function isQuickAskPersistenceRole(role) {
  return AUTH_ROLES.includes(normalizeQuickAskRoleKey(role));
}