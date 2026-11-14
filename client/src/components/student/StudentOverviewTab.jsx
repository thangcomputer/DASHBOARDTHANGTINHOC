import React, { useEffect, useMemo, useState } from 'react';
import FreeMeetPlanModal from './dailyPractice/FreeMeetPlanModal';
import MeetScheduleEmptyState from './MeetScheduleEmptyState';
import { useStudentSubscription } from './subscription/subscriptionContext';
import { hasMeetAccessClient } from '../../utils/subscription';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Calendar, CheckCircle2, ChevronRight, ClipboardList, Clock, Crown, ExternalLink, Flame, Gamepad2, Plus,
  PlayCircle, Trophy, Video, Zap,
} from 'lucide-react';
import LearningLeaderboardCard from './LearningLeaderboardCard';
import { CompactCoursePicker } from './StudentShared';
import WelcomeHero from '../WelcomeHero';
import api from '../../services/api';
import lessonPracticeApi from '../../services/lessonPracticeApi';
import dailyPracticeApi, { DAILY_PRACTICE_STATS_EVENT } from '../../services/dailyPracticeApi';
import { LEARNING_GOAL_CHANGED_EVENT } from '../../utils/learningGoal';
import { isScheduleOngoingNow, getScheduleDisplayKind, normalizeScheduleDate } from '../../utils/scheduleTime';
import { isFreePortalCourseName, isFreePortalSelfRegistrationStudent } from '../../utils/enrollments';
import { isMeetEnded, isMeetLiveNow, meetLessonName, vnScheduleClock } from '../../utils/meetJoin';
import { isFreePortalLocked } from './dailyPractice/FreeFeatureLock';
import meetClassApi from '../../services/meetClassApi';
import { DuoButton, DuoDailyQuestsCard, DuoHeroCard } from '../duo';
import { pickActivePathTopic } from './dailyPractice/PathView';
import { pathTopicHasLearningProgress, pathTopicNextLinePrefix } from '../../../../shared/dailyPractice/lastPathTopic.mjs';
import { resolveSavedPathTopicId, syncLastPathTopicFromServer } from '../../utils/lastPathTopic';

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


