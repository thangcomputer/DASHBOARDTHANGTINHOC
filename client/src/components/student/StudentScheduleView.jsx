import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar, Video, Clock, CheckCircle, XCircle, AlertCircle, FileText,
  ChevronLeft, ChevronRight, User, BookOpen, Sparkles, MessageSquare, ExternalLink, Award, ClipboardList
} from 'lucide-react';
import { getScheduleDisplayKind, getScheduleDisplayMeta, isScheduleUpcomingDisplay } from '../../utils/scheduleTime';
import { isScheduleChangeLog } from '../../utils/studentActivityLogs';

function parseScheduleRowMs(item) {
  const rawDate = item?.date;
  let dateMs = 0;
  if (rawDate instanceof Date) dateMs = rawDate.getTime();
  else if (typeof rawDate === 'number') dateMs = rawDate;
  else if (rawDate) {
    const str = String(rawDate).trim();
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const dt = new Date(year, month, day);
        if (!Number.isNaN(dt.getTime())) dateMs = dt.getTime();
      }
    }
    if (!dateMs) {
      const dt = new Date(str);
      if (!Number.isNaN(dt.getTime())) dateMs = dt.getTime();
    }
  }
  if (!dateMs && item?.timestamp) dateMs = Number(item.timestamp) || 0;
  const m = String(item?.time || '').match(/(\d{1,2}):(\d{2})/);
  if (dateMs && m) {
    const d = new Date(dateMs);
    d.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
    return d.getTime();
  }
  return dateMs || Number(item?.timestamp) || 0;
}

function scheduleLogStatus(g) {
  const type = g?.type;
  const kind = g?.displayKind;
  if (type === 'schedule_cancel' || type === 'cancelled') {
    return { label: 'chưa học', className: 'bg-slate-100 text-slate-600' };
  }
  if (
    type === 'pending_attendance'
    || type === 'overdue_attendance'
    || type === 'past_pending'
    || type === 'attendance_cancel'
    || kind === 'pending_attendance'
    || kind === 'overdue_attendance'
  ) {
    return { label: 'chưa điểm danh', className: 'bg-orange-50 text-orange-700' };
  }
  if (type === 'scheduled' || kind === 'upcoming' || kind === 'ongoing') {
    return { label: 'sắp tới', className: 'bg-blue-50 text-blue-700' };
  }
  if (isScheduleChangeLog(g)) {
    return { label: 'đổi lịch', className: 'bg-indigo-50 text-indigo-700' };
  }
  return { label: 'đã điểm danh', className: 'bg-emerald-50 text-emerald-700' };
}

