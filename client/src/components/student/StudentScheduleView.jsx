import React, { useMemo } from 'react';
import { Calendar, CheckCircle, Clock, Ban } from 'lucide-react';
import {
  getScheduleDisplayKind,
  isScheduleUpcomingDisplay,
} from '../../utils/scheduleTime';
import TeacherTeachingLog from '../teacher/TeacherTeachingLog';
import StudentWeeklyScheduleGrid from './StudentWeeklyScheduleGrid';

export const ScheduleView = ({
  schedules = [],
  student,
  setNoteModalSched,
}) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const monthSchedules = useMemo(() => (
    (schedules || []).filter((s) => {
      const d = new Date(s.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })
  ), [schedules, currentMonth, currentYear]);

  const completedCount = useMemo(
    () => monthSchedules.filter((s) => getScheduleDisplayKind(s) === 'completed').length,
    [monthSchedules],
  );
  const upcomingCount = useMemo(
    () => monthSchedules.filter((s) => isScheduleUpcomingDisplay(s)).length,
    [monthSchedules],
  );
  const cancelledCount = useMemo(
    () => monthSchedules.filter((s) => String(s.status) === 'cancelled').length,
    [monthSchedules],
  );

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100 shadow-sm">
            <Calendar size={22} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Quản lý Lịch học &amp; Điểm danh
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Xem lịch học theo tuần và nhật ký học tập
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wide">Đã học tháng này</p>
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

      <StudentWeeklyScheduleGrid
        schedules={schedules}
        student={student}
        onOpenSession={setNoteModalSched}
      />

      <TeacherTeachingLog
        schedules={schedules}
        variant="student"
        onOpenSession={setNoteModalSched}
      />
    </div>
  );
};

export default ScheduleView;
