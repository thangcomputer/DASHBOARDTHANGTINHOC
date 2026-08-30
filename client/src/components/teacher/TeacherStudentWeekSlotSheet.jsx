import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useToast } from '../../utils/toast';
import {
  endTimeFromStart,
  findTeacherScheduleConflict,
  formatTeacherConflictMessage,
  formatLocalDateKey,
  isScheduleDateBeforeToday,
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
} from '../../utils/weeklySlotGrid';

const LOCKED_STATUSES = new Set(['completed', 'no_show']);
const CLEAR_REASON = 'Bỏ ca từ xếp lịch tuần';

function studentIdOf(student) {
  return String(student?._id || student?.id || '');
}

function scheduleIdOf(sch) {
  return String(sch?._id || sch?.id || '');
}

function enrollmentKey(student) {
  return String(student?._enrollmentKey || student?._id || student?.id || '');
}

function slotEnd(start) {
  if (!start) return '';
  const known = WEEK_SLOT_OPTIONS.find((o) => o.value === start);
  return known?.end || endTimeFromStart(start);
}

export default function TeacherStudentWeekSlotSheet({
  student,
  enrollments = [],
  teacherId,
  schedules = [],
  addSchedule,
  updateSchedule,
  cancelSchedule,
  onClose,
  onCreated,
}) {
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [saving, setSaving] = useState(false);
  const [enrollmentKeyState, setEnrollmentKeyState] = useState(() => enrollmentKey(student));
  const [drafts, setDrafts] = useState({});
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const activeStudent = useMemo(() => {
    const rows = (enrollments || []).length ? enrollments : (student ? [student] : []);
    return rows.find((s) => enrollmentKey(s) === enrollmentKeyState) || rows[0] || student;
  }, [enrollments, student, enrollmentKeyState]);

  const dateKeys = useMemo(() => weekDateKeys(weekStart), [weekStart]);
  const todayKey = formatLocalDateKey(new Date());
  const schedulesRef = useRef(schedules);
  schedulesRef.current = schedules;
  const progress = useMemo(
    () => resolveEnrollmentProgress(activeStudent, schedules),
    [activeStudent, schedules],
  );
  const sid = studentIdOf(activeStudent);

  const savedByDay = useMemo(() => {
    const map = {};
    (dateKeys || []).forEach((dateKey) => {
      const dayOccupying = findStudentDayOccupying(schedules, sid, dateKey);
      const own = occupyingMatchesCourse(dayOccupying, activeStudent?.course) ? dayOccupying : null;
      const otherCourse = Boolean(dayOccupying && !own);
      const locked = Boolean(own && LOCKED_STATUSES.has(String(own.status)));
      map[dateKey] = {
        own,
        otherCourse,
        locked,
        start: slotValueFromSchedule(own),
        id: own ? scheduleIdOf(own) : '',
        status: own ? String(own.status) : '',
      };
    });
    return map;
  }, [dateKeys, schedules, sid, activeStudent]);

  const valueOf = useCallback((dateKey) => (
    Object.prototype.hasOwnProperty.call(drafts, dateKey)
      ? drafts[dateKey]
      : (savedByDay[dateKey]?.start || '')
  ), [drafts, savedByDay]);

  const dirtyKeys = useMemo(() => {
    const keys = new Set([...Object.keys(drafts), ...dateKeys]);
    return [...keys].filter((dateKey) => {
      const saved = savedByDay[dateKey];
      if (saved?.locked || saved?.otherCourse || isScheduleDateBeforeToday(dateKey)) return false;
      const next = valueOf(dateKey);
      const prev = saved?.start || '';
      return String(next) !== String(prev);
    });
  }, [drafts, dateKeys, savedByDay, valueOf]);

  const handleSlotChange = useCallback((dateKey, nextStart) => {
    const saved = savedByDay[dateKey];
    if (isScheduleDateBeforeToday(dateKey)) {
      toast.error('Không thể sửa lịch đã qua ngày.');
      return;
    }
    if (saved?.locked) {
      toast.info('Buổi đã điểm danh — không đổi giờ từ đây.');
      return;
    }
    if (saved?.otherCourse) {
      toast.info(`Học viên đã có ca khóa khác trong ngày (${saved.own?.course || 'khác'}).`);
      return;
    }
    if (nextStart) {
      if (isWeekSlotElapsed(dateKey, nextStart, slotEnd(nextStart))) {
        toast.error('Ca này đã kết thúc — chỉ xếp khung giờ hiện tại trở đi.');
        return;
      }
      const conflict = findTeacherScheduleConflict({
        schedules: schedulesRef.current || [],
        teacherId,
        date: dateKey,
        startTime: nextStart,
        endTime: slotEnd(nextStart),
        excludeScheduleId: saved?.id || null,
      });
      if (conflict) {
        toast.error(formatTeacherConflictMessage(conflict));
        return;
      }
    } else if (!saved?.id || saved.status !== 'scheduled') {
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[dateKey];
        return next;
      });
      return;
    }
    setDrafts((prev) => ({ ...prev, [dateKey]: nextStart }));
  }, [savedByDay, teacherId, toast]);

  const handleCommit = useCallback(async () => {
    if (!activeStudent || saving || dirtyKeys.length === 0) return;
    const newCreates = dirtyKeys.filter((dateKey) => {
      const saved = savedByDay[dateKey];
      const next = valueOf(dateKey);
      return next && !(saved?.id && saved.status === 'scheduled');
    });
    const remaining = Number(progress.remaining ?? 0);
    if (newCreates.length > remaining) {
      toast.error(`Chỉ còn ${remaining} buổi — đang chọn thêm ${newCreates.length} ca.`);
      return;
    }

    setSaving(true);
    let created = 0;
    let updated = 0;
    let cancelled = 0;
    let live = [...(schedulesRef.current || [])];
    try {
      for (const dateKey of dirtyKeys) {
        const saved = savedByDay[dateKey];
        const next = valueOf(dateKey);
        const prev = saved?.start || '';
        if (String(next) === String(prev)) continue;

        if (!next) {
          if (saved?.id && saved.status === 'scheduled') {
            await cancelSchedule(saved.id, CLEAR_REASON);
            cancelled += 1;
            live = live.filter((s) => scheduleIdOf(s) !== String(saved.id));
          }
          continue;
        }

        const extra = extraSlotOption(saved?.own);
        const endTime = WEEK_SLOT_OPTIONS.find((o) => o.value === next)?.end || extra?.end || endTimeFromStart(next);
        if (isWeekSlotElapsed(dateKey, next, endTime)) {
          throw new Error('Ca này đã kết thúc — chỉ xếp khung giờ hiện tại trở đi.');
        }

        const conflict = findTeacherScheduleConflict({
          schedules: live,
          teacherId,
          date: dateKey,
          startTime: next,
          endTime,
          excludeScheduleId: saved?.id || null,
        });
        if (conflict) {
          throw new Error(formatTeacherConflictMessage(conflict));
        }

        const gate = getStudentScheduleGate(activeStudent, live, dateKey, saved?.id || null);
        if (saved?.id && saved.status === 'scheduled') {
          const res = await updateSchedule(saved.id, {
            date: dateKey,
            startTime: next,
            endTime,
          });
          if (res?.success === false) throw new Error(res.message);
          updated += 1;
          live = live.map((s) => (
            scheduleIdOf(s) === String(saved.id) ? { ...s, date: dateKey, startTime: next, endTime } : s
          ));
          continue;
        }

        if (!gate.canSchedule) {
          throw new Error(gate.reason || `Không xếp được ca ngày ${dateKey}`);
        }

        const res = await addSchedule({
          studentId: sid,
          teacherId,
          date: dateKey,
          startTime: next,
          endTime,
          course: activeStudent.course || '',
          topic: '',
          note: '',
          studentName: activeStudent.displayName || activeStudent.name || '',
        });
        if (!res?.success) throw new Error(res?.message || 'Không thể xếp lịch');
        created += 1;
        const createdId = res.data?._id || res.data?.id || `local_${dateKey}`;
        live = [...live, {
          ...(res.data || {}),
          _id: createdId,
          id: createdId,
          teacherId,
          studentId: sid,
          date: dateKey,
          startTime: next,
          endTime,
          status: 'scheduled',
        }];
        if (typeof onCreated === 'function') {
          await onCreated({
            date: dateKey,
            startTime: next,
            endTime,
            course: activeStudent.course || '',
            studentName: activeStudent.displayName || activeStudent.name || '',
            studentId: sid,
            scheduleId: res.data?._id || res.data?.id || null,
          });
        }
      }

      setDrafts({});
      const bits = [];
      if (created) bits.push(`xếp ${created} ca`);
      if (updated) bits.push(`đổi ${updated} ca`);
      if (cancelled) bits.push(`bỏ ${cancelled} ca`);
      toast.success(bits.length ? `Đã ${bits.join(', ')}` : 'Không có thay đổi');
      onClose?.();
    } catch (err) {
      toast.error(err?.message || 'Không cập nhật được lịch');
    } finally {
      setSaving(false);
    }
  }, [
    activeStudent, saving, dirtyKeys, savedByDay, valueOf, progress.remaining,
    schedules, sid, teacherId, addSchedule, updateSchedule, cancelSchedule,
    onCreated, onClose, toast,
  ]);

  if (!activeStudent || typeof document === 'undefined') return null;

  const name = activeStudent.displayName || activeStudent.name || 'Học viên';
  const courseOptions = (enrollments || []).length > 1 ? enrollments : [];

  return createPortal(
    <div className="fixed inset-0 z-[10040] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Đóng" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="bg-red-600 px-4 sm:px-5 py-3.5 text-white flex items-center justify-between gap-2 shrink-0">
          <h3 className="font-bold text-sm sm:text-base flex items-center gap-2 min-w-0">
            <Calendar size={18} className="shrink-0" />
            <span className="truncate">Xếp lịch tuần · {name}</span>
          </h3>
          <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/15 shrink-0" aria-label="Đóng">
            <X size={20} />
          </button>
        </div>

        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 shrink-0">
          <p className="text-xs text-slate-500 font-medium">
            Khóa: <span className="font-bold text-red-700">{activeStudent.course || '—'}</span>
            {' · '}
            {progress.displayDone}/{progress.totalSessions} buổi
          </p>
          {courseOptions.length > 0 && (
            <select
              value={enrollmentKey(activeStudent)}
              onChange={(e) => {
                setEnrollmentKeyState(e.target.value);
                setDrafts({});
              }}
              className="mt-2 w-full h-10 rounded-xl border border-slate-200 text-xs font-bold px-2"
            >
              {courseOptions.map((row) => (
                <option key={enrollmentKey(row)} value={enrollmentKey(row)}>
                  {row.course || 'Khóa học'}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <button type="button" onClick={() => setWeekStart((d) => addDays(startOfWeekMonday(d), -7))} className="w-9 h-9 rounded-xl border-2 border-red-600 text-red-600 hover:bg-red-50 flex items-center justify-center" aria-label="Tuần trước">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setWeekStart(startOfWeekMonday(new Date()))} className="px-3 h-9 rounded-xl border-2 border-red-600 text-xs font-bold text-red-600 hover:bg-red-50 min-w-[9.5rem]">
              {formatWeekRangeLabel(weekStart)}
            </button>
            <button type="button" onClick={() => setWeekStart((d) => addDays(startOfWeekMonday(d), 7))} className="w-9 h-9 rounded-xl border-2 border-red-600 text-red-600 hover:bg-red-50 flex items-center justify-center" aria-label="Tuần sau">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-4 sm:px-5 py-3 space-y-2">
          {dateKeys.map((dateKey, i) => (
            <DaySlotRow
              key={dateKey}
              label={WEEKDAY_LABELS[i]}
              dateKey={dateKey}
              student={activeStudent}
              schedules={schedules}
              teacherId={teacherId}
              saved={savedByDay[dateKey]}
              value={valueOf(dateKey)}
              dirty={dirtyKeys.includes(dateKey)}
              isToday={dateKey === todayKey}
              now={now}
              onChange={handleSlotChange}
            />
          ))}
        </div>

        <div className="px-4 sm:px-5 py-3 border-t border-slate-100 shrink-0">
          <p className="text-[11px] text-slate-400 text-center font-medium mb-2">
            Chọn giờ trước — chỉ lưu và nhắn tin khi bấm Xếp lịch ngay.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl bg-white border-2 border-red-600 text-red-600 text-sm font-bold hover:bg-red-50">
              Hủy
            </button>
            <button
              type="button"
              disabled={saving || dirtyKeys.length === 0}
              onClick={handleCommit}
              className="flex-[1.6] h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-black uppercase tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Đang lưu...' : 'Xếp lịch ngay'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function DaySlotRow({ label, dateKey, student, schedules, teacherId, saved, value, dirty, isToday, now, onChange }) {
  const past = isScheduleDateBeforeToday(dateKey);
  const own = saved?.own || null;
  const otherCourse = Boolean(saved?.otherCourse);
  const existingId = saved?.id || '';
  const lockedDone = Boolean(saved?.locked);
  const extra = extraSlotOption(own);
  const gate = getStudentScheduleGate(student, schedules, dateKey, existingId || null);
  const options = extra ? [extra, ...WEEK_SLOT_OPTIONS] : WEEK_SLOT_OPTIONS;
  const dateLabel = `${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}`;

  let control = null;
  if (otherCourse) {
    control = (
      <div className="flex-1 min-h-11 px-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-400 font-semibold flex items-center">
        Ca khóa khác
      </div>
    );
  } else if (past || lockedDone) {
    const labelText = own
      ? (extra?.label || WEEK_SLOT_OPTIONS.find((o) => o.value === value)?.label || value || '—')
      : '—';
    control = (
      <div className={`flex-1 min-h-11 px-3 rounded-xl border text-xs font-bold flex items-center ${
        String(own?.status) === 'completed'
          ? 'bg-emerald-50 border-emerald-100 text-emerald-700'
          : 'bg-slate-50 border-slate-100 text-slate-500'
      }`}>
        {labelText}
      </div>
    );
  } else {
    const canCreate = Boolean(value) || gate.canSchedule || Boolean(saved?.id);
    control = (
      <select
        value={value}
        disabled={!canCreate}
        title={!value && !gate.canSchedule ? (gate.reason || 'Không xếp thêm được') : undefined}
        onChange={(e) => onChange(dateKey, e.target.value)}
        className={`flex-1 min-h-11 px-2 rounded-xl border text-sm font-semibold outline-none cursor-pointer ${
          dirty
            ? 'bg-amber-50 border-amber-300 text-amber-900'
            : value
              ? 'bg-amber-50/70 border-amber-200 text-amber-800'
              : 'bg-white border-slate-200 text-slate-700'
        }`}
      >
        <option value="">— Chọn giờ —</option>
        {options.map((opt) => {
          const meta = weekSlotSelectMeta(opt, dateKey, {
            schedules,
            teacherId,
            excludeScheduleId: existingId,
            now,
            currentValue: value,
          });
          if (meta.hidden) return null;
          return (
            <option key={opt.value} value={opt.value} disabled={meta.disabled}>
              {opt.label}{meta.suffix}
            </option>
          );
        })}
      </select>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${isToday ? 'bg-red-50/70 -mx-2 px-2 py-1.5 rounded-xl' : ''}`}>
      <div className="w-[5.5rem] shrink-0">
        <p className={`text-xs font-black ${isToday ? 'text-red-700' : 'text-slate-700'}`}>{label}</p>
        <p className="text-[10px] font-semibold text-slate-400">{dateLabel}</p>
      </div>
      {control}
    </div>
  );
}