export const ScheduleView = ({ schedules = [], student, setNoteModalSched, displayGrades = [] }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date().getDate());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();
  const isCurrentMonth = month === todayMonth && year === todayYear;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Group schedules by day of month
  const scheduleMap = useMemo(() => {
    const map = {};
    (schedules || []).forEach(s => {
      const d = new Date(s.date);
      if (d.getMonth() === month && d.getFullYear() === year) {
        const day = d.getDate();
        if (!map[day]) map[day] = [];
        map[day].push(s);
      }
    });
    return map;
  }, [schedules, month, year]);

  const activeDate = selectedDate ?? (isCurrentMonth ? todayDay : null);
  const selectedSchedules = activeDate ? (scheduleMap[activeDate] || []) : [];
  const isShowingToday = isCurrentMonth && activeDate === todayDay;

  const [, setLiveTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setLiveTick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const isToday = (d) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  // Summary Stats
  const monthSchedules = useMemo(() => {
    return (schedules || []).filter(s => {
      const d = new Date(s.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [schedules, month, year]);

  const scheduleLogsOldestFirst = useMemo(() => {
    return [...(displayGrades || [])].sort((a, b) => parseScheduleRowMs(a) - parseScheduleRowMs(b));
  }, [displayGrades]);

  const upcomingCount = useMemo(() => {
    return monthSchedules.filter((s) => isScheduleUpcomingDisplay(s)).length;
  }, [monthSchedules]);

  const completedCount = useMemo(() => {
    return monthSchedules.filter((s) => getScheduleDisplayKind(s) === 'completed').length;
  }, [monthSchedules]);

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      {/* ── STATS HEADER BANNER ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center gap-3 sm:gap-4 hover:shadow-md transition">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Buổi sắp tới</p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 leading-none mt-1">
              {upcomingCount} <span className="text-xs font-semibold text-slate-400">buổi</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center gap-3 sm:gap-4 hover:shadow-md transition">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Đã hoàn thành</p>
            <p className="text-xl sm:text-2xl font-black text-emerald-600 leading-none mt-1">
              {completedCount} <span className="text-xs font-semibold text-slate-400">buổi</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-100 shadow-sm flex items-center gap-3 sm:gap-4 hover:shadow-md transition">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <BookOpen size={22} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tổng buổi trong tháng</p>
            <p className="text-xl sm:text-2xl font-black text-indigo-600 leading-none mt-1">
              {monthSchedules.length} <span className="text-xs font-semibold text-slate-400">buổi</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── MAIN CALENDAR GRID & RIGHT SIDE COLUMN ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch w-full min-w-0">
        {/* Lịch tháng (Trái) */}
        <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 p-4 sm:p-5 min-w-0 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 gap-2 min-w-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                  <Calendar size={18} />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight">Lịch theo tháng</h3>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/80 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="w-8 h-8 rounded-lg hover:bg-white transition-colors flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-none hover:shadow-sm"
                  title="Tháng trước"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs sm:text-sm font-extrabold text-slate-800 min-w-[6.5rem] text-center tabular-nums">
                  {monthNames[month]} {year}
                </span>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="w-8 h-8 rounded-lg hover:bg-white transition-colors flex items-center justify-center text-slate-600 hover:text-slate-900 shadow-none hover:shadow-sm"
                  title="Tháng sau"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Header Thứ */}
            <div className="grid grid-cols-7 text-center border-b border-slate-100 pb-2.5 mb-2.5">
              {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d, i) => (
                <div key={d} className={`text-[11px] sm:text-xs font-black uppercase tracking-wider ${i === 0 ? 'text-red-500' : 'text-slate-400'}`}>
                  {d}
                </div>
              ))}
            </div>

            {/* Grid Ô ngày */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {days.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;
                const daySchedules = scheduleMap[day] || [];
                const hasSchedule = daySchedules.length > 0;
                const isSelected = activeDate === day;
                const isTodayCell = isToday(day);

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDate(day === selectedDate ? null : day)}
                    className={`relative w-full h-8 sm:h-9 md:h-9.5 rounded-lg sm:rounded-xl flex flex-col items-center justify-center text-xs font-bold transition-all duration-200 active:scale-95 border ${
                      isSelected
                        ? 'bg-red-600 border-red-600 text-white shadow-md shadow-red-500/20 z-10'
                        : isTodayCell
                        ? 'bg-indigo-50/80 border-indigo-200 text-indigo-700 ring-2 ring-indigo-200/60 font-black'
                        : hasSchedule
                        ? 'bg-blue-50/80 border-blue-100 text-blue-900 hover:bg-blue-100/80'
                        : 'bg-white border-transparent text-slate-700 hover:bg-slate-50 hover:border-slate-100'
                    }`}
                  >
                    <span className={`leading-none ${isSelected ? 'text-white font-extrabold' : ''}`}>{day}</span>

                    {hasSchedule && (
                      <div className="flex gap-0.5 mt-0.5 justify-center">
                        {daySchedules.filter((s) => isScheduleUpcomingDisplay(s)).slice(0, 2).map((s, sidx) => (
                          <div key={'s-' + (s.id || s._id) + sidx} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-400'} shadow-sm`} />
                        ))}
                        {daySchedules.filter((s) => getScheduleDisplayKind(s) === 'past_pending').slice(0, 2).map((s, sidx) => (
                          <div key={'p-' + (s.id || s._id) + sidx} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-slate-300' : 'bg-slate-400'} shadow-sm`} />
                        ))}
                        {daySchedules.filter((s) => getScheduleDisplayKind(s) === 'completed').slice(0, 2).map((s, sidx) => (
                          <div key={'c-' + (s.id || s._id) + sidx} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-emerald-200' : 'bg-emerald-500'} shadow-sm`} />
                        ))}
                        {daySchedules.filter((s) => getScheduleDisplayKind(s) === 'cancelled').slice(0, 2).map((s, sidx) => (
                          <div key={'x-' + (s.id || s._id) + sidx} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-red-200' : 'bg-red-500'} shadow-sm`} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Legend chú thích */}
          <div className="px-2 pt-2.5 mt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-[11px] sm:text-xs font-semibold text-slate-500 shrink-0">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /> Đã hoàn thành</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" /> Sắp diễn ra</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" /> Đã qua</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" /> Đã hủy</span>
          </div>
        </div>

        {/* Cột Bên Phải (Phụ trách: 1. Chi tiết ca học + 2. Nhật ký học tập & Điểm số) */}
        <div className="lg:col-span-5 flex flex-col gap-3.5 sm:gap-4 min-w-0 h-full justify-between">
          {/* 1. Chi tiết lịch ngày được chọn */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl sm:rounded-3xl p-4 text-white shadow-xl shadow-slate-900/10 border border-slate-800/60 flex-1 min-h-[170px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10 shrink-0">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Calendar size={13} className="text-yellow-400" />
                  {activeDate
                    ? (isShowingToday
                      ? `Hôm nay — ${today.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })}`
                      : `Ngày ${activeDate}/${month + 1}/${year}`)
                    : 'Chọn ngày trên lịch'}
                </span>
                {activeDate && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/80 border border-white/10">
                    {selectedSchedules.length} buổi học
                  </span>
                )}
              </div>

              {selectedSchedules.length > 0 ? (
                <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
                  {selectedSchedules.map((s) => {
                    const kind = getScheduleDisplayKind(s);
                    const meta = getScheduleDisplayMeta(s);
                    return (
                      <div
                        key={s._id || s.id}
                        className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 hover:bg-white/15 transition duration-200"
                      >
                        <div className="flex justify-between items-start gap-2 mb-1.5">
                          <h4 className="font-bold text-xs sm:text-sm leading-snug line-clamp-2 text-white">
                            {s.topic || s.course || 'Buổi học'}
                          </h4>
                          <span
                            className={`text-[9px] font-black px-1.5 py-0.2 rounded uppercase shrink-0 border ${
                              kind === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : kind === 'cancelled'
                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                : kind === 'ongoing'
                                ? 'bg-green-500/30 text-green-200 border-green-400/40 animate-pulse'
                                : kind === 'past_pending'
                                ? 'bg-slate-500/25 text-slate-200 border-slate-400/30'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {meta.label}
                          </span>
                        </div>

                        <div className="space-y-0.5 text-[11px] text-slate-300 font-medium">
                          <p className="flex items-center gap-1">
                            <Clock size={12} className="text-amber-400 shrink-0" />
                            <span>{s.startTime}{s.endTime ? ` - ${s.endTime}` : ''}</span>
                          </p>
                          <p className="flex items-center gap-1 truncate">
                            <User size={12} className="text-sky-400 shrink-0" />
                            <span>GV: <strong className="text-white">{s.teacherName || s.teacher || 'Chưa phân công'}</strong></span>
                          </p>
                        </div>

                        {s.note && (
                          <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 italic">
                            <strong className="text-amber-300 not-italic block font-bold mb-0.5">Ghi chú GV:</strong>
                            {s.note}
                          </div>
                        )}

                        {s.studentNote && (
                          <div className="mt-1.5 p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-[11px] text-red-200 italic">
                            <strong className="text-red-300 not-italic block font-bold mb-0.5">Ghi chú của bạn:</strong>
                            {s.studentNote}
                          </div>
                        )}

                        {s.status === 'scheduled' && (
                          <div className="flex gap-2 mt-2 pt-2 border-t border-white/10">
                            {s.linkHoc && (
                              <a
                                href={s.linkHoc}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 py-1.5 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-lg text-[11px] font-black text-center shadow hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-1"
                              >
                                <Video size={12} /> VÀO LỚP NGAY
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setNoteModalSched(s);
                              }}
                              className="flex-1 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-lg text-[11px] font-bold text-center active:scale-95 transition"
                            >
                              GHI CHÚ / ĐỔI LỊCH
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-center space-y-1.5">
                  <div className="w-9 h-9 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center mx-auto text-indigo-300">
                    <Sparkles size={18} />
                  </div>
                  <h4 className="text-xs font-bold text-white">Không có lịch học ngày này</h4>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto leading-tight">
                    Bấm chọn ngày khác trên bảng lịch hoặc tranh thủ ôn luyện trắc nghiệm nhé!
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2 mt-1 border-t border-white/10 text-center shrink-0">
              <span className="text-[10px] text-slate-400 font-semibold">
                Cần hỗ trợ đổi buổi? Hãy dùng nút <strong>Ghi chú / Đổi lịch</strong> trên ca học.
              </span>
            </div>
          </div>

          {/* 2. Nhật ký lịch — hủy buổi / lịch học / đổi lịch / điểm danh buổi */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm p-3.5 sm:p-4 h-[250px] shrink-0 flex flex-col justify-between">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Calendar size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
                    Nhật ký lịch
                  </h3>
                </div>
              </div>
              {displayGrades && displayGrades.length > 0 && (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {displayGrades.length} sự kiện
                </span>
              )}
            </div>

            {scheduleLogsOldestFirst.length > 0 ? (
              <div className="flex-1 overflow-y-auto pr-1 divide-y divide-slate-100 space-y-0.5">
                {scheduleLogsOldestFirst.map((g, idx) => {
                  let parsedDate = g.date;
                  if (parsedDate && parsedDate.includes('T')) {
                    parsedDate = new Date(parsedDate).toLocaleDateString('vi-VN');
                  }
                  
                  const isUpdated = g.type === 'grade_update';
                  const isHomework = g.type === 'homework' || isUpdated;
                  const isQuiz = g.type === 'quiz';
                  const isCancelled = g.type === 'schedule_cancel' || g.type === 'attendance_cancel' || g.type === 'cancelled';
                  const isEvaluation = g.type === 'evaluation';
                  const isCourseComplete = g.type === 'course_complete';
                  const isScheduled = g.type === 'scheduled';
                  const isPastPending = g.type === 'past_pending'
                    || g.type === 'pending_attendance'
                    || g.type === 'overdue_attendance';
                  const isOverdue = g.type === 'overdue_attendance' || g.displayKind === 'overdue_attendance';
                  const isDoiLich = isScheduleChangeLog(g);
                  const status = scheduleLogStatus(g);

                  return (
                    <div
                      key={g._idx ?? idx}
                      className="py-2 px-1 hover:bg-slate-50/80 flex items-center justify-between gap-2 transition-colors duration-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${
                          isCancelled ? 'bg-red-50 text-red-600 border border-red-100' :
                          isOverdue ? 'bg-red-50 text-red-600 border border-red-100' :
                          isPastPending ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                          isDoiLich ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' :
                          isScheduled ? 'bg-blue-50 text-blue-600 border border-blue-100' :
                          isQuiz ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                          isEvaluation ? 'bg-pink-50 text-pink-600 border border-pink-100' :
                          isCourseComplete ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                          isHomework ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                          {isCancelled || isOverdue ? <XCircle size={13} />
                            : isPastPending || isScheduled || isDoiLich ? <Calendar size={13} />
                            : isQuiz ? <Award size={13} />
                            : isCourseComplete ? <Award size={13} />
                            : isHomework ? <ClipboardList size={13} />
                            : <CheckCircle size={13} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-extrabold text-slate-900 font-mono leading-none">
                              {g.time ? `${g.time} - ${parsedDate}` : parsedDate}
                            </span>
                            {isCancelled ? (
                              <span className="text-[9px] font-black uppercase bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.2 rounded-full leading-none">
                                Hủy buổi
                              </span>
                            ) : isDoiLich ? (
                              <span className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.2 rounded-full leading-none">
                                Đổi lịch
                              </span>
                            ) : isScheduled ? (
                              <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded-full leading-none">
                                {g.displayKind === 'ongoing' ? 'Đang diễn ra' : 'Lịch học'}
                              </span>
                            ) : isPastPending ? (
                              <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full leading-none border ${
                                isOverdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-800 border-orange-200'
                              }`}>
                                {isOverdue ? 'Quá hạn ĐD' : 'Chưa điểm danh'}
                              </span>
                            ) : isUpdated ? (
                              <span className="text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded-full leading-none">
                                Cập nhật điểm
                              </span>
                            ) : isEvaluation ? (
                              <span className="text-[9px] font-black uppercase bg-pink-50 text-pink-700 border border-pink-200 px-1.5 py-0.2 rounded-full leading-none">
                                Đánh giá
                              </span>
                            ) : isCourseComplete ? (
                              <span className="text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded-full leading-none">
                                Hoàn thành
                              </span>
                            ) : isHomework ? (
                              <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded-full leading-none">
                                Bài nộp
                              </span>
                            ) : isQuiz ? (
                              <span className="text-[9px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded-full leading-none">
                                Trắc nghiệm
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded-full leading-none">
                                Điểm danh buổi
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-600 font-medium mt-0.5 truncate leading-tight">
                            {g.note || 'Đã điểm danh hoàn thành buổi học'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md whitespace-nowrap ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-1 py-4">
                <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center mx-auto text-slate-300 border border-slate-100">
                  <FileText size={16} />
                </div>
                <p className="text-xs font-bold text-slate-700">Chưa có sự kiện lịch</p>
                <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                  Lịch học, đổi lịch, điểm danh và hủy buổi sẽ hiện tại đây.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleView;
