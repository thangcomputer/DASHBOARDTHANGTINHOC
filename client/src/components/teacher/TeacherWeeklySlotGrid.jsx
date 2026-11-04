import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Search, Table2, Users, X } from 'lucide-react';
import { useToast } from '../../utils/useToast';
import {
  findTeacherScheduleConflict,
  formatTeacherConflictMessage,
  formatLocalDateKey,
  normalizeScheduleDate,
  isScheduleDateBeforeToday,
  parseTimeToMinutes,
} from '../../utils/scheduleTime';
import { getStudentScheduleGate } from '../../utils/schedulingLimits';
import {
  WEEKDAY_LABELS,
  WEEK_SLOT_OPTIONS,
  startOfWeekMonday,
  addDays,
  weekDateKeys,
  formatWeekRangeLabel,
  findStudentDayOccupying,
  occupyingMatchesCourse,
  isWeekSlotElapsed,
  weekSlotSelectMeta,
  slotValueFromSchedule,
  extraSlotOption,
  slotEndForStart,
  otherTeacherRowRanges,
  rangesOverlapAny,
} from '../../utils/weeklySlotGrid';

const LOCKED_STATUSES = new Set(['completed', 'no_show']);
const CLEAR_REASON = 'Bỏ ca từ bảng tuần lịch';
/** Số HV hiện mặc định trên bảng tuần; bấm «Xem thêm» để hiện hết. */
const ROSTER_PAGE_SIZE = 8;

function isDroppedStudent(student) {
  if (!student) return true;
  if (student.interactionLocked) return true;
  const st = String(student.enrollmentStatus || student.status || '').toLowerCase();
  return st === 'cancelled'
    || st === 'refunded'
    || st === 'thôi học'
    || st === 'paused'
    || st === 'pending_payment';
}

function isFinishedEnrollment(student) {
  const st = String(student?.enrollmentStatus || student?.status || '').toLowerCase();
  if (st === 'completed' || st === 'hoàn thành') return true;
  const totalSessions = Number(student?.totalSessions) > 0
    ? Number(student.totalSessions)
    : 12;
  const completedSessions = student?.completedSessions != null
    ? Math.max(0, Number(student.completedSessions) || 0)
    : Math.max(0, totalSessions - (Number(student?.remainingSessions) || 0));
  return completedSessions >= totalSessions;
}

function studentRowKey(student) {
  return String(student?._enrollmentKey || student?._id || student?.id || '');
}

function studentDisplayName(student) {
  return String(student?.displayName || student?.name || '');
}

function courseLabel(course) {
  if (typeof course === 'string') return course.trim();
  if (!course || typeof course !== 'object') return '';
  return String(course.courseName || course.name || course.title || '').trim();
}

function compareStudentNames(a, b, dir = 'asc') {
  const cmp = studentDisplayName(a).localeCompare(studentDisplayName(b), 'vi', { sensitivity: 'base' });
  return dir === 'desc' ? -cmp : cmp;
}

function rowSlotMinutes(student, dateKey, schedules) {
  const sid = studentIdOf(student);
  const dayOccupying = findStudentDayOccupying(schedules, sid, dateKey);
  const own = occupyingMatchesCourse(dayOccupying, student.course) ? dayOccupying : null;
  const start = slotValueFromSchedule(own);
  if (!start) return null;
  return parseTimeToMinutes(start);
}

function studentIdOf(student) {
  return String(student?._id || student?.id || '');
}

function scheduleIdOf(sch) {
  return String(sch?._id || sch?.id || '');
}

