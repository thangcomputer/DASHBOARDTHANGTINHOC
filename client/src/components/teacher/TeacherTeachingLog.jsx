import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookText, Video, UserCheck } from 'lucide-react';
import {
  formatLocalDateKey,
  formatScheduleDateVi,
  getScheduleDisplayKind,
  getScheduleDisplayMeta,
  normalizeScheduleDate,
} from '../../utils/scheduleTime';
import { startOfWeekMonday, weekDateKeys } from '../../utils/weeklySlotGrid';
import { localizeScheduleNote } from '../../utils/studentActivityLogs';

const PENDING_KINDS = new Set(['pending_attendance', 'overdue_attendance', 'past_pending']);

function isCancelledSchedule(sch) {
  const st = String(sch?.status || '').trim().toLowerCase();
  return st === 'cancelled' || st === 'canceled' || st === 'no_show';
}

const COPY = {
  teacher: {
    title: 'Nhật ký giảng dạy',
    subtitle: 'Xem toàn bộ ca dạy, theo ngày / tuần / tháng, chưa điểm danh hoặc đã hủy.',
    tabs: [
      { id: 'all', label: 'Tất cả' },
      { id: 'day', label: 'Ngày' },
      { id: 'week', label: 'Tuần' },
      { id: 'month', label: 'Tháng' },
      { id: 'pending', label: 'Chưa điểm danh' },
      { id: 'cancelled', label: 'Lịch hủy' },
    ],
    empty: {
      day: 'Không có ca dạy trong ngày hôm nay.',
      week: 'Không có ca dạy trong tuần này.',
      month: 'Không có ca dạy trong tháng này.',
      all: 'Chưa có ca dạy.',
      pending: 'Không có ca chưa điểm danh.',
      cancelled: 'Không có lịch hủy.',
    },
  },
  student: {
    title: 'Nhật ký học tập',
    subtitle: 'Xem toàn bộ ca học, theo ngày / tuần / tháng, chưa điểm danh hoặc đã hủy.',
    tabs: [
      { id: 'all', label: 'Tất cả' },
      { id: 'day', label: 'Ngày' },
      { id: 'week', label: 'Tuần' },
      { id: 'month', label: 'Tháng' },
      { id: 'pending', label: 'Chưa điểm danh' },
      { id: 'cancelled', label: 'Lịch hủy' },
    ],
    empty: {
      day: 'Không có ca học trong ngày hôm nay.',
      week: 'Không có ca học trong tuần này.',
      month: 'Không có ca học trong tháng này.',
      all: 'Chưa có ca học.',
      pending: 'Không có ca chưa điểm danh.',
      cancelled: 'Không có lịch hủy.',
    },
  },
};

const KIND_TONE = {
  completed: 'text-emerald-700 bg-emerald-50',
  cancelled: 'text-rose-600 bg-rose-50',
  ongoing: 'text-green-700 bg-green-50',
  upcoming: 'text-amber-700 bg-amber-50',
  pending_attendance: 'text-orange-700 bg-orange-50',
  overdue_attendance: 'text-red-700 bg-red-50',
  past_pending: 'text-orange-700 bg-orange-50',
};

function scheduleKey(sch) {
  return String(sch?._id || sch?.id || '');
}

function startMinutes(sch) {
  const t = String(sch?.startTime || '99:99');
  const [h, m] = t.split(':').map((n) => parseInt(n, 10));
  return (Number.isFinite(h) ? h : 99) * 60 + (Number.isFinite(m) ? m : 0);
}

function cancelActionMs(sch) {
  const raw = sch?.cancelledAt || sch?.updatedAt;
  const t = raw ? new Date(raw).getTime() : 0;
  if (Number.isFinite(t) && t > 0) return t;
  return 0;
}

function sortCancelledByAction(list) {
  return (list || []).slice().sort((a, b) => cancelActionMs(b) - cancelActionMs(a));
}

function sortSchedules(list) {
  return (list || []).slice().sort((a, b) => {
    const da = normalizeScheduleDate(a.date);
    const db = normalizeScheduleDate(b.date);
    if (da !== db) return da > db ? -1 : 1;
    return startMinutes(b) - startMinutes(a);
  });
}

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

