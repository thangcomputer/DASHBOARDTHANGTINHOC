import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, StickyNote, Table2 } from 'lucide-react';
import {
  formatLocalDateKey,
  getScheduleDisplayKind,
  normalizeScheduleDate,
} from '../../utils/scheduleTime';
import {
  startOfWeekMonday,
  addDays,
  weekDateKeys,
  formatWeekRangeLabel,
} from '../../utils/weeklySlotGrid';

const SHORT_WEEKDAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const KIND_CELL = {
  completed: 'bg-emerald-50 border-emerald-200 text-emerald-700 font-extrabold',
  cancelled: 'bg-slate-50 border-slate-200 text-slate-400',
  ongoing: 'bg-green-100 border-green-300 text-green-800 font-black ring-1 ring-green-400',
  upcoming: 'bg-red-50/70 border-red-200 text-red-700 font-extrabold',
  pending_attendance: 'bg-orange-50 border-orange-200 text-orange-700 font-extrabold',
  overdue_attendance: 'bg-red-50 border-red-200 text-red-700 font-extrabold',
  past_pending: 'bg-orange-50 border-orange-200 text-orange-700 font-extrabold',
};

function courseKeyOf(name) {
  return String(name || '').trim() || 'Khóa học';
}

function slotLabel(sch) {
  if (!sch) return '-';
  const start = sch.startTime?.match(/\d{1,2}:\d{2}/)?.[0] || sch.startTime;
  return start || '-';
}

