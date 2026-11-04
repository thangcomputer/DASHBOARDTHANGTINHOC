import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Award, BookOpen, Calendar, CheckCircle, CheckCircle2, ChevronRight, ClipboardList, Flame, Gamepad2,
  PlayCircle, Trophy, XCircle,
} from 'lucide-react';
import LearningGoalCard from './LearningGoalCard';
import LearningLeaderboardCard from './LearningLeaderboardCard';
import WelcomeHero from '../WelcomeHero';
import { getGradeTextClasses, getGradePillClasses, getGradeLabel } from '../../utils/gradeColors';
import api from '../../services/api';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import dailyPracticeApi from '../../services/dailyPracticeApi';
import { LEARNING_GOAL_CHANGED_EVENT } from '../../utils/learningGoal';
import { isScheduleOngoingNow, getScheduleDisplayKind, normalizeScheduleDate } from '../../utils/scheduleTime';
import '../dashboard-overview.css';

const RECENT_ACTIVITY_LIMIT = 5;

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

function deadlineMs(item) {
  const t = new Date(item?.deadline || 0).getTime();
  return Number.isFinite(t) && t > 0 ? t : Number.MAX_SAFE_INTEGER;
}

/** Một dòng trong "Việc cần làm hôm nay" — bấm là tới đúng việc. */
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

