import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, CalendarPlus, Check, CheckCircle, Clock, Ban, Copy, Download, ExternalLink, QrCode, Table2, Video, X } from 'lucide-react';
import TeacherMonthlyCalendar from './TeacherMonthlyCalendar';
import TeacherWeeklySlotGrid from './TeacherWeeklySlotGrid';
import TeacherTeachingLog from './TeacherTeachingLog';
import AttendanceMakeupRequestModal from './AttendanceMakeupRequestModal';
import { QrSvg } from '../student/DigitalCertificateModal';
import {
  endTimeFromStart,
  formatLocalDateKey,
  formatScheduleDateVi,
  getScheduleDisplayKind,
  isScheduleDateBeforeToday,
  isSchedulePastEnd,
  normalizeScheduleDate,
} from '../../utils/scheduleTime';
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

function normalizeTimeParts(timeStr = '09:00') {
  const [rawH = '09', rawM = '00'] = String(timeStr || '09:00').trim().split(':');
  const hhNum = parseInt(rawH, 10);
  const mmNum = parseInt(rawM, 10);
  if (!Number.isFinite(hhNum) || !Number.isFinite(mmNum)) return ['09', '00'];
  if (hhNum >= 24) return ['23', '59'];
  return [
    String(Math.max(0, Math.min(23, hhNum))).padStart(2, '0'),
    String(Math.max(0, Math.min(59, mmNum))).padStart(2, '0'),
  ];
}

function toGoogleUtcStamp(dateStr, timeStr = '09:00') {
  const day = normalizeScheduleDate(dateStr);
  if (!day) return '';
  const [hh, mm] = normalizeTimeParts(timeStr);
  const d = new Date(`${day}T${hh}:${mm}:00+07:00`);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
}

