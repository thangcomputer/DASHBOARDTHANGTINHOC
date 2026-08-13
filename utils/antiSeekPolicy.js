'use strict';

/**
 * Anti-seek policy — SoT: lesson.antiSeek
 * Convention: antiSeek !== false => ENABLED (undefined/null => ON)
 */

function isLessonAntiSeekEnabled(lesson) {
  return lesson?.antiSeek !== false;
}

/** Parse lesson.duration (seconds number or "mm:ss" / "m:ss"). */
function parseLessonDurationSeconds(duration) {
  if (duration == null || duration === '') return 0;
  if (typeof duration === 'number' && Number.isFinite(duration)) {
    return Math.max(0, Math.floor(duration));
  }
  const s = String(duration).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.max(0, Math.floor(Number(s)));
  const m = s.match(/^(\d+)\s*:\s*(\d{1,2})$/);
  if (m) return Math.max(0, Number(m[1]) * 60 + Number(m[2]));
  return 0;
}

/** Business rule: require ceil(2/3) of duration. */
function requiredWatchSeconds(durationSeconds) {
  const d = Number(durationSeconds) || 0;
  if (d <= 0) return 0;
  return Math.ceil((d * 2) / 3);
}

function findLessonInCourse(course, lessonId) {
  if (!course || lessonId == null) return null;
  const id = String(lessonId);
  const match = (l) => l && String(l.id || l._id) === id;

  const fromList = (list) => (Array.isArray(list) ? list.find(match) : null);
  let found = fromList(course.lessons) || fromList(course.videos);
  if (found) return found;

  if (Array.isArray(course.chapters)) {
    for (const ch of course.chapters) {
      found = fromList(ch?.lessons);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Cap watch progress growth using wall-clock since last save (anti one-shot inflate).
 * First record: accept incoming as-is (bounded by optional maxSeconds).
 */
function clampWatchProgressIncrease({ previous = 0, incoming, lastWatchedAt, maxSeconds = 0 }) {
  const prev = Math.max(0, Number(previous) || 0);
  const nextRaw = Math.max(0, Number(incoming) || 0);
  if (nextRaw <= prev) return prev;

  let cap;
  if (!lastWatchedAt) {
    cap = maxSeconds > 0 ? Math.min(nextRaw, maxSeconds) : nextRaw;
  } else {
    const elapsed = Math.max(0, (Date.now() - new Date(lastWatchedAt).getTime()) / 1000);
    // 30s autosave + small buffer; allow catch-up after tab background
    cap = prev + Math.ceil(elapsed) + 8;
    if (maxSeconds > 0) cap = Math.min(cap, maxSeconds);
  }
  return Math.min(nextRaw, Math.max(prev, cap));
}

module.exports = {
  isLessonAntiSeekEnabled,
  parseLessonDurationSeconds,
  requiredWatchSeconds,
  findLessonInCourse,
  clampWatchProgressIncrease,
};
