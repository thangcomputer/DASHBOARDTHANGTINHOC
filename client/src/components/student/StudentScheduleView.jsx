import React, { useMemo } from 'react';
import { Calendar, CheckCircle, Clock, Ban } from 'lucide-react';
import {
  getScheduleDisplayKind,
  isScheduleUpcomingDisplay,
  normalizeScheduleDate,
  formatLocalDateKey,
} from '../../utils/scheduleTime';
import { isFreePortalSelfRegistrationStudent } from '../../utils/enrollments';
import StudentWeeklyScheduleGrid from './StudentWeeklyScheduleGrid';
import StudentDiaryLog from './StudentDiaryLog';

export const ScheduleView = ({
  schedules = [],
  allSchedules = [],
  student,
  enrollments = [],
  activeCourseName,
  onSelectCourse,
  setNoteModalSched,
}) => {
  const isFree = isFreePortalSelfRegistrationStudent(student);
  const todayKey = formatLocalDateKey(new Date());
  const currentMonth = todayKey.slice(5, 7);
  const currentYear = todayKey.slice(0, 4);

  const targetSchedules = (allSchedules && allSchedules.length > 0) ? allSchedules : schedules;

  const monthSchedules = useMemo(() => (
    (targetSchedules || []).filter((s) => {
      const key = normalizeScheduleDate(s.date);
      return key.slice(5, 7) === currentMonth && key.slice(0, 4) === currentYear;
    })
  ), [targetSchedules, currentMonth, currentYear]);

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
    <div className="student-flat-zone space-y-4 sm:space-y-5 w-full min-w-0">
      {/* ── Header: Quản lý Lịch học & Điểm danh ── */}
      <div className="bg-white rounded-[24px] sm:rounded-[28px] px-4 py-3 sm:px-5 sm:py-3.5 border border-slate-200/80 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
            isFree
              ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
              : 'bg-red-50 text-red-600 border-red-100'
          }`}>
            <Calendar size={20} />
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Quản lý Lịch học & Điểm danh
          </h2>
        </div>
      </div>

      {/* ── 3 thẻ thống kê tròn trịa ── */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <div className="bg-white rounded-[22px] p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center mb-1 ${
            isFree ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
          }`}>
            <CheckCircle size={18} />
          </div>
          <p className="text-[11px] font-bold text-slate-500">Đã học tháng này</p>
          <p className={`mt-0.5 text-base sm:text-lg font-black ${
            isFree ? 'text-emerald-600' : 'text-red-600'
          }`}>
            {completedCount} <span className="text-xs font-semibold text-slate-400">buổi</span>
          </p>
        </div>

        <div className="bg-white rounded-[22px] p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-1">
            <Clock size={18} />
          </div>
          <p className="text-[11px] font-bold text-slate-500">Buổi sắp tới</p>
          <p className="mt-0.5 text-base sm:text-lg font-black text-amber-600">
            {upcomingCount} <span className="text-xs font-semibold text-slate-400">buổi</span>
          </p>
        </div>

        <div className="bg-white rounded-[22px] p-3 sm:p-4 border border-slate-200/80 shadow-sm flex flex-col items-center justify-center text-center">
          <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-1">
            <Ban size={18} />
          </div>
          <p className="text-[11px] font-bold text-slate-500">Đã hủy</p>
          <p className="mt-0.5 text-base sm:text-lg font-black text-rose-600">
            {cancelledCount} <span className="text-xs font-semibold text-slate-400">buổi</span>
          </p>
        </div>
      </div>

      {/* ── Thẻ Lịch học theo tuần ── */}
      <StudentWeeklyScheduleGrid
        schedules={schedules}
        student={student}
        isFree={isFree}
        enrollments={enrollments}
        activeCourseName={activeCourseName}
        onSelectCourse={onSelectCourse}
        onOpenSession={setNoteModalSched}
      />

      {/* ── Thẻ Nhật ký học tập ── */}
      <StudentDiaryLog
        schedules={schedules}
        student={student}
        isFree={isFree}
        onOpenSession={setNoteModalSched}
      />
    </div>
  );
};

export default ScheduleView;