export default function TeacherWeeklySlotGrid({
  students = [],
  teacherId,
  mySchedules = [],
  allSchedules,
  addSchedule,
  updateSchedule,
  cancelSchedule,
}) {
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [busyKey, setBusyKey] = useState('');
  const [rosterFilter, setRosterFilter] = useState('studying');
  const [courseFilter, setCourseFilter] = useState('');
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [nameQuery, setNameQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [sort, setSort] = useState({ kind: 'name', dir: 'asc', dayIndex: 0 });
  const [sortMenuDayIndex, setSortMenuDayIndex] = useState(null);
  const [rosterExpanded, setRosterExpanded] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!coursePickerOpen && sortMenuDayIndex == null) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setCoursePickerOpen(false);
      setSortMenuDayIndex(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [coursePickerOpen, sortMenuDayIndex]);

  const schedules = allSchedules || mySchedules;
  const schedulesRef = useRef(schedules);
  schedulesRef.current = schedules;
  const holdsRef = useRef({});
  const [slotHolds, setSlotHolds] = useState({});
  const todayKey = formatLocalDateKey(new Date());
  const dateKeys = useMemo(() => weekDateKeys(weekStart), [weekStart]);

  const eligibleRosterRows = useMemo(
    () => (students || []).filter((student) => !isDroppedStudent(student)),
    [students],
  );
  const courseOptions = useMemo(
    () => [...new Set(eligibleRosterRows.flatMap((student) => [
      ...(Array.isArray(student.courses) ? student.courses : []),
      ...(Array.isArray(student.enrollments) ? student.enrollments.map((enrollment) => enrollment.courseName) : []),
      student.course,
    ]).map(courseLabel).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'vi')),
    [eligibleRosterRows],
  );

  const rosterRows = useMemo(() => {
    return eligibleRosterRows.filter((s) => {
      if (courseFilter) {
        const courses = [
          s.course,
          ...(Array.isArray(s.courses) ? s.courses : []),
          ...(Array.isArray(s.enrollments) ? s.enrollments.map((enrollment) => enrollment.courseName) : []),
        ].map(courseLabel);
        if (!courses.includes(courseFilter)) return false;
      }
      const finished = isFinishedEnrollment(s);
      if (rosterFilter === 'studying') return !finished;
      if (rosterFilter === 'finished') return finished;
      return true;
    });
  }, [eligibleRosterRows, courseFilter, rosterFilter]);

  const rosterCounts = useMemo(() => ({
    studying: eligibleRosterRows.filter((student) => !isFinishedEnrollment(student)).length,
    finished: eligibleRosterRows.filter(isFinishedEnrollment).length,
    all: eligibleRosterRows.length,
  }), [eligibleRosterRows]);

  const rows = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    const list = rosterRows.filter((s) => {
      if (!q) return true;
      return `${studentDisplayName(s)} ${s.course || ''}`.toLocaleLowerCase('vi-VN').includes(q);
    });
    const sorted = list.slice();
    if (sort.kind === 'day') {
      const dateKey = dateKeys[sort.dayIndex];
      sorted.sort((a, b) => {
        const ma = dateKey ? rowSlotMinutes(a, dateKey, schedules) : null;
        const mb = dateKey ? rowSlotMinutes(b, dateKey, schedules) : null;
        if (ma == null && mb == null) return compareStudentNames(a, b);
        if (ma == null) return 1;
        if (mb == null) return -1;
        const diff = sort.dir === 'desc' ? mb - ma : ma - mb;
        if (diff !== 0) return diff;
        return compareStudentNames(a, b);
      });
    } else {
      sorted.sort((a, b) => compareStudentNames(a, b, sort.dir || 'asc'));
    }
    return sorted;
  }, [rosterRows, nameQuery, sort, schedules, dateKeys]);

  // Đổi lọc / tìm / sắp xếp → thu gọn lại về 8 HV
  useEffect(() => {
    setRosterExpanded(false);
  }, [rosterFilter, nameQuery, sort.kind, sort.dir, sort.dayIndex]);

  const visibleRows = useMemo(() => {
    if (rosterExpanded || rows.length <= ROSTER_PAGE_SIZE) return rows;
    return rows.slice(0, ROSTER_PAGE_SIZE);
  }, [rows, rosterExpanded]);

  const studentScheduleIndex = useMemo(() => {
    const byStudent = new Map();
    const byStudentDay = new Map();
    for (const schedule of schedules || []) {
      const sid = studentIdOf(schedule);
      if (!sid) continue;
      if (!byStudent.has(sid)) byStudent.set(sid, []);
      byStudent.get(sid).push(schedule);
      const dayKey = normalizeScheduleDate(schedule.date);
      if (dayKey) byStudentDay.set(`${sid}|${dayKey}`, schedule);
    }
    return { byStudent, byStudentDay };
  }, [schedules]);

  const teacherSchedulesByDate = useMemo(() => {
    const byDate = new Map();
    const tid = String(teacherId || '');
    for (const schedule of schedules || []) {
      const scheduleTeacherId = String(
        schedule?.teacherId?._id
        || schedule?.teacherId?.id
        || schedule?.teacherId
        || '',
      );
      if (tid && scheduleTeacherId !== tid) continue;
      const dayKey = normalizeScheduleDate(schedule.date);
      if (!dayKey) continue;
      if (!byDate.has(dayKey)) byDate.set(dayKey, []);
      byDate.get(dayKey).push(schedule);
    }
    return byDate;
  }, [schedules, teacherId]);

  const otherTeacherRangesByDate = useMemo(() => {
    const map = new Map();
    for (const dateKey of dateKeys) {
      const ranges = [];
      for (const student of rosterRows) {
        const rowKey = studentRowKey(student);
        const hold = slotHolds?.[`${rowKey}|${dateKey}`];
        if (hold?.start) {
          ranges.push({
            rowKey,
            start: hold.start,
            end: hold.end || slotEndForStart(hold.start),
            studentName: hold.studentName || studentDisplayName(student),
          });
          continue;
        }
        const dayOccupying = studentScheduleIndex.byStudentDay.get(
          `${studentIdOf(student)}|${dateKey}`,
        );
        const own = occupyingMatchesCourse(dayOccupying, student.course) ? dayOccupying : null;
        const start = slotValueFromSchedule(own);
        if (start) {
          ranges.push({
            rowKey,
            start,
            end: slotEndForStart(start, own),
            studentName: studentDisplayName(student),
          });
        }
      }
      map.set(dateKey, ranges);
    }
    return map;
  }, [dateKeys, rosterRows, studentScheduleIndex, slotHolds]);

  const hiddenCount = Math.max(0, rows.length - ROSTER_PAGE_SIZE);
  const showRosterToggle = hiddenCount > 0;

  const goPrev = () => setWeekStart((d) => addDays(startOfWeekMonday(d), -7));
  const goNext = () => setWeekStart((d) => addDays(startOfWeekMonday(d), 7));
  const goThisWeek = () => setWeekStart(startOfWeekMonday(new Date()));

  const handleSlotChange = useCallback(async (student, dateKey, nextStart) => {
    const cellKey = `${studentRowKey(student)}|${dateKey}`;
    if (busyKey === cellKey) return;

    const live = schedulesRef.current || [];
    const sid = studentIdOf(student);
    const dayOccupying = findStudentDayOccupying(live, sid, dateKey);
    const own = occupyingMatchesCourse(dayOccupying, student.course) ? dayOccupying : null;
    const existingId = own ? scheduleIdOf(own) : '';

    if (isScheduleDateBeforeToday(dateKey)) {
      toast.error('Không thể sửa lịch đã qua ngày.');
      return;
    }
    if (own && LOCKED_STATUSES.has(String(own.status))) {
      toast.info('Buổi đã điểm danh — không đổi giờ từ bảng này.');
      return;
    }
    if (dayOccupying && !own) {
      toast.info(`Học viên đã có ca khóa khác trong ngày (${dayOccupying.course || 'khác'}).`);
      return;
    }

    const currentStart = slotValueFromSchedule(own);
    if (String(nextStart || '') === String(currentStart || '')) return;

    const publishHolds = () => setSlotHolds({ ...holdsRef.current });
    const prevHold = holdsRef.current[cellKey];

    setBusyKey(cellKey);
    try {
      if (!nextStart) {
        if (!own || String(own.status) !== 'scheduled') return;
        delete holdsRef.current[cellKey];
        publishHolds();
        await cancelSchedule(existingId, CLEAR_REASON);
        toast.success('Đã bỏ ca');
        return;
      }

      const endTime = slotEndForStart(nextStart, own);

      if (isWeekSlotElapsed(dateKey, nextStart, endTime)) {
        toast.error('Ca này đã kết thúc — chỉ xếp khung giờ hiện tại trở đi.');
        return;
      }

      const otherRanges = otherTeacherRowRanges({
        rows: rosterRows,
        schedules: live,
        dateKey,
        excludeRowKey: studentRowKey(student),
        holds: holdsRef.current,
      });
      if (rangesOverlapAny(nextStart, endTime, otherRanges)) {
        toast.error('Giảng viên đã có lịch trùng thời gian này. Vui lòng chọn khung giờ khác.');
        return;
      }

      const teacherConflict = findTeacherScheduleConflict({
        schedules: live,
        teacherId,
        date: dateKey,
        startTime: nextStart,
        endTime,
        excludeScheduleId: existingId || null,
      });
      if (teacherConflict) {
        toast.error(formatTeacherConflictMessage(teacherConflict));
        return;
      }

      holdsRef.current[cellKey] = {
        dateKey,
        start: nextStart,
        end: endTime,
        studentName: student.displayName || student.name || '',
      };
      publishHolds();

      if (own && String(own.status) === 'scheduled') {
        const res = await updateSchedule(existingId, {
          date: dateKey,
          startTime: nextStart,
          endTime,
        });
        if (res?.success === false) throw new Error(res.message);
        toast.success('Đã đổi khung giờ');
        return;
      }

      const gate = getStudentScheduleGate(student, live, dateKey, null);
      if (!gate.canSchedule) {
        throw new Error(gate.reason || 'Không xếp thêm được ca');
      }

      const res = await addSchedule({
        studentId: sid,
        teacherId,
        date: dateKey,
        startTime: nextStart,
        endTime,
        course: student.course || '',
        topic: '',
        note: '',
      });
      if (!res?.success) throw new Error(res?.message || 'Không thể xếp lịch');
      toast.success('Đã xếp lịch');
    } catch (err) {
      if (prevHold) holdsRef.current[cellKey] = prevHold;
      else delete holdsRef.current[cellKey];
      publishHolds();
      toast.error(err?.message || 'Không cập nhật được lịch');
    } finally {
      setBusyKey('');
    }
  }, [busyKey, rosterRows, teacherId, addSchedule, updateSchedule, cancelSchedule, toast]);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl">
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-3 sm:px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-red-50 text-red-600">
          <Table2 size={18} />
        </div>
        <h3 className="text-sm font-black tracking-tight text-slate-900 sm:text-base">
          Xếp lịch học viên theo tuần
        </h3>
      </div>

      <div className="m-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2 sm:m-4 sm:p-3">
        <div className="flex items-center gap-1.5">
          <Users size={14} className="shrink-0 text-slate-500" />
          <span className="text-xs font-black tracking-wide text-slate-500">Lọc học viên</span>
          <span className="ml-auto text-xs font-extrabold text-red-700">{rows.length} học viên</span>
        </div>
        <div className="flex w-full items-center gap-1">
          {[
            { id: 'studying', label: 'Đang học' },
            { id: 'finished', label: 'Học xong' },
            { id: 'all', label: 'Tất cả' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setRosterFilter(opt.id)}
              className={`flex min-h-[34px] min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border px-1 text-xs font-extrabold transition sm:text-xs ${
                rosterFilter === opt.id
                  ? 'border-red-600 bg-red-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-500 hover:text-red-700'
              }`}
              aria-pressed={rosterFilter === opt.id}
            >
              <span className="truncate">{opt.label}</span>
              <span className={rosterFilter === opt.id ? 'text-rose-100' : 'text-slate-400'}>
                {rosterCounts[opt.id]}
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              if (searchOpen) setNameQuery('');
              setSearchOpen((open) => !open);
            }}
            className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border ${
              searchOpen ? 'border-red-200 bg-red-50' : 'border-blue-100 bg-blue-50'
            } text-red-600`}
            aria-label={searchOpen ? 'Đóng tìm kiếm học viên' : 'Tìm học viên'}
            aria-expanded={searchOpen}
          >
            {searchOpen ? <X size={15} /> : <Search size={15} />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => setCoursePickerOpen(true)}
          aria-label={`Chọn khóa học, hiện tại ${courseFilter || 'Tất cả khóa học'}`}
          aria-haspopup="dialog"
          aria-expanded={coursePickerOpen}
          className="flex min-h-[38px] w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 text-left"
        >
          <span className="shrink-0 text-xs font-bold text-slate-500">Khóa học</span>
          <span className="min-w-0 flex-1 truncate text-center text-xs font-extrabold text-red-700">
            {courseFilter || 'Tất cả khóa học'}
          </span>
          <ChevronDown size={16} className="shrink-0 text-red-600" aria-hidden="true" />
        </button>
        {searchOpen ? (
          <input
            type="search"
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            placeholder="Lọc tên học viên"
            aria-label="Lọc theo tên học viên"
            autoFocus
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-red-300"
          />
        ) : null}
      </div>

      <div className="mx-3 flex min-h-9 items-center justify-between border border-b-0 border-slate-200 bg-rose-50/70 px-1 sm:mx-4">
        <button
          type="button"
          onClick={goPrev}
          className="flex h-8 w-8 items-center justify-center text-red-600"
          aria-label="Tuần trước"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          onClick={goThisWeek}
          className="px-2 text-xs font-extrabold text-red-700"
          aria-label="Về tuần hiện tại"
        >
          {formatWeekRangeLabel(weekStart)}
        </button>
        <button
          type="button"
          onClick={goNext}
          className="flex h-8 w-8 items-center justify-center text-red-600"
          aria-label="Tuần sau"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mx-3 mb-3 overflow-x-auto sm:mx-4 sm:mb-4">
        <table className="w-full min-w-[43rem] table-fixed border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="sticky left-0 z-10 w-[8rem] min-w-[8rem] border-b border-r border-slate-200 bg-slate-50 px-1.5 py-2 text-slate-700 align-bottom sm:px-2">
                <div className="text-center text-xs font-black tracking-wide">Học viên</div>
                <select
                  value={sort.kind === 'name' ? sort.dir : ''}
                  onChange={(e) => {
                    const dir = e.target.value === 'desc' ? 'desc' : 'asc';
                    setSort({ kind: 'name', dir, dayIndex: 0 });
                  }}
                  aria-label="Sắp xếp theo tên"
                  title="Sắp xếp theo tên A–Z hoặc Z–A"
                  className={`mt-1 h-7 w-full rounded-md border bg-white px-1 text-xs font-semibold text-slate-600 outline-none ${
                    sort.kind === 'name' ? 'border-red-300 text-red-700' : 'border-slate-200'
                  }`}
                >
                  {sort.kind !== 'name' && <option value="">Tên</option>}
                  <option value="asc">A–Z</option>
                  <option value="desc">Z–A</option>
                </select>
              </th>
              {dateKeys.map((key, i) => {
                const isToday = key === todayKey;
                const past = isScheduleDateBeforeToday(key);
                const dayActive = sort.kind === 'day' && sort.dayIndex === i;
                return (
                  <th
                    key={key}
                    className={`w-[5rem] min-w-[5rem] border-b border-r border-slate-200 px-0.5 py-1.5 text-center align-bottom ${
                      isToday ? 'bg-red-50/80' : ''
                    }`}
                  >
                    <div className={`${past ? 'opacity-70' : ''}`}>
                      <div className={`text-xs font-black ${isToday ? 'text-red-700' : 'text-slate-700'}`}>
                        {WEEKDAY_LABELS[i]}
                      </div>
                      <div className={`text-xs font-semibold ${isToday ? 'text-red-500' : 'text-slate-400'}`}>
                        {key.slice(8, 10)}/{key.slice(5, 7)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSortMenuDayIndex(i)}
                      aria-label={`Chọn sắp xếp lịch theo giờ ${WEEKDAY_LABELS[i]}`}
                      aria-haspopup="dialog"
                      className={`mt-0.5 flex h-6 w-full items-center justify-center gap-0.5 rounded-md border px-1 text-xs font-semibold ${
                        dayActive ? 'border-blue-200 bg-blue-50 text-red-700' : 'border-transparent text-slate-500 hover:bg-white'
                      }`}
                    >
                      <span>{dayActive ? (sort.dir === 'asc' ? '↑' : '↓') : 'Giờ'}</span>
                      {!dayActive ? <ChevronDown size={10} aria-hidden="true" /> : null}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm font-medium text-slate-400">
                  {nameQuery.trim()
                    ? 'Không tìm thấy học viên khớp tên'
                    : rosterFilter === 'finished'
                      ? 'Không có học viên học xong trên bảng này'
                      : rosterFilter === 'all'
                        ? 'Chưa có học viên để xếp trên bảng này'
                        : 'Chưa có học viên đang học để xếp trên bảng này'}
                </td>
              </tr>
            )}
            {visibleRows.map((student) => {
              const totalSessions = Number(student?.totalSessions) > 0
                ? Number(student.totalSessions)
                : 12;
              const displayDone = student?.completedSessions != null
                ? Math.max(0, Number(student.completedSessions) || 0)
                : Math.max(0, totalSessions - (Number(student?.remainingSessions) || 0));
              const name = student.displayName || student.name || 'Học viên';
              return (
                <tr key={studentRowKey(student)} className="border-b border-slate-100 last:border-b-0">
                  <td className="sticky left-0 z-10 h-[4.5rem] w-[8rem] min-w-[8rem] border-r border-slate-200 bg-white px-1.5 py-2 align-middle sm:px-2">
                    <p className="text-xs font-bold text-slate-900 truncate" title={name}>{name}</p>
                    <p className="line-clamp-2 text-xs font-medium text-slate-500">
                      {student.course || '—'}
                    </p>
                    <p className="text-xs font-medium text-slate-400">
                      {displayDone}/{totalSessions} buổi
                    </p>
                  </td>
                  {dateKeys.map((dateKey) => (
                    <SlotCell
                      key={dateKey}
                      student={student}
                      dateKey={dateKey}
                      schedules={schedules}
                      studentSchedules={studentScheduleIndex.byStudent.get(studentIdOf(student)) || []}
                      dayOccupying={studentScheduleIndex.byStudentDay.get(`${studentIdOf(student)}|${dateKey}`) || null}
                      teacherSchedulesForDate={teacherSchedulesByDate.get(dateKey) || []}
                      teacherId={teacherId}
                      busy={busyKey === `${studentRowKey(student)}|${dateKey}`}
                      isToday={dateKey === todayKey}
                      now={now}
                                      extraTakenRanges={otherTeacherRangesByDate.get(dateKey) || []}
                      onChange={handleSlotChange}
                    />
                  ))}
                </tr>
              );
            })}
            {showRosterToggle ? (
              <tr className="border-b border-slate-100">
                <td colSpan={8} className="sticky left-0 z-10 bg-slate-50/90 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setRosterExpanded((v) => !v)}
                    className="text-xs font-black text-red-600 hover:text-red-700 hover:underline  tracking-wide"
                  >
                    {rosterExpanded
                      ? 'Thu gọn'
                      : `Xem thêm ${hiddenCount} học viên`}
                  </button>
                  <span className="ml-2 text-xs font-semibold text-slate-400">
                    ({rosterExpanded ? rows.length : ROSTER_PAGE_SIZE}/{rows.length})
                  </span>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {coursePickerOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setCoursePickerOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-course-picker-title"
            className="flex max-h-[min(80vh,36rem)] w-full max-w-md flex-col gap-1 rounded-2xl bg-white p-3 shadow-2xl sm:p-4"
          >
            <header className="mb-1 flex items-center gap-2.5 border-b border-slate-200 pb-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <BookOpen size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span id="teacher-course-picker-title" className="block text-sm font-black text-slate-900">Chọn khóa học</span>
                <span className="block text-xs text-slate-500">Lọc học viên theo khóa</span>
              </span>
              <button
                type="button"
                onClick={() => setCoursePickerOpen(false)}
                aria-label="Đóng chọn khóa học"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </header>
            <div className="overflow-y-auto">
              {['', ...courseOptions].map((course) => {
                const selected = courseFilter === course;
                return (
                  <button
                    key={course || 'all-courses'}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => {
                      setCourseFilter(course);
                      setCoursePickerOpen(false);
                    }}
                    className={`flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl px-2 text-left text-xs font-bold transition ${
                      selected ? 'bg-blue-50 text-red-700' : 'text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span>{course || 'Tất cả khóa học'}</span>
                    {selected ? <Check size={17} className="shrink-0 text-red-600" /> : null}
                  </button>
                );
              })}
            </div>
          </section>
        </div>,
        document.body,
      )}
      {sortMenuDayIndex != null && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-950/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSortMenuDayIndex(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="teacher-hour-sort-title"
            className="w-full max-w-md rounded-2xl bg-white p-3 shadow-2xl sm:p-4"
          >
            <header className="mb-1 flex items-center gap-2.5 border-b border-slate-200 pb-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                <Table2 size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span id="teacher-hour-sort-title" className="block text-sm font-black text-slate-900">Sắp xếp theo giờ</span>
                <span className="block text-xs text-slate-500">
                  {WEEKDAY_LABELS[sortMenuDayIndex]} · {dateKeys[sortMenuDayIndex]?.slice(8, 10)}/{dateKeys[sortMenuDayIndex]?.slice(5, 7)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setSortMenuDayIndex(null)}
                aria-label="Đóng sắp xếp"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </header>
            {[
              { value: 'none', label: 'Không sắp xếp theo giờ' },
              { value: 'asc', label: 'Giờ tăng dần · thấp đến cao' },
              { value: 'desc', label: 'Giờ giảm dần · cao đến thấp' },
            ].map((option) => {
              const selected = option.value === 'none'
                ? sort.kind !== 'day' || sort.dayIndex !== sortMenuDayIndex
                : sort.kind === 'day' && sort.dayIndex === sortMenuDayIndex && sort.dir === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    if (option.value === 'none') setSort({ kind: 'name', dir: 'asc', dayIndex: 0 });
                    else setSort({ kind: 'day', dir: option.value, dayIndex: sortMenuDayIndex });
                    setSortMenuDayIndex(null);
                  }}
                  className={`flex min-h-[46px] w-full items-center justify-between gap-3 rounded-xl px-2 text-left text-xs font-bold transition ${
                    selected ? 'bg-blue-50 text-red-700' : 'text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <span>{option.label}</span>
                  {selected ? <Check size={17} className="shrink-0 text-red-600" /> : null}
                </button>
              );
            })}
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}

function SlotCell({
  student,
  dateKey,
  schedules,
  studentSchedules,
  dayOccupying: indexedDayOccupying,
  teacherSchedulesForDate,
  teacherId,
  busy,
  isToday,
  now,
  extraTakenRanges,
  onChange,
}) {
  const past = isScheduleDateBeforeToday(dateKey);
  const sid = studentIdOf(student);
  const dayOccupying = indexedDayOccupying || findStudentDayOccupying(schedules, sid, dateKey);
  const own = occupyingMatchesCourse(dayOccupying, student.course) ? dayOccupying : null;
  const otherCourse = Boolean(dayOccupying && !own);
  const existingId = own ? scheduleIdOf(own) : '';
  const lockedDone = Boolean(own && LOCKED_STATUSES.has(String(own.status)));
  const extra = extraSlotOption(own);
  const slotValue = slotValueFromSchedule(own);
  const gate = getStudentScheduleGate(student, studentSchedules || schedules, dateKey, existingId || null);

  const options = extra ? [extra, ...WEEK_SLOT_OPTIONS] : WEEK_SLOT_OPTIONS;
  const dayTd = `h-[4.5rem] min-w-0 border-b border-r border-slate-200 px-1 py-1 ${isToday ? 'bg-red-50/50' : ''}`;

  if (otherCourse) {
    return (
      <td className={dayTd}>
        <div
          className="flex min-h-11 w-full items-center justify-center px-1 text-xs font-semibold leading-tight text-slate-400"
          title={`Đã có ca khóa ${dayOccupying.course || 'khác'} ${slotValueFromSchedule(dayOccupying) || ''}`}
        >
          Ca khác
        </div>
      </td>
    );
  }

  if (past || lockedDone) {
    const label = own
      ? (extra?.label || WEEK_SLOT_OPTIONS.find((o) => o.value === slotValue)?.label || slotValue)
      : '—';
    const tone = String(own?.status) === 'completed'
      ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
      : own
        ? 'bg-slate-50 border-slate-100 text-slate-500'
        : 'bg-transparent border-transparent text-slate-300';
    return (
      <td className={dayTd}>
        <div className={`flex min-h-11 w-full items-center justify-center px-1 text-xs font-bold text-center ${tone}`}>
          {label}
        </div>
      </td>
    );
  }

  const rowKey = studentRowKey(student);
  const otherRanges = (extraTakenRanges || []).filter((range) => range.rowKey !== rowKey);
  const canCreate = !own && gate.canSchedule;
  const disabledAll = busy || (!own && !canCreate);

  return (
    <td className={dayTd}>
      <select
        value={slotValue}
        disabled={disabledAll}
        data-native-select
        title={!own && !gate.canSchedule ? (gate.reason || 'Không xếp thêm được') : undefined}
        onChange={(e) => onChange(student, dateKey, e.target.value)}
        className={`min-h-11 w-full min-w-0 max-w-full appearance-none rounded-md border border-transparent bg-none bg-transparent px-0 text-center text-xs font-semibold outline-none hover:bg-white/70 focus:border-red-300 focus:bg-white ${
          own
            ? 'text-amber-700'
            : 'text-slate-600'
        } ${busy ? 'opacity-60' : ''} ${disabledAll ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <option value="">—</option>
        {options.map((opt) => {
          const meta = weekSlotSelectMeta(opt, dateKey, {
            schedules,
            conflictSchedules: teacherSchedulesForDate,
            teacherId,
            excludeScheduleId: existingId,
            now,
            currentValue: slotValue,
            extraTakenRanges: otherRanges,
          });
          if (meta.hidden) return null;
          return (
            <option key={opt.value} value={opt.value} disabled={meta.disabled}>
              {opt.label}{meta.suffix}
            </option>
          );
        })}
      </select>
    </td>
  );
}
