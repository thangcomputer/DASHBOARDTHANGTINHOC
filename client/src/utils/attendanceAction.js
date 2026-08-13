/**
 * Single FE resolver — mirrors services/attendanceWindow.js (grace 60m default).
 */

export const ATTENDANCE_GRACE_MINUTES = Number(
  import.meta.env?.VITE_ATTENDANCE_GRACE_MINUTES
  || import.meta.env?.VITE_ATTENDANCE_LATE_GRACE_MINUTES,
) || 60;

function parseTimeToMinutes(raw) {
  if (raw == null || raw === '') return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

function scheduleBounds(schedule, now = new Date()) {
  const d = new Date(schedule?.date);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const mo = d.getMonth();
  const day = d.getDate();
  const startMins = parseTimeToMinutes(schedule.startTime);
  let endMins = parseTimeToMinutes(schedule.endTime);
  if (endMins == null && startMins != null) endMins = Math.min(startMins + 90, 23 * 60 + 59);
  if (startMins == null || endMins == null) return null;
  const startAt = new Date(y, mo, day, Math.floor(startMins / 60), startMins % 60, 0, 0);
  const endAt = new Date(y, mo, day, Math.floor(endMins / 60), endMins % 60, 0, 0);
  const graceEndAt = new Date(endAt.getTime() + ATTENDANCE_GRACE_MINUTES * 60 * 1000);
  return { startAt, endAt, graceEndAt, now };
}

export const ATTENDANCE_UI = {
  UPCOMING: { state: 'UPCOMING', label: 'Sắp tới', tone: 'amber' },
  IN_PROGRESS: { state: 'IN_PROGRESS', label: 'Đang diễn ra', tone: 'blue' },
  PENDING_ATTENDANCE: { state: 'PENDING_ATTENDANCE', label: 'Chưa điểm danh', tone: 'orange' },
  OVERDUE_ATTENDANCE: { state: 'OVERDUE_ATTENDANCE', label: 'Quá hạn điểm danh', tone: 'red' },
  COMPLETED: { state: 'COMPLETED', label: 'Đã học', tone: 'emerald' },
  CANCELLED: { state: 'CANCELLED', label: 'Đã hủy', tone: 'slate' },
  MISSED: { state: 'MISSED', label: 'Không học', tone: 'slate' },
};

/**
 * @returns {{
 *   state, label, tone, action, canAttend, canLateAttend, canAdminMakeup, canRequestCorrection, reason, remainingGraceMs, endAt?, graceEndAt?
 * }}
 */
export function getAttendanceAction(schedule, _attendance, now = new Date()) {
  const status = String(schedule?.status || '');
  if (status === 'completed') {
    return {
      ...ATTENDANCE_UI.COMPLETED,
      action: null,
      canAttend: false,
      canLateAttend: false,
      canAdminMakeup: false,
      canRequestCorrection: false,
      reason: 'Đã điểm danh',
      remainingGraceMs: 0,
    };
  }
  if (status === 'cancelled') {
    return {
      ...ATTENDANCE_UI.CANCELLED,
      action: null,
      canAttend: false,
      canLateAttend: false,
      canAdminMakeup: false,
      canRequestCorrection: false,
      reason: 'Đã hủy',
      remainingGraceMs: 0,
    };
  }
  if (status === 'no_show') {
    return {
      ...ATTENDANCE_UI.MISSED,
      action: null,
      canAttend: false,
      canLateAttend: false,
      canAdminMakeup: false,
      canRequestCorrection: false,
      reason: 'Học viên không học',
      remainingGraceMs: 0,
    };
  }

  const bounds = scheduleBounds(schedule, now);
  if (!bounds) {
    return {
      ...ATTENDANCE_UI.UPCOMING,
      action: null,
      canAttend: false,
      canLateAttend: false,
      canAdminMakeup: false,
      canRequestCorrection: false,
      reason: 'Thiếu thời gian buổi học',
      remainingGraceMs: 0,
    };
  }

  const { startAt, endAt, graceEndAt } = bounds;
  const t = now.getTime();

  if (t < startAt.getTime()) {
    return {
      ...ATTENDANCE_UI.UPCOMING,
      action: null,
      canAttend: false,
      canLateAttend: false,
      canAdminMakeup: false,
      canRequestCorrection: false,
      reason: 'Chưa đến giờ học',
      remainingGraceMs: 0,
      endAt,
      graceEndAt,
    };
  }

  if (t <= endAt.getTime()) {
    return {
      ...ATTENDANCE_UI.IN_PROGRESS,
      action: 'CHECK_IN',
      canAttend: true,
      canLateAttend: false,
      canAdminMakeup: false,
      canRequestCorrection: false,
      reason: 'Buổi học đang diễn ra',
      remainingGraceMs: Math.max(0, graceEndAt.getTime() - t),
      endAt,
      graceEndAt,
    };
  }

  if (t <= graceEndAt.getTime()) {
    return {
      ...ATTENDANCE_UI.PENDING_ATTENDANCE,
      action: 'CHECK_IN',
      canAttend: true,
      canLateAttend: true,
      canAdminMakeup: true,
      canRequestCorrection: false,
      reason: 'Buổi học đã kết thúc — còn hạn điểm danh',
      remainingGraceMs: Math.max(0, graceEndAt.getTime() - t),
      endAt,
      graceEndAt,
    };
  }

  return {
    ...ATTENDANCE_UI.OVERDUE_ATTENDANCE,
    action: 'ADMIN_MAKEUP',
    canAttend: false,
    canLateAttend: false,
    canAdminMakeup: true,
    canRequestCorrection: true,
    reason: 'Đã quá thời gian điểm danh — cần Admin điểm danh bù',
    remainingGraceMs: 0,
    endAt,
    graceEndAt,
  };
}

export function formatGraceRemaining(ms) {
  if (!ms || ms <= 0) return '0 phút';
  const totalMin = Math.ceil(ms / 60000);
  if (totalMin < 60) return `${totalMin} phút`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m ? `${h} giờ ${m} phút` : `${h} giờ`;
}

export function attendanceToneClass(tone) {
  switch (tone) {
    case 'emerald': return 'bg-emerald-50 text-emerald-600';
    case 'blue': return 'bg-blue-50 text-blue-700';
    case 'orange': return 'bg-orange-50 text-orange-700';
    case 'red': return 'bg-red-50 text-red-700';
    case 'slate': return 'bg-slate-100 text-slate-500';
    case 'amber':
    default: return 'bg-amber-50 text-amber-600';
  }
}
