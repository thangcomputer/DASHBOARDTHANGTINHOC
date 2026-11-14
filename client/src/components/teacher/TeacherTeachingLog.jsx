import React, { useEffect, useMemo, useReducer, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookText, CalendarDays, CheckCircle, Clock3, Users, Video, UserCheck } from 'lucide-react';
import {
  formatLocalDateKey,
  formatScheduleDateVi,
  getScheduleDisplayKind,
  getScheduleDisplayMeta,
  isStudentConfirmExpired,
  normalizeScheduleDate,
} from '../../utils/scheduleTime';
import { startOfWeekMonday, weekDateKeys } from '../../utils/weeklySlotGrid';
import { localizeScheduleNote } from '../../utils/studentActivityLogs';
import {
  clearMakeupPending,
  getMakeupPending,
  makeupPendingKey,
  subscribeMakeupPending,
} from '../../utils/attendanceMakeupPendingStore';

const PENDING_KINDS = new Set(['pending_attendance', 'overdue_attendance', 'past_pending']);

function isCancelledSchedule(sch) {
  const st = String(sch?.status || '').trim().toLowerCase();
  return st === 'cancelled' || st === 'canceled' || st === 'no_show';
}

function isAwaitingStudentConfirmation(sch) {
  const confirmation = String(sch?.studentConfirmStatus || sch?.attendanceConfirmStatus || '').toLowerCase();
  if (isStudentConfirmExpired(sch)) return false;
  return !isCancelledSchedule(sch)
    && (confirmation === 'pending' || Boolean(sch?.attendanceConfirmPending));
}

