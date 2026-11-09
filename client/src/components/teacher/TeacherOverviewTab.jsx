import React, { useMemo, useState, useEffect } from 'react';
import {
  CalendarDays, ChevronRight, Award, Zap, UserCheck, Clipboard, GraduationCap, WalletCards, Clock, TrendingUp,
} from 'lucide-react';
import { resolveAvatarUrl } from '../../utils/defaultAvatars';
import api from '../../services/api';
import TeacherRatingDisplay from './TeacherRatingDisplay';
import WelcomeHero from '../WelcomeHero';
import { openClassRoom } from '../classRoom/ClassRoom';
import {
  isScheduleOngoingNow,
  getScheduleDisplayKind,
  normalizeScheduleDate,
  formatLocalDateKey,
} from '../../utils/scheduleTime';
import { STAR_BONUS_MIN_STUDENTS, STAR_BONUS_MIN_STARS } from '../../utils/teacherCommission';
import { starsFromRating } from '../../context/useDataRatings';
import '../dashboard-overview.css';

function scheduleStudentId(sch) {
  return String(sch?.studentId?._id || sch?.studentId?.id || sch?.studentId || '');
}

function formatSessionDayLabel(date) {
  const d = date ? new Date(date) : null;
  if (!d || Number.isNaN(d.getTime())) return { weekday: '', dateLabel: '' };
  return {
    weekday: d.toLocaleDateString('vi-VN', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' }),
    dateLabel: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }),
  };
}

function getNextScheduleForStudent(schedules, student, now = new Date()) {
  const sid = String(student?._id || student?.id || '');
  if (!sid) return null;
  const todayKey = formatLocalDateKey(now);
  const course = String(student?.course || '').trim().toLowerCase();
  const list = (schedules || []).filter((s) => {
    if (String(s?.status || '') !== 'scheduled') return false;
    if (scheduleStudentId(s) !== sid) return false;
    if (normalizeScheduleDate(s.date) !== todayKey) return false;
    if (course) {
      const sc = String(s.course || '').trim().toLowerCase();
      if (sc && sc !== course) return false;
    }
    const kind = getScheduleDisplayKind(s, now);
    return kind === 'upcoming' || kind === 'ongoing';
  });
  list.sort((a, b) => {
    const ka = `${normalizeScheduleDate(a.date)}-${a.startTime || ''}`;
    const kb = `${normalizeScheduleDate(b.date)}-${b.startTime || ''}`;
    return ka.localeCompare(kb);
  });
  return list[0] || null;
}