function shortDayLabel(dayKey) {
  const [, month, day] = String(dayKey || '').split('-');
  return day && month ? `${day}/${month}` : 'Hôm nay';
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

function parseHmToMinutes(timeStr) {
  const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function sortMeetClasses(rows = [], clock = vnScheduleClock()) {
  return [...rows]
    .filter((m) => m?.status !== 'cancelled')
    .map((m) => {
      const isToday = m.day === clock.day;
      const live = isMeetLiveNow({
        day: m.day,
        startTime: m.startTime,
        endTime: m.endTime,
        nowDay: clock.day,
        nowMinutes: clock.minutes,
      });
      const start = parseHmToMinutes(m.startTime) ?? 0;
      const futureToday = isToday && clock.minutes < start;
      const nextStart = live
        ? -1
        : futureToday
          ? start - clock.minutes
          : m.day && m.day > clock.day
            ? 100000 + start
            : 200000 + start;
      let dayLabel = shortDayLabel(m.day);
      if (live) dayLabel = 'Đang diễn ra';
      else if (isToday) dayLabel = 'Hôm nay';
      return { ...m, live, nextStart, dayLabel };
    })
    .sort((a, b) => a.nextStart - b.nextStart);
}

function TaskRow({ icon: Icon, tone, title, sub, cta, onClick, freePortalUi = false }) {
  return (
    <div
      onClick={onClick}
      className={`duo-pressable flex w-full flex-col gap-2.5 rounded-2xl border bg-white p-3 sm:flex-row sm:items-center sm:justify-between shadow-sm transition cursor-pointer ${
        freePortalUi ? 'border-[#E2E8F0] hover:border-emerald-200' : 'border-slate-200 hover:border-red-200'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white ${tone}`}>
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-slate-900">{title}</span>
          {sub ? <span className="block truncate text-xs text-slate-500">{sub}</span> : null}
        </div>
      </div>
      <DuoButton
        variant={freePortalUi ? 'primary' : 'danger'}
        size="sm"
        className="w-full shrink-0 sm:w-auto"
        rightIcon={<ChevronRight size={14} aria-hidden="true" />}
        label={cta}
        onClick={(e) => {
          e?.stopPropagation?.();
          onClick();
        }}
      />
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
  myAssignments = [],
  mySchedules = [],
  studyLogs: _studyLogs = [],
}) {
  const navigate = useNavigate();
  const [videoCourses, setVideoCourses] = useState({ byId: new Map(), byName: new Map(), error: '' });
  const [practice, setPractice] = useState(null);
  const [pathData, setPathData] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [meetClasses, setMeetClasses] = useState([]);
  const [pendingQuizzes, setPendingQuizzes] = useState([]);
  const [meetPlanOpen, setMeetPlanOpen] = useState(false);
  const subCtx = useStudentSubscription();
  const portalSub = subCtx?.subscription;

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const reloadMeetClasses = () => {
    meetClassApi.mine()
      .then((res) => setMeetClasses(res.data || []))
      .catch(() => setMeetClasses([]));
  };

  useEffect(() => {
    reloadMeetClasses();
    const onVisible = () => {
      if (document.visibilityState === 'visible') reloadMeetClasses();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  useEffect(() => {
    reloadMeetClasses();
  }, [portalSub?.state, portalSub?.expiresAt, portalSub?.meetLifetime]);

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
    let portalSession = null;
    try {
      portalSession = JSON.parse(localStorage.getItem('student_user') || 'null');
    } catch { /* ignore */ }
    if (isFreePortalLocked(portalSession)) return () => { cancelled = true; };
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
    const load = () => {
      dailyPracticeApi.student.overview().then(setPractice).catch(() => { });
      dailyPracticeApi.student.path()
        .then((data) => {
          setPathData(data);
          syncLastPathTopicFromServer(data?.activeTopicId);
        })
        .catch(() => { setPathData(null); });
    };
    load();
    const onFocus = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onFocus);
    const onStats = (event) => {
      const detail = event?.detail || {};
      setPractice((prev) => {
        if (!prev) return prev;
        if (detail.stats) return { ...prev, stats: { ...prev.stats, ...detail.stats } };
        if (typeof detail.xpTotal === 'number') return { ...prev, stats: { ...prev.stats, xpTotal: detail.xpTotal } };
        return prev;
      });
    };
    window.addEventListener(LEARNING_GOAL_CHANGED_EVENT, load);
    window.addEventListener(DAILY_PRACTICE_STATS_EVENT, onStats);
    return () => {
      window.removeEventListener(LEARNING_GOAL_CHANGED_EVENT, load);
      window.removeEventListener(DAILY_PRACTICE_STATS_EVENT, onStats);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  let portalSession = null;
  try {
    portalSession = JSON.parse(localStorage.getItem('student_user') || 'null');
  } catch { /* ignore */ }
  const practiceLocked = isFreePortalLocked(portalSession);

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

  const sessionRange = nextSchedule
    ? `${nextSchedule.startTime || ''}${nextSchedule.endTime ? `–${nextSchedule.endTime}` : ''}`
    : '';

  const clockForMeet = vnScheduleClock();
  const meetCardsPre = useMemo(
    () => sortMeetClasses(meetClasses, clockForMeet),
    [meetClasses, clockForMeet.day, clockForMeet.minutes],
  );

  const currentCourseName = activeCourseName || viewStudent?.course || '';

  const todayKey = clockForMeet.day;
  const todayClasses = useMemo(() => {
    const today1on1Schedules = (mySchedules || [])
      .filter((s) => s.status !== 'cancelled' && normalizeScheduleDate(s.date) === todayKey)
      .sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));

    const todayMeetClasses = meetCardsPre.filter((item) => item.day === todayKey);

    const list = [];
    today1on1Schedules.forEach((s) => {
      const sDay = normalizeScheduleDate(s.date);
      const liveByClock = isMeetLiveNow({
        day: sDay,
        startTime: s.startTime,
        endTime: s.endTime,
        nowDay: todayKey,
        nowMinutes: clockForMeet.minutes,
      });
      const live = isScheduleOngoingNow(s) || (s.status !== 'cancelled' && s.status !== 'no_show' && liveByClock);
      const sTeacherId = String(s.teacherId?._id || s.teacherId?.id || s.teacherId || '');
      const sCourse = normalizeCourseName(s.course || s.courseName || '');
      const matchedEnrollment = (enrollments || []).find((e) => (
        sTeacherId
        && String(e?.teacherId?._id || e?.teacherId?.id || e?.teacherId || '') === sTeacherId
        && (!sCourse || normalizeCourseName(e?.courseName || e?.name || '') === sCourse)
        && String(e?.linkHoc || '').trim()
      ))
        || (enrollments || []).find((e) => (
          sTeacherId
          && String(e?.teacherId?._id || e?.teacherId?.id || e?.teacherId || '') === sTeacherId
          && String(e?.linkHoc || '').trim()
        ))
        || (enrollments || []).find((e) => (
          sCourse
          && normalizeCourseName(e?.courseName || e?.name || '') === sCourse
          && String(e?.linkHoc || '').trim()
        ));
      const rawMeetLink = String(
        s.linkHoc
        || s.meetingUrl
        || matchedEnrollment?.linkHoc
        || viewStudent?.linkHoc
        || viewStudent?.joinClassUrl
        || viewStudent?.online_meeting_url
        || studentData?.linkHoc
        || studentData?.online_meeting_url
        || '',
      ).trim();
      const meetLink = rawMeetLink && !/^https?:\/\//i.test(rawMeetLink)
        ? `https://${rawMeetLink}`
        : rawMeetLink;
      const joinable = live || isScheduleOngoingNow(s);
      const ended = isMeetEnded({
        day: sDay,
        endTime: s.endTime,
        nowDay: todayKey,
        nowMinutes: clockForMeet.minutes,
      });
      list.push({
        id: s._id || s.id || `1on1-${s.date}-${s.startTime}`,
        title: s.title || s.subject || s.content || s.courseName || currentCourseName || 'Buổi học 1 kèm 1',
        time: s.startTime && s.endTime ? `${s.startTime} – ${s.endTime}` : (s.startTime || 'Trong ngày'),
        dateLabel: shortDayLabel(sDay) || 'Hôm nay',
        meetLink,
        live: live && !ended,
        joinable: joinable && !ended,
        ended,
        waitLabel: s.startTime ? `Vào lúc ${s.startTime}` : '',
        teacher: s.teacherName || s.teacher || viewStudent?.teacher || '',
      });
    });
    todayMeetClasses.forEach((m) => {
      const joinable = isMeetLiveNow({
        day: m.day,
        startTime: m.startTime,
        endTime: m.endTime,
        nowDay: todayKey,
        nowMinutes: clockForMeet.minutes,
      });
      const ended = isMeetEnded({
        day: m.day,
        endTime: m.endTime,
        nowDay: todayKey,
        nowMinutes: clockForMeet.minutes,
      });
      list.push({
        id: m.id || `meet-${m.day}-${m.startTime}`,
        title: meetLessonName(m),
        time: m.startTime && m.endTime ? `${m.startTime} – ${m.endTime}` : (m.slotLabel || 'Trong ngày'),
        dateLabel: shortDayLabel(m.day),
        meetLink: String(m.linkHoc || '').trim(),
        live: m.live && !ended,
        joinable: joinable && !ended,
        ended,
        waitLabel: m.startTime ? `Vào lúc ${m.startTime}` : 'Chưa đến giờ vào lớp',
        teacher: m.teacherName || m.teacher || '',
      });
    });
    return list.sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0));
  }, [mySchedules, meetCardsPre, todayKey, currentCourseName, viewStudent, clockForMeet.minutes, nowTick]);

  const nextLessons = useMemo(() => {
    const rows = [];
    meetCardsPre.forEach((item) => {
      if (!item.day || item.day <= todayKey || item.status === 'cancelled') return;
      rows.push({
        sort: `${item.day} ${item.startTime || ''}`,
        name: meetLessonName(item),
        meta: `${item.startTime || ''}–${item.endTime || ''} (${formatDayLabel(item.day)})`,
      });
    });
    (mySchedules || []).forEach((item) => {
      if (item.status === 'cancelled') return;
      const day = normalizeScheduleDate(item.date);
      if (!day || day <= todayKey) return;
      rows.push({
        sort: `${day} ${item.startTime || ''}`,
        name: item.title || item.subject || item.content || item.courseName || 'Buổi học',
        meta: `${item.startTime || ''}${item.endTime ? `–${item.endTime}` : ''} (${formatDayLabel(item.date)})`,
      });
    });
    rows.sort((a, b) => a.sort.localeCompare(b.sort));
    return rows;
  }, [meetCardsPre, mySchedules, todayKey]);

  const coursePickerItems = useMemo(() => {
    return (enrollments || []).map((c, index) => {
      const name = c.courseName || c.name || `Khóa học ${index + 1}`;
      const vc = (c.courseId && videoCourses.byId.get(String(c.courseId)))
        || videoCourses.byName.get(normalizeCourseName(name))
        || null;
      const isVideo = c.deliveryMode === 'video' || Boolean(vc);
      const d = isVideo ? (vc?.completed || 0) : (Number(c.completedSessions) || 0);
      const t = isVideo ? (vc?.total || 0) : (Number(c.totalSessions) || 0);
      const u = isVideo ? 'bài' : 'buổi';
      const p = t ? Math.min(100, Math.round((d / t) * 100)) : 0;
      return {
        key: c.enrollmentId || c.id || name,
        name,
        teacherName: c.teacherName || c.teacher,
        done: d,
        total: t,
        unit: u,
        pct: p,
        completed: t > 0 && d >= t,
      };
    });
  }, [enrollments, videoCourses]);

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
  const freePortalUi = Boolean(
    portalSession?.freePortal === true
    || viewStudent?.freePortal === true
    || studentData?.freePortal === true
    || isFreePortalCourseName(currentCourseName)
    || isFreePortalCourseName(portalSession?.course)
    || isFreePortalCourseName(viewStudent?.course)
    || isFreePortalSelfRegistrationStudent({
      ...(portalSession || {}),
      role: 'student',
      course: currentCourseName || portalSession?.course,
      enrollments,
      courses: viewStudent?.courses,
    })
    || (typeof document !== 'undefined' && document.documentElement.hasAttribute('data-free-portal-student'))
  );
  const accentIconClass = freePortalUi ? 'text-emerald-600' : 'text-red-600';
  const freePortalAccount = freePortalUi;
  const meetAccess = hasMeetAccessClient(portalSub);
  const meetScheduleEmptyMode = freePortalAccount
    ? (portalSub?.state === 'expired'
      ? 'renew'
      : !meetAccess
        ? 'purchase'
        : 'default')
    : 'default';
  const canOpenScheduleTab = meetScheduleEmptyMode === 'default' && !freePortalAccount;

  const practiceStats = practice?.stats;
  const pathTopic = useMemo(
    () => pickActivePathTopic(pathData, '', resolveSavedPathTopicId(undefined, pathData?.activeTopicId)),
    [pathData],
  );
  const activePathUnit = useMemo(() => {
    if (!pathTopic?.units?.length) return null;
    const nextId = pathTopic.next?.unitId;
    return pathTopic.units.find((u) => u.id === nextId)
      || pathTopic.units.find((u) => u.state !== 'locked' && u.state !== 'completed')
      || pathTopic.units[0];
  }, [pathTopic]);
  const heroProgress = pathTopic?.totalUnits
    ? Math.round(((pathTopic.completedUnits || 0) / pathTopic.totalUnits) * 100)
    : (practiceStats?.playedToday ? 100 : 0);
  const todayAnswers = practiceStats?.todaySessions
    ? practiceStats.todaySessions * 10
    : (practiceStats?.playedToday ? 10 : 0);
  const todayXp = practiceStats?.todayXp ?? studentData?.lms?.dailyXpToday ?? 0;

  const liveMeet = meetCardsPre.find((item) => item.live);
  const nextMeet = meetCardsPre[0] || null;
  const isLiveSchedule = Boolean(ongoingSchedule);
  const isLiveMeet = Boolean(liveMeet);
  const heroChips = useMemo(() => {
    if (isLiveSchedule) {
      return [{ tone: 'live', label: `Đang học · Ca ${sessionRange}` }];
    }
    if (isLiveMeet && liveMeet) {
      return [{ tone: 'live', label: `Đang diễn ra · Meet ${meetLessonName(liveMeet)} ${liveMeet.startTime || ''}–${liveMeet.endTime || ''}` }];
    }
    const chips = [];
    if (nextSchedule) {
      chips.push({ icon: Calendar, label: `Buổi tới: Ca ${sessionRange} · ${formatDayLabel(nextSchedule.date)}` });
    }
    if (nextMeet) {
      chips.push({
        icon: Video,
        label: `Meet · ${meetLessonName(nextMeet)} · ${nextMeet.startTime || ''}–${nextMeet.endTime || ''} · ${nextMeet.dayLabel || formatDayLabel(nextMeet.day)}`,
      });
    }
    return chips;
  }, [isLiveSchedule, sessionRange, isLiveMeet, liveMeet, nextSchedule, nextMeet]);

  const pendingHomework = useMemo(
    () => (myAssignments || []).filter((a) => !a.mySubmission).sort((a, b) => deadlineMs(a) - deadlineMs(b)),
    [myAssignments],
  );
  const nearestQuiz = [...pendingQuizzes].sort((a, b) => deadlineMs(a) - deadlineMs(b))[0];
  const tasks = [];
  if (pendingHomework.length) {
    const first = pendingHomework[0];
    const firstId = first._id || first.id;
    tasks.push({
      key: 'hw',
      icon: ClipboardList,
      tone: freePortalUi ? 'bg-emerald-600' : 'bg-gradient-to-b from-orange-400 to-orange-600',
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
      tone: freePortalUi ? 'bg-[#059669]' : 'bg-gradient-to-b from-emerald-500 to-emerald-700',
      title: `Trắc nghiệm chưa làm (${pendingQuizzes.length})`,
      sub: `${nearestQuiz?.title || 'Bài trắc nghiệm'}${nearestQuiz?.deadline ? ` · hạn ${formatDeadline(nearestQuiz.deadline)}` : ''}`,
      cta: 'Làm bài',
      onClick: () => navigate('/student/exam'),
    });
  }
  if (practiceStats && !practiceStats.playedToday) {
    const lost = practiceStats.streakState === 'lost';
    const atRisk = practiceStats.streakState === 'at_risk' && practiceStats.streak > 0;
    tasks.push({
      key: 'practice',
      icon: lost ? Gamepad2 : Flame,
      tone: lost
        ? 'bg-slate-600'
        : (freePortalUi ? 'bg-emerald-500' : 'bg-red-500'),
      title: freePortalUi
        ? (atRisk ? `Duy trì chuỗi ${practiceStats.streak} ngày` : lost ? 'Luyện tập để lấy lại chuỗi' : 'Luyện tập hằng ngày')
        : (atRisk ? `Giữ chuỗi ${practiceStats.streak} ngày` : lost ? 'Lấy lại chuỗi luyện tập' : 'Luyện tập hằng ngày'),
      sub: freePortalUi
        ? (atRisk ? 'Luyện tập hôm nay để giữ vững chuỗi học' : 'Khoảng 5 phút mỗi ngày để củng cố kiến thức')
        : (atRisk ? 'Chuỗi về 0 lúc nửa đêm nếu chưa luyện' : '10 câu · khoảng 5 phút'),
      cta: 'Làm ngay',
      onClick: () => navigate('/student/daily-practice'),
    });
  }

  return (
    <div className="cms-sd cms-sd-stack min-w-0 lg:!gap-3 lg:-mb-4 th-dashboard-overview th-dashboard-overview--student">
      <header className="cms-sd-page !py-0 flex min-w-0">
        <WelcomeHero
          role="student"
          name={studentData?.name}
          chips={heroChips}
          showJoin={false}
          accent={freePortalAccount ? 'emerald' : 'brand'}
        />
      </header>

      <div className="cms-sd-page !pt-0 cms-sd-stack lg:!gap-3">
        <div className="grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-3">
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-7 lg:gap-3">
            <section className={`flex min-w-0 flex-col gap-3 rounded-2xl border bg-white p-4 shadow-sm ${freePortalUi ? 'border-[#E2E8F0]' : 'border-slate-200'}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                  <Calendar size={18} className={accentIconClass} aria-hidden="true" /> Lịch học hôm nay
                </h3>
                {todayClasses.some((c) => c.live) ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-700">
                    <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
                    Đang diễn ra
                  </span>
                ) : null}
              </div>

              {todayClasses.length > 0 ? (
                <div className="space-y-2.5">
                  {todayClasses.map((item) => (
                    <div
                      key={item.id}
                      className={`flex flex-row items-center justify-between gap-2.5 rounded-[16px] border-[1.5px] p-3 transition-all ${
                        item.live ? 'border-[#BBF7D0] bg-[#F0FDF4]' : 'border-[#E2E8F0] bg-[#F8FAFC]'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5">
                          {item.live ? (
                            <span className="shrink-0 rounded-[6px] bg-red-500 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white uppercase">
                              ĐANG DIỄN RA
                            </span>
                          ) : null}
                          <p className="truncate text-[14px] font-extrabold text-[#1E293B]">{item.title}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1 text-[12px] font-semibold text-[#64748B]">
                          <Clock size={13} className="shrink-0 text-[#64748B]" aria-hidden="true" />
                          <span>{item.time}</span>
                          <span className="text-[#94A3B8]">·</span>
                          <span>{item.dateLabel}</span>
                          {item.teacher ? (
                            <>
                              <span className="text-[#94A3B8]">·</span>
                              <span className="font-bold text-[#059669]">GV: {item.teacher}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {item.ended ? (
                          <DuoButton
                            variant="secondary"
                            size="sm"
                            disabled
                            label="Đã kết thúc"
                          />
                        ) : item.meetLink && item.joinable ? (
                          <DuoButton
                            variant="danger"
                            className="duo-btn--meet-live"
                            size="sm"
                            icon={<Video size={14} color="#FFFFFF" aria-hidden="true" />}
                            rightIcon={<ExternalLink size={12} color="#FFFFFF" aria-hidden="true" />}
                            label="Vào Meet"
                            onClick={() => window.open(item.meetLink, '_blank', 'noopener,noreferrer')}
                          />
                        ) : item.meetLink ? (
                          <DuoButton
                            variant="secondary"
                            size="sm"
                            disabled
                            icon={<Video size={14} color="#94A3B8" aria-hidden="true" />}
                            label="Vào Meet"
                            title={item.waitLabel || 'Chưa đến giờ vào lớp'}
                          />
                        ) : (
                          <span className="inline-flex items-center rounded-[10px] bg-[#F1F5F9] px-2.5 py-1.5 text-[11px] font-bold text-[#94A3B8]">
                            Chưa có link
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <MeetScheduleEmptyState
                  mode={meetScheduleEmptyMode}
                  freePortalUi={freePortalUi}
                  nextSchedule={nextLessons.length ? null : nextSchedule}
                  sessionRange={sessionRange}
                  formatDayLabel={formatDayLabel}
                  nextMeet={nextLessons.length ? null : meetCardsPre[0]}
                  onViewSchedule={canOpenScheduleTab ? () => navigate('/student#schedule') : undefined}
                  onPurchaseMeet={() => setMeetPlanOpen(true)}
                  onRenewMeet={() => subCtx?.openRenew?.()}
                />
              )}
              {nextLessons.length > 0 ? (
                <div className="border-t border-slate-100 pt-2.5">
                  <p className="text-xs font-black text-slate-500">Lịch học tiếp theo</p>
                  <ul className="mt-1.5 space-y-1">
                    {nextLessons.map((item) => (
                      <li key={`${item.sort}-${item.name}`} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                          <Plus size={11} strokeWidth={3} aria-hidden="true" />
                        </span>
                        <span>
                          <strong className="font-black text-slate-800">{item.name}</strong>
                          {' · '}
                          {item.meta}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            {!freePortalCourse && Boolean(currentCourseName) ? (
              <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                    <BookOpen size={18} className={accentIconClass} aria-hidden="true" /> Khóa học của tôi
                  </h3>
                </div>

                {coursePickerItems.length > 1 ? (
                  <CompactCoursePicker
                    aria-label="Chọn khóa học"
                    items={coursePickerItems}
                    activeCourseName={currentCourseName}
                    onChange={setActiveCourseName}
                    showProgress={false}
                  />
                ) : (
                  <p className="line-clamp-2 text-base font-black text-slate-800">{currentCourseName || 'Chưa có khóa học'}</p>
                )}

                <div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isVideoCourse
                          ? 'bg-blue-500'
                          : 'bg-gradient-to-r from-emerald-500 to-orange-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-600">
                    <span><span className="text-slate-900">{done}/{total}</span> {unit} · {pct}%</span>
                    <span>Còn {Math.max(0, total - done)} {unit}</span>
                    {viewStudent?.avgGrade != null && viewStudent.avgGrade !== '' && (
                      <span>Điểm TB <span className="text-slate-900">{viewStudent.avgGrade}</span>/10</span>
                    )}
                    {!isVideoCourse && viewStudent?.teacher && (
                      <span className="truncate">GV: {viewStudent.teacher}</span>
                    )}
                  </div>
                  {videoCourses.error && (
                    <p className="mt-1 text-xs font-semibold text-amber-700">Không đồng bộ được tiến độ bài học: {videoCourses.error}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {isVideoCourse ? (
                    <DuoButton
                      variant="blue"
                      size="md"
                      className="flex-1 min-w-[200px]"
                      icon={<Video size={16} color="#FFFFFF" aria-hidden="true" />}
                      label={nextSubject ? `Học tiếp: ${nextSubject.name}` : 'Vào học video'}
                      onClick={() => {
                        if (nextSubject && videoCourse?.id) {
                          navigate(`/student/lesson-practice/subjects/${nextSubject.id}?courseId=${encodeURIComponent(videoCourse.id)}`);
                        } else {
                          navigate('/student/lesson-practice');
                        }
                      }}
                    />
                  ) : (
                    <>
                      <DuoButton
                        variant={freePortalUi ? 'primary' : 'danger'}
                        size="md"
                        className="flex-1 min-w-[140px]"
                        icon={<Video size={16} color="#FFFFFF" aria-hidden="true" />}
                        label="Vào bài học"
                        onClick={() => navigate('/student/lesson-practice')}
                      />
                      <DuoButton
                        variant="secondary"
                        size="md"
                        className="flex-1 min-w-[140px]"
                        icon={<Calendar size={16} color="#475569" aria-hidden="true" />}
                        label="Lịch học"
                        onClick={() => navigate('/student#schedule')}
                      />
                    </>
                  )}
                </div>
              </section>
            ) : null}

            <section className="flex min-w-0 flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-900">
                <CheckCircle2 size={18} className={accentIconClass} aria-hidden="true" /> Việc cần làm hôm nay
              </h3>
              {tasks.length ? (
                <div className="flex flex-col gap-2.5">
                  {tasks.map(({ key, ...task }) => <TaskRow key={key} freePortalUi={freePortalUi} {...task} />)}
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
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:col-span-5 lg:gap-3">
            <LearningLeaderboardCard />
            {!practiceLocked ? (
              <>
                <DuoHeroCard
                  stageTitle={activePathUnit?.title || pathTopic?.topic?.name || 'Windows cơ bản'}
                  lessonSubtitle={
                    pathTopic?.next?.unitTitle
                      ? `${pathTopicNextLinePrefix(pathTopic)}: ${pathTopic.next.unitTitle}`
                      : activePathUnit?.description
                      || (practiceStats?.playedToday ? 'Hôm nay bạn đã hoàn thành bài tập xuất sắc!' : 'Bắt đầu hành trình chinh phục kiến thức')
                  }
                  progressPercent={heroProgress}
                  playedToday={practiceStats?.playedToday ?? false}
                  streak={practiceStats?.streak ?? 0}
                  onContinue={() => navigate(pathTopic?.next ? '/student/daily-practice?watch=stage' : '/student/daily-practice')}
                  continueLabel={
                    practiceStats?.playedToday
                      ? 'ÔN TẬP THÊM'
                      : (pathTopicHasLearningProgress(pathTopic) ? 'TIẾP TỤC HỌC' : 'BẮT ĐẦU')
                  }
                  mascotReaction={practiceStats?.playedToday ? 'happy' : 'studying'}
                />
                <DuoDailyQuestsCard
                  todayAnswers={todayAnswers}
                  todayXp={todayXp}
                  onOpenPractice={() => navigate('/student/daily-practice')}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
      <FreeMeetPlanModal
        open={meetPlanOpen}
        onClose={() => setMeetPlanOpen(false)}
        onPaid={() => {
          setMeetPlanOpen(false);
          subCtx?.refresh?.();
          reloadMeetClasses();
        }}
      />
    </div>
  );
}
