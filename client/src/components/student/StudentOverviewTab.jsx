import React, { useEffect, useMemo, useState } from 'react';
import FreeMeetPlanModal from './dailyPractice/FreeMeetPlanModal';
import MeetScheduleEmptyState from './MeetScheduleEmptyState';
import { useStudentSubscription } from './subscription/subscriptionContext';
import { hasMeetAccessClient } from '../../utils/subscription';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Award, BookOpen, Calendar, CheckCircle2, ChevronRight, ClipboardList, Clock, Copy, Crown, ExternalLink, Flame, Gamepad2, Gift, Play, Plus,
  PlayCircle, Trophy, Video, Zap,
} from 'lucide-react';
import { useToast } from '../../utils/useToast';
import { useActiveCourse } from '../../context/ActiveCourseContext';
import DigitalCertificateModal from './DigitalCertificateModal';
import ShareAchievementModal, { ShareTriggerButton } from './ShareAchievementModal';
import { buildCourseOrCertShareData } from '../../../../shared/dailyPractice/shareAchievement.mjs';
import LearningLeaderboardCard from './LearningLeaderboardCard';
import { CompactCoursePicker } from './StudentShared';
import WelcomeHero from '../WelcomeHero';
import api from '../../services/api';
import dailyPracticeApi, { DAILY_PRACTICE_STATS_EVENT } from '../../services/dailyPracticeApi';
import { LEARNING_GOAL_CHANGED_EVENT } from '../../utils/learningGoal';
import { LAST_STUDY_UPDATED_EVENT, formatResumeTimeAgo, readLastStudySession } from '../../utils/resumeLearning';
import { formatLmsTimestamp } from '../../utils/lmsLessonUi';
import { isScheduleOngoingNow, getScheduleDisplayKind, normalizeScheduleDate } from '../../utils/scheduleTime';
import { isFreePortalCourseName, isFreePortalSelfRegistrationStudent } from '../../utils/enrollments';
import { isMeetEnded, isMeetLiveNow, meetLessonName, vnScheduleClock } from '../../utils/meetJoin';
import { isFreePortalLocked } from './dailyPractice/FreeFeatureLock';
import meetClassApi from '../../services/meetClassApi';
import { DuoButton, DuoDailyQuestsCard } from '../duo';
import { pickActivePathTopic } from './dailyPractice/PathView';
import { pathTopicNextLinePrefix } from '../../../../shared/dailyPractice/lastPathTopic.mjs';
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
  if (freePortalUi) {
    return (
      <div
        onClick={onClick}
        className="flex w-full flex-col gap-3 rounded-2xl bg-white/75 backdrop-blur-md border border-white/95 px-4 py-3 shadow-[0_6px_18px_-8px_rgba(16,185,129,0.16),inset_0_1.5px_0_#fff] hover:bg-white/95 transition cursor-pointer sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-[#34D399] via-[#10B981] to-[#059669] text-white shadow-[0_8px_16px_-4px_rgba(16,185,129,0.45),inset_0_2px_2px_rgba(255,255,255,0.55)]">
            <Icon size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold text-slate-900">{title}</span>
            {sub ? <span className="block truncate text-xs font-medium text-slate-500">{sub}</span> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
          className="dew-btn-primary w-full sm:w-auto shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer"
        >
          <span>{cta}</span>
          <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="duo-pressable flex w-full flex-col gap-2.5 rounded-2xl border bg-white p-3 sm:flex-row sm:items-center sm:justify-between shadow-sm transition cursor-pointer border-[#E2E8F0] hover:border-emerald-200"
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
        variant="primary"
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
  const toast = useToast();
  const { enrolledCourses, setActiveCourseId, openAddCourse } = useActiveCourse();
  const [practice, setPractice] = useState(null);
  const [pathData, setPathData] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [meetClasses, setMeetClasses] = useState([]);
  const [pendingQuizzes, setPendingQuizzes] = useState([]);
  const [meetPlanOpen, setMeetPlanOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [shareResumeOpen, setShareResumeOpen] = useState(false);
  const [referralInput, setReferralInput] = useState('');
  const [referralBusy, setReferralBusy] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralFeedback, setReferralFeedback] = useState({ type: '', text: '' });
  const overviewStudentId = studentData?.id || studentData?._id || '';
  const [lastStudy, setLastStudy] = useState(() => readLastStudySession(overviewStudentId));
  const subCtx = useStudentSubscription();
  const portalSub = subCtx?.subscription;

  useEffect(() => {
    const refreshLastStudy = () => setLastStudy(readLastStudySession(overviewStudentId));
    refreshLastStudy();
    window.addEventListener(LAST_STUDY_UPDATED_EVENT, refreshLastStudy);
    window.addEventListener('focus', refreshLastStudy);
    return () => {
      window.removeEventListener(LAST_STUDY_UPDATED_EVENT, refreshLastStudy);
      window.removeEventListener('focus', refreshLastStudy);
    };
  }, [overviewStudentId]);

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
    const onUnlock = () => reloadMeetClasses();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('free-portal-unlocked', onUnlock);
    window.addEventListener('cms:subscription-updated', onUnlock);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('free-portal-unlocked', onUnlock);
      window.removeEventListener('cms:subscription-updated', onUnlock);
    };
  }, []);

  useEffect(() => {
    reloadMeetClasses();
  }, [portalSub?.state, portalSub?.expiresAt, portalSub?.meetLifetime]);

  useEffect(() => {
    let cancelled = false;
    const loadQuizzes = (forceUnlocked = false) => {
      let portalSession = null;
      try {
        portalSession = JSON.parse(localStorage.getItem('student_user') || 'null');
      } catch { /* ignore */ }
      if (!forceUnlocked && isFreePortalLocked(portalSession)) return;
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
    };
    loadQuizzes(false);
    const onUnlock = () => loadQuizzes(true);
    window.addEventListener('free-portal-unlocked', onUnlock);
    return () => {
      cancelled = true;
      window.removeEventListener('free-portal-unlocked', onUnlock);
    };
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
    window.addEventListener('free-portal-unlocked', load);
    window.addEventListener('free-portal-locked', load);
    window.addEventListener('cms:subscription-updated', load);
    return () => {
      window.removeEventListener(LEARNING_GOAL_CHANGED_EVENT, load);
      window.removeEventListener(DAILY_PRACTICE_STATS_EVENT, onStats);
      window.removeEventListener('free-portal-unlocked', load);
      window.removeEventListener('free-portal-locked', load);
      window.removeEventListener('cms:subscription-updated', load);
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
      const d = Number(c.completedSessions) || 0;
      const t = Number(c.totalSessions) || 0;
      const p = t ? Math.min(100, Math.round((d / t) * 100)) : 0;
      return {
        key: c.enrollmentId || c.id || name,
        name,
        teacherName: c.teacherName || c.teacher,
        done: d,
        total: t,
        unit: 'buổi',
        pct: p,
        completed: t > 0 && d >= t,
      };
    });
  }, [enrollments]);

  const done = Number(viewStudent?.completedSessions) || 0;
  const total = Number(viewStudent?.totalSessions) || 0;
  const unit = 'buổi';
  const pct = Number(progressPct) || 0;
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
  const accentIconClass = 'text-emerald-600';
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
  const referralInfo = practice?.referral || practiceStats?.referral || null;
  const formatShortReferralVnd = (amount) => {
    const val = Math.max(0, Math.round(Number(amount) || 0));
    if (val === 0) return '0đ';
    if (val >= 1000 && val % 1000 === 0) return `${val / 1000}K`;
    return `${val.toLocaleString('vi-VN')}đ`;
  };
  const referralDiscountVnd = Math.max(0, Math.round(Number(referralInfo?.discountAmountVnd ?? 50000)));
  const referralReferrerVnd = Math.max(0, Math.round(Number(referralInfo?.referrerRewardVnd ?? 50000)));
  const referralAvailableVnd = Math.max(0, Math.round(Number(referralInfo?.availableDiscountVnd || 0)));
  const referralShortDiscount = formatShortReferralVnd(referralDiscountVnd);
  const referralShortReferrer = formatShortReferralVnd(referralReferrerVnd);
  const handleCopyReferral = async () => {
    if (!referralInfo?.code) return;
    try {
      await navigator.clipboard?.writeText(referralInfo.code);
      setReferralCopied(true);
      toast.success('Đã sao chép mã giới thiệu!');
      setTimeout(() => setReferralCopied(false), 2000);
    } catch {
      setReferralFeedback({ type: 'error', text: `Mã của bạn là ${referralInfo.code}` });
    }
  };
  const handleRedeemReferral = async (e) => {
    e.preventDefault();
    const cleaned = String(referralInput || '').trim();
    if (!cleaned || referralBusy) return;
    setReferralBusy(true);
    setReferralFeedback({ type: '', text: '' });
    try {
      const data = await dailyPracticeApi.student.redeemReferral(cleaned);
      setReferralInput('');
      const gained = Math.max(0, Math.round(Number(data?.discountAmountVnd ?? referralDiscountVnd)));
      setReferralFeedback({
        type: 'success',
        text: gained > 0
          ? `Đã áp mã từ ${data.referrerName}! Bạn nhận ngay ưu đãi giảm ${gained.toLocaleString('vi-VN')}đ khi đăng ký khóa học.`
          : `Đã áp dụng mã giới thiệu từ ${data.referrerName}!`,
      });
      dailyPracticeApi.student.overview().then(setPractice).catch(() => { });
    } catch (err) {
      setReferralFeedback({ type: 'error', text: err.message || 'Không thể áp dụng mã giới thiệu' });
    } finally {
      setReferralBusy(false);
    }
  };
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
  const activeUnitSteps = Array.isArray(activePathUnit?.steps) ? activePathUnit.steps : [];
  const activeUnitDoneSteps = activeUnitSteps.filter((s) => s.state === 'completed').length;
  const activeUnitPct = activeUnitSteps.length
    ? Math.round((activeUnitDoneSteps / activeUnitSteps.length) * 100)
    : 0;
  const topicUnitPct = pathTopic?.totalUnits
    ? Math.round(((pathTopic.completedUnits || 0) / pathTopic.totalUnits) * 100)
    : 0;
  const heroProgress = activeUnitPct > 0
    ? activeUnitPct
    : (pathTopic?.totalUnits ? topicUnitPct : (practiceStats?.playedToday ? 100 : 0));
  const todayAnswers = Math.max(
    Number(practiceStats?.todayQuestions) || 0,
    practiceStats?.todaySessions ? practiceStats.todaySessions * 10 : (practiceStats?.playedToday ? 10 : 0),
  );
  const todayVideos = Number(practiceStats?.todayVideos) || 0;
  const todayXp = practiceStats?.todayXp ?? studentData?.lms?.dailyXpToday ?? 0;

  const effectiveLastStudy = useMemo(() => {
    if (lastStudy) return lastStudy;
    if (!practiceLocked && (pathTopic || activePathUnit)) {
      const topicName = pathTopic?.topic?.name || 'Lộ trình DewSkill';
      const lessonTitle = pathTopic?.next?.unitTitle || activePathUnit?.title || topicName;
      const stepLabel = pathTopic?.next?.stepLabel
        ? `${pathTopicNextLinePrefix(pathTopic)} · ${pathTopic.next.stepLabel}`
        : `Chặng ${activePathUnit?.index || 1}`;
      return {
        kind: 'daily_practice',
        courseTitle: topicName,
        lessonTitle,
        sectionLabel: stepLabel,
        atSec: 0,
        progressPct: heroProgress,
        href: '/student/daily-practice',
        updatedAt: 0,
      };
    }
    return null;
  }, [lastStudy, practiceLocked, pathTopic, activePathUnit, heroProgress]);

  const activeResumeCertReady = Boolean(
    effectiveLastStudy
    && (effectiveLastStudy.kind === 'daily_practice'
      ? Boolean(pathTopic?.totalUnits && (pathTopic.completedUnits || 0) >= pathTopic.totalUnits)
      : Number(effectiveLastStudy.progressPct) >= 100),
  );
  const resumeKindLabel = effectiveLastStudy?.kind === 'lesson_practice'
    ? 'Bài giảng thực hành'
    : effectiveLastStudy?.kind === 'daily_practice'
      ? 'Lộ trình DewSkill'
      : 'Video khóa học';

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
        : (freePortalUi ? 'bg-emerald-500' : 'bg-emerald-500'),
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

      <div className={freePortalUi ? 'cms-sd-page !pt-0 cms-sd-stack mt-5' : 'cms-sd-page !pt-0 cms-sd-stack lg:!gap-3'}>
        <div className={freePortalUi ? 'grid min-w-0 grid-cols-1 items-start gap-5 xl:grid-cols-12' : 'grid min-w-0 grid-cols-1 items-start gap-4 lg:grid-cols-12 lg:gap-3'}>
          <div className={freePortalUi ? 'flex min-w-0 flex-col gap-5 xl:col-span-7' : 'flex min-w-0 flex-col gap-4 lg:col-span-7 lg:gap-3'}>
            {freePortalUi ? (
              <section className="dew-app-card dew-app-card--emerald flex min-w-0 flex-col gap-4 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <BookOpen size={18} className="shrink-0 text-emerald-600" aria-hidden="true" />
                    <h2 className="truncate text-[15px] font-extrabold uppercase tracking-wide text-slate-900">
                      KHÓA HỌC CỦA TÔI ({enrolledCourses.length})
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => openAddCourse()}
                    className="dew-btn-primary inline-flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    <Plus size={14} aria-hidden="true" />
                    <span>Đăng ký thêm khóa</span>
                  </button>
                </div>

                {enrolledCourses.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {enrolledCourses.map((course) => {
                      const hasProgress = course.progress > 0;
                      const goPractice = () => {
                        setActiveCourseId(course.id);
                        const firstTopicId = course.topicIds?.[0];
                        navigate(firstTopicId
                          ? `/student/daily-practice?topicId=${encodeURIComponent(firstTopicId)}`
                          : '/student/daily-practice');
                      };
                      return (
                        <div
                          key={course.id}
                          className={`flex flex-col justify-between gap-3.5 rounded-2xl border p-4 shadow-[0_8px_20px_-10px_rgba(16,185,129,0.16),inset_0_1.5px_0_#fff] transition hover:-translate-y-0.5 ${
                            hasProgress
                              ? 'border-emerald-200/80 bg-gradient-to-br from-[#F0FDF4]/90 to-[#ECFDF5]/85'
                              : 'border-sky-200/80 bg-gradient-to-br from-[#F0F9FF]/90 to-[#ECFEFF]/85'
                          }`}
                        >
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="line-clamp-2 text-[15px] font-black leading-snug text-slate-900">
                                {course.title}
                              </h3>
                              {course.status === 'trial' ? (
                                <span className="shrink-0 rounded-full border border-sky-200 bg-sky-100/90 px-2 py-0.5 text-[10px] font-extrabold text-sky-700">
                                  Học thử
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs font-semibold text-slate-600">
                              {course.currentStage}
                            </p>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200/75 shadow-inner">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-[#34D399] via-[#10B981] to-[#059669] transition-all duration-500"
                                style={{ width: `${course.progress}%` }}
                              />
                            </div>
                          </div>

                          <div className="flex justify-end pt-0.5">
                            {hasProgress ? (
                              <button
                                type="button"
                                onClick={goPractice}
                                className="dew-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold cursor-pointer"
                              >
                                <span>Học tiếp</span>
                                <ArrowRight size={14} aria-hidden="true" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={goPractice}
                                className="inline-flex items-center gap-1.5 rounded-full border border-white/50 bg-gradient-to-b from-[#38BDF8] via-[#0EA5E9] to-[#0284C7] px-4 py-2 text-xs font-bold text-white shadow-[0_8px_18px_-6px_rgba(14,165,233,0.45),inset_0_2px_2px_rgba(255,255,255,0.5)] transition hover:brightness-105 cursor-pointer"
                              >
                                <span>Bắt đầu học</span>
                                <ArrowRight size={14} aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-r from-[#ECFDF5]/90 to-[#E0F2FE]/80 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-extrabold text-slate-900">
                        Chào mừng bạn đến với DewSkill!
                      </p>
                      <p className="text-xs font-medium text-slate-600">
                        Chọn lớp học phù hợp để mở lộ trình từng chặng hoặc học thử Chặng 1 miễn phí ngay.
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openAddCourse()}
                        className="dew-btn-white inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold cursor-pointer"
                      >
                        Chọn lộ trình
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/student/daily-practice')}
                        className="dew-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold cursor-pointer"
                      >
                        <Play size={13} fill="currentColor" aria-hidden="true" />
                        <span>Học thử Chặng 1</span>
                      </button>
                    </div>
                  </div>
                )}
              </section>
            ) : effectiveLastStudy ? (
                <section className="flex min-w-0 flex-col gap-3 rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-black tracking-wide text-white uppercase">
                        <Zap size={11} aria-hidden="true" /> Học tiếp 1 chạm
                      </span>
                      <span className="text-[11px] font-bold text-emerald-700">
                        {resumeKindLabel}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-slate-500">
                      {effectiveLastStudy.updatedAt > 0
                        ? formatResumeTimeAgo(effectiveLastStudy.updatedAt)
                        : 'Lộ trình hiện tại'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="truncate text-[15px] font-black text-slate-900">
                        {effectiveLastStudy.lessonTitle || effectiveLastStudy.unitTitle || effectiveLastStudy.courseTitle || 'Tiếp tục bài học'}
                      </h3>
                      <p className="truncate text-xs font-semibold text-slate-600">
                        {[effectiveLastStudy.courseTitle || effectiveLastStudy.subjectName, effectiveLastStudy.sectionLabel].filter(Boolean).join(' · ') || 'Quay lại đúng vị trí bạn đang học dở'}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {effectiveLastStudy.atSec > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700 tabular-nums">
                            <Clock size={11} aria-hidden="true" />
                            Đang xem tại {formatLmsTimestamp(effectiveLastStudy.atSec)}
                          </span>
                        ) : null}
                        {effectiveLastStudy.progressPct != null ? (
                          <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                            {effectiveLastStudy.progressPct}% hoàn thành
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                      <DuoButton
                        variant="primary"
                        size="sm"
                        className="w-full shrink-0 sm:w-auto"
                        icon={<PlayCircle size={15} color="#FFFFFF" aria-hidden="true" />}
                        rightIcon={<ChevronRight size={14} color="#FFFFFF" aria-hidden="true" />}
                        label="Học tiếp ngay"
                        onClick={() => {
                          const [pathname, hash] = String(effectiveLastStudy.href || '').split('#');
                          if (hash) {
                            navigate({ pathname: pathname || '/student', hash });
                            window.location.hash = hash;
                          } else {
                            navigate(effectiveLastStudy.href);
                          }
                        }}
                      />
                    </div>
                  </div>
                </section>
            ) : null}

            <section className={freePortalUi
              ? 'dew-app-card flex min-w-0 flex-col gap-3.5 p-5'
              : 'flex min-w-0 flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className={`flex items-center gap-2 ${freePortalUi ? 'text-[15px] font-extrabold text-slate-900' : 'text-base font-black text-slate-900'}`}>
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
                            <span className="shrink-0 rounded-[6px] bg-emerald-500 px-1.5 py-0.5 text-[9px] font-black tracking-wide text-white uppercase">
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
                            label="Vào học"
                            onClick={() => window.open(item.meetLink, '_blank', 'noopener,noreferrer')}
                          />
                        ) : !item.joinable ? (
                          <DuoButton
                            variant="secondary"
                            size="sm"
                            disabled
                            icon={<Video size={14} color="#94A3B8" aria-hidden="true" />}
                            label="Vào học"
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
                  onPurchaseMeet={() => navigate('/student/courses')}
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
                ) : null}

                <div>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    {coursePickerItems.length <= 1 ? (
                      <p className="line-clamp-2 text-base font-black text-slate-800">{currentCourseName || 'Chưa có khóa học'}</p>
                    ) : (
                      <span />
                    )}
                    <span className="shrink-0 text-xs font-black text-emerald-600 tabular-nums">{pct}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-orange-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-slate-600">
                    <span>Đã học <span className="text-slate-900">{done}/{total}</span> {unit}</span>
                    {viewStudent?.teacher && (
                      <span className="truncate">GV: {viewStudent.teacher}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <DuoButton
                    variant="primary"
                    size="md"
                    className="w-[calc(50%-0.375rem)] min-w-[168px]"
                    icon={<Video size={16} color="#FFFFFF" aria-hidden="true" />}
                    label="Vào bài học"
                    onClick={() => navigate('/student/daily-practice')}
                  />
                </div>
              </section>
            ) : null}

            <section className={freePortalUi
              ? 'dew-app-card dew-app-card--emerald flex min-w-0 flex-col gap-3 p-5'
              : 'flex min-w-0 flex-col gap-2.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'}
            >
              <h3 className={`flex items-center gap-2 ${freePortalUi ? 'text-[15px] font-extrabold text-slate-900' : 'text-base font-black text-slate-900'}`}>
                <CheckCircle2 size={18} className={accentIconClass} aria-hidden="true" /> Việc cần làm hôm nay
              </h3>
              {tasks.length ? (
                <div className="flex flex-col gap-2.5">
                  {tasks.map(({ key, ...task }) => <TaskRow key={key} freePortalUi={freePortalUi} {...task} />)}
                </div>
              ) : (
                <div className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${freePortalUi ? 'bg-emerald-50/80 border border-emerald-100' : 'bg-emerald-50'}`}>
                  <CheckCircle2 size={26} className="shrink-0 text-emerald-500" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-emerald-700">Hôm nay bạn đã hoàn thành hết việc!</p>
                    <p className="text-xs text-emerald-600">Không còn bài tập, trắc nghiệm hay lượt luyện tập nào đang chờ.</p>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className={freePortalUi ? 'flex min-w-0 flex-col gap-5 xl:col-span-5' : 'flex min-w-0 flex-col gap-4 lg:col-span-5 lg:gap-3'}>
            <LearningLeaderboardCard />
            {!practiceLocked ? (
              <DuoDailyQuestsCard
                todayAnswers={todayAnswers}
                todayVideos={todayVideos}
                todayXp={todayXp}
                onOpenPractice={() => navigate('/student/daily-practice')}
                dewdropStyle={freePortalUi}
              />
            ) : null}

            {freePortalUi && referralInfo && referralInfo.enabled !== false ? (
              <section className="dew-app-card dew-app-card--amber flex min-w-0 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-2 text-[15px] font-extrabold text-slate-900">
                      <Gift size={18} className="shrink-0 text-amber-500" aria-hidden="true" />
                      {referralDiscountVnd > 0
                        ? `Giới thiệu bạn bè · Giảm ${referralShortDiscount}`
                        : 'Giới thiệu bạn bè'}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      {referralDiscountVnd > 0 ? (
                        <>
                          Giảm ngay{' '}
                          <span className="font-extrabold text-emerald-700">
                            {referralDiscountVnd.toLocaleString('vi-VN')}đ
                          </span>{' '}
                          khi được giới thiệu
                          {referralReferrerVnd > 0 ? ` · Người giới thiệu nhận giảm ${referralShortReferrer}` : ''}
                          {Number(referralInfo.minOrderAmountVnd) > 0
                            ? ` (khóa từ ${formatShortReferralVnd(referralInfo.minOrderAmountVnd)})`
                            : ''}.
                        </>
                      ) : (
                        'Chia sẻ mã để giới thiệu bạn bè cùng học tại DewSkill.'
                      )}
                    </p>
                  </div>
                  {(referralAvailableVnd > 0 || referralInfo.referralCount > 0) ? (
                    <span className="shrink-0 rounded-full bg-amber-100/90 border border-amber-200/70 px-2.5 py-0.5 text-[11px] font-black text-amber-800">
                      {referralAvailableVnd > 0
                        ? `Đang có -${referralAvailableVnd.toLocaleString('vi-VN')}đ`
                        : `${referralInfo.referralCount} bạn`}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-100 px-3.5 py-2.5 shadow-[inset_0_1px_0_#fff]">
                  <p className="min-w-0 truncate text-xs text-slate-500 font-semibold">
                    MÃ CỦA BẠN:{' '}
                    <span className="font-mono text-sm font-black tracking-wide text-slate-900">{referralInfo.code}</span>
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyReferral}
                    className="dew-btn-primary inline-flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    <Copy size={13} aria-hidden="true" />
                    {referralCopied ? 'Đã sao chép' : 'Sao chép'}
                  </button>
                </div>

                {referralInfo.redeemed ? (
                  <p className="rounded-2xl bg-emerald-50/90 border border-emerald-100 px-3.5 py-2 text-xs font-semibold text-emerald-700">
                    ✓ Đã áp dụng mã giới thiệu {referralInfo.referredByCode || ''}
                    {referralAvailableVnd > 0
                      ? ` · Còn ưu đãi giảm ${referralAvailableVnd.toLocaleString('vi-VN')}đ (tự động trừ khi đăng ký khóa học).`
                      : '.'}
                  </p>
                ) : (
                  <form onSubmit={handleRedeemReferral} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value.toUpperCase())}
                      placeholder="Nhập mã bạn bè (Ví dụ: DEW-XXXXXX)"
                      maxLength={32}
                      className="min-w-0 flex-1 rounded-full border border-slate-200/80 bg-white/85 px-4 py-2 text-xs font-bold uppercase text-slate-800 placeholder:normal-case placeholder:font-medium placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]"
                    />
                    <button
                      type="submit"
                      disabled={referralBusy || !referralInput.trim()}
                      className="dew-btn-gold shrink-0 px-4 py-2 text-xs font-extrabold cursor-pointer disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      {referralBusy
                        ? 'Đang gửi...'
                        : referralDiscountVnd > 0
                          ? `Nhận giảm ${referralShortDiscount}`
                          : 'Áp dụng'}
                    </button>
                  </form>
                )}

                {referralFeedback.text ? (
                  <p
                    className={`rounded-2xl px-3.5 py-2 text-xs font-semibold ${
                      referralFeedback.type === 'success'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {referralFeedback.text}
                  </p>
                ) : null}
              </section>
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
      {certOpen && (
        <DigitalCertificateModal
          open={certOpen}
          onClose={() => setCertOpen(false)}
          studentName={studentData?.name || viewStudent?.name || 'Học viên Thắng Tin Học'}
          studentCode={studentData?.studentCode || viewStudent?.studentCode || ''}
          studentId={overviewStudentId}
          courseId={pathTopic?.topic?.id || currentCourseName || 'dewskill'}
          courseTitle={effectiveLastStudy?.courseTitle || currentCourseName || pathTopic?.topic?.name || 'Lộ trình Tin học DewSkill'}
          instructorName="Trung tâm Thắng Tin Học"
          certificateScope={freePortalUi ? 'subject' : 'course'}
          completionRate={activeResumeCertReady ? 100 : (effectiveLastStudy?.progressPct ?? (Number.isFinite(Number(progressPct)) ? Number(progressPct) : heroProgress))}
        />
      )}
      <ShareAchievementModal
        open={shareResumeOpen}
        onClose={() => setShareResumeOpen(false)}
        data={buildCourseOrCertShareData({
          title: effectiveLastStudy?.courseTitle || currentCourseName || pathTopic?.topic?.name || 'Lộ trình Tin học DewSkill',
          scope: freePortalUi ? 'subject' : 'course',
          studentName: studentData?.name || viewStudent?.name || '',
          completionRate: 100,
        })}
      />
    </div>
  );
}
