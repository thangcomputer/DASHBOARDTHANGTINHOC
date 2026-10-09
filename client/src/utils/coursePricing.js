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
  const discountPrice = Number(course?.discountPrice);
  return discountPrice > 0
    ? discountPrice
    : Math.round(price * (1 - Number(course.discountPercent) / 100));
}
