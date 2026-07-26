/** Chuyen HH:mm -> phut trong ngay */
export function parseTimeToMinutes(raw) {
  if (raw == null || raw === '') return null;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function isEndTimeAfterStart(startTime, endTime) {
  const end = String(endTime || '').trim();
  if (!end) return true;
  const s = parseTimeToMinutes(startTime);
  const e = parseTimeToMinutes(endTime);
  if (s == null || e == null) return false;
  return e > s;
}

export function normalizeScheduleDate(raw) {
  if (!raw) return new Date().toISOString().slice(0, 10);
  const s = String(raw);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function normalizeTimeHHmm(raw, fallback = '19:30') {
  if (!raw) return fallback;
  const m = String(raw).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  return `${String(parseInt(m[1], 10)).padStart(2, '0')}:${m[2]}`;
}

/** Gio hien tai cua he thong (HH:mm, 24h) */
export function getCurrentTimeHHmm(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export const SESSION_DURATION_MINS = 90;

/** Cong phut vao HH:mm, gioi han trong cung ngay (toi da 23:59) */
export function addMinutesToTimeHHmm(time, addMins) {
  const mins = parseTimeToMinutes(time);
  if (mins == null) return '';
  const total = Math.min(mins + addMins, 23 * 60 + 59);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function endTimeFromStart(startTime, durationMins = SESSION_DURATION_MINS) {
  return addMinutesToTimeHHmm(startTime, durationMins);
}

/** Hai khung gio trung nhau (cung ngay) */
export function timeRangesOverlap(start1, end1, start2, end2) {
  const s1 = parseTimeToMinutes(start1);
  const s2 = parseTimeToMinutes(start2);
  if (s1 == null || s2 == null) return false;
  const e1 = parseTimeToMinutes(end1) ?? (s1 + SESSION_DURATION_MINS);
  const e2 = parseTimeToMinutes(end2) ?? (s2 + SESSION_DURATION_MINS);
  return s1 < e2 && s2 < e1;
}

export function findStudentScheduleConflict({ schedules, studentId, date, startTime, endTime, excludeScheduleId }) {
  const targetDate = normalizeScheduleDate(date);
  const sid = String(studentId);
  return (schedules || []).find((sch) => {
    if (!sch || sch.status === 'cancelled') return false;
    const schId = String(sch.id || sch._id || '');
    if (excludeScheduleId && schId === String(excludeScheduleId)) return false;
    const schStudentId = String(sch.studentId?._id || sch.studentId?.id || sch.studentId || '');
    if (schStudentId !== sid) return false;
    if (normalizeScheduleDate(sch.date) !== targetDate) return false;
    return timeRangesOverlap(startTime, endTime, sch.startTime, sch.endTime);
  }) || null;
}

export function formatScheduleConflictMessage(conflict) {
  const course = conflict?.course ? ` (${conflict.course})` : '';
  const end = conflict?.endTime ? ` - ${conflict.endTime}` : '';
  return `Học viên đã có lịch học${course} từ ${conflict.startTime}${end} trong ngày này. Vui lòng chọn khung giờ khác.`;
}

/** Buoi hoc dang dien ra: cung ngay va gio hien tai nam trong [startTime, endTime] */
export function isScheduleOngoingNow(schedule, now = new Date()) {
  if (!schedule || schedule.status !== 'scheduled') return false;
  const schedDate = new Date(schedule.date);
  if (Number.isNaN(schedDate.getTime())) return false;
  if (
    schedDate.getFullYear() !== now.getFullYear()
    || schedDate.getMonth() !== now.getMonth()
    || schedDate.getDate() !== now.getDate()
  ) return false;

  const start = parseTimeToMinutes(schedule.startTime);
  const end = parseTimeToMinutes(schedule.endTime);
  const current = now.getHours() * 60 + now.getMinutes();
  if (start == null) return false;
  if (end == null) return current >= start;
  return current >= start && current <= end;
}