export default function TeacherOverviewTab({
  navigate, totalMonthlyIncome, teacherName,
  teacherRating, students, mySchedules = [], RATING_CRITERIA,
}) {
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [pendingGradeCount, setPendingGradeCount] = useState(0);

  const todayKey = formatLocalDateKey(new Date());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Đếm bài tập đã nộp chờ chấm - không dùng lastGrade (HV mới luôn bị báo sai)
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      const courses = [...new Set((students || [])
        .map((s) => String(s.course || '').trim())
        .filter(Boolean))];
      if (!courses.length) {
        setPendingGradeCount(0);
        return;
      }
      Promise.all(courses.map((c) => api.assignments.getByCourse(c).catch(() => null)))
        .then((results) => {
          if (cancelled) return;
          const studentIds = new Set();
          for (const res of results) {
            if (!res?.success || !Array.isArray(res.data)) continue;
            for (const a of res.data) {
              for (const sub of (a.submissions || [])) {
                if (String(sub.status || '') !== 'submitted') continue;
                const sid = String(sub.studentId?._id || sub.studentId?.id || sub.studentId || '');
                if (sid) studentIds.add(sid);
              }
            }
          }
          setPendingGradeCount(studentIds.size);
        })
        .catch(() => {
          if (!cancelled) setPendingGradeCount(0);
        });
    }, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [students]);

  // Check if there is a live schedule right now
  const ongoingSchedule = useMemo(() => {
    void nowTick;
    return (mySchedules || []).find((s) => s.status === 'scheduled' && isScheduleOngoingNow(s));
  }, [mySchedules, nowTick]);

  const ongoingStudent = useMemo(() => {
    const studentId = scheduleStudentId(ongoingSchedule);
    if (!studentId) return null;
    return (students || []).find((student) => (
      String(student?._id || student?.id || '') === studentId
    )) || null;
  }, [ongoingSchedule, students]);

  const todaySessionCount = (mySchedules || [])
    .filter((s) => s.status === 'scheduled' && normalizeScheduleDate(s.date) === todayKey).length;

  const ongoingJoinUrl = (
    ongoingSchedule?.linkHoc
    || ongoingStudent?.linkHoc
    || ongoingStudent?.joinClassUrl
    || ongoingStudent?.online_meeting_url
    || ''
  ).trim();

  const nextSessions = useMemo(() => {
    void nowTick;
    const now = new Date();
    return (students || [])
      .map((student) => {
        const sch = getNextScheduleForStudent(mySchedules, student, now);
        if (!sch) return null;
        const live = isScheduleOngoingNow(sch, now);
        const { weekday, dateLabel } = formatSessionDayLabel(sch.date);
        const joinUrl = sch.linkHoc || student.linkHoc || '';
        return { student, sch, live, weekday, dateLabel, joinUrl };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.live !== b.live) return a.live ? -1 : 1;
        const ka = `${normalizeScheduleDate(a.sch.date)}-${a.sch.startTime || ''}`;
        const kb = `${normalizeScheduleDate(b.sch.date)}-${b.sch.startTime || ''}`;
        return ka.localeCompare(kb);
      });
  }, [students, mySchedules, nowTick]);

  /** Ca sắp tới gần nhất (dùng cho nhãn thẻ chào mừng khi chưa có ca đang dạy). */
  const nextUpcoming = useMemo(() => {
    void nowTick;
    const now = new Date();
    return (mySchedules || [])
      .filter((s) => String(s?.status || '') === 'scheduled' && getScheduleDisplayKind(s, now) === 'upcoming')
      .sort((a, b) => `${normalizeScheduleDate(a.date)}-${a.startTime || ''}`.localeCompare(`${normalizeScheduleDate(b.date)}-${b.startTime || ''}`))[0] || null;
  }, [mySchedules, nowTick]);

  /** Ca hôm nay đã tới giờ nhưng chưa điểm danh (chưa gửi xác nhận cho HV). */
  const unmarkedToday = useMemo(() => {
    void nowTick;
    const now = new Date();
    return (mySchedules || [])
      .filter((s) => String(s?.status || '') === 'scheduled'
        && normalizeScheduleDate(s.date) === todayKey
        && getScheduleDisplayKind(s, now) !== 'upcoming'
        && String(s.studentConfirmStatus || 'none') !== 'pending')
      .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
  }, [mySchedules, nowTick, todayKey]);

  const taughtThisMonth = useMemo(() => {
    const monthKey = todayKey.slice(0, 7);
    return (mySchedules || []).filter((s) => String(s?.status || '') === 'completed'
      && normalizeScheduleDate(s.date).slice(0, 7) === monthKey).length;
  }, [mySchedules, todayKey]);

  /** HV đạt ≥5★ trong tháng hiện tại; Đạt khi đủ ngưỡng thưởng sao (≥5 HV/tháng). */
  const fiveStarStats = useMemo(() => {
    const ratings = Array.isArray(teacherRating?.ratings) ? teacherRating.ratings : [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const seen = new Set();
    for (const r of ratings) {
      if (starsFromRating(r) < STAR_BONUS_MIN_STARS) continue;
      const t = new Date(r.createdAt || r.updatedAt || 0).getTime();
      if (!Number.isFinite(t) || t < monthStart || t >= monthEnd) continue;
      const sid = String(r.studentId?._id || r.studentId || r._id || r.id || '');
      if (!sid) continue;
      seen.add(sid);
    }
    const need = STAR_BONUS_MIN_STUDENTS;
    const count = seen.size;
    return {
      count,
      need,
      achieved: count >= need,
    };
  }, [teacherRating]);

  const activeStudents = useMemo(
    () => (students || []).filter((student) => student.enrollmentStatus === 'active'),
    [students],
  );

  const heroChips = ongoingSchedule
    ? [{ tone: 'live', label: `Đang dạy: ${ongoingSchedule.studentName || 'Học viên'} · ${ongoingSchedule.course || ''} · ${ongoingSchedule.startTime}–${ongoingSchedule.endTime}` }]
    : nextUpcoming
      ? [{
        icon: CalendarDays,
        label: `Ca tới: ${nextUpcoming.startTime || ''} · ${nextUpcoming.studentName || 'Học viên'} · ${[formatSessionDayLabel(nextUpcoming.date).weekday, formatSessionDayLabel(nextUpcoming.date).dateLabel].filter(Boolean).join(' ')}`,
      }]
      : [{ icon: CalendarDays, label: 'Chưa có ca dạy sắp tới' }];

  const openStudentAttendance = (sch) => {
    const stId = sch?.studentId?._id || sch?.studentId?.id || sch?.studentId;
    if (!stId) { navigate('/teacher#students'); return; }
    navigate(`/teacher#students?studentId=${stId}&course=${encodeURIComponent(sch.course || sch.courseName || '')}`);
  };

  const todoItems = [];
  if (unmarkedToday.length) {
    const first = unmarkedToday[0];
    todoItems.push({
      key: 'attendance',
      icon: UserCheck,
      tone: 'bg-gradient-to-b from-emerald-400 to-emerald-600',
      title: `Ca chưa điểm danh (${unmarkedToday.length})`,
      sub: `${first.studentName || 'Học viên'} · ${first.startTime || ''}${first.endTime ? `–${first.endTime}` : ''}`,
      cta: 'Điểm danh',
      action: () => openStudentAttendance(first),
    });
  }
  if (pendingGradeCount > 0) {
    todoItems.push({
      key: 'grading',
      icon: Clipboard,
      tone: 'bg-gradient-to-b from-amber-400 to-orange-500',
      title: `Bài chờ chấm (${pendingGradeCount} HV)`,
      sub: 'Học viên đã nộp, đang chờ bạn chấm điểm',
      cta: 'Chấm bài',
      action: () => navigate('/teacher#assignments'),
    });
  }

  return (
    <div className="bg-[#F5F8FC] py-3 sm:py-5 md:py-6 space-y-4 lg:space-y-5 animate-in fade-in slide-in-from-bottom-5 duration-700 w-full min-w-0 max-w-full overflow-x-hidden pb-4 th-dashboard-overview th-dashboard-overview--teacher">

      <header className="flex min-w-0">
        <WelcomeHero
          role="teacher"
          name={teacherName}
          chips={heroChips}
          joinUrl={ongoingSchedule ? ongoingJoinUrl : ''}
          onJoin={(ongoingSchedule?._id || ongoingSchedule?.id) ? () => openClassRoom(ongoingSchedule._id || ongoingSchedule.id) : undefined}
          joinHint={ongoingSchedule ? 'Chưa có buổi để vào' : todaySessionCount ? 'Chưa đến giờ dạy' : 'Chưa có lịch dạy'}
        />
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-stretch">
        {/* ── Cần xử lý: chỉ hiện việc còn tồn, bấm là tới đúng việc ── */}
        <section className="lg:col-span-6 bg-white rounded-2xl border border-slate-100 p-3 sm:p-4 shadow-sm flex flex-col gap-2.5 min-w-0">
          <h3 className="flex items-center gap-2 font-bold text-sm lg:text-base text-slate-800">
            <Zap size={16} className="text-amber-500 shrink-0" aria-hidden="true" /> Cần xử lý
          </h3>
          {todoItems.length ? todoItems.map(({ key, icon: Icon, tone, title, sub, cta, action }) => (
            <button
              key={key}
              type="button"
              onClick={action}
              className="group flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5 text-left transition hover:border-red-200 hover:bg-red-50/40"
            >
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${tone}`}>
                <Icon size={19} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-900">{title}</span>
                {sub && <span className="block truncate text-xs text-slate-500">{sub}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-0.5 text-xs font-black text-red-600">
                {cta} <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </button>
          )) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl bg-emerald-50 px-4 py-6 text-center">
              <UserCheck size={28} className="text-emerald-500" aria-hidden="true" />
              <p className="text-sm font-black text-emerald-700">Không còn việc tồn đọng</p>
              <p className="text-xs text-emerald-600">Các ca đã điểm danh và không có bài chờ chấm.</p>
            </div>
          )}
        </section>

        {/* ── Tháng này: 3 cột gọn (giống mobile) ── */}
        <section className="lg:col-span-6 bg-white rounded-2xl border border-slate-100 p-3 sm:p-4 shadow-sm flex flex-col gap-2.5 min-w-0">
          <h3 className="flex items-center gap-2 font-bold text-sm lg:text-base text-slate-800">
            <TrendingUp size={16} className="text-sky-500 shrink-0" aria-hidden="true" /> Tháng này
          </h3>
          <div className="grid flex-1 grid-cols-3 gap-2 sm:gap-3">
            {[
              {
                icon: WalletCards,
                tint: 'bg-sky-50 text-sky-600',
                label: `Thu nhập T${new Date().getMonth() + 1}`,
                value: `${(Number(totalMonthlyIncome) || 0).toLocaleString('vi-VN')}đ`,
                onClick: () => navigate('/teacher/finance'),
              },
              {
                icon: CalendarDays,
                tint: 'bg-indigo-50 text-indigo-600',
                label: 'Buổi đã dạy',
                value: taughtThisMonth,
                onClick: () => navigate('/teacher#schedule'),
              },
              {
                icon: Award,
                tint: 'bg-amber-50 text-amber-600',
                label: fiveStarStats.achieved ? 'Thưởng sao · đã đạt' : 'Thưởng sao',
                value: `${fiveStarStats.count}/${fiveStarStats.need} HV`,
                title: fiveStarStats.achieved ? 'Đã đạt thưởng' : `Cần thêm ${Math.max(0, fiveStarStats.need - fiveStarStats.count)} HV đánh giá 5★`,
              },
            ].map(({ icon: Icon, tint, label, value, title, onClick }) => {
              const Tag = onClick ? 'button' : 'div';
              return (
                <Tag
                  key={label}
                  type={onClick ? 'button' : undefined}
                  onClick={onClick}
                  title={title}
                  className={`flex min-w-0 items-center gap-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5 text-left !shadow-none transition sm:gap-3 sm:p-3 ${onClick ? 'cursor-pointer hover:border-red-200 hover:bg-red-50/40' : ''}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${tint}`}>
                    <Icon size={24} strokeWidth={2.2} aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-base font-black tabular-nums text-slate-900 sm:text-lg">{value}</span>
                    <span className="truncate text-[11px] font-bold text-slate-500 sm:text-xs">{label}</span>
                  </span>
                </Tag>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Học viên / Lịch dạy / Đánh giá ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-5 items-start">

        {/* Cột 1: Học viên được phân công - hiện ~5, scroll thêm */}
        <div className="bg-white rounded-2xl border border-slate-100 p-3.5 sm:p-4 shadow-sm space-y-3 flex flex-col min-w-0 w-full">
          <div className="flex items-center justify-between gap-2 min-w-0 pb-2 border-b border-slate-100 shrink-0">
            <h3 className="text-sm sm:text-base lg:text-lg font-bold text-slate-800 flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-sm shrink-0">
                <GraduationCap size={17} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span className="truncate">Học viên được phân công ({activeStudents.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => navigate('/teacher#students')}
              className="text-[11px] font-bold text-indigo-600 hover:underline shrink-0 cursor-pointer inline-flex items-center gap-0.5"
            >
              Xem chi tiết
              <ChevronRight size={12} aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-2.5 min-h-0">
            {activeStudents.slice(0, 3).map((s) => {
              const done = s.completedSessions != null
                ? Math.max(0, Number(s.completedSessions) || 0)
                : Math.max(0, (Number(s.totalSessions) || 12) - (Number(s.remainingSessions) || 0));
              const total = Number(s.totalSessions) > 0 ? Number(s.totalSessions) : 12;
              const pct = total > 0 ? Math.round((done / total) * 100) || 0 : 0;
              const studentId = s._id || s.id;
              const enrollmentKey = s._enrollmentKey || studentId;
              const openStudent = () => {
                const q = new URLSearchParams();
                if (studentId) q.set('studentId', String(studentId));
                if (enrollmentKey) q.set('enrollmentKey', String(enrollmentKey));
                if (s.course) q.set('course', String(s.course));
                navigate(`/teacher#students?${q.toString()}`);
              };
              return (
                <button
                  type="button"
                  key={enrollmentKey}
                  onClick={openStudent}
                  className="w-full text-left bg-[#F7F9FC] rounded-xl p-2.5 sm:p-3 border border-slate-100 flex items-center gap-2.5 sm:gap-3 hover:bg-indigo-50/60 hover:border-indigo-200 transition group cursor-pointer"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-white shadow-sm border border-slate-200">
                    <img src={resolveAvatarUrl({ avatar: s.avatar, role: 'student', gender: s.gender })} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 truncate uppercase group-hover:text-indigo-600 transition-colors">{s.name}</p>
                      <p className="shrink-0 text-[11px] sm:text-xs font-black text-slate-800 tabular-nums">{pct}%</p>
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-400 truncate uppercase">{s.course}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 min-w-0 flex-1 bg-slate-200/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-indigo-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="shrink-0 text-[10px] text-slate-400 tabular-nums">{done}/{total} buổi</p>
                    </div>
                  </div>
                  <ChevronRight size={15} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition shrink-0" />
                </button>
              );
            })}

            {activeStudents.length === 0 && (
              <div className="py-6 text-center text-slate-400 text-xs font-medium">Chưa được phân công học viên nào.</div>
            )}
          </div>
        </div>

        {/* Cột 2: Ca tiếp theo - giờ, thứ/ngày, link hướng dẫn, nhấp nháy khi đến ca */}
        <div className="bg-white rounded-2xl border border-slate-100 p-3.5 sm:p-4 shadow-sm space-y-3 flex flex-col min-w-0 w-full">
          <div className="flex items-center justify-between gap-2 min-w-0 pb-2 border-b border-slate-100 shrink-0">
            <h3 className="text-sm sm:text-base lg:text-lg font-bold text-slate-800 flex items-center gap-2 min-w-0">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 text-white shadow-md shadow-red-200 shrink-0">
                <Clock size={17} strokeWidth={2.4} aria-hidden="true" />
              </span>
              <span className="truncate">Lịch dạy hôm nay ({nextSessions.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => navigate('/teacher#schedule')}
              className="text-[11px] font-bold text-red-600 hover:underline shrink-0 cursor-pointer inline-flex items-center gap-0.5"
            >
              Cả tháng
              <ChevronRight size={12} aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-2.5 min-h-0">
            {nextSessions.map(({ student, sch, live, weekday, dateLabel }) => {
              const enrollmentKey = student._enrollmentKey || student._id || student.id;
              const timeRange = sch.endTime ? `${sch.startTime} - ${sch.endTime}` : (sch.startTime || '-');
              return (
                <div
                  key={`${enrollmentKey}-${sch._id || sch.id}`}
                  className={`rounded-xl p-3 border transition ${live
                      ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white border-red-400/40 shadow-md shadow-red-500/20 animate-pulse'
                      : 'bg-slate-50/80 border-slate-100 hover:border-red-200'
                    }`}
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="min-w-0 flex-1">
                      {live && (
                        <p className="text-[11px] font-black  tracking-wider text-red-100 flex items-center gap-1.5 mb-1">
                          <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                          </span>
                          Đang diễn ra
                        </p>
                      )}
                      <p className={`text-xs sm:text-sm lg:text-base font-bold truncate ${live ? 'text-white' : 'text-slate-800'}`}>
                        {student.name || sch.studentName || 'Học viên'}
                      </p>
                      <p className={`text-[11px] sm:text-xs lg:text-sm truncate ${live ? 'text-red-100' : 'text-slate-400'}`}>
                        {student.course || sch.course || ''}
                      </p>
                      <p className={`text-xs font-black tabular-nums mt-1 ${live ? 'text-yellow-200' : 'text-red-600'}`}>
                        {timeRange}
                      </p>
                      <p className={`text-[11px] font-semibold capitalize ${live ? 'text-red-100' : 'text-slate-500'}`}>
                        {[weekday, dateLabel].filter(Boolean).join(' · ') || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}

            {nextSessions.length === 0 && (
              <div className="py-6 text-center text-slate-400 text-xs font-medium">
                Hôm nay không còn ca dạy nào.
              </div>
            )}
          </div>
        </div>

        {/* Cột 3: Đánh giá từ học viên - list hiện ~3, scroll thêm */}
        <div className="min-w-0 w-full">
          <TeacherRatingDisplay rating={teacherRating} RATING_CRITERIA={RATING_CRITERIA} students={students} reviewsScrollLimit={3} />
        </div>
      </div>
    </div>
  );
}
