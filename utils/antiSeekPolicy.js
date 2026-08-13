'use strict';

/**
 * Anti-seek policy — SoT: lesson.antiSeek
 * Convention: antiSeek !== false => ENABLED (undefined/null => ON)
 *
 * Duration SoT for threshold (Module 5):
 * prefer live YouTube duration when sane; fall back to Admin lesson.duration.
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

/**
 * Unify FE/BE threshold duration.
 * @param {number|string} adminDuration - lesson.duration from Course Builder
 * @param {number} reportedDuration - YouTube getDuration() from client
 */
function resolveEffectiveDuration(adminDuration, reportedDuration) {
  const admin = parseLessonDurationSeconds(adminDuration);
  const reported = Math.max(0, Math.floor(Number(reportedDuration) || 0));

  if (reported <= 0 && admin <= 0) return 0;
  if (reported <= 0) return admin;
  if (admin <= 0) return reported;

  // Client under-reports to lower threshold → fail-closed to admin
  if (reported < admin * 0.45) return admin;

  // Prefer live player duration (fixes Admin duration mismatch)
  return reported;
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
    cap = prev + Math.ceil(elapsed) + 8;
    if (maxSeconds > 0) cap = Math.min(cap, maxSeconds);
  }
  return Math.min(nextRaw, Math.max(prev, cap));
}

/** Ordered lesson ids for a course (chapters flattened). */
function listCourseLessonIds(course) {
  const lessons = [];
  const push = (list) => {
    if (!Array.isArray(list)) return;
    list.forEach((l) => {
      const id = l && (l.id || l._id);
      if (id != null) lessons.push(String(id));
    });
  };
  if (Array.isArray(course?.lessons) && course.lessons.length) push(course.lessons);
  else if (Array.isArray(course?.videos) && course.videos.length) push(course.videos);
  else if (Array.isArray(course?.chapters)) {
    course.chapters.forEach((ch) => push(ch?.lessons));
  }
  return lessons;
}

function previousLessonId(course, lessonId) {
  const ids = listCourseLessonIds(course);
  const idx = ids.indexOf(String(lessonId));
  if (idx <= 0) return null;
  return ids[idx - 1];
}

module.exports = {
  isLessonAntiSeekEnabled,
  parseLessonDurationSeconds,
  requiredWatchSeconds,
  resolveEffectiveDuration,
  findLessonInCourse,
  clampWatchProgressIncrease,
  listCourseLessonIds,
  previousLessonId,
};
