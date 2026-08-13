/**
 * Anti-seek / duration / learning policy — keep in sync with:
 * - utils/antiSeekPolicy.js
 * - utils/lessonLearningPolicy.js
 */

export function isLessonAntiSeekEnabled(lesson) {
  return lesson?.antiSeek !== false;
}

/** allowEarlyAccess missing → false */
export function isLessonAllowEarlyAccess(lesson) {
  return lesson?.allowEarlyAccess === true;
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

/** COMPLETION — independent of antiSeek */
export function evaluateCompletionRequirement({ watchedSeconds, effectiveDuration }) {
  const watched = Math.max(0, Number(watchedSeconds) || 0);
  const duration = Math.max(0, Number(effectiveDuration) || 0);
  const required = requiredWatchSeconds(duration);
  if (duration <= 0 || required <= 0) {
    return {
      watchedSeconds: watched,
      requiredSeconds: 0,
      durationSeconds: 0,
      completionEligible: false,
      durationUnknown: true,
    };
  }
  return {
    watchedSeconds: watched,
    requiredSeconds: required,
    durationSeconds: duration,
    completionEligible: watched >= required,
    durationUnknown: false,
  };
}

export const LESSON_COMPLETION_REQUIREMENT_CODE = 'LESSON_COMPLETION_REQUIREMENT_NOT_MET';
/** @deprecated alias kept for older responses during rollout */
export const ANTI_SEEK_PROGRESS_CODE = 'ANTI_SEEK_PROGRESS_REQUIRED';
export const ANTI_SEEK_PROGRESS_MESSAGE =
  'Bạn chưa xem đủ thời lượng yêu cầu. Hãy tiếp tục xem bài học.';
export const LESSON_COMPLETION_REQUIREMENT_MESSAGE =
  'Bạn chưa xem đủ thời lượng yêu cầu của bài học. Hãy tiếp tục xem.';
export const PREV_LESSON_REQUIRED_CODE = 'PREVIOUS_LESSON_REQUIRED';

export function isCompletionRequirementCode(code) {
  return code === LESSON_COMPLETION_REQUIREMENT_CODE || code === ANTI_SEEK_PROGRESS_CODE;
}
