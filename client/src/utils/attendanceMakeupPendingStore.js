/**
 * Persist teacher → admin makeup-attendance requests (per schedule).
 * Cleared when the session is marked completed / attended.
 */

const STORAGE_KEY = 'cms_attendance_makeup_pending';

let cache = null;
const listeners = new Set();

export function makeupPendingKey({ scheduleId, studentId, date, course } = {}) {
  const sch = scheduleId ? String(scheduleId) : '';
  if (sch) return `sch:${sch}`;
  const sid = String(studentId || '');
  const d = String(date || '').slice(0, 10);
  const c = String(course || '').trim();
  if (!sid) return '';
  return `stu:${sid}|${d}|${c}`;
}

function readMap() {
  if (cache) return cache;
  if (typeof localStorage === 'undefined') {
    cache = {};
    return cache;
  }
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    cache = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    cache = {};
  }
  return cache;
}

function writeMap(next) {
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* quota / private mode */
  }
  listeners.forEach((fn) => {
    try {
      fn(next);
    } catch {
      /* ignore */
    }
  });
}

export function getMakeupPending(key) {
  if (!key) return null;
  return readMap()[key] || null;
}

export function markMakeupPending(key, meta = {}) {
  if (!key) return;
  writeMap({
    ...readMap(),
    [key]: {
      sentAt: Date.now(),
      ...meta,
    },
  });
}

export function clearMakeupPending(key) {
  if (!key) return;
  const curr = readMap();
  if (!(key in curr)) return;
  const next = { ...curr };
  delete next[key];
  writeMap(next);
}

export function subscribeMakeupPending(fn) {
  if (typeof fn !== 'function') return () => {};
  listeners.add(fn);
  return () => listeners.delete(fn);
}
