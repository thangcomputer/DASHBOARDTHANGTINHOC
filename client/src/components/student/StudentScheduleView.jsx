import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar, Video, Clock, CheckCircle, XCircle, AlertCircle, FileText,
  ChevronLeft, ChevronRight, User, BookOpen, Sparkles, MessageSquare, ExternalLink, Award, ClipboardList
} from 'lucide-react';
import { isScheduleOngoingNow } from '../../utils/scheduleTime';
import { getGradeTextClasses, getGradePillClasses, getGradeLabel } from '../../utils/gradeColors';

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

  const upcomingCount = useMemo(() => {
    return monthSchedules.filter(s => s.status === 'scheduled').length;
  }, [monthSchedules]);

  const completedCount = useMemo(() => {
    return monthSchedules.filter(s => s.status === 'completed').length;
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* Lịch tháng (Trái) */}
        <div className="lg:col-span-7 bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 p-4 sm:p-5 min-w-0">
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
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
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
                  className={`relative aspect-square w-full min-h-[2.2rem] sm:min-h-[2.7rem] rounded-xl flex flex-col items-center justify-center text-xs sm:text-sm font-bold transition-all duration-200 active:scale-95 border ${
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
                    <div className="flex gap-1 mt-1 justify-center">
                      {daySchedules.filter(s => s.status === 'scheduled').slice(0, 2).map((s, sidx) => (
                        <div key={'s-' + s.id + sidx} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-amber-200' : 'bg-amber-400'} shadow-sm`} />
                      ))}
                      {daySchedules.filter(s => s.status === 'completed').slice(0, 2).map((s, sidx) => (
                        <div key={'c-' + s.id + sidx} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-200' : 'bg-emerald-500'} shadow-sm`} />
                      ))}
                      {daySchedules.filter(s => s.status === 'cancelled').slice(0, 2).map((s, sidx) => (
                        <div key={'x-' + s.id + sidx} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-red-200' : 'bg-red-500'} shadow-sm`} />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend chú thích */}
          <div className="px-2 pt-3 mt-3 border-t border-slate-100 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" /> Đã hoàn thành</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400 shrink-0" /> Sắp diễn ra</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" /> Đã hủy</span>
          </div>
        </div>

        {/* Cột Bên Phải (Phụ trách: 1. Chi tiết ca học + 2. Nhật ký học tập & Điểm số) */}
        <div className="lg:col-span-5 space-y-4 min-w-0">
          {/* 1. Chi tiết lịch ngày được chọn */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-2xl sm:rounded-3xl p-5 text-white shadow-xl shadow-slate-900/10 border border-slate-800/60 min-h-[220px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                <span className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                  <Calendar size={14} className="text-yellow-400" />
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
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                  {selectedSchedules.map((s) => {
                    const isOngoing = isScheduleOngoingNow(s);
                    return (
                      <div
                        key={s._id || s.id}
                        className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:bg-white/15 transition duration-200"
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <h4 className="font-bold text-sm sm:text-base leading-snug line-clamp-2 text-white">
                            {s.topic || s.course || 'Buổi học'}
                          </h4>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase shrink-0 border ${
                              s.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : s.status === 'cancelled'
                                ? 'bg-red-500/20 text-red-300 border-red-500/30'
                                : isOngoing
                                ? 'bg-green-500/30 text-green-200 border-green-400/40 animate-pulse'
                                : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                            }`}
                          >
                            {s.status === 'completed'
                              ? 'ĐÃ HỌC'
                              : s.status === 'cancelled'
                              ? 'ĐÃ HỦY'
                              : isOngoing
                              ? 'ĐANG DIỄN RA'
                              : 'SẮP HỌC'}
                          </span>
                        </div>

                        <div className="space-y-1 text-xs text-slate-300 font-medium">
                          <p className="flex items-center gap-1.5">
                            <Clock size={13} className="text-amber-400 shrink-0" />
                            <span>{s.startTime}{s.endTime ? ` - ${s.endTime}` : ''}</span>
                          </p>
                          <p className="flex items-center gap-1.5 truncate">
                            <User size={13} className="text-sky-400 shrink-0" />
                            <span>Giảng viên: <strong className="text-white">{s.teacherName || s.teacher || 'Chưa phân công'}</strong></span>
                          </p>
                        </div>

                        {s.note && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 italic">
                            <strong className="text-amber-300 not-italic block font-bold mb-0.5">Ghi chú GV:</strong>
                            {s.note}
                          </div>
                        )}

                        {s.studentNote && (
                          <div className="mt-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-200 italic">
                            <strong className="text-red-300 not-italic block font-bold mb-0.5">Ghi chú của bạn:</strong>
                            {s.studentNote}
                          </div>
                        )}

                        {s.status === 'scheduled' && (
                          <div className="flex gap-2 mt-3 pt-2 border-t border-white/10">
                            {s.linkHoc && (
                              <a
                                href={s.linkHoc}
                                target="_blank"
                                rel="noreferrer"
                                className="flex-1 py-2 bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl text-xs font-black text-center shadow-lg shadow-red-900/30 hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-1"
                              >
                                <Video size={13} /> VÀO LỚP NGAY
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setNoteModalSched(s);
                              }}
                              className="flex-1 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-xl text-xs font-bold text-center active:scale-95 transition"
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
                <div className="py-6 text-center space-y-2">
                  <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center mx-auto text-indigo-300">
                    <Sparkles size={22} />
                  </div>
                  <h4 className="text-sm font-bold text-white">Không có lịch học ngày này</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                    Bạn có thể bấm chọn ngày khác trên bảng lịch hoặc tranh thủ ôn luyện trắc nghiệm nhé!
                  </p>
                </div>
              )}
            </div>

            <div className="pt-2.5 mt-2 border-t border-white/10 text-center">
              <span className="text-[11px] text-slate-400 font-semibold">
                Cần hỗ trợ đổi buổi? Hãy dùng nút <strong>Ghi chú / Đổi lịch</strong> trên ca học.
              </span>
            </div>
          </div>

          {/* 2. Nhật ký học tập & Điểm số (Nằm ngay dưới cột bên phải) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    Nhật ký học tập &amp; Điểm số
                  </h3>
                </div>
              </div>
              {displayGrades && displayGrades.length > 0 && (
                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  {displayGrades.length} lượt ghi nhận
                </span>
              )}
            </div>

            {displayGrades && displayGrades.length > 0 ? (
              <div className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto pr-1">
                {displayGrades.map((g, idx) => {
                  let parsedDate = g.date;
                  if (parsedDate && parsedDate.includes('T')) {
                    parsedDate = new Date(parsedDate).toLocaleDateString('vi-VN');
                  }
                  const noteLower = (g.note || '').toLowerCase();
                  const isUpdated = noteLower.includes('cập nhật điểm') || noteLower.includes('sửa điểm');
                  const isHomework = noteLower.includes('bài nộp') || isUpdated;
                  const isQuiz = noteLower.includes('trắc nghiệm');

                  return (
                    <div
                      key={g._idx ?? idx}
                      className="py-3 px-1 hover:bg-slate-50/80 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between transition-colors duration-200"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                          isQuiz ? 'bg-purple-50 text-purple-600 border border-purple-100' :
                          isHomework ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                          'bg-blue-50 text-blue-600 border border-blue-100'
                        }`}>
                          {isQuiz ? <Award size={15} /> : isHomework ? <ClipboardList size={15} /> : <CheckCircle size={15} />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-extrabold text-slate-900 font-mono">
                              {g.time ? `${g.time} - ${parsedDate}` : parsedDate}
                            </span>
                            {isUpdated ? (
                              <span className="text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded-full">
                                Cập nhật điểm
                              </span>
                            ) : isHomework ? (
                              <span className="text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded-full">
                                Bài nộp
                              </span>
                            ) : isQuiz ? (
                              <span className="text-[9px] font-black uppercase bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.2 rounded-full">
                                Trắc nghiệm
                              </span>
                            ) : (
                              <span className="text-[9px] font-black uppercase bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 rounded-full">
                                Điểm danh
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-600 font-medium mt-0.5 leading-snug break-words">
                            {g.note || 'Đã điểm danh hoàn thành buổi học'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                        {g.grade > 0 ? (
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/60 px-2 py-1 rounded-lg">
                            <span className={`text-sm font-black tabular-nums ${getGradeTextClasses(g.grade)}`}>
                              {g.grade}
                            </span>
                            <span className="text-[10px] text-slate-400 font-bold">/10</span>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded ${getGradePillClasses(g.grade)}`}>
                              {getGradeLabel(g.grade) || 'TB'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-bold italic">--</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center space-y-1">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center mx-auto text-slate-300 border border-slate-100">
                  <FileText size={18} />
                </div>
                <p className="text-xs font-bold text-slate-700">Chưa có dữ liệu điểm danh</p>
                <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                  Dữ liệu bài tập &amp; điểm số sẽ xuất hiện tại đây sau khi bắt đầu học.
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
