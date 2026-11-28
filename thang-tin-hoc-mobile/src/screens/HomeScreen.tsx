import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, DeviceEventEmitter, Easing, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  ArrowRight, Award, BookOpen, Calendar, CalendarDays, CheckCircle, ChevronRight, ClipboardList,
  Clock, Flame, Gamepad2, GraduationCap, PlayCircle, Target, Trophy, Video, X, Zap, type LucideIcon,
} from 'lucide-react-native';
import { ClipboardCheck, FileText, WalletCards } from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../app/AuthContext';
import { Avatar, AppScreen, Card, ErrorState, LoadingSkeleton, SectionHeading, StatusBadge, ProgressBar } from '../components/ui';
import { LearningLeaderboardCard } from '../components/LearningLeaderboardCard';
import { pickActivePathTopic } from '../utils/pickActivePathTopic';
import { pathTopicHasLearningProgress, pathTopicNextLinePrefix } from '../../../shared/dailyPractice/lastPathTopic.mjs';
import { resolveSavedPathTopicId, syncLastPathTopicFromServer } from '../utils/lastPathTopic';
import {
  LAST_STUDY_UPDATED_EVENT,
  formatLmsTimestamp,
  formatResumeTimeAgo,
  readLastStudySession,
  type LastStudySession,
} from '../utils/resumeLearning';
import { isMeetEnded, isMeetLiveNow, meetLessonName, vnScheduleClock } from '../utils/meetJoin';
import { FreeMeetPlanModal, isFreePortalLocked, isFreePortalMenu } from '../components/FreePortalModals';
import { SubscriptionRenewPanel } from '../components/subscription/SubscriptionRenew';
import { hasMeetAccessClient } from '../services/subscriptionApi';
import { CompactCoursePicker, type CoursePickerItem } from '../components/CompactCoursePicker';
import { WelcomeHero, type WelcomeChip } from '../components/WelcomeHero';
import { DAILY_PRACTICE_STATS_EVENT, dailyPracticeApi, type DpStats } from '../services/dailyPracticeApi';
import {
  LEARNING_GOAL_CHANGED_EVENT,
  OPEN_LEARNING_GOAL_EVENT,
  STUDY_MINUTE_EVENT,
  formatStudyMinutes,
  getLearningGoal,
  periodLabel,
  type LearningGoalData,
} from '../services/learningGoalApi';
import {
  assignmentService, evaluationService,
  quizService, scheduleService, studentProfileService, studentService,
} from '../services/mockService';
import { useMockResource } from '../hooks/useMockResource';
import { SOCKET_EVENTS } from '../services/socketService';
import { mobileApiRequest } from '../services/apiClient';
import { getTeacherDashboardMetrics } from '../services/teacherApi';
import { buildStudentDashboardActivity } from '../services/studentDashboardActivity';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';
import { DuoButton } from '../components/duo/DuoButton';
import { DuoDailyQuestsCard } from '../components/duo/DuoDailyQuestsCard';
import { ReferralRewardCard } from '../components/ReferralRewardCard';
import { listOfflineVideos } from '../services/offlineVideos';
import { saveHomeWidgetSnapshot } from '../services/widgetSync';

type RootNavigation = NativeStackNavigationProp<AppStackParamList>;
type TabNavigation = BottomTabNavigationProp<MainTabsParamList>;

function scheduleIsLive(item: { date?: string; startTime?: string; endTime?: string; time: string } | undefined) {
  if (!item?.date) return false;
  const times = item.time.match(/\d{1,2}:\d{2}/g) || [];
  const start = item.startTime || times[0];
  const end = item.endTime || times[1];
  if (!start || !end) return false;
  const startAt = new Date(`${item.date}T${start}:00+07:00`).getTime();
  const endAt = new Date(`${item.date}T${end}:00+07:00`).getTime();
  const now = Date.now();
  return Number.isFinite(startAt) && Number.isFinite(endAt) && now >= startAt && now <= endAt;
}

function scheduleIsCurrentOrFuture(item: { date?: string; startTime?: string; endTime?: string; time: string; status: string }) {
  if (item.status !== 'upcoming' || !item.date) return false;
  const times = item.time.match(/\d{1,2}:\d{2}/g) || [];
  const start = item.startTime || times[0];
  const end = item.endTime || times[1] || start;
  if (!start) {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return item.date >= todayKey;
  }
  const startAt = new Date(`${item.date}T${start}:00+07:00`).getTime();
  const endAt = new Date(`${item.date}T${end}:00+07:00`).getTime();
  return Number.isFinite(startAt) && Number.isFinite(endAt) && endAt >= Date.now();
}

function normalizeDashboardCourse(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
}

type MeetClassRow = {
  _id?: string;
  id?: string;
  title?: string;
  day?: string;
  slot?: string;
  slotKey?: string;
  slotLabel?: string;
  startTime?: string;
  endTime?: string;
  linkHoc?: string;
  status?: string;
  note?: string;
};

type MeetCardItem = MeetClassRow & {
  live: boolean;
  dayLabel: string;
  nextStart: number;
};

function shortDayLabel(dayKey?: string) {
  const [, month, day] = String(dayKey || '').split('-');
  return day && month ? `${day}/${month}` : 'Hôm nay';
}

function parseHmToMinutes(timeStr?: string) {
  const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function upcomingDayLabel(day?: string) {
  const key = String(day || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return formatMeetDayLabel(day);
  const weekday = new Date(`${key}T12:00:00+07:00`).toLocaleDateString('vi-VN', { weekday: 'long', timeZone: 'Asia/Ho_Chi_Minh' });
  const [, month, date] = key.split('-');
  return `${weekday} ${date}/${month}`;
}

function formatMeetDayLabel(day?: string) {
  const key = String(day || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return key || 'Hôm nay';
  const [, month, date] = key.split('-');
  return `${date}/${month}`;
}

/** Khớp web StudentOverviewTab — live theo ngày `day` từ admin + giờ VN. */
function sortMeetClasses(rows: MeetClassRow[] = []): MeetCardItem[] {
  const clock = vnScheduleClock();
  return [...rows]
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
      let dayLabel = formatMeetDayLabel(m.day);
      if (live) dayLabel = 'Đang diễn ra';
      else if (isToday) dayLabel = 'Hôm nay';
      return { ...m, live, nextStart, dayLabel };
    })
    .sort((a, b) => a.nextStart - b.nextStart);
}

async function openDashboardLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert('Không thể mở liên kết', error instanceof Error ? error.message : 'Vui lòng thử lại.');
  }
}

