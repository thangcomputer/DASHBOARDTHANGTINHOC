'use strict';

/**
 * LMS learning laws — ACCESS ≠ SEEK ≠ COMPLETION
 * Uses duration helpers from antiSeekPolicy; does not couple completion to antiSeek.
 */

const {
  isLessonAntiSeekEnabled,
  requiredWatchSeconds,
  resolveEffectiveDuration,
  parseLessonDurationSeconds,
  previousLessonId,
  listCourseLessonIds,
} = require('./antiSeekPolicy');

/** allowEarlyAccess missing → false (backward compatible). */
function isLessonAllowEarlyAccess(lesson) {
  return lesson?.allowEarlyAccess === true;
}

/**
 * ACCESS only: can the learner open this lesson?
 * First lesson always open. allowEarlyAccess opens without prerequisite.
 * Otherwise previous lesson must be server-completed.
 */
function resolveCanAccessLesson({ course, lessonId, lesson = null, completedLessonIds }) {
  const ids = listCourseLessonIds(course);
  const id = String(lessonId);
  const index = ids.indexOf(id);
  if (index < 0) {
    return {
      canAccess: false,
      prerequisiteLessonId: null,
      prerequisiteCompleted: false,
      allowEarlyAccess: false,
      isFirstLesson: false,
    };
  }

  const completedSet = new Set((completedLessonIds || []).map(String));
  const allowEarlyAccess = isLessonAllowEarlyAccess(lesson);
  const isFirstLesson = index === 0;
  const prerequisiteLessonId = previousLessonId(course, id);
  const prerequisiteCompleted = !prerequisiteLessonId || completedSet.has(String(prerequisiteLessonId));
  const canAccess = isFirstLesson || allowEarlyAccess || prerequisiteCompleted;

  return {
    canAccess,
    prerequisiteLessonId,
    prerequisiteCompleted,
    allowEarlyAccess,
    isFirstLesson,
  };
}

/**
 * COMPLETION only — independent of antiSeek / allowEarlyAccess.
 * When duration unknown (0): requiredSeconds=0, not eligible (UI waits for YouTube).
 * Complete endpoint must call this only AFTER resolveEffectiveDuration(admin, yt).
 */
function evaluateCompletionRequirement({ watchedSeconds, effectiveDuration }) {
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

/**
 * Full resolver for one lesson in a list (API mapping).
 */
function resolveLessonLearningState({
  lesson,
  index,
  course,
  completedLessonIds,
  watchedSeconds = 0,
  videoDuration = 0,
}) {
  const lessonId = String(lesson.id || lesson._id);
  const completedSet = new Set((completedLessonIds || []).map(String));
  const completed = completedSet.has(lessonId);
  const allowEarlyAccess = isLessonAllowEarlyAccess(lesson);
  const antiSeekEnabled = isLessonAntiSeekEnabled(lesson);
  const prerequisiteLessonId = previousLessonId(course, lessonId);
  const prerequisiteCompleted = !prerequisiteLessonId || completedSet.has(String(prerequisiteLessonId));
  const isFirstLesson = index === 0;
  const canAccess = isFirstLesson || allowEarlyAccess || prerequisiteCompleted;

  const adminDurationSeconds = parseLessonDurationSeconds(lesson.duration);
  const effectiveDuration = resolveEffectiveDuration(lesson.duration, videoDuration);
  const completion = evaluateCompletionRequirement({
    watchedSeconds,
    effectiveDuration,
  });

  return {
    canAccess,
    isUnlocked: canAccess, // API alias used by FE
    antiSeekEnabled,
    canSeekFreely: !antiSeekEnabled || completed || completion.completionEligible,
    allowEarlyAccess,
    completed,
    isCompleted: completed,
    completionEligible: completion.completionEligible,
    watchedSeconds: completion.watchedSeconds,
    requiredSeconds: completion.requiredSeconds,
    adminDurationSeconds,
    effectiveDurationSeconds: completion.durationSeconds,
    durationUnknown: !!completion.durationUnknown,
    prerequisiteLessonId,
    prerequisiteCompleted,
    progressPercent:
      completion.requiredSeconds > 0
        ? Math.min(100, Math.round((completion.watchedSeconds / completion.requiredSeconds) * 100))
        : 0,
  };
}

const LESSON_COMPLETION_REQUIREMENT_CODE = 'LESSON_COMPLETION_REQUIREMENT_NOT_MET';
/** @deprecated alias — prefer LESSON_COMPLETION_REQUIREMENT_CODE */
const ANTI_SEEK_PROGRESS_CODE = 'ANTI_SEEK_PROGRESS_REQUIRED';
const LESSON_COMPLETION_REQUIREMENT_MESSAGE =
  'Bạn chưa xem đủ thời lượng yêu cầu của bài học. Hãy tiếp tục xem.';

module.exports = {
  isLessonAllowEarlyAccess,
  resolveCanAccessLesson,
  evaluateCompletionRequirement,
  resolveLessonLearningState,
  LESSON_COMPLETION_REQUIREMENT_CODE,
  ANTI_SEEK_PROGRESS_CODE,
  LESSON_COMPLETION_REQUIREMENT_MESSAGE,
};
