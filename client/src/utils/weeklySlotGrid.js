/**
 * Module thử nghiệm: lưới tuần + dropdown khung giờ.
 * Tắt: TEACHER_WEEKLY_SLOT_GRID_EXPERIMENT = false
 * Xóa: file này + TeacherWeeklySlotGrid.jsx + chỗ gắn ở TeacherScheduleTab.
 */

import {
  normalizeScheduleDate,
  normalizeTimeHHmm,
  endTimeFromStart,
  findTeacherScheduleConflict,
  formatLocalDateKey,
  parseTimeToMinutes,
  timeRangesOverlap,
} from './scheduleTime';

export const TEACHER_WEEKLY_SLOT_GRID_EXPERIMENT = true;
/** Tạm ẩn lịch tháng để xem bảng tuần. Bật lại = true. */
export const SHOW_TEACHER_MONTHLY_CALENDAR = false;

export const WEEKDAY_LABELS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

const SLOT_MINS = 90;
const SLOT_STEP_MINS = 30;
const DAY_START_MINS = 7 * 60;
const DAY_END_MINS = 24 * 60;

function formatSlotHHmm(totalMins) {
  if (totalMins >= DAY_END_MINS) return '24:00';
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Ca 90 phút, lệch 30 phút: 07:00-08:30, 07:30-09:00, … đến 22:30-24:00. */
function buildWeekSlotOptions() {
  const list = [];
  for (let start = DAY_START_MINS; start + SLOT_MINS <= DAY_END_MINS; start += SLOT_STEP_MINS) {
    const endMins = start + SLOT_MINS;
    const startH = formatSlotHHmm(start);
    const endLabel = formatSlotHHmm(endMins);
    const endH = endMins >= DAY_END_MINS ? '23:59' : formatSlotHHmm(endMins);
    list.push({
      start: startH,
      end: endH,
      value: startH,
      label: `${startH} - ${endLabel}`,
    });
  }
  return list;
}

export const WEEK_SLOT_OPTIONS = buildWeekSlotOptions();

const OCCUPYING = new Set(['scheduled', 'completed', 'no_show']);

export function startOfWeekMonday(input = new Date()) {
  const date = input instanceof Date ? new Date(input) : new Date(input);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekDateKeys(weekStart) {
  const start = startOfWeekMonday(weekStart);
  return WEEKDAY_LABELS.map((_, i) => normalizeScheduleDate(addDays(start, i)));
}

export function formatWeekRangeLabel(weekStart) {
  const keys = weekDateKeys(weekStart);
  const a = keys[0]?.slice(8, 10);
  const b = keys[6]?.slice(8, 10);
  const m1 = keys[0]?.slice(5, 7);
  const m2 = keys[6]?.slice(5, 7);
  const y = keys[6]?.slice(0, 4);
  if (m1 === m2) return `${a}/${m1} – ${b}/${m2}/${y}`;
  return `${a}/${m1} – ${b}/${m2}/${y}`;
}

function scheduleStudentId(sch) {
  return String(sch?.studentId?._id || sch?.studentId?.id || sch?.studentId || '');
}

function normCourse(name) {
  return String(name || '').trim().toLowerCase();
}

export function findStudentDayOccupying(schedules, studentId, dateKey) {
  const sid = String(studentId || '');
  const day = normalizeScheduleDate(dateKey);
  return (schedules || []).find((sch) => {
    if (!sch || !OCCUPYING.has(String(sch.status || 'scheduled'))) return false;
    if (scheduleStudentId(sch) !== sid) return false;
    return normalizeScheduleDate(sch.date) === day;
  }) || null;
}

export function findOccupyingSchedule(schedules, studentId, dateKey, courseName) {
  const sid = String(studentId || '');
  const day = normalizeScheduleDate(dateKey);
  const course = normCourse(courseName);
  const occupying = (schedules || []).filter((sch) => {
    if (!sch || !OCCUPYING.has(String(sch.status || 'scheduled'))) return false;
    if (scheduleStudentId(sch) !== sid) return false;
    return normalizeScheduleDate(sch.date) === day;
  });
  if (course) {
    const match = occupying.find((sch) => {
      const sc = normCourse(sch.course);
      return !sc || sc === course;
    });
    if (match) return match;
  }
  return occupying[0] || null;
}

export function occupyingMatchesCourse(sch, courseName) {
  if (!sch) return false;
  const course = normCourse(courseName);
  if (!course) return true;
  const sc = normCourse(sch.course);
  return !sc || sc === course;
}

/** Ca hôm nay đã hết (qua giờ kết thúc) — không xếp mới. Ca đang diễn ra vẫn được. */
export function isWeekSlotElapsed(dateKey, startTime, endTime, now = new Date()) {
  const day = normalizeScheduleDate(dateKey);
  const today = formatLocalDateKey(now);
  if (!day || day !== today) return false;
  const start = normalizeTimeHHmm(startTime, '');
  if (!start) return false;
  const end = endTime || endTimeFromStart(start);
  const endMins = parseTimeToMinutes(end);
  if (endMins == null) return false;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= endMins;
}

export function weekSlotSelectMeta(opt, dateKey, {
  schedules,
  teacherId,
  excludeScheduleId,
  now,
  currentValue,
  extraTakenRanges,
} = {}) {
  const start = opt.start || opt.value;
  const elapsed = isWeekSlotElapsed(dateKey, start, opt.end, now);
  const optEnd = opt.end || endTimeFromStart(start);
  const takenByHold = !elapsed && (extraTakenRanges || []).some((r) => (
    r?.start && timeRangesOverlap(start, optEnd, r.start, r.end || endTimeFromStart(r.start))
  ));
  const taken = takenByHold || (!elapsed && isSlotTakenByOther(
    schedules,
    teacherId,
    dateKey,
    start,
    excludeScheduleId,
    opt.end,
  ));
  const isCurrent = String(currentValue || '') === String(opt.value);
  let bookedName = '';
  if (!elapsed && taken && !isCurrent) {
    const hold = (extraTakenRanges || []).find((r) => (
      r?.start && timeRangesOverlap(start, optEnd, r.start, r.end || endTimeFromStart(r.start))
    ));
    bookedName = String(hold?.studentName || '').trim();
    if (!bookedName) {
      const clash = findTeacherScheduleConflict({
        schedules,
        teacherId,
        date: dateKey,
        startTime: start,
        endTime: optEnd,
        excludeScheduleId,
      });
      bookedName = String(
        clash?.studentName
        || clash?.studentId?.name
        || '',
      ).trim();
    }
  }
  return {
    hidden: false,
    disabled: elapsed || (taken && !isCurrent),
    suffix: elapsed
      ? ' (đã qua)'
      : (taken && !isCurrent)
        ? (bookedName ? ` (đã chọn lịch · ${bookedName})` : ' (đã chọn lịch)')
        : '',
  };
}

export function isSlotTakenByOther(schedules, teacherId, dateKey, startTime, excludeScheduleId, endTime) {
  const start = normalizeTimeHHmm(startTime, '');
  if (!start) return false;
  const end = endTime || endTimeFromStart(start);
  return Boolean(findTeacherScheduleConflict({
    schedules,
    teacherId,
    date: dateKey,
    startTime: start,
    endTime: end,
    excludeScheduleId,
  }));
}

export function slotValueFromSchedule(sch) {
  if (!sch) return '';
  const start = normalizeTimeHHmm(sch.startTime, '');
  if (!start) return '';
  const known = WEEK_SLOT_OPTIONS.some((o) => o.value === start);
  return known ? start : start;
}

export function extraSlotOption(sch) {
  if (!sch) return null;
  const start = normalizeTimeHHmm(sch.startTime, '');
  if (!start) return null;
  if (WEEK_SLOT_OPTIONS.some((o) => o.value === start)) return null;
  const end = sch.endTime ? normalizeTimeHHmm(sch.endTime, '') : '';
  return {
    start,
    end,
    value: start,
    label: end ? `${start} - ${end}` : start,
  };
}

export function slotEndForStart(start, sch) {
  if (!start) return '';
  const known = WEEK_SLOT_OPTIONS.find((o) => o.value === start);
  if (known?.end) return known.end;
  const extra = extraSlotOption(sch);
  if (extra?.end) return extra.end;
  if (sch?.endTime) return normalizeTimeHHmm(sch.endTime, '') || endTimeFromStart(start);
  return endTimeFromStart(start);
}

function rowKeyOf(student) {
  return String(student?._enrollmentKey || student?._id || student?.id || '');
}

function studentLabel(student, sch) {
  return String(
    student?.displayName
    || student?.name
    || sch?.studentName
    || '',
  ).trim();
}

/** Ca của hàng HV khác cùng ngày (đã lưu + hold vừa chọn) — khóa trùng trên lưới. */
export function otherTeacherRowRanges({
  rows,
  schedules,
  dateKey,
  excludeRowKey,
  holds,
} = {}) {
  const ranges = [];
  for (const student of rows || []) {
    const rk = rowKeyOf(student);
    if (rk && rk === excludeRowKey) continue;
    const hold = holds?.[`${rk}|${dateKey}`];
    if (hold?.start) {
      ranges.push({
        start: hold.start,
        end: hold.end || slotEndForStart(hold.start),
        studentName: hold.studentName || studentLabel(student),
      });
      continue;
    }
    const sid = String(student?._id || student?.id || '');
    const dayOccupying = findStudentDayOccupying(schedules, sid, dateKey);
    const own = occupyingMatchesCourse(dayOccupying, student.course) ? dayOccupying : null;
    const start = slotValueFromSchedule(own);
    if (!start) continue;
    ranges.push({
      start,
      end: slotEndForStart(start, own),
      studentName: studentLabel(student, own),
    });
  }
  return ranges;
}

export function rangesOverlapAny(start, end, ranges) {
  if (!start) return false;
  const e = end || endTimeFromStart(start);
  return (ranges || []).some((r) => (
    r?.start && timeRangesOverlap(start, e, r.start, r.end || endTimeFromStart(r.start))
  ));
}