export default function StudentWeeklyScheduleGrid({
  schedules = [],
  student,
  isFree = false,
  enrollments = [],
  activeCourseName,
  onSelectCourse,
  onOpenSession,
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const coursePickerRef = useRef(null);
  const todayKey = formatLocalDateKey(new Date());
  const dateKeys = useMemo(() => weekDateKeys(weekStart), [weekStart]);

  useEffect(() => {
    if (!showCoursePicker) return undefined;
    const onClickOutside = (e) => {
      if (coursePickerRef.current && !coursePickerRef.current.contains(e.target)) {
        setShowCoursePicker(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showCoursePicker]);

  const courseNames = useMemo(() => {
    const list = [];
    const seen = new Set();
    if (enrollments && enrollments.length > 0) {
      enrollments.forEach((e) => {
        const name = e.courseName || e.name;
        if (name && !seen.has(name.toLowerCase())) {
          seen.add(name.toLowerCase());
          list.push(name);
        }
      });
    }
    (schedules || []).forEach((sch) => {
      const name = courseKeyOf(sch.course || sch.courseName || student?.course);
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        list.push(name);
      }
    });
    if (!list.length) list.push(courseKeyOf(activeCourseName || student?.course));
    return list;
  }, [enrollments, schedules, activeCourseName, student?.course]);

  const currentCourse = activeCourseName || courseNames[0] || 'Khóa học';

  const byCourseDay = useMemo(() => {
    const map = {};
    (schedules || []).forEach((sch) => {
      const course = courseKeyOf(sch.course || sch.courseName || student?.course);
      const day = normalizeScheduleDate(sch.date);
      const key = `${course.toLowerCase()}|${day}`;
      const prev = map[key];
      if (!prev) {
        map[key] = sch;
        return;
      }
      if (String(prev.status) === 'cancelled' && String(sch.status) !== 'cancelled') {
        map[key] = sch;
      }
    });
    return map;
  }, [schedules, student?.course]);

  return (
    <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-sm overflow-hidden" aria-label="Lịch học theo tuần">
      <div className="p-4 sm:p-5 space-y-3.5 border-b border-slate-100">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
            isFree ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
          }`}>
            <Table2 size={18} />
          </div>
          <h3 className="text-base font-black text-slate-900 tracking-tight">
            Lịch học theo tuần
          </h3>
        </div>

        {courseNames.length > 0 && (
          <div ref={coursePickerRef} className="relative w-full">
            <button
              type="button"
              onClick={() => courseNames.length > 1 && setShowCoursePicker((prev) => !prev)}
              className={`flex items-center justify-between gap-3 w-full rounded-[14px] border border-slate-200 bg-white px-4 py-2.5 text-left text-xs transition ${
                courseNames.length > 1 ? 'hover:border-slate-300 cursor-pointer shadow-xs' : 'cursor-default'
              }`}
            >
              <span className="text-slate-400 font-bold shrink-0">Khóa học</span>
              <span className={`flex-1 truncate font-black uppercase tracking-wide text-xs sm:text-sm text-center sm:text-left pl-2 ${
                isFree ? 'text-[#059669]' : 'text-[#DC2626]'
              }`}>
                {currentCourse}
              </span>
              <ChevronDown size={16} className={`transition-transform ${isFree ? 'text-emerald-600' : 'text-red-600'} ${showCoursePicker ? 'rotate-180' : ''}`} />
            </button>
            {showCoursePicker && (
              <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                {courseNames.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCourse?.(name);
                        setShowCoursePicker(false);
                      }}
                      className={`w-full rounded-xl px-3 py-2 text-left text-xs font-bold transition ${
                        name === currentCourse
                          ? (isFree ? 'bg-emerald-50 text-emerald-700 font-black' : 'bg-red-50 text-red-700 font-black')
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Thanh dải tuần liền mạch màu hồng nhạt chuẩn Mobile App (hoặc xanh cho Free) ── */}
        <div className={`flex items-center justify-between rounded-[12px] px-3 py-1.5 border ${
          isFree
            ? 'bg-emerald-50/70 border-emerald-100 text-[#059669]'
            : 'bg-[#FFF5F5] border-red-100/80 text-[#DC2626]'
        }`}>
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(startOfWeekMonday(d), -7))}
            className="p-1 hover:opacity-75 active:scale-95 transition"
            aria-label="Tuần trước"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-black tracking-wide">
            {formatWeekRangeLabel(weekStart)}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart((d) => addDays(startOfWeekMonday(d), 7))}
            className="p-1 hover:opacity-75 active:scale-95 transition"
            aria-label="Tuần sau"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <thead>
            <tr className="bg-slate-50/60 border-b border-slate-100">
              {dateKeys.map((key, i) => {
                const isToday = key === todayKey;
                return (
                  <th
                    key={key}
                    className={`px-2 py-2 text-center min-w-[5rem] transition-colors border-r border-slate-100 last:border-r-0 ${
                      isToday ? (isFree ? 'bg-emerald-50' : 'bg-[#FEF2F2]') : 'bg-white'
                    }`}
                  >
                    <div className={`text-[11px] font-black ${
                      isToday ? (isFree ? 'text-[#059669]' : 'text-[#DC2626]') : 'text-slate-800'
                    }`}>
                      {SHORT_WEEKDAY_NAMES[i] || `T${i + 2}`}
                    </div>
                    <div className={`text-[10px] font-bold ${
                      isToday ? (isFree ? 'text-[#059669]' : 'text-[#DC2626]') : 'text-slate-500'
                    }`}>
                      {key.slice(8, 10)}/{key.slice(5, 7)}
                    </div>
                    <div className={`text-[9px] font-bold tracking-wider ${
                      isToday ? (isFree ? 'text-[#059669]' : 'text-[#DC2626]') : 'text-slate-400'
                    }`}>
                      Giờ
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              {dateKeys.map((dateKey) => {
                const sch = byCourseDay[`${currentCourse.toLowerCase()}|${dateKey}`];
                const isToday = dateKey === todayKey;
                if (!sch) {
                  return (
                    <td key={dateKey} className={`px-1 py-3 text-center border-r border-slate-100 last:border-r-0 ${
                      isToday ? (isFree ? 'bg-emerald-50/30' : 'bg-[#FEF2F2]/50') : ''
                    }`}>
                      <div className="w-full flex items-center justify-center text-xs font-bold text-slate-400">
                        -
                      </div>
                    </td>
                  );
                }
                const kind = getScheduleDisplayKind(sch);
                const tone = KIND_CELL[kind] || KIND_CELL.upcoming;
                const clickable = String(sch.status) === 'scheduled' && typeof onOpenSession === 'function';
                const hasNote = Boolean(String(sch.studentNote || '').trim());
                const hoverHint = hasNote ? 'Chỉnh sửa ghi chú' : 'Thêm ghi chú';
                const teacherHint = sch.teacherName ? `GV: ${sch.teacherName}` : '';

                return (
                  <td key={dateKey} className={`px-1 py-2 border-r border-slate-100 last:border-r-0 ${
                    isToday ? (isFree ? 'bg-emerald-50/30' : 'bg-[#FEF2F2]/50') : ''
                  }`}>
                    <button
                      type="button"
                      disabled={!clickable}
                      onClick={() => onOpenSession?.(sch)}
                      title={clickable ? [hoverHint, teacherHint].filter(Boolean).join(' · ') : teacherHint || undefined}
                      className={`group relative w-full min-h-[38px] px-1 py-1 rounded-xl border flex flex-col items-center justify-center text-center transition ${tone} ${
                        clickable ? 'hover:brightness-95 cursor-pointer active:scale-95' : 'cursor-default'
                      }`}
                    >
                      {hasNote && (
                        <span
                          className="absolute -top-1 -right-1 z-[1] w-3.5 h-3.5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm pointer-events-none"
                          aria-hidden="true"
                        >
                          <StickyNote size={8} strokeWidth={2.5} />
                        </span>
                      )}
                      <span className="text-[11px] font-black leading-tight">{slotLabel(sch)}</span>
                    </button>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
