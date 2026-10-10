const DISCOUNT_PRICE_ROUNDING_UNIT = 10000;

export function calculateDiscountPrice(price, discountPercent) {
  const basePrice = Number(price) || 0;
  const percent = Number(discountPercent) || 0;
  if (percent <= 0) return basePrice;
  const discountedPrice = basePrice * (1 - percent / 100);
  const roundedPrice = Math.round(discountedPrice / DISCOUNT_PRICE_ROUNDING_UNIT) * DISCOUNT_PRICE_ROUNDING_UNIT;
  return Math.max(0, roundedPrice - 1000);
}

export function isCourseDiscountActive(course, now = Date.now()) {
  if (!(Number(course?.discountPercent) > 0)) return false;
  const startsAt = course.discountStartsAt ? new Date(course.discountStartsAt).getTime() : null;
  const endsAt = course.discountEndsAt ? new Date(course.discountEndsAt).getTime() : null;
  return (startsAt === null || (Number.isFinite(startsAt) && now >= startsAt))
    && (endsAt === null || (Number.isFinite(endsAt) && now < endsAt));
}

export function getEffectiveCoursePrice(course, now = Date.now()) {
  const price = Number(course?.price) || 0;
  if (!isCourseDiscountActive(course, now)) return price;
  return calculateDiscountPrice(price, course.discountPercent);
}