function StudyLogRow({ item }) {
  const isCancelled = item.type === 'cancelled' || item.type === 'attendance_cancel' || item.type === 'schedule_cancel';
  const isPastPending = ['past_pending', 'pending_attendance', 'overdue_attendance'].includes(item.type);
  const isOverdue = item.type === 'overdue_attendance' || item.displayKind === 'overdue_attendance';
  const isHomework = item.type === 'homework';
  const isQuiz = item.type === 'quiz';
  const isPassed = isQuiz ? (item.isPassed ?? item.meta?.isPassed) : undefined;
  const isAttendance = item.type === 'attendance';
  const isGradeUpdate = item.type === 'grade_update';
  const isEvaluation = item.type === 'evaluation';
  const isCourseComplete = item.type === 'course_complete';

  const badge = isPastPending ? (isOverdue ? 'Quá hạn điểm danh' : 'Chưa điểm danh')
    : isCancelled ? 'Hủy'
      : isGradeUpdate ? 'Cập nhật điểm'
        : isEvaluation ? 'Đánh giá'
          : isCourseComplete ? 'Hoàn thành'
            : isHomework ? 'Bài nộp'
              : isQuiz ? 'Trắc nghiệm'
                : isAttendance ? 'Điểm danh' : '';

  return (
    <div className={`flex items-start gap-2.5 px-3.5 py-3 ${isCancelled || isOverdue ? 'bg-red-50/30' : isPastPending ? 'bg-orange-50/40' : ''}`}>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${
        isCancelled || isOverdue ? 'bg-red-100 text-red-600'
          : isPastPending ? 'bg-orange-100 text-orange-700'
            : isHomework ? 'bg-purple-100 text-purple-600'
              : isQuiz ? 'bg-amber-100 text-amber-600'
                : 'bg-emerald-100 text-emerald-600'
      }`}
      >
        {isCancelled ? <XCircle size={15} aria-hidden="true" />
          : isPastPending ? <Calendar size={15} aria-hidden="true" />
            : isHomework ? <ClipboardList size={15} aria-hidden="true" />
              : isQuiz ? <Award size={15} aria-hidden="true" />
                : <CheckCircle size={15} aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-xs font-bold text-slate-800">
            {item.index ? `Buổi ${item.index} — ` : ''}{item.date}{item.time ? ` (${item.time})` : ''}
          </p>
          {badge && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-extrabold text-slate-600">{badge}</span>}
        </div>
        {item.note && <p className="mt-0.5 truncate text-xs text-slate-500">{item.note}</p>}
      </div>
      {!isCancelled && item.grade != null && (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {isQuiz ? (
            <span className={`text-xs font-extrabold tabular-nums ${isPassed ? 'text-emerald-600' : 'text-red-600'}`}>
              {item.rawScore != null ? `${Math.round(item.rawScore)}%` : `${item.grade} / 10`}
            </span>
          ) : (
            <span className={`text-xs font-extrabold tabular-nums ${getGradeTextClasses(item.grade)}`}>{item.grade} / 10</span>
          )}
          <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-extrabold ${
            isQuiz
              ? (isPassed ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-600')
              : getGradePillClasses(item.grade)
          }`}
          >
            {isQuiz ? (isPassed ? 'ĐẠT' : 'CHƯA ĐẠT') : (getGradeLabel(item.grade) || 'TB')}
          </span>
        </div>
      )}
    </div>
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
  studyLogs = [],
}) {
  const navigate = useNavigate();
  const [pendingQuizzes, setPendingQuizzes] = useState([]);
  const [videoCourses, setVideoCourses] = useState({ byId: new Map(), byName: new Map(), error: '' });
  const [practice, setPractice] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
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
    const load = () => dailyPracticeApi.student.overview().then(setPractice).catch(() => {});
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

  const isLive = Boolean(ongoingSchedule);
  const joinUrl = (
    ongoingSchedule?.linkHoc
    || nextSchedule?.linkHoc
    || viewStudent?.joinClassUrl
    || viewStudent?.linkHoc
    || viewStudent?.online_meeting_url
    || ''
  ).trim();
  const sessionRange = nextSchedule
    ? `${nextSchedule.startTime || ''}${nextSchedule.endTime ? `–${nextSchedule.endTime}` : ''}`
    : '';
  const heroChips = isLive
    ? [{ tone: 'live', label: `Đang học · Ca ${sessionRange}` }]
    : nextSchedule
      ? [{ icon: Calendar, label: `Buổi tới: Ca ${sessionRange} · ${formatDayLabel(nextSchedule.date)}` }]
      : [];

  // ── Khóa học của tôi: một chỗ duy nhất cho tiến độ ────────────────────────
  const currentCourseName = activeCourseName || viewStudent?.course || '';
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
      cta: 'Chơi ngay',
      onClick: () => navigate('/student/daily-practice'),
    });
  }

  const recentActivity = (studyLogs || []).filter((item) => item.type !== 'scheduled').slice(0, RECENT_ACTIVITY_LIMIT);

  return (
    <div className="cms-sd cms-sd-stack min-w-0 lg:!gap-3 lg:-mb-4 th-dashboard-overview th-dashboard-overview--student">
      <header className="cms-sd-page !py-0 flex min-w-0">
        <WelcomeHero
          role="student"
          name={studentData.name}
          chips={heroChips}
          joinUrl={isLive ? joinUrl : ''}
          joinHint={isLive ? 'Chưa có link học' : nextSchedule ? 'Chưa đến giờ học' : 'Chưa có lịch học'}
        />
      </header>

      <div className="cms-sd-page !pt-0 cms-sd-stack lg:!gap-3">
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-3">
        {/* Cột trái: khóa học → việc cần làm → hoạt động gần đây */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7 lg:gap-3">
          {/* Khóa học của tôi */}
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

          {/* Việc cần làm hôm nay — ngay dưới thẻ khóa học */}
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

          {/* Hoạt động gần đây */}
          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <h3 className="flex items-center gap-2 text-sm font-black text-slate-900">
                <ClipboardList size={18} className="text-emerald-500" aria-hidden="true" /> Hoạt động gần đây
              </h3>
              <button type="button" onClick={() => navigate('/student#schedule')} className="flex items-center gap-0.5 text-xs font-black text-red-600 !shadow-none">
                Xem nhật ký đầy đủ <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
            {recentActivity.length ? (
              <div className="divide-y divide-slate-100">
                {recentActivity.map((item, idx) => <StudyLogRow key={`${item.type}-${item.date}-${idx}`} item={item} />)}
              </div>
            ) : (
              <p className="px-4 py-8 text-center text-xs font-semibold text-slate-400">Điểm bài tập, trắc nghiệm và nhận xét của giảng viên sẽ hiện tại đây.</p>
            )}
          </section>
        </div>

        {/* Cột phải: mục tiêu + bảng xếp hạng, nằm ngay đầu trang */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-5 lg:gap-3">
          <LearningGoalCard />
          <LearningLeaderboardCard />
        </div>
        </div>
      </div>
    </div>
  );
}
