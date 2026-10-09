'use strict';

function isCourseDiscountActive(course, now = new Date()) {
  if (!(Number(course?.discountPercent) > 0) || !(Number(course?.discountPrice) > 0)) return false;

  const startsAt = course.discountStartsAt ? new Date(course.discountStartsAt).getTime() : null;
  const endsAt = course.discountEndsAt ? new Date(course.discountEndsAt).getTime() : null;
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(currentTime)) return false;
  if (startsAt !== null && (!Number.isFinite(startsAt) || currentTime < startsAt)) return false;
  if (endsAt !== null && (!Number.isFinite(endsAt) || currentTime >= endsAt)) return false;
  return true;
}

function effectiveCoursePrice(course, now = new Date()) {
  const price = Number(course?.price) || 0;
  return isCourseDiscountActive(course, now)
    ? Number(course.discountPrice)
    : price;
}

module.exports = { isCourseDiscountActive, effectiveCoursePrice };
