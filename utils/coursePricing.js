'use strict';

const DISCOUNT_PRICE_ROUNDING_UNIT = 10000;

function calculateDiscountPrice(price, discountPercent) {
  const basePrice = Number(price) || 0;
  const percent = Number(discountPercent) || 0;
  if (percent <= 0) return basePrice;
  const discountedPrice = basePrice * (1 - percent / 100);
  const roundedPrice = Math.round(discountedPrice / DISCOUNT_PRICE_ROUNDING_UNIT) * DISCOUNT_PRICE_ROUNDING_UNIT;
  return Math.max(0, roundedPrice - 1000);
}

function isCourseDiscountActive(course, now = new Date()) {
  if (!(Number(course?.discountPercent) > 0) || !(Number(course?.price) > 0)) return false;

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
    ? calculateDiscountPrice(price, course.discountPercent)
    : price;
}

module.exports = {
  DISCOUNT_PRICE_ROUNDING_UNIT,
  calculateDiscountPrice,
  isCourseDiscountActive,
  effectiveCoursePrice,
};
