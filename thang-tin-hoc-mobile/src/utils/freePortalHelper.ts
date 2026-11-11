import type { DemoEnrollment, DemoUser } from '../types';

export const FREE_PORTAL_COURSE_NAME = 'Tài khoản miễn phí';

export function hasRealCourseEnrollment(
  user?: DemoUser | null,
  enrollmentsOverride?: DemoEnrollment[] | null,
): boolean {
  if (user?.role !== 'student') return false;
  if (user?.freePortal === false && Boolean(user?.course) && !String(user?.course).toLowerCase().includes('miễn phí')) {
    return true;
  }
  const list = enrollmentsOverride ?? user?.enrollments ?? (user as any)?.courses;
  if (Array.isArray(list) && list.length > 0) {
    return list.some((enrollment) => {
      const label = String(enrollment?.courseName || (enrollment as any)?.name || '').trim().toLocaleLowerCase('vi');
      if (!label || label === FREE_PORTAL_COURSE_NAME.toLocaleLowerCase('vi') || label.includes('miễn phí')) return false;
      const status = String(enrollment.status || '').trim().toLowerCase();
      return status !== 'hoàn thành' && status !== 'thôi học' && status !== 'completed' && status !== 'cancelled';
    });
  }
  const course = String(user?.course || '').trim().toLocaleLowerCase('vi');
  if (course && course !== FREE_PORTAL_COURSE_NAME.toLocaleLowerCase('vi') && !course.includes('miễn phí')) {
    return true;
  }
  return false;
}

export function isFreePortalMenu(
  user?: DemoUser | null,
  enrollmentsOverride?: DemoEnrollment[] | null,
): boolean {
  if (!user || user.role !== 'student') return false;
  if (hasRealCourseEnrollment(user, enrollmentsOverride)) return false;
  if (user.freePortal === false && Boolean(user.course) && !String(user.course).toLowerCase().includes('miễn phí')) {
    return false;
  }
  return (
    user.freePortal === true
    || String(user.course || '').trim().toLocaleLowerCase('vi') === FREE_PORTAL_COURSE_NAME.toLocaleLowerCase('vi')
    || String(user.course || '').trim().toLocaleLowerCase('vi').includes('miễn phí')
  );
}

export function isFreePortalLocked(
  user?: DemoUser | null,
  enrollmentsOverride?: DemoEnrollment[] | null,
): boolean {
  return isFreePortalMenu(user, enrollmentsOverride) && user?.freeUnlocked !== true;
}