export default function TeacherTeachingLog({
  schedules = [],
  variant = 'teacher',
  onOpenSession,
  onOpenAttendance,
}) {
  const copy = COPY[variant] || COPY.teacher;
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const todayKey = formatLocalDateKey(new Date());
  const now = useMemo(() => new Date(), []);
  const weekKeys = useMemo(() => weekDateKeys(startOfWeekMonday(now)), [now]);
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const list = useMemo(() => {
    const all = schedules || [];
    if (tab === 'all') {
      // Toàn bộ ca kể cả đã hủy / no_show (không lọc status)
      return sortSchedules(all.slice());
    }
    if (tab === 'cancelled') {
      return sortCancelledByAction(all.filter(isCancelledSchedule));
    }
    if (tab === 'pending') {
      return sortSchedules(
        all.filter((s) => {
          if (isCancelledSchedule(s)) return false;
          return PENDING_KINDS.has(getScheduleDisplayKind(s));
        }),
      );
    }
    const inRange = all.filter((s) => {
      if (isCancelledSchedule(s)) return false;
      const key = normalizeScheduleDate(s.date);
      if (tab === 'day') return key === todayKey;
      if (tab === 'week') return weekKeys.includes(key);
      if (tab === 'month') return key.startsWith(monthPrefix);
      return false;
    });
    return sortSchedules(inRange);
  }, [schedules, tab, todayKey, weekKeys, monthPrefix]);

  const emptyText = copy.empty[tab];

  const openAttendanceFor = (sch) => {
    if (typeof onOpenAttendance === 'function') {
      onOpenAttendance(sch);
      return;
    }
    if (variant !== 'teacher') return;
    const sid = resolveStudentId(sch);
    if (!sid) return;
    const course = String(sch.course || sch.courseName || '').trim();
    const q = new URLSearchParams();
    q.set('studentId', sid);
    if (course) q.set('course', course);
    navigate(`/teacher#students?${q.toString()}`);
  };

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0 border border-red-100">
            <BookText size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              {copy.title}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              {copy.subtitle}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {copy.tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`px-3 h-9 rounded-xl text-[11px] sm:text-xs font-bold transition ${
                tab === item.id
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white text-red-600 border-2 border-red-600 hover:bg-red-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 sm:px-5 py-3 sm:py-4">
        {list.length === 0 ? (
          <p className="text-sm text-slate-400 font-medium py-6 text-center">{emptyText}</p>
        ) : (
          <ol className="space-y-2">
            {list.map((sch) => {
              const kind = getScheduleDisplayKind(sch);
              const meta = getScheduleDisplayMeta(sch);
              const tone = KIND_TONE[kind] || KIND_TONE.upcoming;
              const time = sch.endTime
                ? `${sch.startTime || ''} – ${sch.endTime}`
                : (sch.startTime || '');
              const note = localizeScheduleNote(sch.topic || sch.note || sch.cancelReason || '');
              const who = variant === 'student'
                ? (sch.teacherName || sch.teacher || 'Giảng viên')
                : (sch.studentName || 'Học viên');
              const canAct = variant === 'student'
                && String(sch.status) === 'scheduled'
                && typeof onOpenSession === 'function';
              const needsAttendance = variant === 'teacher' && PENDING_KINDS.has(kind);
              const canOpenAttendance = needsAttendance
                && (typeof onOpenAttendance === 'function' || Boolean(resolveStudentId(sch)));
              const attendanceLabel = kind === 'overdue_attendance'
                ? 'Điểm danh bù'
                : 'Điểm danh';
              const studentNote = String(sch.studentNote || '').trim();
              return (
                <li
                  key={scheduleKey(sch)}
                  className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs sm:text-sm text-slate-800 font-semibold leading-relaxed min-w-0">
                      {who}
                      {sch.course ? ` · ${sch.course}` : ''}
                      {' · '}
                      {formatScheduleDateVi(sch.date)}
                      {time ? ` · ${time}` : ''}
                    </p>
                    {variant === 'teacher' && studentNote ? (
                      <p
                        className="shrink-0 max-w-[42%] text-right text-[11px] text-red-700 font-medium leading-relaxed line-clamp-2"
                        title={studentNote}
                      >
                        Ghi chú: {studentNote}
                      </p>
                    ) : null}
                  </div>
                  <p className="mt-1.5">
                    {canOpenAttendance ? (
                      <button
                        type="button"
                        onClick={() => openAttendanceFor(sch)}
                        className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md underline-offset-2 hover:underline ${tone}`}
                        title={
                          kind === 'overdue_attendance'
                            ? 'Mở yêu cầu điểm danh bù'
                            : `Mở hồ sơ học viên — ${attendanceLabel}`
                        }
                      >
                        {meta.shortLabel || meta.label}
                      </button>
                    ) : (
                      <span className={`inline-flex text-[10px] font-black uppercase tracking-wide px-1.5 py-0.5 rounded-md ${tone}`}>
                        {meta.shortLabel || meta.label}
                      </span>
                    )}
                  </p>
                  {note ? (
                    <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                      Ghi chú: {note}
                    </p>
                  ) : null}
                  {canOpenAttendance ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => openAttendanceFor(sch)}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-orange-600 text-white text-[10px] font-black uppercase hover:bg-orange-700"
                      >
                        <UserCheck size={12} /> {attendanceLabel}
                      </button>
                    </div>
                  ) : null}
                  {canAct ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {sch.linkHoc ? (
                        <a
                          href={sch.linkHoc}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-red-600 text-white text-[10px] font-black uppercase"
                        >
                          <Video size={12} /> Vào lớp
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onOpenSession(sch)}
                        className="h-8 px-2.5 rounded-lg bg-white border-2 border-red-600 text-red-600 text-[10px] font-bold hover:bg-red-50"
                      >
                        Ghi chú / Đổi lịch
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
