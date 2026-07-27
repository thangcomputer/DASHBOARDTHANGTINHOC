import React, { useState, useMemo, useEffect } from 'react';
import { Calendar, Video, Clock, CheckCircle, XCircle, AlertCircle, FileText, ExternalLink, ChevronRight } from 'lucide-react';
import { isScheduleOngoingNow } from '../../utils/scheduleTime';
import { getGradeTextClasses, getGradeLabel } from '../../utils/gradeColors';

export const ScheduleView = ({ schedules, student, setNoteModalSched }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date().getDate());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = ['tháng 1', 'tháng 2', 'tháng 3', 'tháng 4', 'tháng 5', 'tháng 6',
    'tháng 7', 'tháng 8', 'tháng 9', 'tháng 10', 'tháng 11', 'tháng 12'];

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();
  const isCurrentMonth = month === todayMonth && year === todayYear;

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Group schedules
  const scheduleMap = useMemo(() => {
    const map = {};
    schedules.forEach(s => {
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Lịch tháng */}
      <div className="lg:col-span-7 bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between min-w-0">
          <h3 className="font-extrabold text-slate-800 uppercase tracking-tight">Lịch theo tháng</h3>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
              <ChevronRight size={18} className="text-slate-500 rotate-180" />
            </button>
            <span className="text-sm font-bold text-slate-700 min-w-[120px] text-center">
              {monthNames[month]} {year}
            </span>
            <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition">
              <ChevronRight size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 text-center px-2 sm:px-4 pt-4">
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((d, i) => (
            <div key={d} className={`text-xs font-black py-2 cms-min-text-xs ${i === 0 ? 'text-red-500' : 'text-slate-400'}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 px-2 sm:px-4 pb-4 sm:pb-6 gap-0.5 sm:gap-1 md:gap-2">
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`} />;
            const hasSchedule = scheduleMap[day]?.length > 0;
            const daySchedules = scheduleMap[day] || [];
            const hasUpcoming = daySchedules.some(s => s.status === 'scheduled');
            const hasCompleted = daySchedules.some(s => s.status === 'completed');
            const isSelected = activeDate === day;

            return (
              <button key={day} onClick={() => setSelectedDate(day === selectedDate ? null : day)}
                className={`relative aspect-square min-h-[2.25rem] rounded-xl sm:rounded-2xl flex flex-col items-center justify-center text-xs sm:text-sm font-bold transition-all ${
                  isSelected ? 'bg-blue-600 text-white shadow-xl ring-4 ring-blue-100 scale-105 z-10' :
                  isToday(day) ? 'bg-indigo-50 text-indigo-700 ring-2 ring-indigo-200' :
                  hasSchedule ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : 'text-slate-600 hover:bg-slate-50'
                }`}>
                {day}
                {hasSchedule && (
                  <div className="flex gap-1 mt-1 flex-wrap justify-center px-1">
                    {daySchedules.filter(s => s.status === 'scheduled').slice(0,2).map((s, idx) => (
                      <div key={'s-'+s.id+idx} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-amber-500'} shadow-sm`} />
                    ))}
                    {daySchedules.filter(s => s.status === 'completed').slice(0,2).map((s, idx) => (
                      <div key={'c-'+s.id+idx} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-emerald-500'} shadow-sm`} />
                    ))}
                    {daySchedules.filter(s => s.status === 'cancelled').slice(0,2).map((s, idx) => (
                      <div key={'x-'+s.id+idx} className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-red-500'} shadow-sm`} />
                    ))}
                  </div>
                )}
                {/* Diagonal line for full-cancelled days */}
                {!isSelected && daySchedules.length > 0 && daySchedules.every(s => s.status === 'cancelled') && (
                  <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full" style={{ background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(239,68,68,0.15) 4px, rgba(239,68,68,0.15) 5px)' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-4 sm:px-6 pb-4 flex flex-wrap gap-3 sm:gap-5 text-xs text-gray-500 border-t border-gray-50 pt-4 mt-2">
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500" /> Đã học xong</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-500" /> Sắp diễn ra</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-500" /> Đã hủy</span>
        </div>
      </div>

      {/* Chi tiết lịch */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-gradient-to-br from-[#203DB5] to-[#1E3A8A] rounded-3xl p-6 text-white shadow-xl">
          <p className="text-blue-200 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
            <Calendar size={14} className="text-yellow-400" />
            {activeDate
              ? (isShowingToday
                ? `Hôm nay — ${today.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })}`
                : `Ngày ${activeDate}/${month + 1}/${year}`)
              : 'Chọn ngày để xem lịch'
            }
          </p>
          
          {selectedSchedules.length > 0 ? (
            <div className="space-y-4">
              {selectedSchedules.map(s => (
                <div key={s.id} className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 hover:bg-white/20 transition-all">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-extrabold text-base leading-tight">{s.topic || s.course}</h4>
                    {(() => {
                      let text = 'SẮP HỌC';
                      let style = 'bg-blue-400/20 text-blue-200';
                      if (s.status === 'completed') { text = 'ĐÃ XONG'; style = 'bg-emerald-400/20 text-emerald-300'; }
                      else if (s.status === 'cancelled') { text = 'ĐÃ HỦY'; style = 'bg-red-400/20 text-red-300'; }
                      else if (s.status === 'no_show') { text = 'VẮNG MẶT'; style = 'bg-orange-400/20 text-orange-300'; }
                      else if (isScheduleOngoingNow(s)) { text = 'ĐANG DIỄN RA'; style = 'bg-green-400/30 text-green-200 ring-1 ring-green-300/40'; }
                      return <span className={`text-xs cms-min-text-xs font-black px-2 py-1 rounded-lg uppercase whitespace-nowrap ${style}`}>{text}</span>;
                    })()}
                  </div>
                  <p className="text-blue-100 text-xs font-semibold">🕐 {s.startTime} - {s.endTime}</p>
                  <p className="text-blue-100 text-xs font-semibold mt-0.5">👤 GV: {s.teacherName}</p>
                  {s.note && (
                    <p className="text-blue-200/80 text-xs mt-2 bg-white/5 p-2.5 rounded-xl border border-white/5 italic">
                      <span className="font-bold block text-blue-200/90 mb-0.5">Ghi chú từ GV:</span> {s.note}
                    </p>
                  )}
                  {s.studentNote && (
                    <p className="text-red-200 text-xs mt-2 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20 italic">
                      <span className="font-bold block text-red-300 mb-0.5">Ghi chú của bạn:</span> {s.studentNote}
                    </p>
                  )}
                  
                  {s.status === 'scheduled' && (
                    <div className="flex gap-2 mt-4">
                       {s.linkHoc && (
                         <a href={s.linkHoc} target="_blank" rel="noreferrer" className="flex-1 bg-white text-blue-900 py-2.5 rounded-xl text-xs font-black text-center shadow-[0_4px_15px_rgba(0,0,0,0.1)] active:scale-95 transition-all">
                           VÀO LỚP
                         </a>
                       )}
                       <button 
                         type="button"
                         onClick={(e) => {
                           e.preventDefault();
                           e.stopPropagation();
                           setNoteModalSched(s);
                         }}
                         className="flex-1 bg-white/10 hover:bg-white/20 border border-white/20 text-white py-2.5 rounded-xl text-xs font-black text-center transition-all relative z-10 cursor-pointer">
                           GHI CHÚ / ĐỔI LỊCH
                       </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-blue-200/60 font-bold border-2 border-dashed border-white/10 rounded-2xl">
              Không có lịch học ngày này.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Materials Section ──────────────────────────────────────────────────────


export default ScheduleView;
