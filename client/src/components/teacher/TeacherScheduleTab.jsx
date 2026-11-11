import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CheckCircle, Clock, Ban, Table2 } from 'lucide-react';
import TeacherMonthlyCalendar from './TeacherMonthlyCalendar';
import TeacherWeeklySlotGrid from './TeacherWeeklySlotGrid';
import TeacherTeachingLog from './TeacherTeachingLog';
import AttendanceMakeupRequestModal from './AttendanceMakeupRequestModal';
import { getScheduleDisplayKind, isScheduleDateBeforeToday } from '../../utils/scheduleTime';
import { isDateInCalendarMonth } from '../../utils/teacherFinance';
import { TEACHER_WEEKLY_SLOT_GRID_EXPERIMENT, SHOW_TEACHER_MONTHLY_CALENDAR } from '../../utils/weeklySlotGrid';
import { useToast } from '../../utils/useToast';

function resolveStudentId(sch) {
  return String(
    sch?.studentId?._id
    || sch?.studentId?.id
    || sch?.studentId
    || sch?.student?._id
    || sch?.student?.id
    || sch?.student
    || '',
  ).trim();
}

export default function TeacherScheduleTab({
  setEditingSchedule,
  setShowScheduleModal,
  mySchedules = [],
  startEditSchedule,
  cancelSchedule,
  students = [],
  teacherId,
  addSchedule,
  updateSchedule,
  allSchedules,
}) {
  const navigate = useNavigate();
  const toast = useToast();
  const today = useMemo(() => new Date(), []);
  const [makeupTarget, setMakeupTarget] = useState(null);
  const [scheduleView, setScheduleView] = useState('week');

  const isCurrentMonth = useCallback((schedule) => {
    return isDateInCalendarMonth(schedule?.date, today);
  }, [today]);

  const teacherSession = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('teacher_user') || '{}') || {};
    } catch {
      return {};
    }
  }, []);

  const completedCount = useMemo(() => {
    return (mySchedules || []).filter(s => s.status === 'completed' && isCurrentMonth(s)).length;
  }, [mySchedules, isCurrentMonth]);

  const upcomingCount = useMemo(() => {
    return (mySchedules || []).filter(s => s.status === 'scheduled' && isCurrentMonth(s)).length;
  }, [mySchedules, isCurrentMonth]);

  const cancelledCount = useMemo(() => {
    return (mySchedules || []).filter(s => s.status === 'cancelled' && isCurrentMonth(s)).length;
  }, [mySchedules, isCurrentMonth]);

  const openStudentProfile = useCallback((sch) => {
    const sid = resolveStudentId(sch);
    if (!sid) {
      toast.error('Không tìm thấy học viên của ca này.');
      return;
    }
    const course = String(sch.course || sch.courseName || '').trim();
    const q = new URLSearchParams();
    q.set('studentId', sid);
    if (course) q.set('course', course);
    navigate(`/teacher#students?${q.toString()}`);
  }, [navigate, toast]);

  /** Nhật ký: quá hạn → popup điểm danh bù; còn lại → hồ sơ HV (điểm danh thường). */
  const handleOpenAttendance = useCallback((sch) => {
    const kind = getScheduleDisplayKind(sch);
    if (kind !== 'overdue_attendance') {
      openStudentProfile(sch);
      return;
    }
    const sid = resolveStudentId(sch);
    if (!sid) {
      toast.error('Không tìm thấy học viên của ca này.');
      return;
    }
    const found = (students || []).find(
      (s) => String(s._id || s.id) === sid,
    );
    const student = found || {
      _id: sid,
      id: sid,
      name: sch.studentName || 'Học viên',
      course: sch.course || sch.courseName || '',
      completedSessions: sch.completedSessions,
      remainingSessions: sch.remainingSessions,
      totalSessions: sch.totalSessions,
    };
    setMakeupTarget({ schedule: sch, student });
  }, [openStudentProfile, students, toast]);

  return (
    <div className="space-y-4 sm:space-y-6 w-full min-w-0 bg-[#F5F8FC] py-3 sm:py-6 animate-in fade-in duration-500">
      {/* Top Banner Toolbar & Quick Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex w-11 h-11 sm:w-12 sm:h-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <CalendarDays size={22} strokeWidth={2.3} />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Quản lý Lịch dạy &amp; Điểm danh
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Xếp lịch theo tuần và xem nhật ký giảng dạy
            </p>
          </div>
        </div>
      </div>

      {scheduleView === 'month' && SHOW_TEACHER_MONTHLY_CALENDAR && (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
            <div className="flex w-10 h-10 sm:w-11 sm:h-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <CheckCircle size={22} strokeWidth={2.3} />
            </div>
            <div>
              <p className="text-xs sm:text-xs font-bold text-slate-400 tracking-wide">Đã dạy tháng này</p>
              <p className="text-base sm:text-xl font-black text-emerald-600 leading-tight">
                {completedCount} <span className="text-xs font-semibold text-slate-400">buổi</span>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
            <div className="flex w-10 h-10 sm:w-11 sm:h-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Clock size={22} strokeWidth={2.3} />
            </div>
            <div>
              <p className="text-xs sm:text-xs font-bold text-slate-400 tracking-wide">Buổi sắp tới</p>
              <p className="text-base sm:text-xl font-black text-slate-800 leading-tight">
                {upcomingCount} <span className="text-xs font-semibold text-slate-400">buổi</span>
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-left">
            <div className="flex w-10 h-10 sm:w-11 sm:h-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
              <Ban size={22} strokeWidth={2.3} />
            </div>
            <div>
              <p className="text-xs sm:text-xs font-bold text-slate-400 tracking-wide">Đã hủy</p>
              <p className="text-base sm:text-xl font-black text-rose-600 leading-tight">
                {cancelledCount} <span className="text-xs font-semibold text-slate-400">buổi</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {TEACHER_WEEKLY_SLOT_GRID_EXPERIMENT && SHOW_TEACHER_MONTHLY_CALENDAR && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1" role="tablist" aria-label="Chế độ xem lịch">
          {[
            { key: 'week', label: 'Xếp lịch học viên', icon: Table2 },
            { key: 'month', label: 'Lịch tháng', icon: CalendarDays },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={scheduleView === key}
              onClick={() => setScheduleView(key)}
              className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 text-xs font-extrabold transition-all cursor-pointer sm:text-sm ${
                scheduleView === key
                  ? 'bg-[#10B981] border border-[#34D399] border-b-4 border-b-[#059669] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 border-b-4 border-b-slate-300 hover:bg-slate-50'
              }`}
            >
              {React.createElement(Icon, { size: 16, 'aria-hidden': true })}
              <span>{label}</span>
            </button>
          ))}
        </div>
      )}

      {SHOW_TEACHER_MONTHLY_CALENDAR && (!TEACHER_WEEKLY_SLOT_GRID_EXPERIMENT || scheduleView === 'month') && (
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
      )}

      {TEACHER_WEEKLY_SLOT_GRID_EXPERIMENT && (!SHOW_TEACHER_MONTHLY_CALENDAR || scheduleView === 'week') && (
        <TeacherWeeklySlotGrid
          students={students}
          teacherId={teacherId}
          mySchedules={mySchedules}
          allSchedules={allSchedules}
          addSchedule={addSchedule}
          updateSchedule={updateSchedule}
          cancelSchedule={cancelSchedule}
        />
      )}

      {scheduleView === 'week' && (
        <TeacherTeachingLog
          schedules={mySchedules}
          students={students}
          onOpenAttendance={handleOpenAttendance}
        />
      )}

      <AttendanceMakeupRequestModal
        open={Boolean(makeupTarget)}
        onClose={() => setMakeupTarget(null)}
        student={makeupTarget?.student}
        schedule={makeupTarget?.schedule}
        teacherName={teacherSession.name || 'Giảng viên'}
        teacherId={String(teacherId || teacherSession.id || teacherSession._id || '')}
      />
    </div>
  );
}
