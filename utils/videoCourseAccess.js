'use strict';

const VideoCoursePurchase = require('../models/VideoCoursePurchase');

function coursePriceOf(course) {
  const n = Number(course?.price);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function isPaidVideoCourse(course) {
  return coursePriceOf(course) > 0;
}

function isPreviewLesson(lesson) {
  return lesson?.isPreview === true;
}

async function studentOwnsVideoCourse(studentId, courseId) {
  if (!studentId || !courseId) return false;
  const row = await VideoCoursePurchase.findOne({
    studentId,
    courseId: String(courseId),
    status: 'paid',
  }).select('_id').lean();
  return Boolean(row);
}

/**
 * Student + paid course + not owned → only isPreview lessons may play.
 * Teachers/admins unchanged.
 */
function applyVideoPaywallToLesson({ role, owned, course, lesson, sequentialState }) {
  const base = sequentialState || {};
  if (String(role || '').toLowerCase() !== 'student' || !isPaidVideoCourse(course) || owned) {
    return {
      ...base,
      paywallLocked: false,
      isPreview: isPreviewLesson(lesson),
    };
  }
  if (isPreviewLesson(lesson)) {
    return {
      ...base,
      canAccess: true,
      isUnlocked: true,
      paywallLocked: false,
      isPreview: true,
    };
  }
  return {
    ...base,
    canAccess: false,
    isUnlocked: false,
    paywallLocked: true,
    isPreview: false,
    videoUrl: undefined,
    url: undefined,
    youtubeUrl: undefined,
    link: undefined,
    contentLocked: true,
  };
}

async function assertStudentMayWatchLesson({ user, course, lesson }) {
  if (String(user?.role || '').toLowerCase() !== 'student') return { ok: true };
  if (!isPaidVideoCourse(course)) return { ok: true };
  const uid = user.id || user._id;
  const cid = course.id || course._id;
  const owned = await studentOwnsVideoCourse(uid, cid);
  if (owned) return { ok: true, owned: true };
  if (isPreviewLesson(lesson)) return { ok: true, owned: false, preview: true };
  return {
    ok: false,
    owned: false,
    code: 'VIDEO_COURSE_PAYWALL',
    message: 'Khóa học này cần thanh toán. Bạn có thể xem thử các bài được mở.',
  };
}

module.exports = {
  coursePriceOf,
  isPaidVideoCourse,
  isPreviewLesson,
  studentOwnsVideoCourse,
  applyVideoPaywallToLesson,
  assertStudentMayWatchLesson,
};