function isTeacherAttendancePending(sch, now) {
  return !isCancelledSchedule(sch)
    && !isAwaitingStudentConfirmation(sch)
    && PENDING_KINDS.has(getScheduleDisplayKind(sch, now));
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
      confirmation: 'Không có ca chờ xác nhận.',
      cancelled: 'Không có lịch hủy.',
    },
  },
  student: {
    title: 'Nhật ký học tập',
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

function getMakeupKey(sch) {
  return makeupPendingKey({
    scheduleId: scheduleKey(sch),
    studentId: resolveStudentId(sch),
    date: sch?.date,
    course: sch?.course || sch?.courseName,
  });
}

export default function TeacherTeachingLog({
  schedules = [],
  students = [],
  variant = 'teacher',
  onOpenSession,
  onOpenAttendance,
}) {
  const copy = COPY[variant] || COPY.teacher;
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const [, refreshMakeupPending] = useReducer((revision) => revision + 1, 0);
  const todayKey = formatLocalDateKey(new Date());
  const now = useMemo(() => new Date(), []);
  const weekKeys = useMemo(() => weekDateKeys(startOfWeekMonday(now)), [now]);
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const studentById = useMemo(() => new Map(
    (students || []).map((student) => [
      String(student?._id || student?.id || ''),
      student,
    ]),
  ), [students]);

  useEffect(() => subscribeMakeupPending(() => {
    refreshMakeupPending();
  }), []);

  useEffect(() => {
    if (variant !== 'teacher') return;
    (schedules || []).forEach((sch) => {
      const status = String(sch?.status || '').toLowerCase();
      if (status === 'completed' || isCancelledSchedule(sch)) {
        clearMakeupPending(getMakeupKey(sch));
      }
    });
  }, [schedules, variant]);

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
        all.filter((s) => isTeacherAttendancePending(s, now)),
      );
    }
    if (tab === 'confirmation') {
      return sortSchedules(all.filter(isAwaitingStudentConfirmation));
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
  }, [schedules, tab, todayKey, weekKeys, monthPrefix, now]);

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

  if (variant === 'teacher') {
    const pendingCount = (schedules || []).filter((sch) => isTeacherAttendancePending(sch, now)).length;
    const confirmationCount = (schedules || []).filter(isAwaitingStudentConfirmation).length;
    const cancelledCount = (schedules || []).filter(isCancelledSchedule).length;
    const dateFilters = [
      { id: 'day', label: 'Ngày' },
      { id: 'week', label: 'Tuần' },
      { id: 'month', label: 'Tháng' },
      { id: 'cancelled', label: 'Hủy', count: cancelledCount },
    ];

    return (
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:rounded-3xl" aria-label="Nhật ký giảng dạy">
        <header className="flex items-center gap-2.5 border-b border-slate-100 px-4 pb-2.5 pt-3 sm:px-5 sm:pt-4">
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[11px] bg-emerald-50 text-emerald-600">
            <BookText size={16} />
          </div>
          <h3 className="min-w-0 flex-1 text-sm font-black tracking-tight text-slate-900 sm:text-base">
            {copy.title}
          </h3>
          <div className="flex h-9 min-w-[42px] items-center justify-center gap-1 rounded-xl bg-slate-100 px-2">
            <span className="text-xs font-black text-emerald-700">{list.length}</span>
            <span className="text-xs font-bold text-slate-500">ca</span>
          </div>
        </header>

        <div className="border-b border-slate-200 bg-slate-50/70 px-4 py-2 sm:px-5">
          <div className="flex flex-wrap lg:flex-nowrap items-center gap-1.5" role="tablist" aria-label="Lọc nhật ký giảng dạy">
            {dateFilters.map(({ id, label, count }) => {
              const selected = tab === id;
              const cancelled = id === 'cancelled';
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(selected ? 'all' : id)}
                  className={`flex min-h-9 flex-1 min-w-[72px] items-center justify-center gap-1 rounded-xl border px-2.5 text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap ${selected
                      ? cancelled
                        ? 'border-rose-600 bg-rose-600 text-white shadow-sm'
                        : 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : cancelled
                        ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100/70'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-emerald-700'
                    }`}
                >
                  <span>{label}</span>
                  {count !== undefined ? (
                    <span className={`min-w-5 rounded-full px-1 text-center text-xs ${selected ? 'bg-white/20 text-white' : cancelled ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-600'}`}>
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
            {[
              { id: 'pending', label: 'Chưa điểm danh', count: pendingCount, tone: 'orange' },
              { id: 'confirmation', label: 'Chờ xác nhận', count: confirmationCount, tone: 'emerald' },
            ].map(({ id, label, count, tone }) => {
              const selected = tab === id;
              const orange = tone === 'orange';
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(selected ? 'all' : id)}
                  className={`flex min-h-9 flex-1 min-w-[130px] items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap ${selected
                      ? orange ? 'border-orange-600 bg-orange-600 text-white shadow-sm' : 'border-emerald-600 bg-emerald-600 text-white shadow-sm'
                      : orange ? 'border-orange-200 bg-orange-50 text-orange-800 hover:bg-orange-100/70' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/70'
                    }`}
                >
                  <span>{label}</span>
                  <span className={`min-w-5 rounded-full px-1 text-center text-xs ${selected ? 'bg-white/20 text-white' : orange ? 'bg-orange-100 text-orange-800' : 'bg-emerald-100 text-emerald-800'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          {list.length === 0 ? (
            <p className="py-8 text-center text-sm font-medium text-slate-400">{emptyText}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-black uppercase tracking-wider text-slate-500">
                    <th className="w-12 px-3 py-2.5 text-center">STT</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Ngày</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Giờ học</th>
                    <th className="px-3 py-2.5">Khóa học / Buổi dạy</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Học viên</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Trạng thái</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {list.map((sch, idx) => {
                    const kind = getScheduleDisplayKind(sch, now);
                    const meta = getScheduleDisplayMeta(sch, now);
                    const tone = KIND_TONE[kind] || KIND_TONE.upcoming;
                    const cancelled = isCancelledSchedule(sch);
                    const awaitingConfirmation = isAwaitingStudentConfirmation(sch);
                    const course = String(sch.course || sch.courseName || '').trim();
                    const title = course || String(sch.topic || sch.title || 'Ca dạy').trim();
                    const startTime = String(sch.startTime || '').trim();
                    const time = sch.endTime
                      ? `${startTime} – ${sch.endTime}`
                      : startTime;
                    const studentName = sch.studentName || sch.student?.name || '-';
                    const makeupRequestSent = variant === 'teacher'
                      && Boolean(getMakeupPending(getMakeupKey(sch)));
                    const canOpenAttendance = !awaitingConfirmation
                      && !makeupRequestSent
                      && PENDING_KINDS.has(kind)
                      && (typeof onOpenAttendance === 'function' || Boolean(resolveStudentId(sch)));
                    const actionLabel = kind === 'overdue_attendance' ? 'Điểm danh bù' : 'Điểm danh';

                    return (
                      <tr
                        key={scheduleKey(sch)}
                        className={`transition-colors ${cancelled ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-emerald-50/30'}`}
                      >
                        <td className="px-3 py-2.5 text-center font-bold text-slate-400 tabular-nums">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap tabular-nums">
                          {formatScheduleDateVi(sch.date) || '-'}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap tabular-nums">
                          {time || '-'}
                        </td>
                        <td className="px-3 py-2.5 font-extrabold text-slate-900">
                          <div className="max-w-[320px] truncate" title={title}>{title}</div>
                          {course && course !== title ? (
                            <span className="mt-0.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
                              {course}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-700 whitespace-nowrap">
                          {studentName}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${makeupRequestSent ? 'bg-slate-100 text-slate-600 border border-slate-200' : tone}`}>
                            {makeupRequestSent ? <CheckCircle size={12} className="text-emerald-600" /> : null}
                            {awaitingConfirmation
                              ? 'Chờ học viên xác nhận'
                              : makeupRequestSent ? 'Đã gửi Admin' : meta.shortLabel || meta.label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          {canOpenAttendance ? (
                            <button
                              type="button"
                              onClick={() => openAttendanceFor(sch)}
                              className={`inline-flex min-h-8 items-center gap-1.5 rounded-xl border px-3 py-1 text-xs font-extrabold transition-colors cursor-pointer ${kind === 'overdue_attendance'
                                  ? 'border-amber-600 bg-amber-500 text-white hover:bg-amber-600'
                                  : 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
                                }`}
                              title={kind === 'overdue_attendance' ? 'Mở yêu cầu điểm danh bù' : 'Mở hồ sơ học viên để điểm danh'}
                            >
                              {kind !== 'overdue_attendance'
                                ? <CheckCircle size={12} />
                                : <UserCheck size={12} />}
                              {actionLabel}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-3 min-w-0 mb-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <BookText size={18} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              {copy.title}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
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
              className={`px-3.5 h-9 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${tab === item.id
                ? 'bg-[#10B981] border border-[#34D399] border-b-4 border-b-[#059669] text-white'
                : 'bg-white text-slate-600 border border-slate-200 border-b-4 border-b-slate-300 hover:bg-slate-50 active:translate-y-[2px] active:border-b-2'
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
              const makeupRequestSent = variant === 'teacher'
                && Boolean(getMakeupPending(getMakeupKey(sch)));
              const attendanceLabel = makeupRequestSent
                ? 'Đã gửi Admin'
                : kind === 'overdue_attendance'
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
                        className="shrink-0 max-w-[42%] text-right text-xs text-red-700 font-medium leading-relaxed line-clamp-2"
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
                        disabled={makeupRequestSent}
                        className={`inline-flex items-center gap-1 text-xs font-black tracking-wide px-1.5 py-0.5 rounded-md underline-offset-2 ${makeupRequestSent ? 'cursor-not-allowed text-slate-500' : `hover:underline ${tone}`
                          }`}
                        title={
                          makeupRequestSent
                            ? 'Yêu cầu đã gửi Admin'
                            : kind === 'overdue_attendance'
                              ? 'Mở yêu cầu điểm danh bù'
                              : `Mở hồ sơ học viên - ${attendanceLabel}`
                        }
                      >
                        {makeupRequestSent ? 'Đã gửi Admin' : meta.shortLabel || meta.label}
                      </button>
                    ) : (
                      <span className={`inline-flex text-xs font-black  tracking-wide px-1.5 py-0.5 rounded-md ${tone}`}>
                        {makeupRequestSent ? 'Đã gửi Admin' : meta.shortLabel || meta.label}
                      </span>
                    )}
                  </p>
                  {note ? (
                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                      Ghi chú: {note}
                    </p>
                  ) : null}
                  {canOpenAttendance ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => openAttendanceFor(sch)}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg bg-orange-600 text-white text-xs font-black  hover:bg-orange-700"
                      >
                        <UserCheck size={12} /> {attendanceLabel}
                      </button>
                    </div>
                  ) : null}
                  {canAct ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {(
                        sch.linkHoc
                        || studentById.get(resolveStudentId(sch))?.linkHoc
                        || studentById.get(resolveStudentId(sch))?.joinClassUrl
                        || studentById.get(resolveStudentId(sch))?.online_meeting_url
                      ) ? (
                        <a
                          href={
                            sch.linkHoc
                            || studentById.get(resolveStudentId(sch))?.linkHoc
                            || studentById.get(resolveStudentId(sch))?.joinClassUrl
                            || studentById.get(resolveStudentId(sch))?.online_meeting_url
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-xl bg-[#10B981] border border-[#34D399] border-b-4 border-b-[#059669] hover:brightness-105 active:translate-y-[2px] active:border-b-2 text-white text-xs font-black transition-all cursor-pointer"
                        >
                          <Video size={13} /> Vào lớp
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onOpenSession(sch)}
                        className="h-8 px-3 rounded-xl bg-white border border-slate-200 border-b-4 border-b-slate-300 text-slate-700 hover:bg-slate-50 active:translate-y-[2px] active:border-b-2 text-xs font-extrabold transition-all cursor-pointer"
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