export function HomeScreen() {
  const { user, subscription, refreshSubscription } = useAuth();
  const [meetPlanOpen, setMeetPlanOpen] = useState(false);
  const [renewSheetOpen, setRenewSheetOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 1024;
  const tabNavigation = useNavigation<TabNavigation>();
  const navigation = tabNavigation.getParent<RootNavigation>();
  const isTeacher = user?.role === 'teacher';
  const [selectedCourse, setSelectedCourse] = useState('');
  const [practice, setPractice] = useState<Awaited<ReturnType<typeof dailyPracticeApi.overview>> | null>(null);
  const [pathData, setPathData] = useState<Awaited<ReturnType<typeof dailyPracticeApi.path>> | null>(null);
  const [meetClasses, setMeetClasses] = useState<MeetClassRow[]>([]);
  const [savedPathTopicId, setSavedPathTopicId] = useState('');
  const [lastStudy, setLastStudy] = useState<LastStudySession | null>(null);
  const [goalData, setGoalData] = useState<LearningGoalData | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const reloadStudentHomeData = useCallback(() => {
    if (isTeacher || !user || user.previewMode) return;
    const userKey = String(user.id || user._id || '').trim();
    void readLastStudySession(userKey).then(setLastStudy);
    getLearningGoal().then(setGoalData).catch(() => { });
    dailyPracticeApi.overview().then(setPractice).catch(() => { });
    dailyPracticeApi.path()
      .then((data) => {
        setPathData(data);
        const serverId = String(data.activeTopicId || '').trim();
        void syncLastPathTopicFromServer(serverId, userKey);
        void resolveSavedPathTopicId(userKey, serverId).then(setSavedPathTopicId);
      })
      .catch(() => { });
    mobileApiRequest<{ data?: MeetClassRow[] }>('/meet-classes/mine')
      .then((res) => setMeetClasses(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setMeetClasses([]));
  }, [isTeacher, user]);

  const didInitialStudentFocusRef = useRef(false);
  const lastStudentReloadAtRef = useRef(Date.now());
  useFocusEffect(useCallback(() => {
    if (!didInitialStudentFocusRef.current) {
      didInitialStudentFocusRef.current = true;
      lastStudentReloadAtRef.current = Date.now();
      reloadStudentHomeData();
      return;
    }
    if (Date.now() - lastStudentReloadAtRef.current < 10_000) return;
    lastStudentReloadAtRef.current = Date.now();
    reloadStudentHomeData();
  }, [reloadStudentHomeData]));

  useEffect(() => {
    if (isTeacher || !user || user.previewMode) return undefined;
    const onUnlockOrSubChanged = () => {
      reloadStudentHomeData();
      void refreshSubscription();
    };
    const subs = [
      DeviceEventEmitter.addListener('mobile:free-portal-unlocked', onUnlockOrSubChanged),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.FREE_PORTAL_UNLOCKED, onUnlockOrSubChanged),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.FREE_PORTAL_LOCKED, onUnlockOrSubChanged),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SUBSCRIPTION_UPDATED, onUnlockOrSubChanged),
    ];
    return () => {
      subs.forEach((s) => s.remove());
    };
  }, [isTeacher, refreshSubscription, reloadStudentHomeData, user]);
  useEffect(() => {
    if (isTeacher || !user || user.previewMode) return undefined;
    const userKey = String(user.id || user._id || '').trim();
    const sub = DeviceEventEmitter.addListener(DAILY_PRACTICE_STATS_EVENT, (detail?: { stats?: Partial<DpStats>; xpTotal?: number | null }) => {
      if (!detail) return;
      setPractice((prev) => {
        if (!prev) return prev;
        if (detail.stats) return { ...prev, stats: { ...prev.stats, ...detail.stats } };
        if (typeof detail.xpTotal === 'number') return { ...prev, stats: { ...prev.stats, xpTotal: detail.xpTotal } };
        return prev;
      });
    });
    const resumeSub = DeviceEventEmitter.addListener(LAST_STUDY_UPDATED_EVENT, (sessionData?: LastStudySession) => {
      if (!sessionData) return;
      if (userKey && sessionData.studentId && sessionData.studentId !== userKey) return;
      setLastStudy(sessionData);
    });
    const goalChangedSub = DeviceEventEmitter.addListener(LEARNING_GOAL_CHANGED_EVENT, (next?: LearningGoalData | null) => {
      if (next && typeof next === 'object' && 'progress' in next) setGoalData(next);
      else getLearningGoal().then(setGoalData).catch(() => { });
      dailyPracticeApi.overview().then(setPractice).catch(() => { });
      dailyPracticeApi.path().then(setPathData).catch(() => { });
    });
    const minuteSub = DeviceEventEmitter.addListener(STUDY_MINUTE_EVENT, (result: { todayMinutes?: number }) => {
      const todayMinutes = Number(result?.todayMinutes);
      if (!Number.isFinite(todayMinutes)) return;
      setGoalData((prev) => {
        if (!prev) return prev;
        const delta = Math.max(0, todayMinutes - (prev.progress.todayMinutes || 0));
        return {
          ...prev,
          progress: { ...prev.progress, todayMinutes, periodMinutes: (prev.progress.periodMinutes || 0) + delta },
        };
      });
    });
    return () => {
      sub.remove();
      resumeSub.remove();
      goalChangedSub.remove();
      minuteSub.remove();
    };
  }, [isTeacher, user]);
  const schedulesLoader = useCallback(() => (
    isTeacher
      ? scheduleService.list('teacher')
      : isFreePortalMenu(user)
        ? Promise.resolve([])
        : scheduleService.list('student')
  ), [isTeacher, user]);
  const assignmentsLoader = useCallback(() => (
    isTeacher
      ? assignmentService.list('teacher', user)
      : isFreePortalLocked(user)
        ? Promise.resolve([])
        : assignmentService.list('student', user)
  ), [isTeacher, user]);
  const studentsLoader = useCallback(() => studentService.assigned(user), [user]);
  const teacherMetricsLoader = useCallback(() => isTeacher && user
    ? getTeacherDashboardMetrics(user)
    : Promise.resolve(null), [isTeacher, user]);
  const profileLoader = useCallback(() => !isTeacher && user
    ? studentProfileService.get(user)
    : Promise.resolve(null), [isTeacher, user]);
  const quizzesLoader = useCallback(() => (
    !isTeacher && user && !isFreePortalLocked(user)
      ? quizService.studentList(user)
      : Promise.resolve([])
  ), [isTeacher, user]);
  const evaluationActivityLoader = useCallback(() => (
    isTeacher || !user || isFreePortalMenu(user)
      ? Promise.resolve([])
      : evaluationService.activity(user)
  ), [isTeacher, user]);
  const schedules = useMockResource(schedulesLoader);
  const assignments = useMockResource(assignmentsLoader);
  const students = useMockResource(studentsLoader);
  const teacherMetrics = useMockResource(teacherMetricsLoader);
  const profile = useMockResource(profileLoader);
  const quizzes = useMockResource(quizzesLoader);
  const evaluationActivity = useMockResource(evaluationActivityLoader);
  const didInitialResourceFocusRef = useRef(false);
  const lastResourceFocusAtRef = useRef(Date.now());
  useFocusEffect(useCallback(() => {
    if (!didInitialResourceFocusRef.current) {
      didInitialResourceFocusRef.current = true;
      lastResourceFocusAtRef.current = Date.now();
      return;
    }
    if (Date.now() - lastResourceFocusAtRef.current < 10_000) return;
    lastResourceFocusAtRef.current = Date.now();
    schedules.silentReload();
    assignments.silentReload();
    students.silentReload();
    teacherMetrics.silentReload();
    profile.silentReload();
    quizzes.silentReload();
    evaluationActivity.silentReload();
  }, [
    assignments.silentReload, evaluationActivity.silentReload, profile.silentReload, quizzes.silentReload, schedules.silentReload, students.silentReload, teacherMetrics.silentReload,
  ]));
  useEffect(() => {
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_NEW, schedules.silentReload),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_UPDATED, schedules.silentReload),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_CANCELLED, schedules.silentReload),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [schedules.silentReload]);

  const studentEnrollments = profile.data?.enrollments || user?.enrollments || [];
  const freeMenu = isFreePortalMenu(user, studentEnrollments);
  const isBrandStudent = Boolean(user && user.role === 'student' && !freeMenu);
  const activeEnrollments = studentEnrollments.filter((enrollment) => enrollment.status === 'Đang học');
  const courseOptions = useMemo(() => [...studentEnrollments].sort((a, b) => {
    const aCompleted = a.status === 'Hoàn thành'
      || ((a.totalSessions ?? 0) > 0 && (a.completedSessions || 0) >= (a.totalSessions ?? 0));
    const bCompleted = b.status === 'Hoàn thành'
      || ((b.totalSessions ?? 0) > 0 && (b.completedSessions || 0) >= (b.totalSessions ?? 0));
    return Number(aCompleted) - Number(bCompleted);
  }), [studentEnrollments]);
  const currentEnrollment = courseOptions.find((enrollment) => enrollment.courseName === selectedCourse)
    || activeEnrollments[0]
    || courseOptions[0];
  const currentCourse = currentEnrollment?.courseName || user?.course || '';
  const freePortalCourse = currentCourse.trim().toLocaleLowerCase('vi') === 'tài khoản miễn phí' || freeMenu;

  const coursePickerItems = useMemo<CoursePickerItem[]>(() => courseOptions.map((enrollment) => {
    const total = enrollment.totalSessions ?? 12;
    const done = enrollment.completedSessions ?? 0;
    return {
      key: enrollment.id,
      name: enrollment.courseName,
      teacherName: enrollment.teacherName,
      done,
      total,
      pct: Math.min(100, Math.max(0, enrollment.progress ?? (total > 0 ? Math.round(done / total * 100) : 0))),
      completed: enrollment.status === 'Hoàn thành' || (total > 0 && done >= total),
    };
  }), [courseOptions]);
  const scheduleMatchesCourse = useCallback((item: { courseName?: string; subject?: string; title: string }) => {
    if (isTeacher || !currentCourse) return true;
    const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi');
    const itemCourse = item.courseName || item.subject || item.title;
    return normalize(itemCourse) === normalize(currentCourse);
  }, [currentCourse, isTeacher]);
  const studentSchedules = useMemo(
    () => (schedules.data || []).filter(scheduleMatchesCourse),
    [scheduleMatchesCourse, schedules.data],
  );
  const studentAssignments = useMemo(() => {
    if (isTeacher || !currentCourse) return assignments.data || [];
    const activeCourse = normalizeDashboardCourse(currentCourse);
    return (assignments.data || []).filter((item) => {
      const course = normalizeDashboardCourse(item.courseName || '');
      return !course || course === activeCourse;
    });
  }, [assignments.data, currentCourse, isTeacher]);
  const firstSchedule = useMemo(() => {
    const today = new Date();
    const now = today.getTime();
    const upcoming = (isTeacher ? schedules.data || [] : studentSchedules)
      .filter((item) => item.status === 'upcoming' && item.date)
      .filter(scheduleIsCurrentOrFuture)
      .sort((a, b) => `${a.date} ${a.startTime || ''}`.localeCompare(`${b.date} ${b.startTime || ''}`));
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return upcoming.find((item) => {
      if (item.date !== todayKey) return false;
      const start = item.startTime || item.time.match(/\d{1,2}:\d{2}/)?.[0];
      const end = item.endTime || item.time.match(/\d{1,2}:\d{2}/g)?.[1];
      if (!start || !end) return false;
      const startAt = new Date(`${item.date}T${start}:00+07:00`).getTime();
      const endAt = new Date(`${item.date}T${end}:00+07:00`).getTime();
      return Number.isFinite(startAt) && Number.isFinite(endAt) && now >= startAt && now <= endAt;
    }) || upcoming[0];
  }, [isTeacher, schedules.data, studentSchedules]);
  const firstScheduleIsLive = scheduleIsLive(firstSchedule);
  const meetCards = useMemo(() => sortMeetClasses(meetClasses), [meetClasses, nowTick]);
  const liveMeet = useMemo(() => meetCards.find((m) => m.live) || null, [meetCards]);
  const nextMeetForEmpty = useMemo(() => {
    const { day: todayKey } = vnScheduleClock();
    return [...meetClasses]
      .filter((m) => m.status !== 'cancelled' && m.day && m.day >= todayKey)
      .sort((a, b) => `${a.day || ''} ${a.startTime || ''}`.localeCompare(`${b.day || ''} ${b.startTime || ''}`))[0] || null;
  }, [meetClasses, nowTick]);
  const nextMeet = meetCards[0] || null;
  const studentHeroChips = useMemo<WelcomeChip[]>(() => {
    if (firstScheduleIsLive && firstSchedule) {
      return [{ live: true, label: `Đang diễn ra · ${firstSchedule.time} · ${firstSchedule.courseName || currentCourse || 'Buổi học'}` }];
    }
    if (liveMeet) {
      return [{ live: true, label: `Đang diễn ra · Meet ${meetLessonName(liveMeet)} ${liveMeet.startTime || ''}–${liveMeet.endTime || ''}` }];
    }
    const chips: WelcomeChip[] = [];
    if (firstSchedule) {
      chips.push({ icon: Calendar, label: `Buổi tới: ${firstSchedule.time} · ${firstSchedule.dateLabel}` });
    }
    if (nextMeet) {
      chips.push({ icon: Video, label: `Meet · ${meetLessonName(nextMeet)} · ${nextMeet.startTime || ''}–${nextMeet.endTime || ''} · ${nextMeet.dayLabel}` });
    }
    return chips;
  }, [currentCourse, firstSchedule, firstScheduleIsLive, liveMeet, nextMeet]);

  // ── Lịch học hôm nay trên mobile ──────────────────────────────────────────
  const todayMobileClasses = useMemo(() => {
    void nowTick;
    const { day: todayKey, minutes: nowMinutes } = vnScheduleClock();
    const list: Array<{
      id: string;
      title: string;
      time: string;
      dateLabel: string;
      meetLink: string;
      live: boolean;
      joinable?: boolean;
      ended?: boolean;
      waitLabel?: string;
      teacher?: string;
    }> = [];

    (studentSchedules || [])
      .filter((item) => item.date === todayKey && item.status !== 'cancelled')
      .forEach((item) => {
        const ended = isMeetEnded({
          day: item.date,
          endTime: item.endTime,
          nowDay: todayKey,
          nowMinutes,
        });
        const live = scheduleIsLive(item) && !ended;
        const enrollmentLinks = Array.isArray(profile.data?.enrollments)
          ? profile.data.enrollments
          : [];
        const matchedEnrollment = enrollmentLinks.find((e) => (
          e.linkHoc
          && (
            (e.teacherId && item.teacherId && e.teacherId === item.teacherId)
            || (item.courseName && String(e.courseName || '').trim().toLowerCase() === String(item.courseName || '').trim().toLowerCase())
          )
        )) || enrollmentLinks.find((e) => e.linkHoc);
        const rawMeetLink = item.meetingUrl
          || (item as { linkHoc?: string }).linkHoc
          || matchedEnrollment?.linkHoc
          || (typeof profile.data?.student?.linkHoc === 'string' ? profile.data.student.linkHoc : '')
          || (typeof profile.data?.student?.joinClassUrl === 'string' ? profile.data.student.joinClassUrl : '')
          || (typeof profile.data?.student?.online_meeting_url === 'string' ? profile.data.student.online_meeting_url : '')
          || (typeof (user as { linkHoc?: string } | null)?.linkHoc === 'string' ? (user as { linkHoc?: string }).linkHoc : '');
        const trimmedLink = String(rawMeetLink || '').trim();
        const normalizedLink = trimmedLink && !/^https?:\/\//i.test(trimmedLink)
          ? `https://${trimmedLink}`
          : trimmedLink;
        list.push({
          id: String(item.id || `1on1-${item.date}-${item.time}`),
          title: item.title || item.subject || item.courseName || currentCourse || 'Buổi học 1 kèm 1',
          time: item.time || `${item.startTime || ''} - ${item.endTime || ''}`,
          dateLabel: shortDayLabel(item.date) || 'Hôm nay',
          meetLink: normalizedLink,
          live,
          joinable: live,
          ended,
          waitLabel: item.startTime ? `Vào lúc ${item.startTime}` : 'Chưa đến giờ vào lớp',
          teacher: item.teacherName || item.person || '',
        });
      });

    (meetClasses || [])
      .filter((m) => m.status !== 'cancelled' && m.day === todayKey)
      .forEach((m) => {
        const ended = isMeetEnded({
          day: m.day,
          endTime: m.endTime,
          nowDay: todayKey,
          nowMinutes,
        });
        const live = isMeetLiveNow({
          day: m.day,
          startTime: m.startTime,
          endTime: m.endTime,
          nowDay: todayKey,
          nowMinutes,
        }) && !ended;
        const joinable = live;
        const rawLink = String(m.linkHoc || '').trim();
        const normalizedMeetLink = rawLink && !/^https?:\/\//i.test(rawLink) ? `https://${rawLink}` : rawLink;
        list.push({
          id: String(m._id || m.id || `meet-${m.day}-${m.startTime}`),
          title: meetLessonName(m),
          time: m.startTime && m.endTime ? `${m.startTime} – ${m.endTime}` : (m.slotLabel || 'Trong ngày'),
          dateLabel: shortDayLabel(m.day),
          meetLink: normalizedMeetLink,
          live,
          joinable,
          ended,
          waitLabel: m.startTime ? `Vào lúc ${m.startTime}` : 'Chưa đến giờ vào lớp',
          teacher: '',
        });
      });

    return list.sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0));
  }, [studentSchedules, meetClasses, currentCourse, profile.data, user, nowTick]);
  const nextLesson = useMemo(() => {
    const { day: todayKey } = vnScheduleClock();
    const rows: Array<{ sort: string; name: string; meta: string }> = [];
    meetClasses.forEach((item) => {
      if (!item.day || item.day <= todayKey || item.status === 'cancelled') return;
      rows.push({
        sort: `${item.day} ${item.startTime || ''}`,
        name: meetLessonName(item),
        meta: `${item.startTime || ''}–${item.endTime || ''} (${upcomingDayLabel(item.day)})`,
      });
    });
    studentSchedules.forEach((item) => {
      if (!item.date || item.date <= todayKey || item.status === 'cancelled') return;
      rows.push({
        sort: `${item.date} ${item.startTime || ''}`,
        name: item.title || item.subject || item.courseName || 'Buổi học',
        meta: `${item.time || `${item.startTime || ''}–${item.endTime || ''}`} (${upcomingDayLabel(item.date)})`,
      });
    });
    rows.sort((a, b) => a.sort.localeCompare(b.sort));
    return rows;
  }, [meetClasses, studentSchedules, nowTick]);
  const assignmentsToGrade = assignments.data?.filter((item) => item.status === 'Cần chấm') || [];
  const pendingAssignments = studentAssignments.filter((item) => item.mySubmission
    ? false
    : item.status === 'Chưa làm' || item.status === 'Quá hạn');
  const gradeEntries = buildStudentDashboardActivity(
    profile.data?.student,
    studentAssignments,
    quizzes.data || [],
    evaluationActivity.data || [],
    currentCourse,
  );
  const completedSessions = currentEnrollment?.completedSessions ?? user?.completedSessions;
  const totalSessions = currentEnrollment?.totalSessions ?? user?.totalSessions;
  const sessionCountsAvailable = completedSessions != null && totalSessions != null && totalSessions > 0;
  const studentProgress = currentEnrollment?.progress != null
    ? Math.min(100, Math.max(0, Math.round(currentEnrollment.progress)))
    : completedSessions != null && totalSessions != null && totalSessions > 0
      ? Math.round((completedSessions / totalSessions) * 100)
      : null;
  const todayDate = new Date();
  const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  const teacherTodaySchedules = (schedules.data || [])
    .filter((item) => item.date === todayKey && scheduleIsCurrentOrFuture(item))
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const nowMs = Date.now();
  const sessionStartMs = (item: { date?: string; startTime?: string; time: string }) => {
    const start = item.startTime || item.time.match(/\d{1,2}:\d{2}/)?.[0];
    return start && item.date ? new Date(`${item.date}T${start}:00+07:00`).getTime() : Number.NaN;
  };
  const teacherTodayAll = (schedules.data || [])
    .filter((item) => item.date === todayKey && item.status !== 'cancelled')
    .sort((a, b) => (a.startTime || a.time).localeCompare(b.startTime || b.time));
  const teacherUnmarked = teacherTodayAll.filter((item) => item.status === 'upcoming'
    && !item.attendanceConfirmPending
    && Number.isFinite(sessionStartMs(item))
    && sessionStartMs(item) <= nowMs);
  const teacherSessionState = (item: (typeof teacherTodayAll)[number]) => {
    if (item.status === 'completed') return { label: 'Đã dạy', color: '#047857', background: '#ECFDF5', live: false };
    if (scheduleIsLive(item)) return { label: 'Đang dạy', color: '#FFFFFF', background: 'rgba(255,255,255,0.22)', live: true };
    if (item.attendanceConfirmPending) return { label: 'Chờ HV xác nhận', color: '#B45309', background: '#FFFBEB', live: false };
    if (Number.isFinite(sessionStartMs(item)) && sessionStartMs(item) <= nowMs) return { label: 'Chưa điểm danh', color: '#059669', background: '#ECFDF5', live: false };
    return { label: 'Sắp tới', color: '#2563EB', background: '#EFF6FF', live: false };
  };
  const taughtThisMonth = (schedules.data || [])
    .filter((item) => item.status === 'completed' && item.date?.slice(0, 7) === todayKey.slice(0, 7)).length;

  const teacherTasks: OverviewTask[] = [];
  if (teacherUnmarked.length) {
    const first = teacherUnmarked[0];
    teacherTasks.push({
      key: 'attendance',
      icon: ClipboardCheck,
      tone: '#059669',
      title: `Ca chưa điểm danh (${teacherUnmarked.length})`,
      sub: `${first.studentName || first.person || 'Học viên'} · ${first.startTime || first.time}`,
      cta: 'Điểm danh',
      onPress: () => navigation?.navigate('Attendance', { scheduleId: first.id }),
    });
  }
  if (assignmentsToGrade.length) {
    teacherTasks.push({
      key: 'grading',
      icon: FileText,
      tone: '#D97706',
      title: `Bài chờ chấm (${assignmentsToGrade.length})`,
      sub: `Mới nhất: ${assignmentsToGrade[0].subject || assignmentsToGrade[0].title}`,
      cta: 'Chấm bài',
      onPress: () => navigation?.navigate('Assignments'),
    });
  }

  const deadlineOf = (value?: string) => {
    const t = value ? Date.parse(value) : Number.NaN;
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
  };
  const nextHomework = [...pendingAssignments].sort((a, b) => deadlineOf(a.deadlineDate) - deadlineOf(b.deadlineDate))[0];
  const pendingQuizzes = (quizzes.data || [])
    .filter((quiz) => !quiz.mySubmission && (!quiz.deadline || deadlineOf(quiz.deadline) > nowMs))
    .sort((a, b) => deadlineOf(a.deadline) - deadlineOf(b.deadline));
  const practiceStats = practice?.stats;
  const [offlineVideosCount, setOfflineVideosCount] = useState(0);
  useFocusEffect(useCallback(() => {
    let alive = true;
    void listOfflineVideos().then((items) => {
      if (alive) setOfflineVideosCount(items.length);
    }).catch(() => { });
    return () => { alive = false; };
  }, []));
  const studentTasks: OverviewTask[] = [];
  if (nextHomework) {
    studentTasks.push({
      key: 'homework',
      icon: ClipboardList,
      tone: '#EA580C',
      title: `Bài tập cần nộp (${pendingAssignments.length})`,
      sub: `${nextHomework.title}${nextHomework.deadline ? ` · hạn ${nextHomework.deadline}` : ''}`,
      cta: 'Nộp bài',
      onPress: () => navigation?.navigate('Assignments', { assignmentId: nextHomework.id }),
    });
  }
  if (pendingQuizzes.length) {
    studentTasks.push({
      key: 'quiz',
      icon: Trophy,
      tone: '#059669',
      title: `Trắc nghiệm chưa làm (${pendingQuizzes.length})`,
      sub: pendingQuizzes[0].title,
      cta: 'Làm bài',
      onPress: () => navigation?.navigate('StudentExam', { quizId: pendingQuizzes[0].id }),
    });
  }
  if (practiceStats && !practiceStats.playedToday && practice?.topics.length) {
    const atRisk = practiceStats.streakState === 'at_risk' && practiceStats.streak > 0;
    const lost = practiceStats.streakState === 'lost';
    studentTasks.push({
      key: 'practice',
      icon: lost ? Gamepad2 : Flame,
      tone: lost ? '#64748B' : (isBrandStudent ? '#059669' : '#10B981'),
      title: isBrandStudent
        ? (atRisk ? `Giữ chuỗi ${practiceStats.streak} ngày` : lost ? 'Lấy lại chuỗi luyện tập' : 'Luyện tập hằng ngày')
        : (atRisk ? `Duy trì chuỗi ${practiceStats.streak} ngày` : lost ? 'Luyện tập để lấy lại chuỗi' : 'Luyện tập hằng ngày'),
      sub: isBrandStudent
        ? (atRisk ? 'Chuỗi về 0 lúc nửa đêm nếu chưa luyện' : '10 câu · khoảng 5 phút')
        : (atRisk ? 'Luyện tập hôm nay để giữ vững chuỗi học' : 'Khoảng 5 phút mỗi ngày để củng cố kiến thức'),
      cta: isBrandStudent ? 'Làm ngay' : (freeMenu ? 'Luyện ngay' : 'Làm ngay'),
      onPress: () => navigation?.navigate('DailyPractice'),
    });
  }

  const practiceLocked = isFreePortalLocked(user);
  const pathTopic = useMemo(
    () => pickActivePathTopic(pathData, '', savedPathTopicId),
    [pathData, savedPathTopicId],
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
  const effectiveLastStudy = useMemo<LastStudySession | null>(() => {
    if (lastStudy) return lastStudy;
    if (!practiceLocked && (pathTopic || activePathUnit)) {
      const topicName = pathTopic?.topic?.name || 'Lộ trình DewSkill';
      const lessonTitle = pathTopic?.next?.unitTitle || activePathUnit?.title || topicName;
      const stepLabel = pathTopic?.next?.stepLabel
        ? `${pathTopicNextLinePrefix(pathTopic)} · ${pathTopic.next.stepLabel}`
        : `Chặng ${activePathUnit?.index || 1}`;
      return {
        kind: 'daily_practice',
        studentId: String(user?.id || user?._id || ''),
        topicId: String(pathTopic?.topic?.id || ''),
        nodeKey: String(pathTopic?.next?.nodeKey || activePathUnit?.pathNodes?.[0]?.key || 'study'),
        courseId: '',
        courseTitle: topicName,
        subjectId: '',
        subjectName: '',
        lessonId: '',
        lessonTitle,
        unitId: String(activePathUnit?.id || ''),
        unitTitle: activePathUnit?.title || '',
        sectionId: '',
        sectionLabel: stepLabel,
        atSec: 0,
        durationSec: 0,
        progressPct: heroProgress,
        href: '/student/daily-practice',
        updatedAt: 0,
      };
    }
    return null;
  }, [lastStudy, practiceLocked, pathTopic, activePathUnit, heroProgress, user?._id, user?.id]);
  const resumeKindLabel = effectiveLastStudy?.kind === 'lesson_practice'
    ? 'Bài giảng thực hành'
    : effectiveLastStudy?.kind === 'daily_practice'
      ? 'Lộ trình DewSkill'
      : 'Video khóa học';
  const scheduleAccent = isBrandStudent ? '#059669' : '#059669';
  const portalSub = subscription?.subscription;
  const meetAccess = hasMeetAccessClient(portalSub);
  const needsUnlockMeetCta = freeMenu && !meetAccess && user?.freeUnlocked !== true;
  const meetEmptyMode: 'default' | 'purchase' | 'renew' = freeMenu
    ? (portalSub?.state === 'expired'
      ? 'renew'
      : !meetAccess
        ? 'purchase'
        : 'default')
    : 'default';

  const widgetPrimaryClass = todayMobileClasses[0];
  const widgetNextTime = widgetPrimaryClass
    ? widgetPrimaryClass.time
    : firstSchedule
      ? (firstSchedule.startTime && firstSchedule.endTime
        ? `${firstSchedule.startTime} - ${firstSchedule.endTime}`
        : firstSchedule.startTime || firstSchedule.time || '')
      : (nextMeetForEmpty?.startTime || '');
  const widgetNextLabel = widgetPrimaryClass
    ? widgetPrimaryClass.title
    : firstSchedule
      ? (firstSchedule.title || firstSchedule.courseName || firstSchedule.subject || 'Buổi học')
      : (nextMeetForEmpty ? meetLessonName(nextMeetForEmpty) : 'Không có lịch học hôm nay');
  const widgetNextLive = Boolean(widgetPrimaryClass?.live || (firstSchedule && scheduleIsLive(firstSchedule)));

  useEffect(() => {
    if (isTeacher || !user) return;
    void saveHomeWidgetSnapshot({
      userId: String(user.id || user._id || ''),
      studentName: user.name || 'Học viên',
      streak: Number(practiceStats?.streak || 0),
      playedToday: Boolean(practiceStats?.playedToday),
      todayXp: Number(practiceStats?.todayXp || 0),
      xp: Number(practiceStats?.xpTotal || 0),
      todayClassesCount: todayMobileClasses.length,
      nextClassLabel: widgetNextLabel,
      nextClassTime: widgetNextTime,
      nextClassLive: widgetNextLive,
      offlineVideosCount,
    });
  }, [
    isTeacher,
    offlineVideosCount,
    practiceStats?.playedToday,
    practiceStats?.streak,
    practiceStats?.todayXp,
    practiceStats?.xpTotal,
    todayMobileClasses.length,
    user,
    widgetNextLabel,
    widgetNextLive,
    widgetNextTime,
  ]);

  const goalObj = goalData?.goal || null;
  const goalProgress = goalData?.progress;
  const todayMinutes = goalProgress?.todayMinutes ?? practiceStats?.todayMinutes ?? 0;
  const dailyTargetMinutes = goalProgress?.dailyTargetMinutes || (goalObj ? goalObj.hoursPerDay * 60 : 60);
  const todayGoalPct = Math.min(100, Math.round((todayMinutes / Math.max(1, dailyTargetMinutes)) * 100));
  const todayGoalDone = Boolean(goalObj) && todayGoalPct >= 100;
  const vnHeroClock = getVnHeroClock();
  const primaryTodayClass = todayMobileClasses[0] || null;
  const primaryTask = studentTasks[0] || null;
  const remainingTasks = studentTasks.slice(1);
  const priorityCount = (primaryTodayClass ? 1 : 0) + studentTasks.length;

  return (
    <AppScreen
      contentStyle={isTeacher ? styles.screen : styles.studentScreen}
    >
      {isTeacher ? (
        <WelcomeHero
          role="teacher"
          name={user?.name || ''}
          chips={firstScheduleIsLive && firstSchedule
            ? [{ live: true, label: `Đang dạy: ${[firstSchedule.studentName || firstSchedule.person, firstSchedule.courseName || firstSchedule.title].filter(Boolean).join(' · ')}` }]
            : firstSchedule
              ? [{ icon: Calendar, label: `Ca tới: ${firstSchedule.startTime || firstSchedule.time} · ${firstSchedule.studentName || firstSchedule.person || 'Học viên'} · ${firstSchedule.dateLabel}` }]
              : [{ icon: Calendar, label: 'Chưa có ca dạy sắp tới' }]}
          joinUrl={firstScheduleIsLive ? firstSchedule?.meetingUrl || '' : ''}
          joinHint={firstScheduleIsLive ? 'Chưa có link dạy' : teacherTodaySchedules.length ? 'Chưa đến giờ dạy' : 'Chưa có lịch dạy'}
          onJoin={(url) => { void openDashboardLink(url); }}
          accent="emerald"
        />
      ) : (
        <View style={styles.bHeroCard}>
          <View style={styles.bHeroTopRow}>
            <View style={styles.bHeroIdentityCol}>
              <Text style={styles.bHeroGreeting}>{`${vnHeroClock.greeting} · ${vnHeroClock.dateText}`}</Text>
              <Text style={styles.bHeroName} numberOfLines={1}>{user?.name || 'Học viên'}</Text>
            </View>
            <View style={styles.bHeroChipsRow}>
              <View style={styles.bStreakBadge}>
                <Flame size={13} color="#D97706" fill="#F59E0B" />
                <Text style={styles.bStreakBadgeText}>{`${practiceStats?.streak ?? 0} ngày`}</Text>
              </View>
              <View style={styles.bXpBadge}>
                <Zap size={13} color="#FDE047" fill="#FDE047" />
                <Text style={styles.bXpBadgeText}>{`${(practiceStats?.xpTotal ?? 0).toLocaleString('vi-VN')} XP`}</Text>
              </View>
            </View>
          </View>

          <View style={styles.bGoalPanel}>
            <View style={styles.bGoalHeaderRow}>
              <View style={styles.bGoalLabelGroup}>
                <Target size={14} color="#FDE68A" />
                <Text style={styles.bGoalLabelText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {goalObj
                    ? `Mục tiêu: ${formatStudyMinutes(todayMinutes)} / ${goalObj.hoursPerDay} giờ`
                    : `Mục tiêu ngày · ${formatStudyMinutes(todayMinutes)}`}
                </Text>
              </View>
              <Pressable
                onPress={() => DeviceEventEmitter.emit(OPEN_LEARNING_GOAL_EVENT)}
                style={({ pressed }) => [styles.bGoalEditBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={goalObj && !goalObj.expired ? 'Đổi mục tiêu học' : 'Đặt mục tiêu học'}
              >
                <Text style={styles.bGoalEditText}>{goalObj && !goalObj.expired ? 'Đổi mục tiêu' : 'Đặt mục tiêu'}</Text>
              </Pressable>
            </View>

            <View style={styles.bGoalTrack}>
              <View
                style={[
                  styles.bGoalFill,
                  {
                    width: `${Math.max(todayGoalPct, todayMinutes > 0 ? 6 : 0)}%`,
                    backgroundColor: todayGoalDone ? '#34D399' : '#FBBF24',
                  },
                ]}
              />
            </View>

            <View style={styles.bGoalFootRow}>
              <Text style={styles.bGoalFootText} numberOfLines={1}>
                {goalObj
                  ? (goalObj.expired
                    ? `Đạt ${todayGoalPct}% · Chu kỳ đã kết thúc`
                    : `${todayGoalPct}% · ${periodLabel(goalObj.period)} · Còn ${goalProgress?.daysLeft ?? 0} ngày`)
                  : 'Đặt mục tiêu giờ học để duy trì tiến độ'}
              </Text>
              {studentHeroChips[0]?.label ? (
                <View style={[styles.bNextSessionPill, studentHeroChips[0].live && styles.bNextSessionPillLive]}>
                  {studentHeroChips[0].live ? <View style={styles.bLiveDot} /> : null}
                  <Text style={styles.bNextSessionText} numberOfLines={1}>{studentHeroChips[0].label}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      )}

      {schedules.loading || assignments.loading || students.loading || (isTeacher && teacherMetrics.loading) || (!isTeacher && (profile.loading || quizzes.loading || evaluationActivity.loading))
        ? <LoadingSkeleton rows={1} />
        : null}
      {schedules.error || assignments.error || students.error || (isTeacher && teacherMetrics.error) || (!isTeacher && (profile.error || quizzes.error || evaluationActivity.error)) ? (
        <ErrorState onRetry={() => {
          schedules.reload();
          assignments.reload();
          students.reload();
          teacherMetrics.reload();
          profile.reload();
          quizzes.reload();
          evaluationActivity.reload();
        }} />
      ) : null}
      {isTeacher ? (
        <>
          <Card style={styles.ovCard}>
            <View style={styles.ovHeadRow}>
              <Zap size={18} color="#F59E0B" fill="#FCD34D" />
              <Text style={styles.ovTitle}>Cần xử lý</Text>
            </View>
            {teacherTasks.length
              ? teacherTasks.map(({ key, ...task }) => <OverviewTaskRow key={key} {...task} freeMenu={false} />)
              : <OverviewDoneBox title="Không còn việc tồn đọng" text="Các ca đã điểm danh và không có bài chờ chấm." />}
          </Card>

          <Card style={styles.ovCard}>
            <View style={styles.ovHeadRow}>
              <Clock size={18} color={colors.brand} />
              <Text style={[styles.ovTitle, styles.flex]}>Lịch dạy hôm nay</Text>
              <Pressable onPress={() => tabNavigation.navigate('Schedule')} accessibilityRole="button">
                <Text style={styles.ovLink}>Cả tháng</Text>
              </Pressable>
            </View>
            {teacherTodayAll.length ? teacherTodayAll.map((item) => {
              const state = teacherSessionState(item);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => navigation?.navigate('Attendance', { scheduleId: item.id })}
                  style={[styles.ovSessionRow, state.live && styles.ovSessionLive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.ovSessionTime, state.live && styles.ovSessionLiveText]}>{item.startTime || item.time}</Text>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={[styles.cardTitle, state.live && styles.ovSessionLiveText]}>{item.studentName || item.person || 'Học viên'}</Text>
                    <Text numberOfLines={1} style={[styles.muted, state.live && styles.ovSessionLiveText]}>{item.courseName || item.subject}</Text>
                  </View>
                  <Text style={[styles.ovSessionBadge, { color: state.color, backgroundColor: state.background }]}>{state.label}</Text>
                </Pressable>
              );
            }) : <Text style={styles.muted}>Hôm nay không có ca dạy.</Text>}
          </Card>

          <View style={styles.sectionWrap}>
            <SectionHeading title="Tháng này" />
            <View style={styles.ovStatRow}>
              {[
                { label: `Thu nhập T${todayDate.getMonth() + 1}`, value: teacherMetrics.data ? formatCurrency(teacherMetrics.data.monthlyIncome) : '-', icon: WalletCards, tint: colors.blue, soft: '#EFF6FF', onPress: () => navigation?.navigate('TeacherFinance') },
                { label: 'Buổi đã dạy', value: schedules.data ? String(taughtThisMonth) : '-', icon: CalendarDays, tint: '#4F46E5', soft: '#EEF2FF', onPress: () => tabNavigation.navigate('Schedule') },
                { label: 'Thưởng sao', value: teacherMetrics.data ? `${teacherMetrics.data.fiveStarStudentCount}/5 HV` : '-', icon: Award, tint: '#D97706', soft: '#FFFBEB', onPress: undefined },
              ].map(({ label, value, icon: Icon, tint, soft, onPress }) => (
                <Pressable key={label} onPress={onPress} disabled={!onPress} style={styles.ovStat} accessibilityRole={onPress ? 'button' : undefined}>
                  <View style={[styles.ovStatIcon, { backgroundColor: soft }]}><Icon size={22} color={tint} /></View>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={styles.ovStatValue}>{value}</Text>
                    <Text numberOfLines={1} style={styles.ovStatLabel}>{label}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.sectionWrap}>
            <SectionHeading title="Học viên được phân công" action="Xem tất cả" onPress={() => tabNavigation.navigate('Students')} />
            {students.data?.filter((student) => student.enrollmentStatus === 'active').slice(0, 3).map((student) => (
              <Pressable key={student.id} onPress={() => tabNavigation.navigate('Students')} accessibilityRole="button">
                <Card style={styles.teacherStudentCard}>
                  <Avatar name={student.name} color={student.color} avatar={student.avatar} size={42} />
                  <View style={styles.flex}>
                    <View style={styles.taskTop}>
                      <Text numberOfLines={1} style={styles.cardTitle}>{student.name}</Text>
                      <StatusBadge label={student.status} />
                    </View>
                    <Text numberOfLines={1} style={styles.muted}>{student.course} · {student.completedSessions != null && student.totalSessions != null ? `${student.completedSessions}/${student.totalSessions} buổi` : '- buổi'}</Text>
                    {student.progress != null ? <ProgressBar value={student.progress} /> : null}
                  </View>
                </Card>
              </Pressable>
            ))}
            {!students.loading && !students.error && !students.data?.some((student) => student.enrollmentStatus === 'active') ? (
              <Card><Text style={styles.muted}>Chưa được phân công học viên nào.</Text></Card>
            ) : null}
          </View>

          <View style={styles.sectionWrap}>
            <SectionHeading title="Đánh giá mới" />
            {teacherMetrics.data?.recentRatings.length ? teacherMetrics.data.recentRatings.slice(0, 2).map((rating) => (
              <Card key={rating.id || `${rating.studentName}-${rating.createdAt}`} style={styles.ratingCard}>
                <View style={styles.ratingTop}>
                  <Text style={styles.cardTitle}>{rating.studentName}</Text>
                  <Text style={styles.ratingStars}>{'★'.repeat(Math.max(0, Math.min(5, rating.stars)))}</Text>
                </View>
                <Text style={styles.muted}>{rating.comment || 'Chưa có nhận xét.'}</Text>
              </Card>
            )) : (
              <Card><Text style={styles.muted}>Chưa có đánh giá từ học viên.</Text></Card>
            )}
          </View>
        </>
      ) : (
        <View style={styles.duoStudentContainer}>
          <View style={isWide ? styles.duoGridWide : styles.studentGridStack}>
            <View style={isWide ? styles.duoColLeft : styles.studentColStack}>
              {!isTeacher && effectiveLastStudy ? (
                <View style={styles.resumeCard}>
                  <View style={styles.resumeHeaderRow}>
                    <View style={styles.resumeBadgeGroup}>
                      <View style={styles.resumeBadge}>
                        <Zap size={11} color="#FFFFFF" />
                        <Text style={styles.resumeBadgeText}>HỌC TIẾP 1 CHẠM</Text>
                      </View>
                      <Text style={styles.resumeKindText}>{resumeKindLabel}</Text>
                    </View>
                    <Text style={styles.resumeAgoText}>
                      {effectiveLastStudy.updatedAt > 0
                        ? formatResumeTimeAgo(effectiveLastStudy.updatedAt)
                        : 'Lộ trình hiện tại'}
                    </Text>
                  </View>
                  <Text style={styles.resumeTitle} numberOfLines={2}>
                    {effectiveLastStudy.lessonTitle || effectiveLastStudy.unitTitle || effectiveLastStudy.courseTitle || 'Tiếp tục bài học'}
                  </Text>
                  <Text style={styles.resumeMeta} numberOfLines={1}>
                    {[effectiveLastStudy.courseTitle || effectiveLastStudy.subjectName, effectiveLastStudy.sectionLabel]
                      .filter(Boolean)
                      .join(' · ') || 'Quay lại đúng vị trí bạn đang học dở'}
                  </Text>
                  {(effectiveLastStudy.atSec > 0 || effectiveLastStudy.progressPct != null) ? (
                    <View style={styles.resumeTimeRow}>
                      {effectiveLastStudy.atSec > 0 ? (
                        <View style={styles.resumeTimePill}>
                          <Clock size={11} color="#047857" />
                          <Text style={styles.resumeTimeText}>
                            {`Đang xem tại ${formatLmsTimestamp(effectiveLastStudy.atSec)}`}
                          </Text>
                        </View>
                      ) : null}
                      {effectiveLastStudy.progressPct != null ? (
                        <Text style={styles.resumePercentText}>
                          {`${effectiveLastStudy.progressPct}% hoàn thành`}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                  <DuoButton
                    variant="primary"
                    size="md"
                    fullWidth
                    icon={<PlayCircle size={15} color="#FFFFFF" />}
                    rightIcon={<ChevronRight size={14} color="#FFFFFF" />}
                    label="Học tiếp ngay"
                    onPress={() => {
                      if (effectiveLastStudy.kind === 'daily_practice') {
                        const isVideoResume = Boolean(
                          effectiveLastStudy.atSec > 0
                          || effectiveLastStudy.sectionId === 'video'
                          || effectiveLastStudy.href?.includes('watch=stage'),
                        );
                        tabNavigation.navigate('DailyPractice', {
                          topicId: effectiveLastStudy.topicId || pathTopic?.topic?.id || undefined,
                          resumeKey: Date.now(),
                          resumeUnitId: effectiveLastStudy.unitId || pathTopic?.next?.unitId || activePathUnit?.id || undefined,
                          resumeNodeKey: effectiveLastStudy.nodeKey || pathTopic?.next?.nodeKey || undefined,
                          resumeSectionId: effectiveLastStudy.sectionId || undefined,
                          resumeVideoId: isVideoResume ? (effectiveLastStudy.lessonId || undefined) : undefined,
                          resumeAtSec: effectiveLastStudy.atSec || 0,
                          watch: isVideoResume ? 'stage' : undefined,
                        });
                        return;
                      }
                      tabNavigation.navigate('DailyPractice', {
                        resumeKey: Date.now(),
                        resumeCourseId: effectiveLastStudy.courseId,
                        resumeSubjectId: effectiveLastStudy.subjectId,
                        resumeUnitId: effectiveLastStudy.unitId,
                        resumeSectionId: effectiveLastStudy.sectionId,
                        resumeAtSec: effectiveLastStudy.atSec || 0,
                      });
                    }}
                  />
                </View>
              ) : null}
              <View style={styles.bSectionHeader}>
                <Text style={styles.bSectionTitle}>Việc cần làm hôm nay</Text>
                <View style={styles.bSectionPill}>
                  <Text style={styles.bSectionPillText}>
                    {priorityCount > 0 ? `${priorityCount} mục ưu tiên` : 'Đã sẵn sàng'}
                  </Text>
                </View>
              </View>

              <View style={styles.bTwoColRow}>
                {/* Thẻ trái: Lịch học / Google Meet hôm nay */}
                <View style={[styles.bMiniCard, primaryTodayClass?.live && styles.bMiniCardLive]}>
                  <View style={[styles.bMiniTag, primaryTodayClass?.live ? styles.bMiniTagLive : styles.bMiniTagAmber]}>
                    <Clock size={11} color={primaryTodayClass?.live ? '#047857' : '#B45309'} />
                    <Text style={[styles.bMiniTagText, primaryTodayClass?.live ? styles.bMiniTagLiveText : styles.bMiniTagAmberText]} numberOfLines={1}>
                      {primaryTodayClass
                        ? (primaryTodayClass.live ? 'Đang diễn ra' : `Hôm nay ${primaryTodayClass.time}`)
                        : nextMeetForEmpty
                          ? `Sắp tới ${formatMeetDayLabel(nextMeetForEmpty.day)}`
                          : nextLesson[0]
                            ? 'Lịch sắp tới'
                            : 'Lịch học hôm nay'}
                    </Text>
                  </View>
                  <Text style={styles.bMiniTitle} numberOfLines={2}>
                    {primaryTodayClass?.title
                      || (nextMeetForEmpty ? meetLessonName(nextMeetForEmpty) : null)
                      || nextLesson[0]?.name
                      || 'Hôm nay chưa có lịch Meet'}
                  </Text>
                  <Text style={styles.bMiniMeta} numberOfLines={2}>
                    {primaryTodayClass
                      ? (primaryTodayClass.teacher ? `GV: ${primaryTodayClass.teacher}` : primaryTodayClass.waitLabel)
                      : nextMeetForEmpty
                        ? `${nextMeetForEmpty.startTime || ''}–${nextMeetForEmpty.endTime || ''}`
                        : nextLesson[0]
                          ? nextLesson[0].meta
                          : meetAccess
                            ? 'Chưa có lịch Meet hôm nay · Luyện tập & giữ chuỗi XP'
                            : 'Luyện tập & giữ chuỗi XP'}
                  </Text>
                  <View style={styles.bMiniActionWrap}>
                    {primaryTodayClass ? (
                      primaryTodayClass.ended ? (
                        <DuoButton
                          variant="secondary"
                          size="sm"
                          fullWidth
                          disabled
                          label="Đã kết thúc"
                        />
                      ) : primaryTodayClass.meetLink && primaryTodayClass.joinable ? (
                        <DuoButton
                          variant="danger"
                          size="sm"
                          fullWidth
                          label="Vào học"
                          onPress={() => { void openDashboardLink(primaryTodayClass.meetLink); }}
                        />
                      ) : (
                        <DuoButton
                          variant="secondary"
                          size="sm"
                          fullWidth
                          disabled
                          label="Vào học"
                          accessibilityLabel={primaryTodayClass.waitLabel || 'Chưa đến giờ vào lớp'}
                        />
                      )
                    ) : meetEmptyMode === 'purchase' ? (
                      <DuoButton
                        variant="primary"
                        size="sm"
                        fullWidth
                        label="Mua gói Meet"
                        onPress={() => setMeetPlanOpen(true)}
                      />
                    ) : meetEmptyMode === 'renew' ? (
                      <DuoButton
                        variant="primary"
                        size="sm"
                        fullWidth
                        label="Gia hạn Meet"
                        onPress={() => setRenewSheetOpen(true)}
                      />
                    ) : (nextMeetForEmpty || nextLesson.length > 0) ? (
                      <DuoButton
                        variant="secondary"
                        size="sm"
                        fullWidth
                        disabled
                        label="Vào học"
                        accessibilityLabel="Chưa đến giờ vào lớp"
                      />
                    ) : (
                      <DuoButton
                        variant="secondary"
                        size="sm"
                        fullWidth
                        label={needsUnlockMeetCta ? 'Mở khóa Meet' : 'Xem lịch học'}
                        onPress={() => {
                          if (needsUnlockMeetCta) setMeetPlanOpen(true);
                          else tabNavigation.navigate('Schedule');
                        }}
                      />
                    )}
                  </View>
                </View>

                {/* Thẻ phải: Việc ưu tiên / Ôn tập nhanh */}
                <View style={[styles.bMiniCard, styles.bMiniCardAccent]}>
                  {primaryTask ? (
                    <>
                      <View style={[styles.bMiniTag, styles.bMiniTagBlue]}>
                        <Zap size={11} color="#1D4ED8" />
                        <Text style={[styles.bMiniTagText, styles.bMiniTagBlueText]} numberOfLines={1}>Ưu tiên hôm nay</Text>
                      </View>
                      <Text style={styles.bMiniTitle} numberOfLines={2}>{primaryTask.title}</Text>
                      <Text style={styles.bMiniMeta} numberOfLines={2}>{primaryTask.sub || 'Hoàn thành để ghi nhận tiến độ'}</Text>
                      <View style={styles.bMiniActionWrap}>
                        <DuoButton
                          variant="primary"
                          size="sm"
                          fullWidth
                          label={primaryTask.cta}
                          onPress={primaryTask.onPress}
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <View style={[styles.bMiniTag, styles.bMiniTagGreen]}>
                        <CheckCircle size={11} color="#047857" />
                        <Text style={[styles.bMiniTagText, styles.bMiniTagGreenText]} numberOfLines={1}>
                          {practiceStats?.playedToday ? 'Đã giữ chuỗi' : 'Ôn tập XP'}
                        </Text>
                      </View>
                      <Text style={styles.bMiniTitle} numberOfLines={2}>
                        {practiceLocked ? 'Mở khóa Luyện tập XP' : 'Luyện tập & Tích XP'}
                      </Text>
                      <Text style={styles.bMiniMeta} numberOfLines={2}>
                        {practiceStats?.playedToday
                          ? `Hôm nay đã đạt ${practiceStats.todayXp ?? 0} XP`
                          : 'Hoàn thành 1 lượt để giữ chuỗi ngày'}
                      </Text>
                      <View style={styles.bMiniActionWrap}>
                        <DuoButton
                          variant="secondary"
                          size="sm"
                          fullWidth
                          label={practiceStats?.playedToday ? 'Ôn thêm' : 'Luyện ngay'}
                          onPress={() => tabNavigation.navigate('DailyPractice')}
                        />
                      </View>
                    </>
                  )}
                </View>
              </View>

              {todayMobileClasses.length > 1 ? (
                <View style={styles.bCardChunky}>
                  <View style={styles.ovHeadRow}>
                    <CalendarDays size={17} color="#059669" />
                    <Text style={[styles.ovTitle, styles.flex]}>{`Thêm lịch hôm nay (${todayMobileClasses.length - 1})`}</Text>
                  </View>
                  {todayMobileClasses.slice(1).map((item) => (
                    <View key={item.id} style={[styles.todayClassBox, item.live && styles.todayClassBoxLive]}>
                      <View style={styles.flex}>
                        <Text numberOfLines={1} style={styles.todayClassTitle}>{item.title}</Text>
                        <Text numberOfLines={1} style={styles.todayClassMetaText}>{`${item.time}${item.teacher ? ` · ${item.teacher}` : ''}`}</Text>
                      </View>
                      {item.ended ? (
                        <DuoButton variant="secondary" size="sm" disabled label="Đã kết thúc" />
                      ) : item.meetLink && item.joinable ? (
                        <DuoButton variant="danger" size="sm" label="Vào học" onPress={() => { void openDashboardLink(item.meetLink); }} />
                      ) : (
                        <DuoButton
                          variant="secondary"
                          size="sm"
                          disabled
                          label="Vào học"
                          accessibilityLabel={item.waitLabel || 'Chưa đến giờ vào lớp'}
                        />
                      )}
                    </View>
                  ))}
                </View>
              ) : null}

              {remainingTasks.length > 0 ? (
                <View style={styles.bCardChunky}>
                  <View style={styles.ovHeadRow}>
                    <CheckCircle size={18} color="#059669" />
                    <Text style={[styles.ovTitle, styles.flex]}>{`Việc khác cần làm (${remainingTasks.length})`}</Text>
                  </View>
                  {remainingTasks.map(({ key, ...task }) => (
                    <OverviewTaskRow key={key} {...task} freeMenu={freeMenu} isBrandStudent={isBrandStudent} />
                  ))}
                </View>
              ) : null}

              {!freePortalCourse && Boolean(currentCourse) ? (
                <View style={styles.bCardChunky}>
                  <View style={styles.ovHeadRow}>
                    <BookOpen size={18} color="#059669" />
                    <Text style={[styles.ovTitle, styles.flex]}>Khóa học của tôi</Text>
                    <Pressable onPress={() => tabNavigation.navigate('DailyPractice')} accessibilityRole="button">
                      <Text style={styles.ovLink}>Xem tất cả ›</Text>
                    </Pressable>
                  </View>
                  <CompactCoursePicker
                    items={coursePickerItems}
                    activeName={currentCourse}
                    onChange={setSelectedCourse}
                    showProgress={false}
                  />
                  <View style={styles.ovProgressBlock}>
                    <View style={styles.ovProgressHeaderRow}>
                      {coursePickerItems.length <= 1 ? (
                        <Text numberOfLines={2} style={[styles.ovCourseName, styles.flex]}>{currentCourse || 'Chưa có khóa học'}</Text>
                      ) : (
                        <View style={styles.flex} />
                      )}
                      <Text style={styles.ovCoursePct}>{`${studentProgress ?? 0}%`}</Text>
                    </View>
                    <ProgressBar value={studentProgress ?? 0} />
                  </View>
                  <Text style={styles.ovCourseMeta}>
                    {[
                      sessionCountsAvailable ? `Đã học ${completedSessions}/${totalSessions} buổi` : '',
                      currentEnrollment?.teacherName ? `GV: ${currentEnrollment.teacherName}` : '',
                    ].filter(Boolean).join('  ·  ') || 'Tiến độ sẽ cập nhật sau buổi học đầu tiên.'}
                  </Text>
                  <View style={[styles.ovButtonRow, styles.ovButtonRowEnd]}>
                    <DuoButton
                      variant="primary"
                      size="md"
                      icon={<Video size={16} color="#FFFFFF" />}
                      label="Vào bài học"
                      onPress={() => tabNavigation.navigate('DailyPractice')}
                      style={styles.ovCourseActionBtn}
                    />
                  </View>
                </View>
              ) : null}
            </View>

            {!user?.previewMode ? (
              <View style={isWide ? styles.duoColRight : styles.studentColStack}>
                {!practiceLocked ? (
                  <DuoDailyQuestsCard
                    todayAnswers={Math.max(
                      Number((practiceStats as { todayQuestions?: number } | null)?.todayQuestions) || 0,
                      practiceStats?.todaySessions ? practiceStats.todaySessions * 10 : (practiceStats?.playedToday ? 10 : 0),
                    )}
                    todayVideos={Number((practiceStats as { todayVideos?: number } | null)?.todayVideos) || 0}
                    todayXp={practiceStats?.todayXp ?? (user as typeof user & { lms?: { dailyXpToday?: number } })?.lms?.dailyXpToday ?? 0}
                    onOpenPractice={() => tabNavigation.navigate('DailyPractice')}
                    isBrandStudent={isBrandStudent}
                  />
                ) : null}
                <LearningLeaderboardCard isBrandStudent={isBrandStudent} />
                {freeMenu && (practice?.referral || practiceStats?.referral) ? (
                  <ReferralRewardCard
                    referral={(practice?.referral || practiceStats?.referral)!}
                    onRedeemed={() => {
                      dailyPracticeApi.overview().then(setPractice).catch(() => { });
                    }}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        </View>
      )}
      <FreeMeetPlanModal
        visible={meetPlanOpen}
        onClose={() => setMeetPlanOpen(false)}
        onUnlocked={() => {
          setMeetPlanOpen(false);
          void refreshSubscription();
          mobileApiRequest<{ data?: MeetClassRow[] }>('/meet-classes/mine')
            .then((res) => setMeetClasses(Array.isArray(res?.data) ? res.data : []))
            .catch(() => { });
        }}
      />
      <Modal visible={renewSheetOpen} transparent animationType="slide" onRequestClose={() => setRenewSheetOpen(false)}>
        <View style={styles.sheetBackdrop}>
          <View style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Gia hạn gói Meet</Text>
              <Pressable onPress={() => setRenewSheetOpen(false)} accessibilityRole="button" accessibilityLabel="Đóng">
                <X size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.sheetBody}>
              {subscription ? (
                <SubscriptionRenewPanel
                  overview={subscription}
                  onRenewed={() => {
                    setRenewSheetOpen(false);
                    void refreshSubscription();
                  }}
                />
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

type OverviewTask = {
  key: string;
  icon: LucideIcon;
  tone: string;
  title: string;
  sub?: string;
  cta: string;
  onPress: () => void;
};

/** Một dòng "việc cần làm" - bấm là tới đúng việc (mở bài tập, điểm danh ca…). */
function OverviewTaskRow({ icon: Icon, tone, title, sub, cta, onPress, freeMenu, isBrandStudent }: Omit<OverviewTask, 'key'> & { freeMenu?: boolean; isBrandStudent?: boolean }) {
  return (
    <View style={styles.ovTask}>
      <Pressable onPress={onPress} style={styles.ovTaskMain} accessibilityLabel={`${title}. ${cta}`}>
        <View style={[styles.ovTaskIcon, { backgroundColor: tone }]}><Icon size={19} color="#FFFFFF" /></View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.cardTitle}>{title}</Text>
          {sub ? <Text numberOfLines={1} style={styles.muted}>{sub}</Text> : null}
        </View>
      </Pressable>
      <DuoButton
        variant="primary"
        size="sm"
        label={cta}
        rightIcon={<ChevronRight size={14} color="#FFFFFF" />}
        onPress={onPress}
      />
    </View>
  );
}

function OverviewDoneBox({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.ovDone}>
      <CheckCircle size={26} color="#10B981" />
      <View style={styles.flex}>
        <Text style={styles.ovDoneTitle}>{title}</Text>
        <Text style={styles.ovDoneText}>{text}</Text>
      </View>
    </View>
  );
}

function StudentHero({ progress, compact, onPress }: { progress: number; compact: boolean; onPress: () => void }) {
  const { user } = useAuth();
  return (
    <Pressable onPress={onPress} style={[styles.heroCard, compact && styles.heroCompact]} accessibilityRole="button">
      <View style={styles.heroTop}>
        <View style={styles.courseTag}><GraduationCap size={14} color="#D8F3EF" /><Text style={styles.courseTagText}>Khóa học của bạn</Text></View>
        <ArrowRight size={18} color="#FFFFFF" />
      </View>
      <Text style={styles.heroTitle}>{user?.course}</Text>
      <Text style={styles.heroMeta}>Giảng viên · Cô Ngọc Hà</Text>
      <View style={styles.heroProgress}>
        <View style={styles.heroProgressRow}><Text style={styles.heroMeta}>Tiến độ học tập</Text><Text style={styles.heroPercent}>{progress}%</Text></View>
        <ProgressBar value={progress} />
      </View>
    </Pressable>
  );
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

const VN_HERO_WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

function getVnHeroClock() {
  const vn = new Date(Date.now() + 7 * 3600e3);
  const hour = vn.getUTCHours();
  const pad = (n: number) => String(n).padStart(2, '0');
  const greeting = hour < 11 ? 'Chào buổi sáng' : hour < 13 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';
  return {
    greeting,
    dateText: `${VN_HERO_WEEKDAYS[vn.getUTCDay()]}, ${pad(vn.getUTCDate())}/${pad(vn.getUTCMonth() + 1)}`,
  };
}

const styles = StyleSheet.create({
  todayLiveBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' },
  todayLiveBadgeText: { color: '#047857', fontSize: 11, fontWeight: '800' },
  todayClassBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: '#F8FAFC' },
  todayClassBoxLive: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  todayClassTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  todayClassMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  todayClassMetaText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  todayClassMetaDot: { color: colors.muted, fontSize: 12 },
  todayClassTeacherText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  todayJoinBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, backgroundColor: '#2563EB', paddingHorizontal: 12, paddingVertical: 8 },
  todayJoinBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  todayNoLinkBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  todayNoLinkText: { color: '#B45309', fontSize: 11, fontWeight: '700' },
  todayEmptyBox: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 18, paddingHorizontal: spacing.md, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, backgroundColor: '#F8FAFC' },
  todayEmptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  todayEmptySub: { color: colors.muted, fontSize: 12, textAlign: 'center', fontWeight: '500' },
  ovCard: { gap: spacing.sm },
  ovHeadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ovTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  ovLink: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  studentGridWide: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  studentGridStack: { gap: spacing.md },
  studentColLeft: { flex: 7, minWidth: 0, gap: spacing.md },
  studentColRight: { flex: 5, minWidth: 0, gap: spacing.md },
  studentColStack: { gap: spacing.md },
  meetGrid: { gap: spacing.xs },
  meetCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: 10, borderRadius: 14,
    borderWidth: 1, borderColor: colors.line, backgroundColor: '#F8FAFC',
  },
  meetCardLive: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  meetIconWrap: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#2563EB', alignItems: 'center', justifyContent: 'center' },
  meetDayLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  meetDayLabelLive: { color: colors.brand, fontWeight: '800' },
  meetJoinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, backgroundColor: colors.brand,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  meetJoinText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  meetPendingText: { color: '#B45309', fontSize: 12, fontWeight: '800' },
  meetIdleText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  ovTask: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 10,
    borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  ovTaskMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  ovTaskIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ovTaskCta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ovTaskCtaText: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  ovDone: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: '#ECFDF5' },
  ovDoneTitle: { color: '#047857', fontSize: 14, fontWeight: '900' },
  ovDoneText: { color: '#059669', fontSize: 12, lineHeight: 17, marginTop: 2 },
  ovSessionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: 10, borderRadius: 14,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  ovSessionLive: { backgroundColor: colors.brand, borderColor: colors.brand },
  ovSessionLiveText: { color: '#FFFFFF' },
  ovSessionTime: { width: 48, color: colors.brand, fontSize: 13, fontWeight: '900' },
  ovSessionBadge: { fontSize: 12, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  ovStatRow: { flexDirection: 'row', gap: spacing.sm },
  ovStat: {
    flex: 1, minWidth: 0, flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 10,
    borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  ovStatIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  ovStatValue: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  ovStatLabel: { color: colors.muted, fontSize: 11.5, lineHeight: 15, fontWeight: '700' },
  ovCourseName: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  ovProgressBlock: { gap: 6 },
  ovProgressHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  ovCoursePct: { color: '#059669', fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  ovCourseMeta: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  ovButtonRow: { flexDirection: 'row', gap: spacing.sm },
  ovButtonRowEnd: { justifyContent: 'flex-end' },
  ovCourseActionBtn: { width: '48.5%', minWidth: 160 },
  ovPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: colors.brand,
  },
  ovPrimaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  ovSecondary: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  ovSecondaryText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  screen: { paddingTop: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.lg, backgroundColor: '#F5F8FC' },
  studentScreen: { paddingTop: spacing.sm, paddingBottom: spacing.xxxl, gap: 14, backgroundColor: '#FFFBF2' },
  bHeroCard: {
    backgroundColor: '#059669',
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#047857',
    borderBottomWidth: 5,
    borderBottomColor: '#065F46',
    padding: 15,
    gap: 12,
  },
  bHeroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    flexWrap: 'wrap',
  },
  bHeroIdentityCol: { flex: 1, minWidth: 150, gap: 2 },
  bHeroGreeting: { color: '#D1FAE5', fontSize: 12, fontWeight: '700' },
  bHeroName: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  bHeroChipsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  bStreakBadgeText: { color: '#92400E', fontSize: 11.5, fontWeight: '800' },
  bXpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  bXpBadgeText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '800' },
  bGoalPanel: {
    backgroundColor: 'rgba(4, 120, 87, 0.52)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  bGoalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  bGoalLabelGroup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  bGoalLabelText: { flex: 1, color: '#FFFFFF', fontSize: 12.5, fontWeight: '800' },
  bGoalEditBtn: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: '#D1FAE5',
  },
  bGoalEditText: { color: '#047857', fontSize: 11, fontWeight: '800' },
  bGoalTrack: {
    height: 11,
    borderRadius: 999,
    backgroundColor: 'rgba(6, 78, 59, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  bGoalFill: { height: '100%', borderRadius: 999 },
  bGoalFootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  bGoalFootText: { color: '#D1FAE5', fontSize: 11.5, fontWeight: '600', flexShrink: 1 },
  bNextSessionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  bNextSessionPillLive: { backgroundColor: '#DC2626' },
  bLiveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#FEF08A' },
  bNextSessionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  bSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2 },
  bSectionTitle: { color: '#1E293B', fontSize: 15, fontWeight: '900' },
  bSectionPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#A7F3D0' },
  bSectionPillText: { color: '#065F46', fontSize: 11, fontWeight: '800' },
  bTwoColRow: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  bMiniCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 5,
    borderBottomColor: '#CBD5E1',
    padding: 12,
    gap: 6,
  },
  bMiniCardLive: { borderColor: '#6EE7B7', borderBottomColor: '#34D399', backgroundColor: '#F0FDF4' },
  bMiniCardAccent: { borderColor: '#FDE68A', borderBottomColor: '#FCD34D' },
  bMiniTag: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  bMiniTagAmber: { backgroundColor: '#FEF3C7' },
  bMiniTagAmberText: { color: '#B45309' },
  bMiniTagBlue: { backgroundColor: '#E0F2FE' },
  bMiniTagBlueText: { color: '#0369A1' },
  bMiniTagGreen: { backgroundColor: '#D1FAE5' },
  bMiniTagGreenText: { color: '#047857' },
  bMiniTagLive: { backgroundColor: '#D1FAE5' },
  bMiniTagLiveText: { color: '#047857' },
  bMiniTagText: { fontSize: 11, fontWeight: '800' },
  bMiniTitle: { color: '#1E293B', fontSize: 13.5, fontWeight: '800', lineHeight: 18, marginTop: 2 },
  bMiniMeta: { color: '#64748B', fontSize: 11.5, fontWeight: '600', lineHeight: 16 },
  bMiniActionWrap: { marginTop: 'auto', paddingTop: 4 },
  bCardChunky: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 5,
    borderBottomColor: '#CBD5E1',
    padding: 14,
    gap: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: '#DFEAF2', backgroundColor: '#F0F6FA' },
  greetingIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand, borderWidth: 1, borderColor: '#A7F3D0', shadowColor: colors.brandDark, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  greeting: { flex: 1, gap: 4 },
  greetingMeta: { color: colors.brand, fontSize: typography.micro, fontWeight: '800', letterSpacing: 1.1 },
  greetingTitle: { color: '#17314C', fontSize: typography.title, fontWeight: '800', letterSpacing: -0.5 },
  greetingSub: { color: '#63778B', fontSize: typography.small, lineHeight: 19 },
  inlineError: { color: colors.red, fontSize: typography.caption, fontWeight: '600' },
  heroCard: { backgroundColor: colors.brandDark, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, overflow: 'hidden' },
  heroCompact: { padding: spacing.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseTag: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  courseTagText: { color: '#D8F3EF', fontSize: typography.micro, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: typography.heading, fontWeight: '800', lineHeight: 25, marginTop: spacing.xs },
  heroMeta: { color: '#C3DDDC', fontSize: typography.small },
  heroProgress: { gap: spacing.sm, marginTop: spacing.sm },
  heroProgressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroPercent: { color: '#FFFFFF', fontSize: typography.heading, fontWeight: '800' },
  sectionWrap: { gap: spacing.md },
  teacherActionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  teacherAction: { minHeight: 112, borderRadius: radius.md, borderWidth: 1, borderColor: '#E1EAF1', padding: spacing.md, justifyContent: 'space-between', gap: spacing.xs, shadowColor: '#1E3A5F', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  teacherActionTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teacherActionIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, shadowColor: '#1E3A5F', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  liveClassCard: { minHeight: 80, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandDark, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 1, borderColor: colors.brand },
  liveClassIcon: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  liveClassEyebrow: { color: '#A7F3D0', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.7 },
  liveClassTitle: { color: '#FFFFFF', fontSize: typography.small, fontWeight: '800' },
  liveClassTime: { color: '#FEF08A', fontSize: typography.caption, fontWeight: '800', marginTop: 2 },
  liveClassCopy: { color: '#D1FAE5' },
  liveClassNoLink: { color: '#D1FAE5', fontSize: typography.micro, fontWeight: '700' },
  teacherStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  teacherStatCard: { width: '48%', minHeight: 116, padding: spacing.md, gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: colors.surface, shadowColor: '#1E3A5F', shadowOpacity: 0.045, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  teacherStatCardWide: { width: '100%', minHeight: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teacherStatTop: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teacherStatTopWide: { flex: 1 },
  teacherStatValueGroup: { gap: spacing.xs },
  teacherStatValueGroupWide: { alignItems: 'flex-end' },
  teacherStatIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  teacherStatLabel: { flex: 1, color: colors.muted, fontSize: typography.caption, fontWeight: '700', lineHeight: 16 },
  teacherStatValue: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' },
  teacherStudentCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  upcomingSessionRow: { minHeight: 62, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  upcomingDate: { width: 38, height: 42, borderRadius: 11, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' },
  upcomingDateDay: { color: colors.blue, fontSize: typography.small, fontWeight: '900' },
  upcomingDateMonth: { color: colors.blue, fontSize: typography.micro, fontWeight: '800' },
  ratingCard: { gap: spacing.xs },
  ratingTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  ratingStars: { color: '#D97706', fontSize: typography.small, fontWeight: '900', letterSpacing: 1 },
  studentCourseCard: { backgroundColor: '#123F5A', borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: '#2A7180', overflow: 'hidden' },
  studentCourseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  studentCourseStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  studentCourseEyebrow: { color: '#BDEBE5', fontSize: typography.caption, fontWeight: '800', letterSpacing: 0.8 },
  studentCourseTitle: { color: '#FFFFFF', fontSize: typography.heading, lineHeight: 25, fontWeight: '800' },
  studentCourseMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  studentCourseCopy: { color: '#D7E8F2', fontSize: typography.small, lineHeight: 20, fontWeight: '600' },
  studentCourseFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)', paddingTop: spacing.sm },
  studentCourseTeacher: { flex: 1, color: '#FFFFFF', fontSize: typography.small, fontWeight: '700' },
  studentRating: { color: '#FDE68A', fontSize: typography.small, fontWeight: '800' },
  studentJoinAction: { minHeight: 40, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 12, backgroundColor: '#FFFFFF' },
  studentJoinActionText: { color: '#123F5A', fontSize: typography.caption, fontWeight: '900', letterSpacing: 0.4 },
  studentKpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  studentKpi: { width: '48%', minHeight: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: spacing.sm, padding: spacing.md, borderRadius: 14 },
  studentKpiIcon: { width: 44, height: 44, flexShrink: 0, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.78)', shadowColor: '#1E3A5F', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  studentKpiContent: { flex: 1, minWidth: 0, gap: spacing.xs },
  studentKpiLabel: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  studentKpiMetric: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: spacing.xs },
  studentKpiValue: { flexShrink: 1, fontSize: typography.heading, lineHeight: 25, fontWeight: '800', fontVariant: ['tabular-nums'] },
  studentKpiUnit: { color: colors.muted, fontSize: typography.micro, fontWeight: '600' },
  todoPanel: { gap: spacing.sm, overflow: 'hidden' },
  todoHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  todoHeaderIcon: { width: 40, height: 40, borderRadius: 16, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' },
  todoOverviewPill: { overflow: 'hidden', borderRadius: radius.pill, backgroundColor: '#F1F5F9', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, color: colors.muted, fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.6 },
  todoCards: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.sm },
  todoSubtitle: { color: colors.muted, fontSize: typography.caption, fontWeight: '600', marginTop: 2 },
  todoCard: { width: '48%', height: 148, borderWidth: 1, borderRadius: 16, padding: spacing.sm, alignItems: 'flex-start', gap: spacing.xs, overflow: 'hidden' },
  quizTodo: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  homeworkTodo: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  scheduleTodo: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  messagesTodo: { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' },
  todoCardIcon: { width: 36, height: 36, flexShrink: 0, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  todoBadge: { position: 'absolute', top: -7, right: -8, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, textAlign: 'center', overflow: 'hidden', backgroundColor: colors.brand, color: '#FFFFFF', fontSize: typography.micro, lineHeight: 20, fontWeight: '900', borderWidth: 2, borderColor: '#FFFFFF' },
  quizTodoIcon: { backgroundColor: '#059669' },
  homeworkTodoIcon: { backgroundColor: '#F97316' },
  scheduleTodoIcon: { backgroundColor: '#3B82F6' },
  messagesTodoIcon: { backgroundColor: '#8B5CF6' },
  todoCardContent: { flex: 1, width: '100%', minWidth: 0, alignItems: 'flex-start', gap: 2 },
  todoCardTitle: { minHeight: 36, color: colors.ink, fontWeight: '700', fontSize: typography.caption, lineHeight: 18 },
  todoDetail: { minHeight: 16, fontSize: typography.caption, lineHeight: 16, fontWeight: '700' },
  todoCta: { minHeight: 28, marginTop: 'auto', paddingHorizontal: spacing.sm, borderRadius: 9, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 2 },
  todoCtaText: { color: colors.ink, fontSize: typography.caption, fontWeight: '800' },
  materialPanel: { backgroundColor: '#334155', borderRadius: 16, padding: spacing.lg, gap: spacing.sm },
  materialHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  materialHeadingText: { color: '#CBD5E1', fontSize: typography.small, fontWeight: '800', letterSpacing: 0.5 },
  materialRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(71, 85, 105, 0.75)', borderRadius: 12, paddingHorizontal: spacing.md },
  materialType: { color: '#FFFFFF', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 3, fontSize: typography.micro, fontWeight: '900' },
  materialTypePdf: { backgroundColor: '#EF4444' },
  materialTypeExcel: { backgroundColor: '#22C55E' },
  materialTypeOther: { backgroundColor: '#F97316' },
  materialTitle: { flex: 1, color: '#FFFFFF', fontSize: typography.caption, fontWeight: '700' },
  materialEmpty: { color: '#CBD5E1', fontSize: typography.caption, paddingVertical: spacing.md },
  materialAction: { minHeight: 40, marginTop: spacing.xs, backgroundColor: 'rgba(71, 85, 105, 0.55)', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  materialActionText: { color: '#BAE6FD', fontSize: typography.caption, fontWeight: '700' },
  gradePanel: { padding: 0, overflow: 'hidden' },
  gradeHeading: { minHeight: 62, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: '#FCFDFE', borderBottomWidth: 1, borderBottomColor: '#E8EEF2', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  gradeHeadingTitle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gradeHeadingIcon: { width: 34, height: 34, flexShrink: 0, borderRadius: 11, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  gradeHeadingText: { flex: 1, minWidth: 0, color: colors.ink, fontWeight: '800', fontSize: typography.caption, lineHeight: 18 },
  gradeCount: { maxWidth: 112, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: '#F1F5F9', paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, color: '#475569', fontSize: typography.micro, fontWeight: '800', textAlign: 'center' },
  gradeRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: spacing.xs },
  gradeRowTitle: { color: colors.ink, fontSize: typography.caption, lineHeight: 19, fontWeight: '700' },
  gradeRowMeta: { color: colors.muted, fontSize: typography.caption, lineHeight: 17 },
  gradeEmpty: { minHeight: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.lg },
  gradeEmptyIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', marginBottom: spacing.xs },
  gradeEmptyTitle: { color: '#475569', fontSize: typography.caption, fontWeight: '800' },
  gradeEmptyCopy: { color: '#94A3B8', fontSize: typography.caption, textAlign: 'center' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickAction: { width: '47.8%', minHeight: 96, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: '#E2E8F0', padding: spacing.md, justifyContent: 'space-between', shadowColor: '#1E3A5F', shadowOpacity: 0.04, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  quickActionSmall: { width: '47%' },
  quickIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, shadowColor: '#1E3A5F', shadowOpacity: 0.08, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  quickTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '700', lineHeight: 20 },
  flex: { flex: 1 },
  muted: { color: colors.muted, fontSize: typography.small, lineHeight: 19 },
  cardTitle: { color: colors.ink, fontWeight: '700', fontSize: typography.body, lineHeight: 21 },
  reviewCard: { flexDirection: 'row', alignItems: 'center' },
  reviewIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center', shadowColor: colors.purple, shadowOpacity: 0.2, shadowRadius: 7, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  taskCard: { gap: spacing.sm },
  taskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  helpCard: { minHeight: 104, position: 'relative', overflow: 'hidden', backgroundColor: '#123B4A', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(167,243,208,0.26)', paddingHorizontal: spacing.md, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs, shadowColor: '#0F766E', shadowOpacity: 0.28, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 6 },
  helpRobotStage: { width: 60, height: 64, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  helpRobotHalo: { position: 'absolute', width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(45,212,191,0.18)', borderWidth: 1, borderColor: 'rgba(153,246,228,0.22)' },
  helpRobot: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#0F766E', borderWidth: 1, borderColor: 'rgba(204,251,241,0.45)', alignItems: 'center', justifyContent: 'center', shadowColor: '#5EEAD4', shadowOpacity: 0.35, shadowRadius: 9, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  helpRobotSparkle: { position: 'absolute', top: 0, right: 0 },
  helpRobotStatus: { position: 'absolute', bottom: 0, right: -2, height: 20, minWidth: 30, paddingHorizontal: 5, borderRadius: 10, backgroundColor: '#ECFDF5', borderWidth: 2, borderColor: '#123B4A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  helpRobotStatusDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#10B981' },
  helpRobotStatusText: { color: '#047857', fontSize: 8, lineHeight: 12, fontWeight: '900' },
  helpTitleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  helpTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: typography.body },
  helpOnline: { borderRadius: radius.pill, backgroundColor: 'rgba(16,185,129,0.16)', paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center', gap: 4 },
  helpOnlineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#6EE7B7' },
  helpOnlineText: { color: '#A7F3D0', fontSize: 8, lineHeight: 10, fontWeight: '900', letterSpacing: 0.5 },
  helpText: { color: '#D1FAE5', fontSize: typography.caption, lineHeight: 17, marginTop: 4 },
  helpArrow: { width: 32, height: 32, flexShrink: 0, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8 },
  duoStudentContainer: {
    gap: 16,
    paddingBottom: 96,
  },
  duoGridWide: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  duoColLeft: {
    flex: 1,
    gap: 16,
  },
  duoColRight: {
    width: 360,
    gap: 16,
  },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.5)' },
  sheet: { maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.sm },
  sheetTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  sheetBody: { padding: spacing.lg, paddingTop: 0, paddingBottom: spacing.xxl },
  resumeCard: {
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#6EE7B7',
    borderBottomWidth: 5,
    borderBottomColor: '#34D399',
    backgroundColor: '#FFFFFF',
    padding: 15,
    gap: 9,
  },
  resumeHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  resumeBadgeGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resumeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#059669',
  },
  resumeBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  resumeKindText: { color: '#047857', fontSize: 11, fontWeight: '700' },
  resumeAgoText: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  resumeTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900', lineHeight: 20 },
  resumeMeta: { color: '#475569', fontSize: 12, fontWeight: '600' },
  resumeTimeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 2, paddingBottom: 2 },
  resumeTimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#FFFFFF',
  },
  resumeTimeText: { color: '#047857', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
  resumePercentText: { color: '#64748B', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
