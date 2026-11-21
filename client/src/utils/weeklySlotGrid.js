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
} from './scheduleTime.js';

export const TEACHER_WEEKLY_SLOT_GRID_EXPERIMENT = true;
export const SHOW_TEACHER_MONTHLY_CALENDAR = false;

export const CUSTOM_SLOT_SENTINEL = '__custom__';
export const CUSTOM_SLOT_OPTION_LABEL = 'Tự chọn giờ...';

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
  const key = normalizeScheduleDate(input);
  const [year, month, dayOfMonth] = key.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, dayOfMonth, 12));
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + n);
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

/** Ca hôm nay đã hết (qua giờ kết thúc) - không xếp mới. Ca đang diễn ra vẫn được. */
export function isWeekSlotElapsed(dateKey, startTime, endTime, now = new Date(), todayKeyOverride = '') {
  const day = normalizeScheduleDate(dateKey);
  const today = todayKeyOverride || formatLocalDateKey(now);
  if (!day || day !== today) return false;
  const start = normalizeTimeHHmm(startTime, '');
  if (!start) return false;
  const end = endTime || endTimeFromStart(start);
  const endMins = parseTimeToMinutes(end);
  if (endMins == null) return false;
  const nowMins = now.getHours() * 60 + now.getMinutes();
  return nowMins >= endMins;
}

export function normalizeSlotEnd(rawEnd) {
  const raw = String(rawEnd ?? '').trim();
  if (!raw) return '';
  if (raw === '24:00') return '23:59';
  return normalizeTimeHHmm(raw, '');
}

export function formatSlotRangeLabel(start, end) {
  const s = normalizeTimeHHmm(start, '');
  const e = normalizeSlotEnd(end);
  if (!s) return '';
  if (!e) return s;
  const displayEnd = s === '22:30' && e === '23:59' ? '24:00' : e;
  return `${s} - ${displayEnd}`;
}

export function encodeSlotValue(start, end) {
  const s = normalizeTimeHHmm(start, '');
  if (!s) return '';
  const e = normalizeSlotEnd(end) || endTimeFromStart(s);
  const matchedPreset = WEEK_SLOT_OPTIONS.find((o) => o.start === s && o.end === e);
  if (matchedPreset) return matchedPreset.value;
  return `${s}|${e}`;
}

export function parseSlotValue(value, sch = null) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === CUSTOM_SLOT_SENTINEL) return { start: '', end: '' };
  if (raw.includes('|')) {
    const [rawStart, rawEnd] = raw.split('|');
    const start = normalizeTimeHHmm(rawStart, '');
    if (!start) return { start: '', end: '' };
    const end = normalizeSlotEnd(rawEnd) || normalizeSlotEnd(sch?.endTime) || endTimeFromStart(start);
    return { start, end };
  }
  const start = normalizeTimeHHmm(raw, '');
  if (!start) return { start: '', end: '' };
  const known = WEEK_SLOT_OPTIONS.find((o) => o.value === start);
  if (known) return { start: known.start, end: known.end };
  const end = normalizeSlotEnd(sch?.endTime) || endTimeFromStart(start);
  return { start, end };
}

export function weekSlotSelectMeta(opt, dateKey, {
  schedules,
  conflictSchedules,
  teacherId,
  excludeScheduleId,
  now,
  currentValue,
  extraTakenRanges,
} = {}) {
  const parsed = parseSlotValue(opt?.value);
  const start = opt.start || parsed.start;
  const optEnd = opt.end || parsed.end || endTimeFromStart(start);
  const elapsed = isWeekSlotElapsed(dateKey, start, optEnd, now);
  const isCurrent = String(currentValue || '') === String(opt.value);
  let holdMatch = null;
  if (!elapsed) {
    holdMatch = (extraTakenRanges || []).find((r) => (
      r?.start && timeRangesOverlap(start, optEnd, r.start, r.end || endTimeFromStart(r.start))
    )) || null;
  }
  const clash = (!elapsed && !holdMatch)
    ? findTeacherScheduleConflict({
      schedules: conflictSchedules || schedules,
      teacherId,
      date: dateKey,
      startTime: start,
      endTime: optEnd,
      excludeScheduleId,
    })
    : null;
  const taken = Boolean(holdMatch || clash);
  const bookedName = (!elapsed && taken && !isCurrent)
    ? String(holdMatch?.studentName || clash?.studentName || clash?.studentId?.name || '').trim()
    : '';
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
  const end = normalizeSlotEnd(sch.endTime) || endTimeFromStart(start);
  return encodeSlotValue(start, end);
}

export function extraSlotOptionFromValue(value, sch = null) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === CUSTOM_SLOT_SENTINEL) return null;
  if (WEEK_SLOT_OPTIONS.some((o) => o.value === raw)) return null;
  const { start, end } = parseSlotValue(raw, sch);
  if (!start) return null;
  const encoded = encodeSlotValue(start, end);
  if (WEEK_SLOT_OPTIONS.some((o) => o.value === encoded)) return null;
  return {
    start,
    end,
    value: encoded,
    label: formatSlotRangeLabel(start, end),
  };
}

export function extraSlotOption(sch) {
  if (!sch) return null;
  return extraSlotOptionFromValue(slotValueFromSchedule(sch), sch);
}

export function slotEndForStart(slotVal, sch) {
  if (!slotVal || slotVal === CUSTOM_SLOT_SENTINEL) return '';
  return parseSlotValue(slotVal, sch).end;
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

/** Ca của hàng HV khác cùng ngày (đã lưu + hold vừa chọn) - khóa trùng trên lưới. */
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
      const parsedHold = parseSlotValue(hold.start);
      const start = parsedHold.start || normalizeTimeHHmm(hold.start, '');
      const end = normalizeSlotEnd(hold.end) || parsedHold.end || endTimeFromStart(start);
      ranges.push({
        start,
        end,
        studentName: hold.studentName || studentLabel(student),
      });
      continue;
    }
    const sid = String(student?._id || student?.id || '');
    const dayOccupying = findStudentDayOccupying(schedules, sid, dateKey);
    const own = occupyingMatchesCourse(dayOccupying, student.course) ? dayOccupying : null;
    const slotVal = slotValueFromSchedule(own);
    if (!slotVal) continue;
    const { start, end } = parseSlotValue(slotVal, own);
    if (!start) continue;
    ranges.push({
      start,
      end,
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
