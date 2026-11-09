import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, DeviceEventEmitter, Easing, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  ArrowRight, Award, BookOpen, Bot, Calendar, CalendarDays, CheckCircle, ChevronRight, ClipboardCheck, ClipboardList,
  Clock, Clock3, Download, ExternalLink, FileText, GraduationCap, MessageCircle, MessageSquare, Sparkles, Star, TrendingUp, Users,
  WalletCards, UserPlus, Trophy, Video, Zap, Flame, Gamepad2, type LucideIcon,
} from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../app/AuthContext';
import { Avatar, AppScreen, Card, ErrorState, LoadingSkeleton, SectionHeading, StatusBadge, ProgressBar } from '../components/ui';
import { LmsGoalMergedCard } from '../components/LmsGoalMergedCard';
import { DailyPracticeOverviewCard } from '../components/DailyPracticeOverviewCard';
import { isFreePortalLocked, isFreePortalMenu } from '../components/FreePortalModals';
import { CompactCoursePicker, type CoursePickerItem } from '../components/CompactCoursePicker';
import { WelcomeHero, type WelcomeChip } from '../components/WelcomeHero';
import { DAILY_PRACTICE_STATS_EVENT, dailyPracticeApi, type DpStats } from '../services/dailyPracticeApi';
import {
  assignmentService, evaluationService,
  quizService, scheduleService, studentProfileService, studentService,
} from '../services/mockService';
import { useMockResource } from '../hooks/useMockResource';
import { SOCKET_EVENTS } from '../services/socketService';
import { getMobileImageSource, mobileApiRequest } from '../services/apiClient';
import { getTeacherDashboardMetrics } from '../services/teacherApi';
import { buildStudentDashboardActivity } from '../services/studentDashboardActivity';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';

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
  slotKey?: string;
  slotLabel?: string;
  startTime?: string;
  endTime?: string;
  linkHoc?: string;
};

type MeetCardItem = MeetClassRow & {
  live: boolean;
  dayLabel: string;
  nextStart: number;
};

function parseHmToMinutes(timeStr?: string) {
  const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

function sortMeetClasses(rows: MeetClassRow[] = []): MeetCardItem[] {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return [...rows]
    .map((m) => {
      const start = parseHmToMinutes(m.startTime) ?? 0;
      const end = parseHmToMinutes(m.endTime) ?? start + 60;
      const live = nowMin >= start - 15 && nowMin <= end;
      const nextStart = live ? -1 : nowMin < start ? start - nowMin : 1440 - nowMin + start;
      const dayLabel = live ? 'Đang diễn ra' : nowMin < start ? 'Hôm nay' : 'Ngày mai';
      return { ...m, live, nextStart, dayLabel };
    })
    .sort((a, b) => a.nextStart - b.nextStart);
}

type LmsSubjectProgress = {
  id: string;
  name: string;
  completedLessons: number;
  totalLessons: number;
};

async function openDashboardLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert('Không thể mở liên kết', error instanceof Error ? error.message : 'Vui lòng thử lại.');
  }
}

