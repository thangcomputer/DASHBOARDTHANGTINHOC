import React, { useMemo } from 'react';
import { Calendar, Plus, CheckCircle, Clock, Ban } from 'lucide-react';
import TeacherMonthlyCalendar from './TeacherMonthlyCalendar';
import { isScheduleDateBeforeToday } from '../../utils/scheduleTime';

export default function TeacherScheduleTab({
  setEditingSchedule,
  setShowScheduleModal,
  mySchedules = [],
  startEditSchedule,
  cancelSchedule,
}) {
  const today = new Date();
  const currentMonth = today.getMonth();

  const completedCount = useMemo(() => {
    return (mySchedules || []).filter(s => s.status === 'completed' && new Date(s.date).getMonth() === currentMonth).length;
  }, [mySchedules, currentMonth]);

  const upcomingCount = useMemo(() => {
    return (mySchedules || []).filter(s => s.status === 'scheduled' && new Date(s.date).getMonth() === currentMonth).length;
  }, [mySchedules, currentMonth]);

  const cancelledCount = useMemo(() => {
    return (mySchedules || []).filter(s => s.status === 'cancelled' && new Date(s.date).getMonth() === currentMonth).length;
  }, [mySchedules, currentMonth]);

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-6 animate-in fade-in duration-500">
      {/* Top Banner Toolbar & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 shadow-sm">
            <Calendar size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Quản lý Lịch dạy &amp; Điểm danh
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Theo dõi danh sách ca dạy, sắp lịch mới và ghi nhận điểm danh
            </p>
          </div>
        </div>

        <button
          onClick={() => { setEditingSchedule(null); setShowScheduleModal(true); }}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black shadow-md shadow-blue-500/20 active:scale-95 transition flex items-center justify-center gap-2 shrink-0 min-h-10 cursor-pointer"
        >
          <Plus size={16} /> Xếp lịch dạy mới
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide">Đã dạy tháng này</p>
            <p className="text-base sm:text-xl font-black text-emerald-600 leading-tight">
              {completedCount} <span className="text-xs font-semibold text-slate-400">buổi</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide">Buổi sắp tới</p>
            <p className="text-base sm:text-xl font-black text-slate-800 leading-tight">
              {upcomingCount} <span className="text-xs font-semibold text-slate-400">buổi</span>
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <Ban size={20} />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide">Đã hủy</p>
            <p className="text-base sm:text-xl font-black text-rose-600 leading-tight">
              {cancelledCount} <span className="text-xs font-semibold text-slate-400">buổi</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Monthly Calendar & Right Column */}
      <TeacherMonthlyCalendar
        schedules={mySchedules}
        onEditSchedule={startEditSchedule}
        onAddSchedule={(date) => {
          if (isScheduleDateBeforeToday(date)) {
            return;
          }
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          setEditingSchedule({ date: `${yyyy}-${mm}-${dd}`, fromCalendar: true });
          setShowScheduleModal(true);
        }}
        onCancelSchedule={(scheduleId, reason) => {
          cancelSchedule(scheduleId, reason);
        }}
      />
    </div>
  );
}
