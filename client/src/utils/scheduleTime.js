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

/** YYYY-MM-DD theo lịch local (không dùng UTC slice — tránh lệch ngày lúc đêm VN). */
export function formatLocalDateKey(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Ngày lịch (YYYY-MM-DD local) đã trước hôm nay — không cho xếp/sửa. */
export function isScheduleDateBeforeToday(dateInput, now = new Date()) {
  const key = normalizeScheduleDate(dateInput);
  const today = formatLocalDateKey(now);
  if (!key || !today) return false;
  return key < today;
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
  if (raw == null || raw === '') return formatLocalDateKey(new Date());
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return formatLocalDateKey(raw);
  }
  const s = String(raw).trim();
  // Chỉ YYYY-MM-DD thuần (không có giờ) — giữ nguyên ngày lịch
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return formatLocalDateKey(new Date());
  return formatLocalDateKey(d);
}

/** Ngày lịch → dd/MM/yyyy (thông báo / UI). Không đổi empty thành hôm nay. */
export function formatScheduleDateVi(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`;
  const d = raw instanceof Date ? raw : new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
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

export function findTeacherScheduleConflict({ schedules, teacherId, date, startTime, endTime, excludeScheduleId }) {
  const tid = String(teacherId || '');
  if (!tid) return null;
  const targetDate = normalizeScheduleDate(date);
  return (schedules || []).find((sch) => {
    if (!sch || sch.status === 'cancelled') return false;
    const schId = String(sch.id || sch._id || '');
    if (excludeScheduleId && schId === String(excludeScheduleId)) return false;
    const schTeacherId = String(sch.teacherId?._id || sch.teacherId?.id || sch.teacherId || '');
    if (schTeacherId !== tid) return false;
    if (normalizeScheduleDate(sch.date) !== targetDate) return false;
    return timeRangesOverlap(startTime, endTime, sch.startTime, sch.endTime);
  }) || null;
}

export function formatScheduleConflictMessage(conflict) {
  const course = conflict?.course ? ` (${conflict.course})` : '';
  const end = conflict?.endTime ? ` - ${conflict.endTime}` : '';
  return `Học viên đã có lịch học${course} từ ${conflict.startTime}${end} trong ngày này. Vui lòng chọn khung giờ khác.`;
}

export function formatTeacherConflictMessage(conflict) {
  const end = conflict?.endTime ? ` - ${conflict.endTime}` : '';
  const hv = conflict?.studentName ? `, HV: ${conflict.studentName}` : '';
  return `Giáo viên đã có lịch trùng thời gian này (${conflict.startTime}${end}${hv}). Vui lòng chọn khung giờ khác.`;
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

/**
 * Buổi scheduled đã qua giờ kết thúc (chưa điểm danh / chưa hủy).
 * Chỉ dùng cho nhãn UI — không đổi status DB / không trừ buổi.
 */
export function isSchedulePastEnd(schedule, now = new Date()) {
  if (!schedule) return false;
  const status = String(schedule.status || 'scheduled');
  if (status === 'completed' || status === 'cancelled' || status === 'no_show') return false;

  const dateStr = normalizeScheduleDate(schedule.date);
  const parts = dateStr.split('-').map((n) => parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return false;
  const [y, m, d] = parts;

  const startMins = parseTimeToMinutes(schedule.startTime);
  let endMins = parseTimeToMinutes(schedule.endTime);
  if (endMins == null) {
    endMins = startMins == null ? null : Math.min(startMins + SESSION_DURATION_MINS, 23 * 60 + 59);
  }
  if (endMins == null) {
    // Không có giờ → coi hết ngày là "đã qua"
    const endOfDay = new Date(y, m - 1, d, 23, 59, 59, 999);
    return now.getTime() > endOfDay.getTime();
  }

  const endAt = new Date(y, m - 1, d, Math.floor(endMins / 60), endMins % 60, 0, 0);
  return now.getTime() > endAt.getTime();
}

/** Nhãn hiển thị lịch (không ghi DB) — aligned with attendance state machine */
export const SCHEDULE_DISPLAY = {
  completed: { kind: 'completed', label: 'ĐÃ HỌC', shortLabel: 'Đã học' },
  cancelled: { kind: 'cancelled', label: 'ĐÃ HỦY', shortLabel: 'Đã hủy' },
  ongoing: { kind: 'ongoing', label: 'ĐANG DIỄN RA', shortLabel: 'Đang diễn ra' },
  upcoming: { kind: 'upcoming', label: 'SẮP TỚI', shortLabel: 'Sắp tới' },
  pending_attendance: { kind: 'pending_attendance', label: 'CHƯA ĐIỂM DANH', shortLabel: 'Chưa điểm danh' },
  overdue_attendance: { kind: 'overdue_attendance', label: 'QUÁ HẠN ĐIỂM DANH', shortLabel: 'Quá hạn điểm danh' },
  past_pending: { kind: 'past_pending', label: 'CHƯA ĐIỂM DANH', shortLabel: 'Chưa điểm danh' },
};

const ATTENDANCE_GRACE_MS = 60 * 60 * 1000; // sync with services/attendanceWindow.js default

/**
 * Phân loại hiển thị lịch theo status + thời gian thực + grace 60'.
 */
export function getScheduleDisplayKind(schedule, now = new Date()) {
  if (!schedule) return 'upcoming';
  const status = String(schedule.status || 'scheduled');
  if (status === 'completed') return 'completed';
  if (status === 'cancelled' || status === 'no_show') return 'cancelled';
  if (isScheduleOngoingNow(schedule, now)) return 'ongoing';
  if (isSchedulePastEnd(schedule, now)) {
    // Grace window → pending; after grace → overdue
    try {
      const dateStr = normalizeScheduleDate(schedule.date);
      const parts = String(dateStr || '').split('-').map((n) => parseInt(n, 10));
      if (parts.length === 3 && !parts.some((n) => !Number.isFinite(n))) {
        const [y, m, d] = parts;
        const endMins = parseTimeToMinutes(schedule.endTime)
          ?? ((parseTimeToMinutes(schedule.startTime) ?? 0) + SESSION_DURATION_MINS);
        const endAt = new Date(y, m - 1, d, Math.floor(endMins / 60), endMins % 60, 0, 0);
        if (now.getTime() <= endAt.getTime() + ATTENDANCE_GRACE_MS) {
          return 'pending_attendance';
        }
      }
    } catch { /* fall through */ }
    return 'overdue_attendance';
  }
  return 'upcoming';
}

export function getScheduleDisplayMeta(schedule, now = new Date()) {
  const kind = getScheduleDisplayKind(schedule, now);
  return SCHEDULE_DISPLAY[kind] || SCHEDULE_DISPLAY.upcoming;
}

/** Còn là buổi sắp tới / đang diễn ra (đếm "sắp tới") */
export function isScheduleUpcomingDisplay(schedule, now = new Date()) {
  const kind = getScheduleDisplayKind(schedule, now);
  return kind === 'upcoming' || kind === 'ongoing';
}
