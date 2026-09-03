import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Table2 } from 'lucide-react';
import { useToast } from '../../utils/toast';
import {
  findTeacherScheduleConflict,
  formatTeacherConflictMessage,
  formatLocalDateKey,
  isScheduleDateBeforeToday,
  parseTimeToMinutes,
} from '../../utils/scheduleTime';
import { getStudentScheduleGate, resolveEnrollmentProgress } from '../../utils/schedulingLimits';
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

function isFinishedEnrollment(student, schedules) {
  const st = String(student?.enrollmentStatus || student?.status || '').toLowerCase();
  if (st === 'completed' || st === 'hoàn thành') return true;
  const progress = resolveEnrollmentProgress(student, schedules);
  return progress.displayDone >= progress.totalSessions;
}

function studentRowKey(student) {
  return String(student?._enrollmentKey || student?._id || student?.id || '');
}

function studentDisplayName(student) {
  return String(student?.displayName || student?.name || '');
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

const HEADER_CTRL = 'w-full min-w-0 max-w-full h-7 px-1.5 rounded-md border bg-white text-[10px] font-semibold text-slate-600 outline-none';

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
  const [nameQuery, setNameQuery] = useState('');
  const [sort, setSort] = useState({ kind: 'name', dir: 'asc', dayIndex: 0 });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const schedules = allSchedules || mySchedules;
  const schedulesRef = useRef(schedules);
  schedulesRef.current = schedules;
  const holdsRef = useRef({});
  const [slotHolds, setSlotHolds] = useState({});
  const todayKey = formatLocalDateKey(new Date());
  const dateKeys = useMemo(() => weekDateKeys(weekStart), [weekStart]);

  const rosterRows = useMemo(() => {
    return (students || []).filter((s) => {
      if (isDroppedStudent(s)) return false;
      const finished = isFinishedEnrollment(s, schedules);
      if (rosterFilter === 'studying') return !finished;
      if (rosterFilter === 'finished') return finished;
      return true;
    });
  }, [students, schedules, rosterFilter]);

  const rows = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    const list = rosterRows.filter((s) => {
      if (!q) return true;
      return studentDisplayName(s).toLowerCase().includes(q);
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
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-center px-4 sm:px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
            <Table2 size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              Xếp lịch dạy theo tuần
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Chọn khung giờ trong ô. Khung trùng giáo viên cùng ngày sẽ bị khóa.
            </p>
          </div>
        </div>
        <div className="flex justify-start lg:justify-center">
          <div className="flex rounded-xl border border-slate-200 p-0.5 bg-slate-50">
            {[
              { id: 'studying', label: 'Đang học' },
              { id: 'finished', label: 'Học xong' },
              { id: 'all', label: 'Tất cả' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRosterFilter(opt.id)}
                className={`px-2.5 h-8 rounded-lg text-[11px] font-bold transition ${
                  rosterFilter === opt.id
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-slate-500 hover:text-red-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-start lg:justify-end gap-1.5">
          <button
            type="button"
            onClick={goPrev}
            className="w-9 h-9 rounded-xl border-2 border-red-600 text-red-600 hover:bg-red-50 flex items-center justify-center"
            aria-label="Tuần trước"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={goThisWeek}
            className="px-3 h-9 rounded-xl border-2 border-red-600 text-xs font-bold text-red-600 hover:bg-red-50 min-w-[9.5rem]"
          >
            {formatWeekRangeLabel(weekStart)}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="w-9 h-9 rounded-xl border-2 border-red-600 text-red-600 hover:bg-red-50 flex items-center justify-center"
            aria-label="Tuần sau"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] table-fixed border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/80">
              <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2 text-slate-500 w-48 min-w-[11rem] border-b border-slate-100 align-bottom">
                <div className="text-[11px] font-black uppercase tracking-wide">Học viên</div>
                <input
                  type="search"
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  placeholder="Lọc tên"
                  aria-label="Lọc theo tên học viên"
                  className={`${HEADER_CTRL} mt-1.5 border-slate-200 font-medium normal-case tracking-normal`}
                />
                <select
                  value={sort.kind === 'name' ? sort.dir : ''}
                  onChange={(e) => {
                    const dir = e.target.value === 'desc' ? 'desc' : 'asc';
                    setSort({ kind: 'name', dir, dayIndex: 0 });
                  }}
                  aria-label="Sắp xếp theo tên"
                  title="Sắp xếp theo tên A–Z hoặc Z–A"
                  className={`${HEADER_CTRL} mt-1 normal-case tracking-normal ${
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
                    className={`px-2 py-2 text-center border-b border-slate-100 w-[7.5rem] align-bottom ${
                      isToday ? 'bg-red-50/80' : ''
                    }`}
                  >
                    <div className={`${past ? 'opacity-70' : ''}`}>
                      <div className={`text-[11px] font-black ${isToday ? 'text-red-700' : 'text-slate-600'}`}>
                        {WEEKDAY_LABELS[i]}
                      </div>
                      <div className={`text-[10px] font-semibold ${isToday ? 'text-red-500' : 'text-slate-400'}`}>
                        {key.slice(8, 10)}/{key.slice(5, 7)}
                      </div>
                    </div>
                    <select
                      value={dayActive ? sort.dir : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) {
                          setSort({ kind: 'name', dir: 'asc', dayIndex: 0 });
                          return;
                        }
                        setSort({
                          kind: 'day',
                          dir: v === 'desc' ? 'desc' : 'asc',
                          dayIndex: i,
                        });
                      }}
                      aria-label={`Sắp xếp theo giờ ${WEEKDAY_LABELS[i]}`}
                      title="Sắp xếp theo giờ: thấp đến cao hoặc cao đến thấp"
                      className={`${HEADER_CTRL} mt-1.5 ${
                        dayActive ? 'border-red-300 text-red-700' : 'border-slate-200'
                      }`}
                    >
                      <option value="">Giờ</option>
                      <option value="asc">Thấp→cao</option>
                      <option value="desc">Cao→thấp</option>
                    </select>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400 font-medium">
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
            {rows.map((student) => {
              const progress = resolveEnrollmentProgress(student, schedules);
              const name = student.displayName || student.name || 'Học viên';
              return (
                <tr key={studentRowKey(student)} className="border-b border-slate-100 last:border-b-0">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 align-middle">
                    <p className="text-xs font-bold text-slate-900 truncate" title={name}>{name}</p>
                    <p className="text-[10px] text-slate-400 font-medium truncate">
                      {student.course || '—'} · {progress.displayDone}/{progress.totalSessions} buổi
                    </p>
                  </td>
                  {dateKeys.map((dateKey) => (
                    <SlotCell
                      key={dateKey}
                      student={student}
                      dateKey={dateKey}
                      schedules={schedules}
                      teacherId={teacherId}
                      busy={busyKey === `${studentRowKey(student)}|${dateKey}`}
                      isToday={dateKey === todayKey}
                      now={now}
                      extraTakenRanges={otherTeacherRowRanges({
                        rows: rosterRows,
                        schedules,
                        dateKey,
                        excludeRowKey: studentRowKey(student),
                        holds: slotHolds,
                      })}
                      onChange={handleSlotChange}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SlotCell({ student, dateKey, schedules, teacherId, busy, isToday, now, extraTakenRanges, onChange }) {
  const past = isScheduleDateBeforeToday(dateKey);
  const sid = studentIdOf(student);
  const dayOccupying = findStudentDayOccupying(schedules, sid, dateKey);
  const own = occupyingMatchesCourse(dayOccupying, student.course) ? dayOccupying : null;
  const otherCourse = Boolean(dayOccupying && !own);
  const existingId = own ? scheduleIdOf(own) : '';
  const lockedDone = Boolean(own && LOCKED_STATUSES.has(String(own.status)));
  const extra = extraSlotOption(own);
  const slotValue = slotValueFromSchedule(own);
  const gate = getStudentScheduleGate(student, schedules, dateKey, existingId || null);

  const options = extra ? [extra, ...WEEK_SLOT_OPTIONS] : WEEK_SLOT_OPTIONS;
  const dayTd = `px-1.5 py-1.5 min-w-0 ${isToday ? 'bg-red-50/40' : ''}`;

  if (otherCourse) {
    return (
      <td className={dayTd}>
        <div
          className="w-full min-h-9 px-1.5 py-1 rounded-lg bg-slate-50 border border-slate-100 text-[10px] text-slate-400 font-semibold text-center leading-tight"
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
        <div className={`w-full min-h-9 px-1.5 py-1.5 rounded-lg border text-[10px] font-bold text-center ${tone}`}>
          {label}
        </div>
      </td>
    );
  }

  const canCreate = !own && gate.canSchedule;
  const disabledAll = busy || (!own && !canCreate);

  return (
    <td className={dayTd}>
      <select
        value={slotValue}
        disabled={disabledAll}
        title={!own && !gate.canSchedule ? (gate.reason || 'Không xếp thêm được') : undefined}
        onChange={(e) => onChange(student, dateKey, e.target.value)}
        className={`w-full min-w-0 max-w-full min-h-9 px-1.5 rounded-lg border text-[11px] font-semibold outline-none ${
          own
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-white border-slate-200 text-slate-600'
        } ${busy ? 'opacity-60' : ''} ${disabledAll ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <option value="">—</option>
        {options.map((opt) => {
          const meta = weekSlotSelectMeta(opt, dateKey, {
            schedules,
            teacherId,
            excludeScheduleId: existingId,
            now,
            currentValue: slotValue,
            extraTakenRanges,
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
