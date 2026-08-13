/**
 * Anti-seek / duration policy — keep in sync with utils/antiSeekPolicy.js
 */

export function isLessonAntiSeekEnabled(lesson) {
  return lesson?.antiSeek !== false;
}

export function parseLessonDurationSeconds(duration) {
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

export function requiredWatchSeconds(durationSeconds) {
  const d = Number(durationSeconds) || 0;
  if (d <= 0) return 0;
  return Math.ceil((d * 2) / 3);
}

export function resolveEffectiveDuration(adminDuration, reportedDuration) {
  const admin = parseLessonDurationSeconds(adminDuration);
  const reported = Math.max(0, Math.floor(Number(reportedDuration) || 0));
  if (reported <= 0 && admin <= 0) return 0;
  if (reported <= 0) return admin;
  if (admin <= 0) return reported;
  if (reported < admin * 0.45) return admin;
  return reported;
}

export const ANTI_SEEK_PROGRESS_CODE = 'ANTI_SEEK_PROGRESS_REQUIRED';
export const ANTI_SEEK_PROGRESS_MESSAGE =
  'Bạn chưa xem đủ thời lượng yêu cầu. Hãy tiếp tục xem bài học.';
export const PREV_LESSON_REQUIRED_CODE = 'PREVIOUS_LESSON_REQUIRED';
