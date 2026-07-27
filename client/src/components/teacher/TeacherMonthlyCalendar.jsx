import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus, Calendar, Clock, X, Ban, PlayCircle, CheckCircle, Video, MessageSquare, Edit3, Trash2 } from 'lucide-react';
import { isScheduleOngoingNow } from '../../utils/scheduleTime';
import { showGlossyAlert } from './TeacherShared';

export const MonthlyCalendar = ({ schedules, onEditSchedule, onAddSchedule, onCancelSchedule }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date().getDate());
  const [cancelTarget, setCancelTarget] = useState(null); // schedule đang muốn hủy
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [, setLiveTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setLiveTick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const getDisplayStatus = (schedule) => (
    isScheduleOngoingNow(schedule) ? 'ongoing' : schedule.status
  );

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthNames = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
    'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today       = new Date();
  today.setHours(0, 0, 0, 0);

  const isPast = (day) => {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return d < today;
  };
  const isToday = (day) => {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  };

  // Group schedules by date
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

  const selectedSchedules = selectedDay ? (scheduleMap[selectedDay] || []) : [];

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  // Xác định màu sắc đại diện của ngày (priority: completed > scheduled > cancelled)
  const getDayStatus = (daySchs) => {
    if (!daySchs?.length) return null;
    if (daySchs.some(s => s.status === 'completed')) return 'completed';
    if (daySchs.some(s => s.status === 'scheduled')) return 'scheduled';
    if (daySchs.some(s => s.status === 'cancelled')) return 'cancelled';
    return null;
  };

  // Hủy lịch → gọi API cancel
  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      const API = import.meta.env.VITE_API_URL || (import.meta.env.VITE_API_URL || "");
      const token = localStorage.getItem('teacher_access_token') || localStorage.getItem('admin_access_token');
      const res = await csrfFetch(`${API}/api/schedules/${cancelTarget._id || cancelTarget.id}/cancel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data = await res.json();
      if (data.success) {
        if (onCancelSchedule) onCancelSchedule(cancelTarget._id || cancelTarget.id, cancelReason);
      } else {
        showGlossyAlert(data.message || 'Lỗi khi hủy lịch');
      }
    } catch (e) {
    }
    setCancelling(false);
    setCancelTarget(null);
    setCancelReason('');
  };

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-start">
      {/* ─ CALENDAR GRID ─ */}
      <div className="bg-white rounded-[2rem] shadow-sm border-0 p-3 sm:p-5 w-full xl:w-[420px] flex-shrink-0">
        {/* Header Nav */}
        <div className="px-2 py-4 flex items-center justify-between mb-2">
          <h3 className="font-extrabold text-teal-800 text-base sm:text-lg tracking-wide">
            Lịch theo tháng
          </h3>
          <div className="flex items-center gap-1.5 sm:gap-3">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-1 sm:p-2 rounded-xl hover:bg-slate-50 transition text-slate-500 hover:text-slate-800 active:scale-95">
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-2 border-2 border-slate-100 rounded-xl px-3 py-1.5 sm:py-2 text-sm font-bold text-slate-700 shadow-sm bg-white">
              <span className="min-w-[90px] sm:min-w-[110px] text-center">tháng {month + 1} {year}</span>
              <Calendar size={14} className="text-slate-400" />
            </div>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-1 sm:p-2 rounded-xl hover:bg-slate-50 transition text-slate-500 hover:text-slate-800 active:scale-95">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 text-center px-1 border-b border-slate-50 pb-3 mb-3">
          {['CN','T2','T3','T4','T5','T6','T7'].map((d, i) => (
            <div key={d} className={`text-xs font-black uppercase tracking-widest ${i === 0 ? 'text-orange-500' : 'text-slate-500'}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 px-1 gap-y-2 gap-x-1 sm:gap-y-3 sm:gap-x-2">
          {days.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} />;

            const daySchs  = scheduleMap[day] || [];
            const past     = isPast(day);
            const todayDay = isToday(day);
            const selected = selectedDay === day;
            const hasData  = daySchs.length > 0;
            const canAddNew = !past && !hasData;

            // Xác định ngày Chủ Nhật để highlight số
            const isSunday = (idx % 7 === 0);

            return (
              <button
                key={day}
                onClick={() => {
                  if (past && !hasData) return;
                  setSelectedDay(day === selectedDay ? null : day);
                  if (canAddNew && onAddSchedule) onAddSchedule(new Date(year, month, day));
                }}
                title={
                  hasData ? daySchs.map(s => `${s.startTime} - ${s.studentName || s.course}${(s.topic || s.note) ? ` (${s.topic || s.note})` : ''}`).join('\n') 
                  : past ? 'Ngày đã qua, không thể sắp lịch' 
                  : 'Click để sắp lịch hôm này'
                }
                className={`relative w-full h-[3.25rem] sm:h-14 rounded-[1.25rem] flex flex-col items-center justify-center text-sm font-bold transition-all border-2
                  ${
                    selected
                      ? 'bg-teal-50/50 border-teal-600 shadow-sm text-teal-800'
                    : todayDay && !hasData
                      ? 'bg-white border-slate-200 text-slate-800 ring-2 ring-slate-100 ring-offset-2'
                    : past && !hasData
                      ? 'opacity-30 cursor-not-allowed border-transparent text-slate-400'
                    : hasData 
                      ? 'bg-[#B2DFDB]/50 border-transparent hover:bg-[#B2DFDB]/70 text-slate-700'
                    : 'text-slate-600 hover:bg-slate-50 border-transparent hover:border-slate-100 cursor-pointer'
                  }
                `}
              >
                <span className={`${isSunday ? 'text-orange-500' : ''} ${(todayDay && !selected) ? 'text-blue-600 font-black' : ''}`}>
                  {day}
                </span>

                {/* Status dots container - stacked below number */}
                {hasData && (
                  <div className="flex gap-1 mt-0.5 flex-wrap justify-center px-1">
                    {/* Render different color dots depending on status */}
                    {daySchs.filter(s => s.status === 'scheduled').slice(0,2).map(s => (
                      <div key={'s-'+s._id} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${s.hasUnreadStudentNote ? 'bg-red-500 animate-[ping_1.5s_ease-in-out_infinite]' : isScheduleOngoingNow(s) ? 'bg-green-500' : 'bg-amber-400'} shadow-sm`} />
                    ))}
                    {daySchs.filter(s => s.status === 'completed').slice(0,2).map(s => (
                      <div key={'c-'+s._id} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${s.hasUnreadStudentNote ? 'bg-red-500 animate-[ping_1.5s_ease-in-out_infinite]' : 'bg-emerald-400'} shadow-sm`} />
                    ))}
                    {daySchs.filter(s => s.status === 'cancelled').slice(0,2).map(s => (
                      <div key={'x-'+s._id} className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${s.hasUnreadStudentNote ? 'bg-red-500 animate-[ping_1.5s_ease-in-out_infinite]' : 'bg-red-400'} shadow-sm`} />
                    ))}
                    {daySchs.length > 4 && (
                      <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-400 shadow-sm" />
                    )}
                  </div>
                )}
                
                {/* Quick-add hint on empty future day */}
                {canAddNew && (
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-white/50 backdrop-blur-[1px] rounded-xl border border-dashed border-teal-300">
                    <Plus size={16} className="text-teal-600" />
                  </div>
                )}
                {/* Diagonal line for full-cancelled days */}
                {!past && !selected && daySchs.length > 0 && daySchs.every(s => s.status === 'cancelled') && (
                  <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-0 w-full h-full" style={{ background: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(239,68,68,0.15) 4px, rgba(239,68,68,0.15) 5px)' }} />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="px-3 sm:px-6 pb-4 flex flex-wrap gap-3 sm:gap-5 text-xs text-gray-500 border-t border-gray-50 pt-3">
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-400" /> Đã dạy</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-amber-400" /> Sắp tới</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-green-500" /> Đang diễn ra</span>
          <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-red-400" /> Đã hủy</span>
          <span className="flex items-center gap-1.5 text-blue-500"><Plus size={10} /> Click ngày trống để sắp lịch</span>
        </div>
      </div>

      {/* ─ RIGHT COLUMN (Detail Panel & Upcoming) ─ */}
      <div className="flex-1 w-full flex flex-col gap-6">
        
      {/* ─ DETAIL PANEL (khi chọn 1 ngày) Hoặc TRẠNG THÁI TRỐNG ─ */}
      {selectedDay ? (
        <div className="bg-white rounded-[2rem] border-0 shadow-sm overflow-hidden min-h-[300px]">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h4 className="font-bold text-gray-800 text-sm">
              Lịch ngày {selectedDay}/{month + 1}/{year}
            </h4>
            <button onClick={() => setSelectedDay(null)} className="p-1 hover:bg-gray-100 rounded-lg">
              <X size={16} className="text-gray-400" />
            </button>
          </div>

          {selectedSchedules.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-400 text-sm mb-3">Không có lịch ngày này.</p>
              {!isPast(selectedDay) && (
                <button
                  onClick={() => { setSelectedDay(null); if (onAddSchedule) onAddSchedule(new Date(year, month, selectedDay)); }}
                  className="text-xs bg-blue-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-1.5 mx-auto"
                >
                  <Plus size={12} /> Sắp lịch ngày này
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {selectedSchedules.map(s => {
                const past = isPast(selectedDay);
                const displayStatus = getDisplayStatus(s);
                const isCancellable = !past && s.status === 'scheduled' && displayStatus !== 'ongoing';
                const cfg = STATUS_COLORS[displayStatus] || STATUS_COLORS.scheduled;
                return (
                  <div key={s._id || s.id} className="px-5 py-4 flex items-center gap-4 group hover:bg-gray-50 transition-colors">
                    {/* Status icon */}
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.badge}`}>
                      {displayStatus === 'completed' ? <CheckCircle size={16} /> :
                       displayStatus === 'cancelled' ? <Ban size={16} /> :
                       displayStatus === 'ongoing' ? <Video size={16} className="animate-pulse" /> :
                       <Clock size={16} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${s.status === 'cancelled' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                        {s.studentName || s.course || 'Lịch học'}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {s.startTime}{s.endTime ? ` – ${s.endTime}` : ''} &bull; {s.course}
                      </p>
                      {(s.topic || s.note) && (
                        <p className="text-xs font-medium text-blue-600 mt-1 truncate border-l-2 border-blue-500 pl-2 bg-blue-50/50 py-0.5 rounded-r">
                          <span className="font-bold opacity-80">Ghi chú của bạn:</span> {s.topic || s.note}
                        </p>
                      )}
                      {s.studentNote && (
                        <div className="text-xs font-bold text-red-600 mt-1 line-clamp-3 border-l-2 border-red-500 pl-2 bg-red-50 py-1 rounded-r flex gap-1 items-start shadow-sm pr-2">
                          <MessageSquare size={12} className="mt-0.5 text-red-500 flex-shrink-0" />
                          <div className="leading-tight flex-1">
                            {s.studentName || 'Học viên'} đã nhắn: {s.hasUnreadStudentNote && <span className="inline-block relative -top-0.5 ml-0.5 w-1.5 h-1.5 rounded-full bg-red-500 animate-[ping_1.5s_ease-in-out_infinite]" title="Có tin nhắn mới"></span>}
                            <br/><span className="italic font-medium text-red-500 line-clamp-2 mt-0.5">"{s.studentNote}"</span>
                          </div>
                        </div>
                      )}
                      <span className={`text-xs cms-min-text-xs font-black px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mt-1 ${cfg.badge}`}>
                        {cfg.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {s.status === 'scheduled' && !past && (
                        <button
                          onClick={() => onEditSchedule && onEditSchedule(s)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Sửa lịch"
                        >
                          <Edit3 size={14} />
                        </button>
                      )}
                      {isCancellable && (
                        <button
                          onClick={() => { setCancelTarget(s); setCancelReason(''); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          title="Hủy lịch này"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-[2rem] border-0 shadow-sm min-h-[300px] flex flex-col items-center justify-center text-slate-400 p-8 text-center border-dashed border-2 border-slate-100">
          <div className="w-20 h-20 bg-slate-50 flex items-center justify-center rounded-[1.5rem] mb-4 text-teal-600/20">
            <Calendar size={40} />
          </div>
          <h3 className="text-lg font-bold text-slate-700 mb-2">Chưa chọn ngày</h3>
          <p className="text-sm max-w-sm">Vui lòng bấm vào một ngày bất kỳ trên lịch phía trái để xem chi tiết hoặc sắp lịch mới.</p>
        </div>
      )}

      {/* ─ UPCOMING LIST ─ */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h4 className="text-sm font-bold text-gray-700">📅 Sắp tới trong tháng</h4>
          <span className="text-xs text-gray-400 font-bold">
            {schedules.filter(s => s.status === 'scheduled' && new Date(s.date) >= today && new Date(s.date).getMonth() === month).length} buổi
          </span>
        </div>
        <div className="divide-y divide-gray-50 max-h-56 overflow-y-auto">
          {schedules
            .filter(s => s.status === 'scheduled' && new Date(s.date).getMonth() === month)
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .map(s => {
              const d = new Date(s.date);
              const displayStatus = getDisplayStatus(s);
              const cfg = STATUS_COLORS[displayStatus] || STATUS_COLORS.scheduled;
              return (
                <div key={s._id || s.id} className={`px-5 py-3 flex items-center gap-3 transition group ${displayStatus === 'ongoing' ? 'bg-green-50/40' : 'hover:bg-amber-50/30'}`}>
                  <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${displayStatus === 'ongoing' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    <span className="text-[8px] font-bold">{monthNames[d.getMonth()]}</span>
                    <span className="text-sm font-black">{d.getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-800 truncate">{s.studentName || s.course}</p>
                    <p className="text-xs text-gray-400">{s.startTime} – {s.endTime} &bull; {s.course}</p>
                    {(s.topic || s.note) && (
                      <p className="text-xs font-medium text-amber-600 mt-0.5 truncate">
                        📖 {s.topic || s.note}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-lg flex-shrink-0 uppercase ${cfg.badge}`}>
                    {displayStatus === 'ongoing' ? 'Đang diễn ra' : s.startTime}
                  </span>
                  {/* Hover cancel button */}
                  {new Date(s.date) >= today && displayStatus !== 'ongoing' && (
                    <button
                      onClick={() => { setCancelTarget(s); setCancelReason(''); }}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      title="Hủy lịch"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          {schedules.filter(s => s.status === 'scheduled' && new Date(s.date).getMonth() === month).length === 0 && (
            <div className="px-5 py-6 text-center text-gray-400 text-sm">Không có buổi nào sắp tới.</div>
          )}
        </div>
      </div>

      {/* ─ STATS ROW ─ */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Tổng', value: schedules.filter(s => new Date(s.date).getMonth() === month).length, color: 'bg-blue-50 text-blue-600' },
          { label: 'Đã dạy', value: schedules.filter(s => s.status === 'completed' && new Date(s.date).getMonth() === month).length, color: 'bg-emerald-50 text-emerald-600' },
          { label: 'Sắp tới', value: schedules.filter(s => s.status === 'scheduled' && new Date(s.date).getMonth() === month).length, color: 'bg-amber-50 text-amber-600' },
          { label: 'Đã hủy', value: schedules.filter(s => s.status === 'cancelled' && new Date(s.date).getMonth() === month).length, color: 'bg-red-50 text-red-500' },
        ].map((st, i) => (
          <div key={i} className={`${st.color} rounded-xl p-3 text-center border border-current/10`}>
            <p className="text-xl font-black">{st.value}</p>
            <p className="text-xs font-bold uppercase">{st.label}</p>
          </div>
        ))}
      </div>

      </div>

      {/* ─ MODAL HUỶY LịCH ─ */}
      {cancelTarget && (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
          <div className="bg-white rounded-[28px] w-full max-w-sm shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 p-6 text-white flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-black text-base">Hủy lịch dạy</h3>
                <p className="text-red-200 text-xs mt-0.5">{cancelTarget.studentName} • {cancelTarget.course}</p>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-600">Hành động này sẽ <strong>hủy vĩnh viễn</strong> buổi học này và ghi vào nhật ký hệ thống.</p>
              <div>
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mb-2">Lý do hủy *</label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="Ví dụ: Học viên xin nghỉ, Giảng viên bận..."
                  className="w-full border-2 border-gray-200 focus:border-red-400 rounded-xl px-4 py-3 text-sm outline-none resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setCancelTarget(null); setCancelReason(''); }}
                  className="flex-1 py-3 text-gray-500 font-bold bg-gray-50 rounded-xl hover:bg-gray-100"
                >Hủy bỏ</button>
                <button
                  onClick={handleConfirmCancel}
                  disabled={!cancelReason.trim() || cancelling}
                  className="flex-[2] py-3 text-white font-bold bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {cancelling ? 'Đang hủy...' : 'Đồng ý Hủy lịch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── TEACHER RATING DISPLAY ─────────────────────────────────────────────────


export default MonthlyCalendar;