export function HomeScreen() {
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 1024;
  const tabNavigation = useNavigation<TabNavigation>();
  const navigation = tabNavigation.getParent<RootNavigation>();
  const isTeacher = user?.role === 'teacher';
  const [selectedCourse, setSelectedCourse] = useState('');
  const [practice, setPractice] = useState<Awaited<ReturnType<typeof dailyPracticeApi.overview>> | null>(null);
  const [pathData, setPathData] = useState<Awaited<ReturnType<typeof dailyPracticeApi.path>> | null>(null);
  const [meetClasses, setMeetClasses] = useState<MeetClassRow[]>([]);
  const [lmsSubjects, setLmsSubjects] = useState<LmsSubjectProgress[]>([]);

  useFocusEffect(useCallback(() => {
    if (isTeacher || !user || user.previewMode) return;
    dailyPracticeApi.overview().then(setPractice).catch(() => { });
    dailyPracticeApi.path().then(setPathData).catch(() => { });
    mobileApiRequest<{ data?: MeetClassRow[] }>('/meet-classes/mine')
      .then((res) => setMeetClasses(Array.isArray(res?.data) ? res.data : []))
      .catch(() => setMeetClasses([]));
    mobileApiRequest<{ data?: { courses?: Array<Record<string, unknown>>; subjects?: Array<Record<string, unknown>> } }>('/lesson-practice/my/subjects')
      .then((res) => {
        const courses = Array.isArray(res?.data?.courses) ? res.data.courses : [];
        if (courses.length > 0) {
          const enrolledVideoCourses = courses.filter((c) => c.enrolled && c.deliveryMode === 'video');
          const mapped: LmsSubjectProgress[] = [];
          enrolledVideoCourses.forEach((course) => {
            const subs = Array.isArray(course.subjects) ? (course.subjects as Array<Record<string, unknown>>) : [];
            if (subs.length > 0) {
              subs.forEach((s) => {
                const units = Array.isArray(s.units) ? (s.units as Array<Record<string, unknown>>) : [];
                let totalLessons = Number(s.totalLessons) || 0;
                let completedLessons = Number(s.completedLessons) || 0;
                if (!totalLessons && units.length > 0) {
                  units.forEach((u) => {
                    const secs = Array.isArray(u.sections) ? (u.sections as Array<Record<string, unknown>>) : [];
                    totalLessons += secs.length || 1;
                    completedLessons += secs.filter((sec) => Boolean(sec.completed)).length;
                  });
                }
                mapped.push({
                  id: String(s.id || s._id || course.courseId || ''),
                  name: String(s.name || course.title || ''),
                  completedLessons,
                  totalLessons,
                });
              });
            } else {
              mapped.push({
                id: String(course.courseId || course.id || ''),
                name: String(course.title || course.name || ''),
                completedLessons: Number(course.completedLessons) || 0,
                totalLessons: Number(course.totalLessons) || 0,
              });
            }
          });
          setLmsSubjects(mapped);
          return;
        }
        const list = Array.isArray(res?.data?.subjects) ? res.data.subjects : [];
        setLmsSubjects(
          list.map((s) => ({
            id: String(s.id || s._id || ''),
            name: String(s.name || ''),
            completedLessons: Number(s.completedLessons) || 0,
            totalLessons: Number(s.totalLessons) || 0,
          })),
        );
      })
      .catch(() => { });
  }, [isTeacher, user]));
  useEffect(() => {
    if (isTeacher || !user || user.previewMode) return undefined;
    const sub = DeviceEventEmitter.addListener(DAILY_PRACTICE_STATS_EVENT, (detail?: { stats?: Partial<DpStats>; xpTotal?: number | null }) => {
      if (!detail) return;
      setPractice((prev) => {
        if (!prev) return prev;
        if (detail.stats) return { ...prev, stats: { ...prev.stats, ...detail.stats } };
        if (typeof detail.xpTotal === 'number') return { ...prev, stats: { ...prev.stats, xpTotal: detail.xpTotal } };
        return prev;
      });
    });
    return () => sub.remove();
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
  useFocusEffect(useCallback(() => {
    schedules.reload();
    assignments.reload();
    students.reload();
    teacherMetrics.reload();
    profile.reload();
    quizzes.reload();
    evaluationActivity.reload();
  }, [
    assignments.reload, evaluationActivity.reload, profile.reload, quizzes.reload, schedules.reload, students.reload, teacherMetrics.reload,
  ]));
  useEffect(() => {
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_NEW, schedules.reload),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_UPDATED, schedules.reload),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_CANCELLED, schedules.reload),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [schedules.reload]);

  const studentEnrollments = profile.data?.enrollments || user?.enrollments || [];
  const freeMenu = isFreePortalMenu(user, studentEnrollments);
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

  const subjectIdsOfEnrollment = useMemo(() => {
    const ids = Array.isArray(currentEnrollment?.subjectIds)
      ? currentEnrollment.subjectIds.map(String)
      : [];
    return new Set(ids);
  }, [currentEnrollment]);

  const matchedSubjects = useMemo(() => {
    if (!lmsSubjects.length || subjectIdsOfEnrollment.size === 0) return [];
    return lmsSubjects.filter((s) => subjectIdsOfEnrollment.has(s.id));
  }, [lmsSubjects, subjectIdsOfEnrollment]);

  const isVideoCourse = matchedSubjects.length > 0 && (currentEnrollment?.totalSessions ?? 0) === 0;
  const videoDone = matchedSubjects.reduce((sum, s) => sum + s.completedLessons, 0);
  const videoTotal = matchedSubjects.reduce((sum, s) => sum + s.totalLessons, 0);
  const videoNextSubject = matchedSubjects.find((s) => s.totalLessons > 0 && s.completedLessons < s.totalLessons)
    || matchedSubjects[0]
    || null;

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
  const meetCards = useMemo(() => sortMeetClasses(meetClasses), [meetClasses]);
  const liveMeet = useMemo(() => meetCards.find((m) => m.live) || null, [meetCards]);
  const nextMeet = meetCards[0] || null;
  const studentHeroChips = useMemo<WelcomeChip[]>(() => {
    if (firstScheduleIsLive && firstSchedule) {
      return [{ live: true, label: `Đang diễn ra · ${firstSchedule.time} · ${firstSchedule.courseName || currentCourse || 'Buổi học'}` }];
    }
    if (liveMeet) {
      return [{ live: true, label: `Đang diễn ra · Meet ${liveMeet.slotLabel || ''} ${liveMeet.startTime || ''}–${liveMeet.endTime || ''}` }];
    }
    const chips: WelcomeChip[] = [];
    if (firstSchedule) {
      chips.push({ icon: Calendar, label: `Buổi tới: ${firstSchedule.time} · ${firstSchedule.dateLabel}` });
    }
    if (nextMeet) {
      chips.push({ icon: Video, label: `Meet ${nextMeet.slotLabel || ''}: ${nextMeet.startTime || ''}–${nextMeet.endTime || ''} · ${nextMeet.dayLabel}` });
    }
    return chips;
  }, [currentCourse, firstSchedule, firstScheduleIsLive, liveMeet, nextMeet]);

  // ── Lịch học hôm nay trên mobile ──────────────────────────────────────────
  const todayMobileClasses = useMemo(() => {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const list: Array<{
      id: string;
      title: string;
      time: string;
      dateLabel: string;
      meetLink: string;
      live: boolean;
      teacher?: string;
    }> = [];

    (studentSchedules || [])
      .filter((item) => item.date === todayKey && item.status !== 'cancelled')
      .forEach((item) => {
        const live = scheduleIsLive(item);
        const meetLink = item.meetingUrl
          || (typeof profile.data?.student?.linkHoc === 'string' ? profile.data.student.linkHoc : '')
          || (typeof profile.data?.student?.joinClassUrl === 'string' ? profile.data.student.joinClassUrl : '');
        list.push({
          id: String(item.id || `1on1-${item.date}-${item.time}`),
          title: item.title || item.subject || item.courseName || currentCourse || 'Buổi học 1 kèm 1',
          time: item.time || `${item.startTime || ''} - ${item.endTime || ''}`,
          dateLabel: item.dateLabel || 'Hôm nay',
          meetLink: String(meetLink || '').trim(),
          live,
          teacher: item.teacherName || item.person || '',
        });
      });

    (meetCards || [])
      .filter((m) => m.dayLabel === 'Hôm nay' || m.live)
      .forEach((m) => {
        list.push({
          id: String(m._id || m.id || `meet-${m.slotKey || m.slotLabel}-${m.startTime}`),
          title: m.slotLabel ? `Lớp Google Meet · ${m.slotLabel}` : 'Lớp Google Meet',
          time: m.startTime && m.endTime ? `${m.startTime} – ${m.endTime}` : (m.slotLabel || 'Trong ngày'),
          dateLabel: m.dayLabel || 'Hôm nay',
          meetLink: String(m.linkHoc || '').trim(),
          live: Boolean(m.live),
          teacher: '',
        });
      });

    return list.sort((a, b) => (b.live ? 1 : 0) - (a.live ? 1 : 0));
  }, [studentSchedules, meetCards, currentCourse, profile.data]);
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
    if (Number.isFinite(sessionStartMs(item)) && sessionStartMs(item) <= nowMs) return { label: 'Chưa điểm danh', color: '#DC2626', background: '#FEF2F2', live: false };
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
      tone: lost ? '#64748B' : '#EA580C',
      title: atRisk ? `Duy trì chuỗi ${practiceStats.streak} ngày` : lost ? 'Luyện tập để lấy lại chuỗi' : 'Luyện tập hằng ngày',
      sub: atRisk ? 'Luyện tập hôm nay để giữ vững chuỗi học' : 'Khoảng 5 phút mỗi ngày để củng cố kiến thức',
      cta: 'Luyện ngay',
      onPress: () => navigation?.navigate('DailyPractice'),
    });
  }

  return (
    <AppScreen contentStyle={isTeacher ? styles.screen : styles.studentScreen}>
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
        />
      ) : (
        <WelcomeHero
          role="student"
          name={user?.name || ''}
          chips={studentHeroChips}
          showJoin={false}
        />
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
              ? teacherTasks.map(({ key, ...task }) => <OverviewTaskRow key={key} {...task} />)
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
                  <Avatar name={student.name} color={student.color} size={42} />
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
        <>
          {meetCards.length > 0 ? (
            <Card style={styles.ovCard}>
              <View style={styles.ovHeadRow}>
                <Video size={18} color={colors.brand} />
                <Text style={styles.ovTitle}>Lịch Meet</Text>
              </View>
              <View style={styles.meetGrid}>
                {meetCards.map((m) => (
                  <View
                    key={m._id || m.id || m.slotKey}
                    style={[styles.meetCard, m.live && styles.meetCardLive]}
                  >
                    <View style={styles.meetIconWrap}>
                      <Video size={18} color="#FFFFFF" />
                    </View>
                    <View style={styles.flex}>
                      <Text numberOfLines={1} style={styles.cardTitle}>
                        {`${m.slotLabel || 'Ca học'} · ${m.startTime || ''} – ${m.endTime || ''}`}
                      </Text>
                      <Text style={[styles.meetDayLabel, m.live && styles.meetDayLabelLive]}>
                        {m.dayLabel}
                      </Text>
                    </View>
                    {m.live && m.linkHoc ? (
                      <Pressable
                        onPress={() => { void openDashboardLink(m.linkHoc!); }}
                        style={styles.meetJoinBtn}
                        accessibilityRole="button"
                      >
                        <Text style={styles.meetJoinText}>Vào Meet</Text>
                        <ExternalLink size={12} color="#FFFFFF" />
                      </Pressable>
                    ) : m.live ? (
                      <Text style={styles.meetPendingText}>Chờ link từ trung tâm</Text>
                    ) : (
                      <Text style={styles.meetIdleText}>Chưa đến giờ</Text>
                    )}
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <View style={isWide ? styles.studentGridWide : styles.studentGridStack}>
            <View style={isWide ? styles.studentColLeft : styles.studentColStack}>
              {/* Lịch học hôm nay */}
              <Card style={styles.ovCard}>
                <View style={styles.ovHeadRow}>
                  <Calendar size={18} color={colors.brand} />
                  <Text style={[styles.ovTitle, styles.flex]}>Lịch học hôm nay</Text>
                  {todayMobileClasses.some((c) => c.live) ? (
                    <View style={styles.todayLiveBadge}>
                      <Text style={styles.todayLiveBadgeText}>Đang diễn ra</Text>
                    </View>
                  ) : null}
                </View>

                {todayMobileClasses.length > 0 ? (
                  <View style={{ gap: 10 }}>
                    {todayMobileClasses.map((item) => (
                      <View key={item.id} style={[styles.todayClassBox, item.live && styles.todayClassBoxLive]}>
                        <View style={{ flex: 1, gap: 4 }}>
                          <Text style={styles.todayClassTitle} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <View style={styles.todayClassMetaRow}>
                            <Clock size={13} color="#64748B" />
                            <Text style={styles.todayClassMetaText}>{item.time}</Text>
                            <Text style={styles.todayClassMetaDot}>·</Text>
                            <Calendar size={13} color="#64748B" />
                            <Text style={styles.todayClassMetaText}>{item.dateLabel}</Text>
                          </View>
                          {item.teacher ? (
                            <Text style={styles.todayClassTeacherText}>GV: {item.teacher}</Text>
                          ) : null}
                        </View>

                        {item.meetLink ? (
                          <Pressable
                            onPress={() => Linking.openURL(item.meetLink)}
                            style={styles.todayJoinBtn}
                            accessibilityRole="button"
                          >
                            <Video size={14} color="#FFFFFF" />
                            <Text style={styles.todayJoinBtnText}>Vào Meet</Text>
                          </Pressable>
                        ) : (
                          <View style={styles.todayNoLinkBadge}>
                            <Text style={styles.todayNoLinkText}>Chưa có link</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.todayEmptyBox}>
                    <Calendar size={24} color="#94A3B8" />
                    <Text style={styles.todayEmptyTitle}>Hôm nay không có lịch</Text>
                    {firstSchedule ? (
                      <Text style={styles.todayEmptySub}>
                        Lịch tới: {firstSchedule.title || 'Buổi học'} · {firstSchedule.time} ({firstSchedule.dateLabel})
                      </Text>
                    ) : nextMeet ? (
                      <Text style={styles.todayEmptySub}>
                        Lịch Meet tới: {nextMeet.slotLabel || 'Lớp Meet'} · {nextMeet.startTime}–{nextMeet.endTime} ({nextMeet.dayLabel})
                      </Text>
                    ) : (
                      <Text style={styles.todayEmptySub}>Hãy dành thời gian tự luyện tập hằng ngày nhé!</Text>
                    )}
                  </View>
                )}
              </Card>
              {!freePortalCourse && Boolean(currentCourse) ? (
                <Card style={styles.ovCard}>
                  <View style={styles.ovHeadRow}>
                    <BookOpen size={18} color={colors.brand} />
                    <Text style={[styles.ovTitle, styles.flex]}>Khóa học của tôi</Text>
                  </View>
                  <CompactCoursePicker items={coursePickerItems} activeName={currentCourse} onChange={setSelectedCourse} showProgress={false} />
                  {coursePickerItems.length <= 1 ? (
                    <Text numberOfLines={2} style={styles.ovCourseName}>{currentCourse || 'Chưa có khóa học'}</Text>
                  ) : null}
                  <ProgressBar
                    value={
                      isVideoCourse
                        ? (videoTotal > 0 ? Math.round((videoDone / videoTotal) * 100) : 0)
                        : (studentProgress ?? 0)
                    }
                  />
                  <Text style={styles.ovCourseMeta}>
                    {(isVideoCourse
                      ? [
                        videoTotal > 0 ? `${videoDone}/${videoTotal} bài · ${Math.round((videoDone / videoTotal) * 100)}%` : 'Khóa video tự học',
                        videoTotal > 0 ? `Còn ${Math.max(0, videoTotal - videoDone)} bài` : '',
                      ]
                      : [
                        sessionCountsAvailable ? `${completedSessions}/${totalSessions} buổi · ${studentProgress ?? 0}%` : '',
                        sessionCountsAvailable ? `Còn ${Math.max(0, (totalSessions || 0) - (completedSessions || 0))} buổi` : '',
                        (currentEnrollment?.avgGrade ?? user?.avgGrade) != null ? `Điểm TB ${currentEnrollment?.avgGrade ?? user?.avgGrade}/10` : '',
                        currentEnrollment?.teacherName ? `GV: ${currentEnrollment.teacherName}` : '',
                      ]
                    ).filter(Boolean).join('  ·  ') || 'Tiến độ sẽ cập nhật sau buổi học đầu tiên.'}
                  </Text>
                  <View style={styles.ovButtonRow}>
                    {isVideoCourse ? (
                      <Pressable
                        onPress={() => tabNavigation.navigate('CourseVideos')}
                        style={styles.ovPrimary}
                        accessibilityRole="button"
                      >
                        <Video size={15} color="#FFFFFF" />
                        <Text style={styles.ovPrimaryText}>
                          {videoNextSubject ? `Học tiếp: ${videoNextSubject.name}` : 'Vào học'}
                        </Text>
                      </Pressable>
                    ) : (
                      <>
                        <Pressable onPress={() => tabNavigation.navigate('CourseVideos')} style={styles.ovPrimary} accessibilityRole="button">
                          <Video size={15} color="#FFFFFF" />
                          <Text style={styles.ovPrimaryText}>Vào bài học</Text>
                        </Pressable>
                        <Pressable onPress={() => tabNavigation.navigate('Schedule')} style={styles.ovSecondary} accessibilityRole="button">
                          <Calendar size={15} color={colors.ink} />
                          <Text style={styles.ovSecondaryText}>Lịch học</Text>
                        </Pressable>
                      </>
                    )}
                  </View>
                </Card>
              ) : null}

              <Card style={styles.ovCard}>
                <View style={styles.ovHeadRow}>
                  <CheckCircle size={18} color={colors.brand} />
                  <Text style={styles.ovTitle}>Việc cần làm hôm nay</Text>
                </View>
                {studentTasks.length
                  ? studentTasks.map(({ key, ...task }) => <OverviewTaskRow key={key} {...task} />)
                  : <OverviewDoneBox title="Hôm nay bạn đã hoàn thành hết việc!" text="Không còn bài tập, trắc nghiệm hay lượt luyện tập nào đang chờ." />}
              </Card>

              <DailyPracticeOverviewCard
                stats={practiceStats || null}
                pathTopic={pathData?.topics?.[0] || null}
              />

              {/* Hoạt động gần đây - Đã ẩn trên Web và Mobile theo yêu cầu */}
              {false && (
                <Card style={styles.ovCard}>
                  <View style={styles.ovHeadRow}>
                    <ClipboardList size={18} color="#059669" />
                    <Text style={[styles.ovTitle, styles.flex]}>Hoạt động gần đây</Text>
                    <Pressable
                      onPress={() => {
                        if (!freeMenu) tabNavigation.navigate('Schedule');
                        else navigation?.navigate('Grades');
                      }}
                      accessibilityRole="button"
                    >
                      <Text style={styles.ovLink}>{freeMenu ? 'Xem tất cả' : 'Xem nhật ký đầy đủ'}</Text>
                    </Pressable>
                  </View>
                  {assignments.loading || quizzes.loading || evaluationActivity.loading || profile.loading
                    ? <Text style={styles.muted}>Đang tải…</Text>
                    : gradeEntries.length ? gradeEntries.slice(0, 5).map((item) => (
                      <View key={`student-grade-${item.id}`} style={styles.gradeRow}>
                        <Text style={styles.gradeRowTitle}>{item.note}</Text>
                        <Text style={styles.gradeRowMeta}>{item.date}{item.grade == null ? '' : `  ·  Điểm: ${item.grade}`}</Text>
                      </View>
                    )) : <Text style={styles.muted}>Điểm bài tập, trắc nghiệm và nhận xét của giảng viên sẽ hiện tại đây.</Text>}
                </Card>
              )}
            </View>

            {!user?.previewMode ? (
              <View style={isWide ? styles.studentColRight : styles.studentColStack}>
                <LmsGoalMergedCard />
              </View>
            ) : null}
          </View>
        </>
      )}
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
function OverviewTaskRow({ icon: Icon, tone, title, sub, cta, onPress }: Omit<OverviewTask, 'key'>) {
  return (
    <Pressable onPress={onPress} style={styles.ovTask} accessibilityRole="button" accessibilityLabel={`${title}. ${cta}`}>
      <View style={[styles.ovTaskIcon, { backgroundColor: tone }]}><Icon size={19} color="#FFFFFF" /></View>
      <View style={styles.flex}>
        <Text numberOfLines={1} style={styles.cardTitle}>{title}</Text>
        {sub ? <Text numberOfLines={1} style={styles.muted}>{sub}</Text> : null}
      </View>
      <View style={styles.ovTaskCta}>
        <Text style={styles.ovTaskCtaText}>{cta}</Text>
        <ChevronRight size={14} color={colors.brand} />
      </View>
    </Pressable>
  );
}

function OverviewDoneBox({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.ovDone}>
      <CheckCircle size={26} color="#10B981" />
      <Text style={styles.ovDoneTitle}>{title}</Text>
      <Text style={styles.ovDoneText}>{text}</Text>
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
  ovTaskIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ovTaskCta: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  ovTaskCtaText: { color: colors.brand, fontSize: 12, fontWeight: '900' },
  ovDone: { alignItems: 'center', gap: 4, paddingVertical: spacing.lg, borderRadius: 14, backgroundColor: '#ECFDF5' },
  ovDoneTitle: { color: '#047857', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  ovDoneText: { color: '#059669', fontSize: 12, textAlign: 'center', paddingHorizontal: spacing.md },
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
    flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.sm,
    borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  ovStatIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ovStatValue: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  ovStatLabel: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  ovCourseName: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  ovCourseMeta: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  ovButtonRow: { flexDirection: 'row', gap: spacing.sm },
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
  studentScreen: { paddingTop: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.md, backgroundColor: '#F5F8FC' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: '#DFEAF2', backgroundColor: '#F0F6FA' },
  greetingIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand, borderWidth: 1, borderColor: '#FCA5A5', shadowColor: colors.brandDark, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
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
  liveClassEyebrow: { color: '#FECACA', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.7 },
  liveClassTitle: { color: '#FFFFFF', fontSize: typography.small, fontWeight: '800' },
  liveClassTime: { color: '#FEF08A', fontSize: typography.caption, fontWeight: '800', marginTop: 2 },
  liveClassCopy: { color: '#FEE2E2' },
  liveClassNoLink: { color: '#FEE2E2', fontSize: typography.micro, fontWeight: '700' },
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
  quizTodo: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  homeworkTodo: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  scheduleTodo: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  messagesTodo: { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' },
  todoCardIcon: { width: 36, height: 36, flexShrink: 0, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  todoBadge: { position: 'absolute', top: -7, right: -8, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, textAlign: 'center', overflow: 'hidden', backgroundColor: colors.brand, color: '#FFFFFF', fontSize: typography.micro, lineHeight: 20, fontWeight: '900', borderWidth: 2, borderColor: '#FFFFFF' },
  quizTodoIcon: { backgroundColor: '#E11D48' },
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
});
