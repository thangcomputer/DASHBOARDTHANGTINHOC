/**
 * Cooldown / prompt helpers — window via getAttendanceAction (grace 60m).
 */

import { getAttendanceAction } from './attendanceAction';

export function resolveCheckInGate(student, courseName) {
  if (!student) return { canCheckIn: true, remainingHours: 0 };
  let canCheckIn = student.can_check_in !== false;
  let remainingHours = Number(student.remaining_cooldown_hours) || 0;

  const course = String(courseName || '').trim();
  if (course && Array.isArray(student.enrollments)) {
    const enr = student.enrollments.find((e) => e && e.courseName === course);
    if (enr && enr.can_check_in === false) {
      canCheckIn = false;
      remainingHours = Number(enr.remaining_cooldown_hours) || remainingHours;
    }
  }
  return { canCheckIn, remainingHours };
}

/**
 * @returns {'checkin' | 'late' | 'expired' | null}
 */
export function classifyAttendancePrompt({ schedule, canCheckIn, dismissedIds, now = new Date() }) {
  if (!schedule) return null;
  const status = String(schedule.status || '');
  if (status === 'completed' || status === 'cancelled' || status === 'no_show') return null;

  const id = String(schedule._id || schedule.id || '');
  if (id && dismissedIds && typeof dismissedIds.has === 'function' && dismissedIds.has(id)) {
    return null;
  }

  if (canCheckIn === false) return null;

  const action = getAttendanceAction(schedule, null, now);
  if (action.state === 'IN_PROGRESS') return 'checkin';
  if (action.state === 'PENDING_ATTENDANCE') return 'late';
  if (action.state === 'OVERDUE_ATTENDANCE') return 'expired';
  return null;
}
