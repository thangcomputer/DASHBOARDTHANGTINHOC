/**
 * Anti-seek policy — SoT: lesson.antiSeek
 * Must stay in sync with utils/antiSeekPolicy.js (server).
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

export const ANTI_SEEK_PROGRESS_CODE = 'ANTI_SEEK_PROGRESS_REQUIRED';
export const ANTI_SEEK_PROGRESS_MESSAGE =
  'Bạn chưa xem đủ thời lượng yêu cầu. Hãy tiếp tục xem bài học.';
