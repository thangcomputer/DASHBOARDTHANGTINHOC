import React, { useMemo } from 'react';
import { CheckCircle, Clock, Ban } from 'lucide-react';
import {
  getScheduleDisplayKind,
  isScheduleUpcomingDisplay,
  normalizeScheduleDate,
  formatLocalDateKey,
} from '../../utils/scheduleTime';
import TeacherTeachingLog from '../teacher/TeacherTeachingLog';
import StudentWeeklyScheduleGrid from './StudentWeeklyScheduleGrid';

export const ScheduleView = ({
  schedules = [],
  student,
  setNoteModalSched,
}) => {
  const todayKey = formatLocalDateKey(new Date());
  const currentMonth = todayKey.slice(5, 7);
  const currentYear = todayKey.slice(0, 4);

  const monthSchedules = useMemo(() => (
    (schedules || []).filter((s) => {
      const key = normalizeScheduleDate(s.date);
      return key.slice(5, 7) === currentMonth && key.slice(0, 4) === currentYear;
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
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle size={20} />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400  tracking-wide">Đã học tháng này</p>
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
            <p className="text-[10px] sm:text-xs font-bold text-slate-400  tracking-wide">Buổi sắp tới</p>
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
            <p className="text-[10px] sm:text-xs font-bold text-slate-400  tracking-wide">Đã hủy</p>
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
