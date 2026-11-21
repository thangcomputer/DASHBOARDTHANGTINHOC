import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useToast } from '../../utils/useToast';
import CustomScheduleTimeModal from './CustomScheduleTimeModal';
import {
  findTeacherScheduleConflict,
  formatTeacherConflictMessage,
  formatLocalDateKey,
  isScheduleDateBeforeToday,
} from '../../utils/scheduleTime';
import { getStudentScheduleGate, resolveEnrollmentProgress } from '../../utils/schedulingLimits';
import {
  WEEKDAY_LABELS,
  WEEK_SLOT_OPTIONS,
  CUSTOM_SLOT_SENTINEL,
  CUSTOM_SLOT_OPTION_LABEL,
  startOfWeekMonday,
  addDays,
  weekDateKeys,
  formatWeekRangeLabel,
  formatSlotRangeLabel,
  encodeSlotValue,
  parseSlotValue,
  findStudentDayOccupying,
  occupyingMatchesCourse,
  isWeekSlotElapsed,
  weekSlotSelectMeta,
  slotValueFromSchedule,
  extraSlotOption,
  extraSlotOptionFromValue,
  slotEndForStart,
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
  onUpdated,
  onCancelled,
}) {
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [saving, setSaving] = useState(false);
  const [enrollmentKeyState, setEnrollmentKeyState] = useState(() => enrollmentKey(student));
  const [drafts, setDrafts] = useState({});
  const [customSlotModal, setCustomSlotModal] = useState(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const activeStudent = useMemo(() => {
    const rows = (enrollments || []).length ? enrollments : (student ? [student] : []);
    return rows.find((s) => enrollmentKey(s) === enrollmentKeyState) || rows[0] || student;
  }, [enrollments, student, enrollmentKeyState]);

  const effectiveTeacherId = useMemo(
    () => String(activeStudent?.teacherId?._id || activeStudent?.teacherId || teacherId || ''),
    [activeStudent, teacherId],
  );

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
      const value = slotValueFromSchedule(own);
      const { start, end } = parseSlotValue(value, own);
      map[dateKey] = {
        own,
        otherCourse,
        locked,
        value,
        start,
        end,
        id: own ? scheduleIdOf(own) : '',
        status: own ? String(own.status) : '',
      };
    });
    return map;
  }, [dateKeys, schedules, sid, activeStudent]);

  const valueOf = useCallback((dateKey) => (
    Object.prototype.hasOwnProperty.call(drafts, dateKey)
      ? drafts[dateKey]
      : (savedByDay[dateKey]?.value || '')
  ), [drafts, savedByDay]);

  const dirtyKeys = useMemo(() => {
    const keys = new Set([...Object.keys(drafts), ...dateKeys]);
    return [...keys].filter((dateKey) => {
      const saved = savedByDay[dateKey];
      if (saved?.locked || saved?.otherCourse || isScheduleDateBeforeToday(dateKey)) return false;
      const next = valueOf(dateKey);
      const prev = saved?.value || '';
      return String(next) !== String(prev);
    });
  }, [drafts, dateKeys, savedByDay, valueOf]);

  const handleSlotChange = useCallback((dateKey, nextRawValue) => {
    const saved = savedByDay[dateKey];
    if (isScheduleDateBeforeToday(dateKey)) {
      toast.error('Không thể sửa lịch đã qua ngày.');
      return;
    }
    if (saved?.locked) {
      toast.info('Buổi đã điểm danh - không đổi giờ từ đây.');
      return;
    }
    if (saved?.otherCourse) {
      toast.info(`Học viên đã có ca khóa khác trong ngày (${saved.own?.course || 'khác'}).`);
      return;
    }
    if (nextRawValue === CUSTOM_SLOT_SENTINEL) {
      const currentVal = valueOf(dateKey);
      const gate = getStudentScheduleGate(activeStudent, schedulesRef.current || [], dateKey, saved?.id || null);
      if (!currentVal && !(saved?.id && saved.status === 'scheduled') && !gate.canSchedule) {
        toast.info(gate.reason || 'Không xếp thêm được ca');
        return;
      }
      const { start: curStart, end: curEnd } = parseSlotValue(currentVal, saved?.own);
      setCustomSlotModal({
        dateKey,
        dayIndex: dateKeys.indexOf(dateKey),
        initialStart: currentVal ? curStart : '',
        initialEnd: currentVal ? curEnd : '',
        hasExistingSlot: Boolean(currentVal || (saved?.id && saved.status === 'scheduled')),
        saved,
      });
      return;
    }

    const { start: nextStart, end: endTime } = parseSlotValue(nextRawValue, saved?.own);
    if (nextStart) {
      if (isWeekSlotElapsed(dateKey, nextStart, endTime)) {
        toast.error('Ca này đã kết thúc - chỉ xếp khung giờ hiện tại trở đi.');
        return;
      }
      const conflict = findTeacherScheduleConflict({
        schedules: schedulesRef.current || [],
        teacherId: effectiveTeacherId,
        date: dateKey,
        startTime: nextStart,
        endTime,
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
    const encoded = nextStart ? encodeSlotValue(nextStart, endTime) : '';
    setDrafts((prev) => ({ ...prev, [dateKey]: encoded }));
  }, [savedByDay, valueOf, activeStudent, dateKeys, effectiveTeacherId, toast]);

  const handleCommit = useCallback(async () => {
    if (!activeStudent || saving || dirtyKeys.length === 0) return;
    const newCreates = dirtyKeys.filter((dateKey) => {
      const saved = savedByDay[dateKey];
      const next = valueOf(dateKey);
      return next && !(saved?.id && saved.status === 'scheduled');
    });
    const remaining = Number(progress.remaining ?? 0);
    if (newCreates.length > remaining) {
      toast.error(`Chỉ còn ${remaining} buổi - đang chọn thêm ${newCreates.length} ca.`);
      return;
    }

    const rawEnrId = String(activeStudent?._enrollmentId || activeStudent?.activeEnrollmentId || '').trim();
    const realEnrollmentId = (
      rawEnrId && rawEnrId !== 'main' && !/^enr-\d+$/i.test(rawEnrId) && !/^course-\d+$/i.test(rawEnrId)
    ) ? rawEnrId : undefined;

    // Kiểm tra hợp lệ toàn bộ trước khi bắn request song song
    const ops = [];
    let simulatedLive = [...(schedulesRef.current || [])];
    try {
      for (const dateKey of dirtyKeys) {
        const saved = savedByDay[dateKey];
        const next = valueOf(dateKey);
        const prev = saved?.value || '';
        if (String(next) === String(prev)) continue;

        if (!next) {
          if (saved?.id && saved.status === 'scheduled') {
            simulatedLive = simulatedLive.filter((s) => scheduleIdOf(s) !== String(saved.id));
            ops.push({ kind: 'cancel', dateKey, saved, prev });
          }
          continue;
        }

        const { start: nextStart, end: endTime } = parseSlotValue(next, saved?.own);
        if (!nextStart) continue;
        if (isWeekSlotElapsed(dateKey, nextStart, endTime)) {
          throw new Error('Ca này đã kết thúc - chỉ xếp khung giờ hiện tại trở đi.');
        }

        const conflict = findTeacherScheduleConflict({
          schedules: simulatedLive,
          teacherId: effectiveTeacherId,
          date: dateKey,
          startTime: nextStart,
          endTime,
          excludeScheduleId: saved?.id || null,
        });
        if (conflict) {
          throw new Error(formatTeacherConflictMessage(conflict));
        }

        if (saved?.id && saved.status === 'scheduled') {
          simulatedLive = simulatedLive.map((s) => (
            scheduleIdOf(s) === String(saved.id) ? { ...s, date: dateKey, startTime: nextStart, endTime } : s
          ));
          ops.push({ kind: 'update', dateKey, saved, prev, nextStart, endTime });
          continue;
        }

        const gate = getStudentScheduleGate(activeStudent, simulatedLive, dateKey, saved?.id || null);
        if (!gate.canSchedule) {
          throw new Error(gate.reason || `Không xếp được ca ngày ${dateKey}`);
        }

        simulatedLive = [...simulatedLive, {
          _id: `local_${dateKey}`,
          id: `local_${dateKey}`,
          teacherId: effectiveTeacherId,
          studentId: sid,
          enrollmentId: realEnrollmentId || null,
          course: activeStudent.course || '',
          date: dateKey,
          startTime: nextStart,
          endTime,
          status: 'scheduled',
        }];
        ops.push({ kind: 'create', dateKey, nextStart, endTime });
      }
    } catch (validationErr) {
      toast.error(validationErr?.message || 'Dữ liệu lịch không hợp lệ');
      return;
    }

    if (ops.length === 0) return;

    setSaving(true);
    let created = 0;
    let updated = 0;
    let cancelled = 0;
    const succeededKeys = [];
    let firstError = null;
    try {
      const results = await Promise.allSettled(
        ops.map(async (op) => {
          if (op.kind === 'cancel') {
            await cancelSchedule(op.saved.id, CLEAR_REASON);
            return { op };
          }
          if (op.kind === 'update') {
            const res = await updateSchedule(op.saved.id, {
              date: op.dateKey,
              startTime: op.nextStart,
              endTime: op.endTime,
            });
            if (res?.success === false) throw new Error(res.message || 'Không cập nhật được lịch');
            return { op, res };
          }
          const res = await addSchedule({
            studentId: sid,
            teacherId: effectiveTeacherId,
            ...(realEnrollmentId ? { enrollmentId: realEnrollmentId } : {}),
            date: op.dateKey,
            startTime: op.nextStart,
            endTime: op.endTime,
            course: activeStudent.course || '',
            topic: '',
            note: '',
            studentName: activeStudent.displayName || activeStudent.name || '',
          });
          if (!res?.success) throw new Error(res?.message || 'Không thể xếp lịch');
          return { op, res };
        }),
      );

      const postCallbacks = [];
      for (const item of results) {
        if (item.status === 'rejected') {
          if (!firstError) firstError = item.reason;
          continue;
        }
        const { op, res } = item.value;
        succeededKeys.push(op.dateKey);
        if (op.kind === 'cancel') {
          cancelled += 1;
          if (typeof onCancelled === 'function') {
            const prevParsed = parseSlotValue(op.prev, op.saved.own);
            postCallbacks.push(onCancelled({
              date: op.dateKey,
              startTime: op.saved.start || prevParsed.start || '',
              endTime: op.saved.end || slotEndForStart(op.prev, op.saved.own) || '',
              course: activeStudent.course || '',
              studentName: activeStudent.displayName || activeStudent.name || '',
              studentId: sid,
              scheduleId: op.saved.id,
            }));
          }
        } else if (op.kind === 'update') {
          updated += 1;
          if (typeof onUpdated === 'function') {
            const prevParsed = parseSlotValue(op.prev, op.saved.own);
            const prevEnd = op.saved.end || slotEndForStart(op.prev, op.saved.own) || '';
            postCallbacks.push(onUpdated({
              date: op.dateKey,
              startTime: op.nextStart,
              endTime: op.endTime,
              prevStartTime: prevParsed.start || op.saved.start || '',
              prevEndTime: prevEnd,
              course: activeStudent.course || '',
              studentName: activeStudent.displayName || activeStudent.name || '',
              studentId: sid,
              scheduleId: op.saved.id,
            }));
          }
        } else if (op.kind === 'create') {
          created += 1;
          if (typeof onCreated === 'function') {
            postCallbacks.push(onCreated({
              date: op.dateKey,
              startTime: op.nextStart,
              endTime: op.endTime,
              course: activeStudent.course || '',
              studentName: activeStudent.displayName || activeStudent.name || '',
              studentId: sid,
              scheduleId: res?.data?._id || res?.data?.id || null,
            }));
          }
        }
      }

      if (postCallbacks.length) {
        await Promise.allSettled(postCallbacks);
      }

      if (firstError) {
        setDrafts((prevDrafts) => {
          const remainingDrafts = { ...prevDrafts };
          succeededKeys.forEach((k) => { delete remainingDrafts[k]; });
          return remainingDrafts;
        });
        toast.error(firstError?.message || 'Một số buổi chưa lưu được');
      } else {
        setDrafts({});
        const bits = [];
        if (created) bits.push(`xếp ${created} ca`);
        if (updated) bits.push(`đổi ${updated} ca`);
        if (cancelled) bits.push(`bỏ ${cancelled} ca`);
        toast.success(bits.length ? `Đã ${bits.join(', ')}` : 'Không có thay đổi');
        onClose?.();
      }
    } catch (err) {
      toast.error(err?.message || 'Không cập nhật được lịch');
    } finally {
      setSaving(false);
    }
  }, [
    activeStudent, saving, dirtyKeys, savedByDay, valueOf, progress.remaining,
    sid, effectiveTeacherId, addSchedule, updateSchedule, cancelSchedule,
    onCreated, onUpdated, onCancelled, onClose, toast,
  ]);

  if (!activeStudent || typeof document === 'undefined') return null;

  const name = activeStudent.displayName || activeStudent.name || 'Học viên';
  const courseOptions = (enrollments || []).length > 1 ? enrollments : [];

  return createPortal(
    <div className="fixed inset-0 z-[10040] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Đóng" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="bg-emerald-600 px-4 sm:px-5 py-3.5 text-white flex items-center justify-between gap-2 shrink-0">
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
            Khóa: <span className="font-bold text-emerald-700">{activeStudent.course || '-'}</span>
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
            <button type="button" onClick={() => setWeekStart((d) => addDays(startOfWeekMonday(d), -7))} className="w-9 h-9 rounded-xl border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center" aria-label="Tuần trước">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setWeekStart(startOfWeekMonday(new Date()))} className="px-3 h-9 rounded-xl border-2 border-emerald-600 text-xs font-bold text-emerald-600 hover:bg-emerald-50 min-w-[9.5rem]">
              {formatWeekRangeLabel(weekStart)}
            </button>
            <button type="button" onClick={() => setWeekStart((d) => addDays(startOfWeekMonday(d), 7))} className="w-9 h-9 rounded-xl border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 flex items-center justify-center" aria-label="Tuần sau">
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
              teacherId={effectiveTeacherId}
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
            Chọn giờ trước - chỉ lưu và nhắn tin khi bấm Xếp lịch ngay.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 h-11 rounded-xl bg-white border-2 border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50">
              Hủy
            </button>
            <button
              type="button"
              disabled={saving || dirtyKeys.length === 0}
              onClick={handleCommit}
              className="flex-[1.6] h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black  tracking-wide disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Đang lưu...' : 'Xếp lịch ngay'}
            </button>
          </div>
        </div>
      </div>
      <CustomScheduleTimeModal
        open={Boolean(customSlotModal)}
        studentName={name}
        courseName={activeStudent?.course || ''}
        weekdayLabel={customSlotModal && customSlotModal.dayIndex >= 0 ? WEEKDAY_LABELS[customSlotModal.dayIndex] : ''}
        dateKey={customSlotModal?.dateKey || ''}
        initialStart={customSlotModal?.initialStart || ''}
        initialEnd={customSlotModal?.initialEnd || ''}
        hasExistingSlot={Boolean(customSlotModal?.hasExistingSlot)}
        validateRange={(startTime, endTime) => {
          if (!customSlotModal) return '';
          if (isWeekSlotElapsed(customSlotModal.dateKey, startTime, endTime)) {
            return 'Ca này đã kết thúc - chỉ xếp khung giờ hiện tại trở đi.';
          }
          const conflict = findTeacherScheduleConflict({
            schedules: schedulesRef.current || [],
            teacherId: effectiveTeacherId,
            date: customSlotModal.dateKey,
            startTime,
            endTime,
            excludeScheduleId: customSlotModal.saved?.id || null,
          });
          return conflict ? formatTeacherConflictMessage(conflict) : '';
        }}
        onConfirm={({ startTime, endTime }) => {
          const target = customSlotModal;
          setCustomSlotModal(null);
          if (!target) return;
          const nextValue = startTime && endTime ? encodeSlotValue(startTime, endTime) : '';
          handleSlotChange(target.dateKey, nextValue);
        }}
        onClose={() => setCustomSlotModal(null)}
      />
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
  const extraFromValue = extraSlotOptionFromValue(value, own);
  const extraFromSaved = extraSlotOption(own);
  const extraList = [extraFromValue, extraFromSaved].filter((item, idx, arr) => (
    item && arr.findIndex((candidate) => candidate && candidate.value === item.value) === idx
  ));
  const gate = getStudentScheduleGate(student, schedules, dateKey, existingId || null);
  const options = [...extraList, ...WEEK_SLOT_OPTIONS];
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
      ? (formatSlotRangeLabel(own.startTime, own.endTime)
        || extraFromSaved?.label
        || WEEK_SLOT_OPTIONS.find((o) => o.value === value)?.label
        || value
        || '-')
      : '-';
    control = (
      <div className={`flex-1 min-h-11 px-3 rounded-xl border text-xs font-bold flex items-center ${String(own?.status) === 'completed'
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
        onChange={(e) => {
          const picked = e.target.value;
          if (picked === CUSTOM_SLOT_SENTINEL) {
            e.target.value = value;
          }
          onChange(dateKey, picked);
        }}
        className={`flex-1 min-h-11 px-2 rounded-xl border text-sm font-semibold outline-none cursor-pointer ${dirty
          ? 'bg-amber-50 border-amber-300 text-amber-900'
          : value
            ? 'bg-amber-50/70 border-amber-200 text-amber-800'
            : 'bg-white border-slate-200 text-slate-700'
          }`}
      >
        <option value={CUSTOM_SLOT_SENTINEL}>{CUSTOM_SLOT_OPTION_LABEL}</option>
        <option value="">- Không có lịch -</option>
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
    <div className={`flex items-center gap-2 ${isToday ? 'bg-emerald-50/70 -mx-2 px-2 py-1.5 rounded-xl' : ''}`}>
      <div className="w-[5.5rem] shrink-0">
        <p className={`text-xs font-black ${isToday ? 'text-emerald-700' : 'text-slate-700'}`}>{label}</p>
        <p className="text-[10px] font-semibold text-slate-400">{dateLabel}</p>
      </div>
      {control}
    </div>
  );
}
