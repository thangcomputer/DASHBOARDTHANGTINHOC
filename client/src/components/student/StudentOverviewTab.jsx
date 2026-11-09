import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, BookOpen, Calendar, CheckCircle, CheckCircle2, ChevronRight, ClipboardList, Clock, ExternalLink,
  Flame, Gamepad2, PlayCircle, Trophy, Video, XCircle,
} from 'lucide-react';
import LmsGoalMergedCard from './LmsGoalMergedCard';
import LearningLeaderboardCard from './LearningLeaderboardCard';
import WelcomeHero from '../WelcomeHero';
import api from '../../services/api';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import dailyPracticeApi from '../../services/dailyPracticeApi';
import { LEARNING_GOAL_CHANGED_EVENT } from '../../utils/learningGoal';
import { isScheduleOngoingNow, getScheduleDisplayKind, normalizeScheduleDate } from '../../utils/scheduleTime';
import { isFreePortalCourseName } from '../../utils/enrollments';
import { isFreePortalLocked } from './dailyPractice/FreeFeatureLock';
import meetClassApi from '../../services/meetClassApi';

function normalizeCourseName(name) {
  return String(name || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

function formatDayLabel(date) {
  const d = date ? new Date(date) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  const weekday = d.toLocaleDateString('vi-VN', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' });
  const day = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
  return `${weekday} ${day}`;
}

function formatDeadline(deadline) {
  const d = deadline ? new Date(deadline) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' });
}

function vnNow() {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return { day: `${parts.year}-${parts.month}-${parts.day}`, minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

function clockMinutes(value) {
  const [hour, minute] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(hour)) return 0;
  return hour * 60 + (Number.isFinite(minute) ? minute : 0);
}

function deadlineMs(item) {
  const t = new Date(item?.deadline || 0).getTime();
  return Number.isFinite(t) && t > 0 ? t : Number.MAX_SAFE_INTEGER;
}

/** Một dòng trong "Việc cần làm hôm nay" - bấm là tới đúng việc. */
function TaskRow({ icon: Icon, tone, title, sub, cta, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
  );
}



export default function StudentOverviewTab({
  studentData,
  enrollments = [],
  activeCourseName,
  setActiveCourseName,
  viewStudent,
  progressPct,
  myAssignments,
  mySchedules = [],
  studyLogs: _studyLogs = [],
}) {
  const navigate = useNavigate();
  const [pendingQuizzes, setPendingQuizzes] = useState([]);
  const [videoCourses, setVideoCourses] = useState({ byId: new Map(), byName: new Map(), error: '' });
  const [practice, setPractice] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [meetClasses, setMeetClasses] = useState([]);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let cancelled = false;
    meetClassApi.mine()
      .then((res) => { if (!cancelled) setMeetClasses(res.data || []); })
      .catch(() => { });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await lessonPracticeApi.student.subjects();
        if (cancelled) return;
        const byId = new Map();
        const byName = new Map();
        (res.data?.courses || [])
          .filter((course) => course.enrolled && course.deliveryMode === 'video')
          .forEach((course) => {
            const info = {
              id: String(course.id),
              completed: Number(course.completedLessonCount) || 0,
              total: Number(course.lessonCount) || 0,
              subjects: course.subjects || [],
            };
            byId.set(info.id, info);
            byName.set(normalizeCourseName(course.name), info);
          });
        setVideoCourses({ byId, byName, error: '' });
      } catch (err) {
        if (!cancelled) setVideoCourses({ byId: new Map(), byName: new Map(), error: err.message || 'Không tải được tiến độ bài học' });
      }
    };
    load();
    window.addEventListener('focus', load);
    window.addEventListener('lesson-practice-progress-updated', load);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', load);
      window.removeEventListener('lesson-practice-progress-updated', load);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let session = null;
    try {
      session = JSON.parse(localStorage.getItem('student_user') || 'null');
    } catch { /* ignore */ }
    if (isFreePortalLocked(session)) return () => { cancelled = true; };
    api.quizzes.getStudentQuizzes()
      .then((res) => {
        if (!res?.success || cancelled) return;
        const nowMs = Date.now();
        setPendingQuizzes((res.data || []).filter((q) => {
          if (q.mySubmission) return false;
          return !q.deadline || new Date(q.deadline).getTime() > nowMs;
        }));
      })
      .catch(() => { if (!cancelled) setPendingQuizzes([]); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const load = () => dailyPracticeApi.student.overview().then(setPractice).catch(() => { });
    load();
    window.addEventListener(LEARNING_GOAL_CHANGED_EVENT, load);
    return () => window.removeEventListener(LEARNING_GOAL_CHANGED_EVENT, load);
  }, []);

  // ── Buổi học: chỉ hiển thị ở thẻ chào mừng ────────────────────────────────
  const ongoingSchedule = useMemo(() => {
    void nowTick;
    return (mySchedules || []).find((s) => s.status === 'scheduled' && isScheduleOngoingNow(s));
  }, [mySchedules, nowTick]);

  const nextSchedule = useMemo(() => {
    void nowTick;
    if (ongoingSchedule) return ongoingSchedule;
    return (mySchedules || [])
      .filter((s) => String(s?.status || '') === 'scheduled' && getScheduleDisplayKind(s) === 'upcoming')
      .sort((a, b) => `${normalizeScheduleDate(a.date)}-${a.startTime || ''}`.localeCompare(`${normalizeScheduleDate(b.date)}-${b.startTime || ''}`))[0] || null;
  }, [mySchedules, ongoingSchedule, nowTick]);

  const clockForMeet = vnNow();
  const meetCardsPre = meetClasses.map((item) => {
    const live = item.day === clockForMeet.day && clockForMeet.minutes >= clockMinutes(item.startTime) && clockForMeet.minutes < clockMinutes(item.endTime);
    return { ...item, live };
  });
  const liveMeet = meetCardsPre.find((item) => item.live);
  const isLiveSchedule = Boolean(ongoingSchedule);
  const isLiveMeet = Boolean(liveMeet);
  const sessionRange = nextSchedule
    ? `${nextSchedule.startTime || ''}${nextSchedule.endTime ? `–${nextSchedule.endTime}` : ''}`
    : '';
  const heroChips = isLiveSchedule
    ? [{ tone: 'live', label: `Đang học · Ca ${sessionRange}` }]
    : isLiveMeet
      ? [{ tone: 'live', label: `Meet · ${liveMeet.slotLabel} ${liveMeet.startTime}–${liveMeet.endTime}` }]
      : nextSchedule
        ? [{ icon: Calendar, label: `Buổi tới: Ca ${sessionRange} · ${formatDayLabel(nextSchedule.date)}` }]
        : meetCardsPre[0]
          ? [{ icon: Calendar, label: `Meet ${meetCardsPre[0].slotLabel} · ${formatDayLabel(meetCardsPre[0].day)}` }]
          : [];

  // ── Khóa học hiện tại ──────────────────────────────────────────────────
  const currentCourseName = activeCourseName || viewStudent?.course || '';

  // ── Lịch học hôm nay: tổng hợp lịch 1 kèm 1 và lịch Meet hôm nay ────────
  const todayKey = clockForMeet.day;
  const today1on1Schedules = useMemo(() => {
    return (mySchedules || [])
      .filter((s) => s.status !== 'cancelled' && normalizeScheduleDate(s.date) === todayKey)
      .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
  }, [mySchedules, todayKey]);

  const todayMeetClasses = useMemo(() => {
    return meetCardsPre.filter((item) => item.day === todayKey);
  }, [meetCardsPre, todayKey]);

  const todayClasses = useMemo(() => {
    const list = [];
    today1on1Schedules.forEach((s) => {
      const live = isScheduleOngoingNow(s);
      const meetLink = s.linkHoc || s.meetingUrl || viewStudent?.linkHoc || viewStudent?.joinClassUrl || viewStudent?.online_meeting_url || '';
      list.push({
        id: s._id || s.id || `1on1-${s.date}-${s.startTime}`,
        type: '1on1',
        title: s.title || s.subject || s.content || s.courseName || currentCourseName || 'Buổi học 1 kèm 1',
        time: s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : (s.startTime || 'Trong ngày'),
        dateLabel: formatDayLabel(s.date) || 'Hôm nay',
        meetLink: String(meetLink || '').trim(),
        live,
        teacher: s.teacherName || s.teacher || viewStudent?.teacher || '',
      });
    });
    todayMeetClasses.forEach((m) => {
      list.push({
        id: m.id || `meet-${m.day}-${m.startTime}`,
        type: 'meet',
        title: m.title || m.courseName || (m.slotLabel ? `Lớp Google Meet · ${m.slotLabel}` : 'Lớp Google Meet'),
        time: m.startTime && m.endTime ? `${m.startTime} – ${m.endTime}` : (m.slotLabel || 'Trong ngày'),
        dateLabel: formatDayLabel(m.day) || 'Hôm nay',
        meetLink: String(m.linkHoc || '').trim(),
        live: m.live,
        teacher: m.teacherName || m.teacher || '',
      });
    });
    return list.sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0));
  }, [today1on1Schedules, todayMeetClasses, currentCourseName, viewStudent]);

  // ── Khóa học của tôi: một chỗ duy nhất cho tiến độ ────────────────────────
  const videoCourse = (viewStudent?.courseId && videoCourses.byId.get(String(viewStudent.courseId)))
    || videoCourses.byName.get(normalizeCourseName(currentCourseName))
    || null;
  const isVideoCourse = viewStudent?.deliveryMode === 'video' || Boolean(videoCourse);
  const done = isVideoCourse ? (videoCourse?.completed || 0) : (Number(viewStudent?.completedSessions) || 0);
  const total = isVideoCourse ? (videoCourse?.total || 0) : (Number(viewStudent?.totalSessions) || 0);
  const unit = isVideoCourse ? 'bài' : 'buổi';
  const pct = isVideoCourse
    ? (total ? Math.min(100, Math.round((done / total) * 100)) : 0)
    : (Number(progressPct) || 0);
  const nextSubject = (videoCourse?.subjects || []).find((s) => s.opened !== false
    && (Number(s.completedUnitCount) || 0) < (Number(s.totalUnitCount) || 0));
  const freePortalCourse = isFreePortalCourseName(currentCourseName);
  const courseCta = isVideoCourse
    ? nextSubject
      ? {
        label: `Học tiếp: ${nextSubject.name}`,
        onClick: () => navigate(`/student/lesson-practice/subjects/${nextSubject.id}?courseId=${encodeURIComponent(videoCourse.id)}`),
      }
      : { label: total && done >= total ? 'Ôn lại khóa học' : 'Vào học', onClick: () => navigate('/student/lesson-practice') }
    : { label: 'Xem lịch học', onClick: () => navigate('/student#schedule') };

  // ── Việc cần làm hôm nay: chỉ hiện việc còn tồn, bấm là tới đúng việc ──────
  const pendingHomework = useMemo(
    () => (myAssignments || []).filter((a) => !a.mySubmission).sort((a, b) => deadlineMs(a) - deadlineMs(b)),
    [myAssignments],
  );
  const nearestQuiz = [...pendingQuizzes].sort((a, b) => deadlineMs(a) - deadlineMs(b))[0];
  const practiceStats = practice?.stats;
  const tasks = [];
  if (pendingHomework.length) {
    const first = pendingHomework[0];
    const firstId = first._id || first.id;
    tasks.push({
      key: 'hw',
      icon: ClipboardList,
      tone: 'bg-gradient-to-b from-orange-400 to-orange-600',
      title: `Bài tập cần nộp (${pendingHomework.length})`,
      sub: `${first.title || 'Bài tập'}${first.deadline ? ` · hạn ${formatDeadline(first.deadline)}` : ''}`,
      cta: 'Nộp bài',
      onClick: () => navigate(`/student#materials-assignments${firstId ? `?assignmentId=${firstId}` : ''}`),
    });
  }
  if (pendingQuizzes.length) {
    tasks.push({
      key: 'quiz',
      icon: Trophy,
      tone: 'bg-gradient-to-b from-red-500 to-red-700',
      title: `Trắc nghiệm chưa làm (${pendingQuizzes.length})`,
      sub: `${nearestQuiz?.title || 'Bài trắc nghiệm'}${nearestQuiz?.deadline ? ` · hạn ${formatDeadline(nearestQuiz.deadline)}` : ''}`,
      cta: 'Làm bài',
      onClick: () => navigate('/student/exam'),
    });
  }
  if (practiceStats && !practiceStats.playedToday && practice.topics?.length) {
    const lost = practiceStats.streakState === 'lost';
    const atRisk = practiceStats.streakState === 'at_risk' && practiceStats.streak > 0;
    tasks.push({
      key: 'practice',
      icon: lost ? Gamepad2 : Flame,
      tone: lost ? 'bg-gradient-to-b from-slate-400 to-slate-600' : 'bg-gradient-to-b from-orange-400 to-red-600',
      title: atRisk ? `Giữ chuỗi ${practiceStats.streak} ngày` : lost ? 'Lấy lại chuỗi luyện tập' : 'Luyện tập hằng ngày',
      sub: atRisk ? 'Chuỗi về 0 lúc nửa đêm nếu chưa luyện' : '10 câu · khoảng 5 phút',
      cta: 'Làm ngay',
      onClick: () => navigate('/student/daily-practice'),
    });
  }

  const meetCards = meetCardsPre;

  return (
    <div className="cms-sd cms-sd-stack min-w-0 lg:!gap-3 lg:-mb-4 th-dashboard-overview th-dashboard-overview--student">
      <header className="cms-sd-page !py-0 flex min-w-0">
        <WelcomeHero
          role="student"
          name={studentData.name}
          chips={heroChips}
          showJoin={false}
        />
      </header>

      {meetCards.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-900">
            <Video size={18} className="text-red-600" aria-hidden="true" /> Lịch Meet
          </h3>
          <ul className="space-y-2">
            {meetCards.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-black text-slate-900">{item.slotLabel} {item.startTime}–{item.endTime}</p>
                  <p className="text-xs font-semibold text-slate-500">{formatDayLabel(item.day)}{item.live ? ' · Đang diễn ra' : ''}</p>
                </div>
                {item.live && item.linkHoc ? (
                  <a href={item.linkHoc} target="_blank" rel="noopener noreferrer" className="cms-btn cms-btn-primary !py-2 text-sm">Vào Meet</a>
                ) : item.live ? (
                  <span className="text-xs font-bold text-amber-600">Chờ link từ trung tâm</span>
                ) : <span className="text-xs font-bold text-slate-400">Chưa đến giờ</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="cms-sd-page !pt-0 cms-sd-stack lg:!gap-3">
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-3">
          {/* Cột trái: Lịch học hôm nay → khóa học (nếu có) → việc cần làm → hoạt động gần đây */}
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-7 lg:gap-3">
            {/* Lịch học hôm nay */}
            <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                  <Calendar size={18} className="text-red-600" aria-hidden="true" /> Lịch học hôm nay
                </h3>
                {todayClasses.some((c) => c.live) && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>Đang diễn ra</span>
                  </span>
                )}
              </div>

              {todayClasses.length > 0 ? (
                <div className="space-y-2.5">
                  {todayClasses.map((item) => (
                    <div
                      key={item.id}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${item.live ? 'border-emerald-300 bg-emerald-50/50 shadow-xs' : 'border-slate-200 bg-slate-50/60'
                        }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-sm font-black text-slate-900 truncate">
                          {item.title}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 font-semibold">
                          <span className="flex items-center gap-1">
                            <Clock size={13} className="text-slate-400" />
                            {item.time}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Calendar size={13} className="text-slate-400" />
                            {item.dateLabel}
                          </span>
                          {item.teacher && (
                            <>
                              <span>·</span>
                              <span className="text-slate-500">GV: {item.teacher}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0">
                        {item.meetLink ? (
                          <a
                            href={item.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-98"
                          >
                            <Video size={15} />
                            <span>Vào lớp Meet</span>
                            <ExternalLink size={13} />
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                            <Clock size={13} /> Chưa có link Meet
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <Calendar size={20} />
                  </div>
                  <p className="mt-2 text-sm font-bold text-slate-700">Hôm nay không có lịch</p>
                  {nextSchedule ? (
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Lịch tới: <strong className="text-slate-800">{nextSchedule.title || nextSchedule.subject || 'Buổi học'}</strong> · {sessionRange} ({formatDayLabel(nextSchedule.date)})
                    </p>
                  ) : meetCardsPre[0] ? (
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      Lịch Meet tới: <strong className="text-slate-800">{meetCardsPre[0].title || 'Lớp Meet'}</strong> · {meetCardsPre[0].startTime}–{meetCardsPre[0].endTime} ({formatDayLabel(meetCardsPre[0].day)})
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-slate-400">Bạn có thể tự ôn luyện hoặc làm bài tập hôm nay nhé!</p>
                  )}
                </div>
              )}
            </section>

            {/* Khóa học của tôi - Ẩn khi là tài khoản miễn phí */}
            {!freePortalCourse && Boolean(currentCourseName) && (
              <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                    <BookOpen size={18} className="text-red-600" aria-hidden="true" /> Khóa học của tôi
                  </h3>
                  {enrollments.length > 1 && (
                    <select
                      value={currentCourseName}
                      onChange={(e) => setActiveCourseName(e.target.value)}
                      className="max-w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none focus:border-red-300"
                      aria-label="Chọn khóa học"
                    >
                      {enrollments.map((c) => {
                        const name = c.courseName || c.name;
                        return <option key={c.enrollmentId || c.id || name} value={name}>{name}</option>;
                      })}
                    </select>
                  )}
                </div>
                <p className="line-clamp-2 text-base font-black text-slate-800">{currentCourseName || 'Chưa có khóa học'}</p>
                <div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-orange-400 transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-600">
                    <span><span className="text-slate-900">{done}/{total}</span> {unit} · {pct}%</span>
                    <span>Còn {Math.max(0, total - done)} {unit}</span>
                    {viewStudent?.avgGrade != null && viewStudent.avgGrade !== '' && <span>Điểm TB <span className="text-slate-900">{viewStudent.avgGrade}</span>/10</span>}
                    {!isVideoCourse && viewStudent?.teacher && <span className="truncate">GV: {viewStudent.teacher}</span>}
                  </div>
                  {videoCourses.error && <p className="mt-1 text-xs font-semibold text-amber-700">Không đồng bộ được tiến độ bài học: {videoCourses.error}</p>}
                </div>
                <button type="button" onClick={courseCta.onClick} className="cms-btn cms-btn-primary self-start">
                  <PlayCircle size={16} aria-hidden="true" /> <span className="max-w-[260px] truncate">{courseCta.label}</span>
                </button>
              </section>
            )}

            {/* Việc cần làm hôm nay - ngay dưới thẻ khóa học */}
            <section className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                <CheckCircle2 size={18} className="text-red-600" aria-hidden="true" /> Việc cần làm hôm nay
              </h3>
              {tasks.length ? (
                <div className="grid min-w-0 grid-cols-1 gap-2.5 md:grid-cols-2">
                  {tasks.map(({ key, ...task }) => <TaskRow key={key} {...task} />)}
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3">
                  <CheckCircle2 size={26} className="shrink-0 text-emerald-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-emerald-700">Hôm nay bạn đã hoàn thành hết việc!</p>
                    <p className="text-xs text-emerald-600">Không còn bài tập, trắc nghiệm hay lượt luyện tập nào đang chờ.</p>
                  </div>
                </div>
              )}
            </section>

            {/* Hoạt động gần đây - Đã ẩn trên Web và Mobile theo yêu cầu */}
          </div>

          {/* Cột phải: mục tiêu + bảng xếp hạng, nằm ngay đầu trang */}
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-5 lg:gap-3">
            <LmsGoalMergedCard />
            <LearningLeaderboardCard />
          </div>
        </div>
      </div>
    </div>
  );
}