function escapeIcsText(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

function formatWeekdayVi(dateKey) {
  if (!dateKey) return '';
  const d = new Date(`${dateKey}T12:00:00+07:00`);
  if (Number.isNaN(d.getTime())) return formatScheduleDateVi(dateKey);
  const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  return `${dayNames[d.getDay()]} · ${formatScheduleDateVi(dateKey)}`;
}

function buildGoogleCalendarEventUrl(sch, studentName, meetUrl) {
  const startTime = sch?.startTime || '09:00';
  const endTime = sch?.endTime || endTimeFromStart(startTime) || '10:30';
  const startUtc = toGoogleUtcStamp(sch?.date, startTime);
  const endUtc = toGoogleUtcStamp(sch?.date, endTime);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Dạy ${studentName || 'Học viên'}${sch?.course ? ` · ${sch.course}` : ''}`,
    dates: `${startUtc}/${endUtc}`,
    details: `Giảng viên Thắng Tin Học${sch?.course ? `\nKhóa học: ${sch.course}` : ''}${meetUrl ? `\nGoogle Meet: ${meetUrl}` : ''}`,
    location: meetUrl || 'Online Google Meet',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildQuickAttendancePin(sch) {
  const raw = String(sch?._id || sch?.id || `${sch?.date || ''}-${sch?.startTime || ''}`);
  let h = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    h = Math.imul(h ^ raw.charCodeAt(i), 16777619);
  }
  return String(Math.abs(h) % 900000 + 100000);
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
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrScheduleId, setQrScheduleId] = useState('');
  const [qrCopied, setQrCopied] = useState(false);
  const [gcalModalOpen, setGcalModalOpen] = useState(false);
  const [gcalOpenedIds, setGcalOpenedIds] = useState([]);

  useEffect(() => {
    if (!gcalModalOpen && !qrModalOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      setGcalModalOpen(false);
      setQrModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [gcalModalOpen, qrModalOpen]);

  const todayKey = formatLocalDateKey(new Date());

  const studentById = useMemo(() => {
    const map = new Map();
    for (const st of students || []) {
      const sid = String(st?._id || st?.id || '').trim();
      if (sid && !map.has(sid)) map.set(sid, st);
    }
    return map;
  }, [students]);

  const resolveScheduleStudentName = useCallback((sch) => (
    sch?.studentName
    || (typeof sch?.studentId === 'object' ? sch.studentId?.name : '')
    || studentById.get(resolveStudentId(sch))?.name
    || 'Học viên'
  ), [studentById]);

  const resolveScheduleMeetLink = useCallback((sch) => (
    sch?.linkHoc
    || sch?.meetingUrl
    || studentById.get(resolveStudentId(sch))?.linkHoc
    || ''
  ), [studentById]);

  const scheduledUpcoming = useMemo(() => {
    const now = new Date();
    const currentTodayKey = formatLocalDateKey(now);
    return (mySchedules || [])
      .filter((s) => {
        if (!s || s.status !== 'scheduled' || !s.date) return false;
        const dayKey = normalizeScheduleDate(s.date);
        if (!dayKey || dayKey < currentTodayKey) return false;
        return !isSchedulePastEnd(s, now);
      })
      .sort((a, b) => `${normalizeScheduleDate(a.date)}-${a.startTime || ''}`.localeCompare(`${normalizeScheduleDate(b.date)}-${b.startTime || ''}`));
  }, [mySchedules]);

  const groupedUpcomingByDate = useMemo(() => {
    const groups = [];
    const indexByDate = new Map();
    for (const sch of scheduledUpcoming) {
      const dayKey = normalizeScheduleDate(sch.date);
      if (!dayKey) continue;
      if (!indexByDate.has(dayKey)) {
        indexByDate.set(dayKey, groups.length);
        groups.push({ dateKey: dayKey, items: [] });
      }
      groups[indexByDate.get(dayKey)].items.push(sch);
    }
    return groups;
  }, [scheduledUpcoming]);

  const activeQrSchedule = useMemo(() => {
    if (qrScheduleId) {
      const found = scheduledUpcoming.find((s) => String(s._id || s.id) === String(qrScheduleId));
      if (found) return found;
    }
    return scheduledUpcoming[0] || null;
  }, [scheduledUpcoming, qrScheduleId]);

  const handleExportIcs = useCallback((customList = null, { silentEmptyToast = false } = {}) => {
    const now = new Date();
    const currentTodayKey = formatLocalDateKey(now);
    const source = Array.isArray(customList) ? customList : scheduledUpcoming;
    const list = (source || []).filter((s) => {
      if (!s || s.status !== 'scheduled' || !s.date) return false;
      const dayKey = normalizeScheduleDate(s.date);
      return Boolean(dayKey) && dayKey >= currentTodayKey && !isSchedulePastEnd(s, now);
    });
    if (!list.length) {
      if (!silentEmptyToast) {
        toast.error('Không có ca dạy sắp tới nào từ hôm nay trở đi để đồng bộ.');
      }
      return false;
    }

    const dtStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const events = list.map((sch, idx) => {
      const uid = `${String(sch._id || sch.id || idx)}@thangtinhoc.vn`;
      const startTime = sch.startTime || '09:00';
      const endTime = sch.endTime || endTimeFromStart(startTime) || '10:30';
      const startUtc = toGoogleUtcStamp(sch.date, startTime);
      const endUtc = toGoogleUtcStamp(sch.date, endTime);
      const studentName = resolveScheduleStudentName(sch);
      const title = `Dạy ${studentName}${sch.course ? ` - ${sch.course}` : ''}`;
      const meetUrl = resolveScheduleMeetLink(sch);
      const desc = `Khóa học: ${sch.course || 'Tin học'}${meetUrl ? `\nLink Google Meet: ${meetUrl}` : ''}`;
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${startUtc}`,
        `DTEND:${endUtc}`,
        'STATUS:CONFIRMED',
        `SUMMARY:${escapeIcsText(title)}`,
        `DESCRIPTION:${escapeIcsText(desc)}`,
        `LOCATION:${escapeIcsText(meetUrl || 'Online Google Meet')}`,
        'END:VEVENT',
      ].join('\r\n');
    }).join('\r\n');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Thang Tin Hoc//Lich Day LMS//VI',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Lich day sap toi - Thang Tin Hoc',
      'X-WR-TIMEZONE:Asia/Ho_Chi_Minh',
      events,
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Lich-day-sap-toi-ThangTinHoc.ics';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Đã xuất ${list.length} ca sắp tới (.ics) từ hôm nay trở đi.`);
    return true;
  }, [scheduledUpcoming, resolveScheduleStudentName, resolveScheduleMeetLink, toast]);

  const handleOpenGoogleCalModal = useCallback(() => {
    if (!scheduledUpcoming.length) {
      toast.error('Không có ca dạy sắp tới nào từ hôm nay trở đi để đồng bộ.');
      return;
    }
    setGcalModalOpen(true);
  }, [scheduledUpcoming.length, toast]);

  const handleOpenSingleGoogleCal = useCallback((sch) => {
    const schId = String(sch?._id || sch?.id || `${sch?.date}-${sch?.startTime}`);
    const url = buildGoogleCalendarEventUrl(
      sch,
      resolveScheduleStudentName(sch),
      resolveScheduleMeetLink(sch),
    );
    window.open(url, '_blank', 'noopener,noreferrer');
    setGcalOpenedIds((prev) => (prev.includes(schId) ? prev : [...prev, schId]));
  }, [resolveScheduleStudentName, resolveScheduleMeetLink]);

  const handleSyncAllGoogleCal = useCallback(() => {
    if (!scheduledUpcoming.length) {
      toast.error('Không có ca dạy sắp tới nào từ hôm nay trở đi để đồng bộ.');
      return;
    }
    const exported = handleExportIcs(scheduledUpcoming);
    if (!exported) return;
    window.open('https://calendar.google.com/calendar/u/0/r/settings/export', '_blank', 'noopener,noreferrer');
    setGcalOpenedIds(scheduledUpcoming.map((sch) => String(sch?._id || sch?.id || `${sch?.date}-${sch?.startTime}`)));
  }, [scheduledUpcoming, handleExportIcs, toast]);

  const handleOpenAllGoogleCalTabs = useCallback(() => {
    if (!scheduledUpcoming.length) return;
    const ids = [];
    for (const sch of scheduledUpcoming) {
      const schId = String(sch?._id || sch?.id || `${sch?.date}-${sch?.startTime}`);
      ids.push(schId);
      const url = buildGoogleCalendarEventUrl(
        sch,
        resolveScheduleStudentName(sch),
        resolveScheduleMeetLink(sch),
      );
      window.open(url, '_blank', 'noopener,noreferrer');
    }
    setGcalOpenedIds((prev) => Array.from(new Set([...prev, ...ids])));
    toast.success(`Đã mở ${scheduledUpcoming.length} ca sắp tới trên Google Calendar (nếu bị chặn pop-up, dùng nút tải .ics).`);
  }, [scheduledUpcoming, resolveScheduleStudentName, resolveScheduleMeetLink, toast]);

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

  /** Nhật ký: quá hạn / hết hạn xác nhận → popup điểm danh bù tại chỗ; còn lại → hồ sơ HV. */
  const handleOpenAttendance = useCallback((sch) => {
    const kind = getScheduleDisplayKind(sch);
    if (kind !== 'overdue_attendance' && kind !== 'makeup_attendance') {
      openStudentProfile(sch);
      return;
    }
    const sid = resolveStudentId(sch);
    if (!sid) {
      toast.error('Không tìm thấy học viên của ca này.');
      return;
    }
    const schCourse = String(sch.course || sch.courseName || '').trim().toLowerCase();
    const found = (students || []).find(
      (s) => String(s._id || s.id) === sid && (!schCourse || String(s.course || '').trim().toLowerCase() === schCourse),
    ) || (students || []).find((s) => String(s._id || s.id) === sid);
    const student = found
      ? { ...found, course: sch.course || sch.courseName || found.course || '' }
      : {
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
      {/* Thanh công cụ Đồng bộ Google Calendar & Điểm danh nhanh QR / Meet */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-xs">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wider text-slate-500">
            Tiện ích lịch dạy &amp; Điểm danh nhanh
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {scheduledUpcoming.length > 0
              ? `Đang có ${scheduledUpcoming.length} ca sắp tới sẵn sàng đồng bộ & quét mã QR.`
              : 'Kéo-thả hoặc xếp ca dạy trực tiếp trên bảng lịch tuần bên dưới.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleExportIcs()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <Download size={14} aria-hidden="true" /> Xuất lịch (.ics)
          </button>
          <button
            type="button"
            onClick={handleOpenGoogleCalModal}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 cursor-pointer"
          >
            <CalendarPlus size={14} aria-hidden="true" /> Đồng bộ Google Calendar
          </button>
          <button
            type="button"
            onClick={() => { setQrScheduleId(''); setQrModalOpen(true); }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
          >
            <QrCode size={14} aria-hidden="true" /> Điểm danh QR / Meet
          </button>
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

      {gcalModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/65 p-3 sm:p-5 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGcalModalOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="gcal-sync-modal-title"
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-blue-50/70 px-5 py-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white">
                  <CalendarPlus size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 id="gcal-sync-modal-title" className="truncate text-base font-black text-slate-900">
                    Đồng bộ Google Calendar ({scheduledUpcoming.length} ca sắp tới)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Chỉ đồng bộ các ca từ hôm nay trở đi ({groupedUpcomingByDate.length} ngày), bỏ qua các ngày đã qua.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGcalModalOpen(false)}
                aria-label="Đóng"
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {scheduledUpcoming.length > 0 ? (
                <>
                  <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-3.5 space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSyncAllGoogleCal}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white shadow-xs hover:bg-blue-700 cursor-pointer"
                      >
                        <Download size={14} aria-hidden="true" />
                        Đồng bộ tất cả {scheduledUpcoming.length} ca (.ics -&gt; Google Calendar)
                      </button>
                      {scheduledUpcoming.length > 1 && scheduledUpcoming.length <= 10 && (
                        <button
                          type="button"
                          onClick={handleOpenAllGoogleCalTabs}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-50 cursor-pointer"
                        >
                          <ExternalLink size={14} aria-hidden="true" />
                          Mở nhanh {scheduledUpcoming.length} tab Google Calendar
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Tệp <span className="font-semibold text-slate-800">.ics</span> chứa toàn bộ{' '}
                      <span className="font-bold text-blue-700">{scheduledUpcoming.length} ca sắp tới</span> trên{' '}
                      <span className="font-bold text-blue-700">{groupedUpcomingByDate.length} ngày</span>. Sau khi tải xuống, chọn{' '}
                      <span className="font-semibold text-slate-800">Select file from your computer</span> tại trang Import vừa mở để thêm hết một lần.
                    </p>
                  </div>

                  <div className="max-h-[52vh] overflow-y-auto pr-1 space-y-3">
                    {groupedUpcomingByDate.map(({ dateKey, items }) => (
                      <div key={dateKey} className="rounded-2xl border border-slate-200 bg-slate-50/60 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 border-b border-slate-200/80 bg-white px-3.5 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-black text-slate-800 truncate">
                              {formatWeekdayVi(dateKey)}
                            </span>
                            {dateKey === todayKey && (
                              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">
                                Hôm nay
                              </span>
                            )}
                          </div>
                          <span className="shrink-0 text-xs font-bold text-slate-500">
                            {items.length} ca
                          </span>
                        </div>

                        <div className="divide-y divide-slate-200/70">
                          {items.map((sch) => {
                            const schId = String(sch._id || sch.id || `${sch.date}-${sch.startTime}`);
                            const startTime = sch.startTime || '09:00';
                            const endTime = sch.endTime || endTimeFromStart(startTime) || '10:30';
                            const studentName = resolveScheduleStudentName(sch);
                            const opened = gcalOpenedIds.includes(schId);
                            return (
                              <div key={schId} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-white/70">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold text-slate-700">
                                      <Clock size={11} aria-hidden="true" />
                                      {startTime} – {endTime}
                                    </span>
                                    <span className="truncate text-xs font-extrabold text-slate-900">
                                      {studentName}
                                    </span>
                                  </div>
                                  {sch.course && (
                                    <p className="mt-0.5 truncate text-xs text-slate-500">
                                      {sch.course}
                                    </p>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleOpenSingleGoogleCal(sch)}
                                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer shrink-0 ${
                                    opened
                                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                      : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                  }`}
                                >
                                  {opened ? <Check size={13} aria-hidden="true" /> : <CalendarPlus size={13} aria-hidden="true" />}
                                  {opened ? 'Đã mở ✓' : 'Thêm vào Google Calendar'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="py-6 text-center text-sm text-slate-500">
                  Không có ca dạy sắp tới nào từ hôm nay trở đi để đồng bộ.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {qrModalOpen && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/65 p-3 sm:p-5 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setQrModalOpen(false);
          }}
        >
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-emerald-50/70 px-5 py-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white">
                  <QrCode size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-base font-black text-slate-900">Điểm danh nhanh QR &amp; Google Meet</h3>
                  <p className="text-xs text-slate-500">Gửi mã QR / PIN cho học viên hoặc bấm điểm danh ngay khi vào Meet</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQrModalOpen(false)}
                aria-label="Đóng"
                className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {scheduledUpcoming.length > 0 && activeQrSchedule ? (() => {
                const sch = activeQrSchedule;
                const schId = String(sch._id || sch.id || '');
                const pin = buildQuickAttendancePin(sch);
                const sid = resolveStudentId(sch);
                const verifyUrl = `${window.location.origin}/student#overview?attend=${encodeURIComponent(schId)}&pin=${pin}`;
                const meetLink = resolveScheduleMeetLink(sch);
                const schStudentName = resolveScheduleStudentName(sch);
                return (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">Chọn ca dạy sắp tới:</label>
                      <select
                        value={String(sch._id || sch.id || '')}
                        onChange={(e) => setQrScheduleId(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:border-emerald-500 focus:outline-none"
                      >
                        {scheduledUpcoming.map((item) => {
                          const iid = String(item._id || item.id);
                          return (
                            <option key={iid} value={iid}>
                              {formatScheduleDateVi(normalizeScheduleDate(item.date))} · {item.startTime || '--:--'} · {resolveScheduleStudentName(item)} ({item.course || 'Tin học'})
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-xs shrink-0">
                        <QrSvg value={verifyUrl} size={128} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Mã PIN điểm danh</p>
                        <p className="font-mono text-2xl font-black tracking-widest text-slate-900">{pin}</p>
                        <p className="text-xs text-slate-600">
                          Học viên: <strong>{schStudentName}</strong> · {formatScheduleDateVi(normalizeScheduleDate(sch.date))} ({sch.startTime || ''})
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard?.writeText(verifyUrl);
                              setQrCopied(true);
                              setTimeout(() => setQrCopied(false), 1800);
                            } catch {
                              /* ignore */
                            }
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          {qrCopied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                          {qrCopied ? 'Đã sao chép link điểm danh' : 'Chép link QR'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                      {meetLink && (
                        <button
                          type="button"
                          onClick={() => window.open(meetLink, '_blank', 'noopener,noreferrer')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"
                        >
                          <Video size={14} /> Mở Google Meet
                        </button>
                      )}
                      {sid && (
                        <button
                          type="button"
                          onClick={() => {
                            setQrModalOpen(false);
                            handleOpenAttendance(sch);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-700"
                        >
                          <CheckCircle size={14} /> Xác nhận điểm danh ngay
                        </button>
                      )}
                    </div>
                  </>
                );
              })() : (
                <p className="py-6 text-center text-sm text-slate-500">
                  Chưa có ca dạy sắp tới nào đang ở trạng thái chờ điểm danh.
                </p>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
