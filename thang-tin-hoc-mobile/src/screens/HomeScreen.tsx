import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, DeviceEventEmitter, Easing, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  ArrowRight, Award, BookOpen, Bot, Calendar, CalendarDays, CheckCircle, ChevronRight, ClipboardCheck, ClipboardList,
  Clock, Clock3, Download, ExternalLink, FileText, GraduationCap, MessageCircle, MessageSquare, Sparkles, Star, TrendingUp, Users,
  WalletCards, UserPlus, Trophy, Video, Zap,
} from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../app/AuthContext';
import { Avatar, AppScreen, Card, ErrorState, LoadingSkeleton, SectionHeading, StatusBadge, ProgressBar } from '../components/ui';
import {
  assignmentService, evaluationService, materialService, messageService,
  quizService, scheduleService, studentProfileService, studentService,
} from '../services/mockService';
import { useMockResource } from '../hooks/useMockResource';
import { SOCKET_EVENTS } from '../services/socketService';
import { getDashboardBanners } from '../services/webSettingsApi';
import { getMobileImageSource } from '../services/apiClient';
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

async function openDashboardLink(url: string) {
  try {
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert('Không thể mở liên kết', error instanceof Error ? error.message : 'Vui lòng thử lại.');
  }
}

export function HomeScreen() {
  const { user } = useAuth();
  const tabNavigation = useNavigation<TabNavigation>();
  const navigation = tabNavigation.getParent<RootNavigation>();
  const { width } = useWindowDimensions();
  const isTeacher = user?.role === 'teacher';
  const [selectedCourse, setSelectedCourse] = useState('');
  const [bannerIndex, setBannerIndex] = useState(0);
  const [failedBannerImages, setFailedBannerImages] = useState<string[]>([]);
  const supportBotMotion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const motion = Animated.loop(Animated.sequence([
      Animated.timing(supportBotMotion, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(supportBotMotion, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    motion.start();
    return () => motion.stop();
  }, [supportBotMotion]);
  const schedulesLoader = useCallback(() => scheduleService.list(isTeacher ? 'teacher' : 'student'), [isTeacher]);
  const assignmentsLoader = useCallback(() => assignmentService.list(isTeacher ? 'teacher' : 'student', user), [isTeacher, user]);
  const studentsLoader = useCallback(() => studentService.assigned(user), [user]);
  const teacherMetricsLoader = useCallback(() => isTeacher && user
    ? getTeacherDashboardMetrics(user)
    : Promise.resolve(null), [isTeacher, user]);
  const profileLoader = useCallback(() => !isTeacher && user
    ? studentProfileService.get(user)
    : Promise.resolve(null), [isTeacher, user]);
  const bannersLoader = useCallback(() => getDashboardBanners(isTeacher ? 'teacher' : 'student'), [isTeacher]);
  const materialsLoader = useCallback(() => materialService.list(user), [user]);
  const quizzesLoader = useCallback(() => !isTeacher && user
    ? quizService.studentList(user)
    : Promise.resolve([]), [isTeacher, user]);
  const evaluationActivityLoader = useCallback(() => isTeacher || !user
    ? Promise.resolve([])
    : evaluationService.activity(user), [isTeacher, user]);
  const messagesLoader = useCallback(() => messageService.conversations(isTeacher ? 'teacher' : 'student', user), [isTeacher, user]);
  const schedules = useMockResource(schedulesLoader);
  const assignments = useMockResource(assignmentsLoader);
  const students = useMockResource(studentsLoader);
  const teacherMetrics = useMockResource(teacherMetricsLoader);
  const profile = useMockResource(profileLoader);
  const banners = useMockResource(bannersLoader);
  const materials = useMockResource(materialsLoader);
  const quizzes = useMockResource(quizzesLoader);
  const evaluationActivity = useMockResource(evaluationActivityLoader);
  const messages = useMockResource(messagesLoader);
  useFocusEffect(useCallback(() => {
    schedules.reload();
    assignments.reload();
    students.reload();
    teacherMetrics.reload();
    profile.reload();
    banners.reload();
    materials.reload();
    quizzes.reload();
    evaluationActivity.reload();
    messages.reload();
  }, [
    assignments.reload, banners.reload, materials.reload, messages.reload,
    evaluationActivity.reload, profile.reload, quizzes.reload, schedules.reload, students.reload, teacherMetrics.reload,
  ]));
  useEffect(() => {
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_RECEIVED, messages.reload),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_SENT_ACK, messages.reload),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_NEW, schedules.reload),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_UPDATED, schedules.reload),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_CANCELLED, schedules.reload),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [messages.reload, schedules.reload]);

  const studentEnrollments = profile.data?.enrollments || user?.enrollments || [];
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
  const dashboardMaterials = useMemo(() => (materials.data || []).filter((item) => {
    if (isTeacher || !currentEnrollment) return true;
    const selected = normalizeDashboardCourse(currentCourse);
    const itemCourse = normalizeDashboardCourse(item.courseName || '');
    if (itemCourse && itemCourse !== selected) return false;
    if (item.courseId && currentEnrollment.courseId && item.courseId !== currentEnrollment.courseId) return false;
    if (item.subjectIds?.length && currentEnrollment.subjectIds?.length) {
      return item.subjectIds.some((id) => currentEnrollment.subjectIds?.includes(id));
    }
    return true;
  }), [currentCourse, currentEnrollment, isTeacher, materials.data]);
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
  const studentJoinUrl = firstSchedule?.meetingUrl
    || (typeof profile.data?.student?.linkHoc === 'string' ? profile.data.student.linkHoc : '')
    || (typeof profile.data?.student?.joinClassUrl === 'string' ? profile.data.student.joinClassUrl : '')
    || '';
  const assignmentsToGrade = assignments.data?.filter((item) => item.status === 'Cần chấm') || [];
  const pendingAssignments = studentAssignments.filter((item) => item.mySubmission
    ? false
    : item.status === 'Chưa làm' || item.status === 'Quá hạn');
  const unreadMessages = messages.data?.reduce((count, item) => count + item.unread, 0);
  const now = Date.now();
  const pendingQuizCount = (quizzes.data || []).filter((quiz) => {
    if (quiz.mySubmission) return false;
    const deadline = quiz.deadline ? new Date(quiz.deadline).getTime() : null;
    return deadline == null || !Number.isFinite(deadline) || deadline > now;
  }).length;
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
  const [currentBannerSet, setCurrentBannerSet] = useState('');
  const bannerRole = isTeacher ? 'teacher' : 'student';
  const bannerItems = banners.data?.banners || [];
  const availableBannerItems = bannerItems.filter((banner) => !failedBannerImages.includes(banner.imageUrl));
  const activeBannerIndex = availableBannerItems.length ? bannerIndex % availableBannerItems.length : 0;
  useEffect(() => {
    if (currentBannerSet !== bannerRole) {
      setBannerIndex(0);
      setFailedBannerImages([]);
      setCurrentBannerSet(bannerRole);
    }
  }, [bannerRole, currentBannerSet]);
  useEffect(() => {
    if (availableBannerItems.length && bannerIndex >= availableBannerItems.length) setBannerIndex(0);
  }, [availableBannerItems.length, bannerIndex]);
  useEffect(() => {
    if (availableBannerItems.length < 2) return undefined;
    const interval = setInterval(
      () => setBannerIndex((index) => (index + 1) % availableBannerItems.length),
      (banners.data?.speedSeconds || 5) * 1000,
    );
    return () => clearInterval(interval);
  }, [availableBannerItems.length, banners.data?.speedSeconds]);
  const quickActions = [
    { title: 'Bảng tin', icon: MessageCircle, route: 'Feed' as const, tint: colors.blueSoft, tone: colors.blue },
    { title: 'Giao bài tập & kiểm tra', icon: FileText, route: 'Assignments' as const, tint: colors.goldSoft, tone: '#B7791F' },
    { title: 'Khóa đào tạo', icon: GraduationCap, route: 'TeacherTraining' as const, tint: colors.purpleSoft, tone: colors.purple },
    { title: 'Tài chính', icon: WalletCards, route: 'TeacherFinance' as const, tint: colors.greenSoft, tone: colors.green },
  ];
  const todayDate = new Date();
  const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`;
  const teacherTodaySchedules = (schedules.data || [])
    .filter((item) => item.date === todayKey && scheduleIsCurrentOrFuture(item))
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  const upcomingTeacherSchedules = (schedules.data || [])
    .filter((item) => scheduleIsCurrentOrFuture(item) && item.date?.slice(0, 7) === todayKey.slice(0, 7))
    .sort((a, b) => `${a.date} ${a.startTime || ''}`.localeCompare(`${b.date} ${b.startTime || ''}`));
  const upcomingStudentSchedules = studentSchedules.filter(scheduleIsCurrentOrFuture);
  const newStudentsThisMonth = (students.data || []).filter((student) => (
    (student.enrollments || []).some((enrollment) => {
      const dateText = enrollment.registeredAt || '';
      const match = dateText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      const registeredAt = match
        ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
        : new Date(dateText);
      return Number.isFinite(registeredAt.getTime())
        && registeredAt.getTime() >= Date.now() - 30 * 24 * 60 * 60 * 1000;
    })
  )).length;

  return (
    <AppScreen contentStyle={isTeacher ? styles.screen : styles.studentScreen}>
      <View style={styles.topRow}>
        <View style={styles.greetingIcon}>
          <GraduationCap size={27} color="#FFFFFF" strokeWidth={2.6} />
        </View>
        <View style={styles.greeting}>
          <Text style={styles.greetingMeta}>{isTeacher ? 'Không gian giảng dạy' : 'Trung tâm Thắng Tin Học'}</Text>
          <Text style={styles.greetingTitle}>{isTeacher ? `Chào mừng, ${user?.name || 'Giảng viên'}!` : `Chào mừng, ${user?.name}! 👋`}</Text>
          <Text style={styles.greetingSub}>{isTeacher ? 'Ưu tiên điểm danh, lịch dạy và học viên được phân công.' : '“Học hôm nay, thành công mai sau.”'}</Text>
        </View>
      </View>

      {schedules.loading || assignments.loading || students.loading || (isTeacher && teacherMetrics.loading) || (!isTeacher && (profile.loading || materials.loading || quizzes.loading || evaluationActivity.loading || messages.loading))
        ? <LoadingSkeleton rows={1} />
        : null}
      {schedules.error || assignments.error || students.error || (isTeacher && teacherMetrics.error) || (!isTeacher && (profile.error || materials.error || quizzes.error || evaluationActivity.error || messages.error)) ? (
        <ErrorState onRetry={() => {
          schedules.reload();
          assignments.reload();
          students.reload();
          teacherMetrics.reload();
          profile.reload();
          banners.reload();
          materials.reload();
          quizzes.reload();
          evaluationActivity.reload();
          messages.reload();
        }} />
      ) : null}
      {availableBannerItems.length ? (
        <View style={styles.bannerWrap}>
          <Pressable
            onPress={() => {
              const link = availableBannerItems[activeBannerIndex]?.linkUrl;
              if (link) void openDashboardLink(link);
            }}
            accessibilityRole="button"
            accessibilityLabel="Mở banner trang tổng quan"
          >
            <Image
              source={getMobileImageSource(availableBannerItems[activeBannerIndex].imageUrl)}
              style={styles.dashboardBanner}
              resizeMode="cover"
              accessibilityLabel="Banner trang tổng quan"
              onError={() => setFailedBannerImages((failed) => (
                failed.includes(availableBannerItems[activeBannerIndex].imageUrl)
                  ? failed
                  : [...failed, availableBannerItems[activeBannerIndex].imageUrl]
              ))}
            />
          </Pressable>
          {availableBannerItems.length > 1 ? (
            <View style={styles.bannerDots}>
              {availableBannerItems.map((banner, index) => (
                <Pressable
                  key={`${banner.imageUrl}-${index}`}
                  onPress={() => setBannerIndex(index)}
                  style={[styles.bannerDot, index === activeBannerIndex && styles.bannerDotActive]}
                  accessibilityRole="button"
                  accessibilityLabel={`Hiển thị banner ${index + 1}`}
                  accessibilityState={{ selected: index === activeBannerIndex }}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : bannerItems.length ? (
        <Text style={styles.inlineError}>Không tải được hình banner trang tổng quan.</Text>
      ) : banners.error ? (
        <Text style={styles.inlineError}>Không tải được banner trang tổng quan.</Text>
      ) : null}

      {isTeacher ? (
        <>
          {firstSchedule && scheduleIsLive(firstSchedule) ? (
            <Pressable
              onPress={() => firstSchedule.meetingUrl && void openDashboardLink(firstSchedule.meetingUrl)}
              style={styles.liveClassCard}
              accessibilityRole="button"
              accessibilityLabel={`Ca dạy đang diễn ra với ${firstSchedule.studentName || 'học viên'}`}
            >
              <View style={styles.liveClassIcon}><Video size={20} color="#FFFFFF" /></View>
              <View style={styles.flex}>
                <Text style={styles.liveClassEyebrow}>Ca dạy đang diễn ra</Text>
                <Text numberOfLines={1} style={styles.liveClassTitle}>{firstSchedule.studentName || 'Học viên'} · {firstSchedule.courseName || firstSchedule.subject}</Text>
                <Text style={styles.liveClassTime}>{firstSchedule.time}</Text>
              </View>
              {firstSchedule.meetingUrl ? <ExternalLink size={19} color="#FFFFFF" /> : <Text style={styles.liveClassNoLink}>Chưa có link</Text>}
            </Pressable>
          ) : null}
          <View style={styles.sectionWrap}>
            <SectionHeading title="Công việc cần xử lý ngay" />
            <View style={styles.teacherActionGrid}>
              {[
                {
                  title: 'Điểm danh',
                  detail: schedules.loading ? '—' : `${teacherTodaySchedules.length} buổi hôm nay`,
                  icon: ClipboardCheck,
                  iconColor: colors.green,
                  onPress: () => navigation?.navigate('Attendance', {
                    scheduleId: teacherTodaySchedules[0]?.id,
                  }),
                  tint: colors.greenSoft,
                },
                {
                  title: 'Chấm điểm',
                  detail: assignments.loading ? '—' : assignmentsToGrade.length ? `${assignmentsToGrade.length} HV chờ chấm điểm` : 'Không có bài chờ chấm',
                  icon: FileText,
                  iconColor: '#B7791F',
                  onPress: () => navigation?.navigate('Assignments'),
                  tint: colors.goldSoft,
                },
                {
                  title: 'Tin nhắn',
                  detail: messages.loading ? '—' : unreadMessages ? `${unreadMessages} tin chưa đọc` : 'Không có tin mới',
                  icon: MessageCircle,
                  iconColor: colors.purple,
                  onPress: () => tabNavigation.navigate('Messages'),
                  tint: colors.purpleSoft,
                },
                {
                  title: 'Xếp lịch',
                  detail: 'Thêm buổi dạy mới',
                  icon: CalendarDays,
                  iconColor: colors.blue,
                  onPress: () => tabNavigation.navigate('Schedule'),
                  tint: colors.blueSoft,
                },
              ].map(({ title, detail, icon: Icon, iconColor, onPress, tint }) => (
                <Pressable
                  key={title}
                  onPress={onPress}
                  style={[styles.teacherAction, { width: width < 360 ? '100%' : '48%', backgroundColor: tint }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${title}. ${detail}`}
                >
                  <View style={styles.teacherActionTop}>
                    <View style={[styles.teacherActionIcon, { borderColor: `${iconColor}30` }]}><Icon size={22} color={iconColor} strokeWidth={2.6} /></View>
                    <ArrowRight size={17} color={colors.muted} />
                  </View>
                  <Text style={styles.cardTitle}>{title}</Text>
                  <Text numberOfLines={2} style={styles.muted}>{detail}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Lịch dạy trong tháng" action="Xem lịch" onPress={() => tabNavigation.navigate('Schedule')} />
            {upcomingTeacherSchedules.slice(0, 3).map((item) => (
              <Pressable key={item.id} onPress={() => tabNavigation.navigate('Schedule')} style={styles.upcomingSessionRow} accessibilityRole="button">
                <View style={styles.upcomingDate}>
                  <Text style={styles.upcomingDateDay}>{item.date?.slice(8, 10)}</Text>
                  <Text style={styles.upcomingDateMonth}>{item.date?.slice(5, 7)}</Text>
                </View>
                <View style={styles.flex}>
                  <Text numberOfLines={1} style={styles.cardTitle}>{item.studentName || item.courseName || 'Buổi dạy'}</Text>
                  <Text numberOfLines={1} style={styles.muted}>{item.startTime || item.time} · {item.courseName || item.subject}</Text>
                </View>
                <ArrowRight size={16} color={colors.muted} />
              </Pressable>
            ))}
            {!upcomingTeacherSchedules.length ? <Card><Text style={styles.muted}>Chưa có lịch dạy sắp tới.</Text></Card> : null}
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Bài tập cần chấm" action="Mở danh sách" onPress={() => navigation?.navigate('Assignments')} />
            {!assignments.loading && !assignments.error && assignmentsToGrade.length ? (
              <Card style={styles.reviewCard}>
                <View style={styles.reviewIcon}><ClipboardCheck size={22} color="#FFFFFF" strokeWidth={2.5} /></View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{assignmentsToGrade.length} bài nộp đang chờ</Text>
                  <Text style={styles.muted}>Cập nhật từ {assignmentsToGrade[0].subject}</Text>
                </View>
                <ArrowRight size={18} color={colors.muted} />
              </Card>
            ) : null}
            {!assignments.loading && !assignments.error && !assignmentsToGrade.length
              ? <Card><Text style={styles.muted}>{assignments.data ? 'Không có bài nộp cần chấm.' : '—'}</Text></Card>
              : null}
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Tổng quan tháng này" />
            <View style={styles.teacherStatsGrid}>
              {[
                { label: `Thu nhập T${todayDate.getMonth() + 1}`, value: teacherMetrics.data ? formatCurrency(teacherMetrics.data.monthlyIncome) : '—', detail: 'Chi tiết thu nhập', icon: WalletCards, iconTint: colors.blue, iconBackground: colors.blueSoft, route: 'TeacherFinance' as const },
                { label: 'Đang dạy', value: students.data ? String(students.data.filter((student) => student.enrollmentStatus === 'active').length) : '—', detail: 'học viên', icon: Users, iconTint: '#4F46E5', iconBackground: '#EEF2FF', route: 'Students' as const },
                { label: 'HV mới', value: students.data ? String(newStudentsThisMonth) : '—', detail: 'trong 30 ngày', icon: UserPlus, iconTint: colors.purple, iconBackground: colors.purpleSoft, route: 'Students' as const },
                { label: '5 sao', value: teacherMetrics.data ? `${teacherMetrics.data.fiveStarStudentCount}/5` : '—', detail: teacherMetrics.data?.fiveStarStudentCount && teacherMetrics.data.fiveStarStudentCount >= 5 ? 'Đạt trong tháng này' : 'Trong tháng này', icon: Award, iconTint: '#D97706', iconBackground: colors.goldSoft, route: 'Students' as const },
                { label: 'Uy tín', value: teacherMetrics.data?.ratingAverage ? String(teacherMetrics.data.ratingAverage) : '—', detail: `${teacherMetrics.data?.ratingCount || 0} đánh giá`, icon: Star, iconTint: colors.green, iconBackground: colors.greenSoft, route: 'Students' as const },
              ].map(({ label, value, detail, icon: Icon, iconTint, iconBackground, route }, index) => (
                <Pressable
                  key={label}
                  onPress={() => route === 'TeacherFinance' ? navigation?.navigate(route) : tabNavigation.navigate(route)}
                  style={[
                    styles.teacherStatCard,
                    width < 640 && index === 4 ? styles.teacherStatCardWide : null,
                    { padding: width < 360 ? spacing.sm : spacing.md },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${label}: ${value}. ${detail}`}
                >
                  <View style={[styles.teacherStatTop, width < 640 && index === 4 ? styles.teacherStatTopWide : null]}>
                    <View style={[styles.teacherStatIcon, { backgroundColor: iconBackground }]}><Icon size={20} color={iconTint} strokeWidth={2.5} /></View>
                    <Text numberOfLines={2} style={styles.teacherStatLabel}>{label}</Text>
                  </View>
                  <View style={[styles.teacherStatValueGroup, width < 640 && index === 4 ? styles.teacherStatValueGroupWide : null]}>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={styles.teacherStatValue}>{value}</Text>
                    <Text style={styles.muted}>{detail}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Học viên được phân công" action="Xem tất cả" onPress={() => tabNavigation.navigate('Students')} />
            {students.data?.filter((student) => student.enrollmentStatus === 'active').slice(0, 3).map((student) => (
              <Card key={student.id} style={styles.teacherStudentCard}>
                <Avatar name={student.name} color={student.color} size={42} />
                <View style={styles.flex}>
                  <View style={styles.taskTop}>
                    <Text numberOfLines={1} style={styles.cardTitle}>{student.name}</Text>
                    <StatusBadge label={student.status} />
                  </View>
                  <Text numberOfLines={1} style={styles.muted}>{student.course} · {student.completedSessions != null && student.totalSessions != null ? `${student.completedSessions}/${student.totalSessions} buổi` : '— buổi'}</Text>
                  {student.progress != null ? <ProgressBar value={student.progress} /> : <Text style={styles.muted}>Tiến độ: —</Text>}
                </View>
              </Card>
            ))}
            {!students.loading && !students.error && !students.data?.some((student) => student.enrollmentStatus === 'active') ? (
              <Card><Text style={styles.muted}>Chưa được phân công học viên nào.</Text></Card>
            ) : null}
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Đánh giá từ học viên" />
            {teacherMetrics.data?.recentRatings.length ? teacherMetrics.data.recentRatings.slice(0, 2).map((rating) => (
              <Card key={rating.id || `${rating.studentName}-${rating.createdAt}`} style={styles.ratingCard}>
                <View style={styles.ratingTop}>
                  <Text style={styles.cardTitle}>{rating.studentName}</Text>
                  <Text style={styles.ratingStars}>{'★'.repeat(Math.max(0, Math.min(5, rating.stars)))}</Text>
                </View>
                {rating.comment ? <Text style={styles.muted}>{rating.comment}</Text> : <Text style={styles.muted}>Chưa có nhận xét.</Text>}
              </Card>
            )) : (
              <Card><Text style={styles.muted}>Chưa có đánh giá từ học viên.</Text></Card>
            )}
          </View>
        </>
      ) : (
        <>
          {courseOptions.length > 1 ? (
            <View style={styles.courseSwitcher}>
              <Text style={styles.courseSwitcherLabel}>Khóa học của bạn</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.courseSwitcherList}>
                {courseOptions.map((enrollment) => {
                  const active = enrollment.courseName === currentCourse;
                  const completed = enrollment.status === 'Hoàn thành'
                    || ((enrollment.totalSessions ?? 0) > 0
                      && (enrollment.completedSessions || 0) >= (enrollment.totalSessions ?? 0));
                  const total = enrollment.totalSessions ?? 12;
                  const done = enrollment.completedSessions ?? 0;
                  const progress = enrollment.progress ?? (total > 0 ? Math.round(done / total * 100) : 0);
                  const progressWidth = `${Math.min(100, Math.max(0, progress))}%` as `${number}%`;
                  return (
                    <Pressable
                      key={enrollment.id}
                      onPress={() => setSelectedCourse(enrollment.courseName)}
                      style={[styles.courseCard, active && styles.courseCardActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text numberOfLines={2} style={[styles.coursePillText, active && styles.coursePillTextActive]}>{enrollment.courseName}</Text>
                      {completed ? <Text style={styles.courseCompleted}>Đã hoàn thành</Text> : null}
                      <Text numberOfLines={1} style={styles.courseTeacher}>GV: {enrollment.teacherName || 'Chưa phân công'}</Text>
                      <View style={styles.courseProgressTrack}>
                        <View style={[styles.courseProgress, { width: progressWidth }, completed && styles.courseProgressCompleted, active && styles.courseProgressActive]} />
                      </View>
                      <View style={styles.courseProgressMeta}>
                        <Text style={styles.courseProgressText}>{done}/{total} buổi</Text>
                        <Text style={styles.courseProgressText}>{Math.min(100, Math.max(0, progress))}%</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          <View style={styles.studentCourseCard}>
            <View style={styles.studentCourseTop}>
              <View style={styles.studentCourseStatus}>
                {firstScheduleIsLive ? <Video size={14} color="#FCA5A5" /> : firstSchedule ? <Zap size={14} color="#FCA5A5" /> : <Calendar size={14} color="#FCA5A5" />}
                <Text style={styles.studentCourseEyebrow}>
                  {firstScheduleIsLive ? 'Buổi học đang diễn ra' : firstSchedule ? 'Lớp học sắp diễn ra' : 'Chưa có lịch sắp tới'}
                </Text>
              </View>
            </View>
            <Text numberOfLines={2} style={styles.studentCourseTitle}>{currentCourse || firstSchedule?.courseName || '—'}</Text>
            {firstSchedule ? (
              <View style={styles.studentCourseMetaRow}>
                <Clock size={16} color="#FDE68A" />
                <Text style={styles.studentCourseCopy}>{firstSchedule.time} · {firstSchedule.dateLabel}</Text>
              </View>
            ) : <Text style={styles.studentCourseCopy}>Lịch học mới sẽ hiển thị tại đây.</Text>}
            <View style={styles.studentCourseFooter}>
              <Calendar size={15} color="#CBD5E1" />
              <Text numberOfLines={1} style={styles.studentCourseTeacher}>GV: {currentEnrollment?.teacherName || user?.teacherName || firstSchedule?.teacherName || firstSchedule?.person || '—'}</Text>
              {user?.teacherRating ? <Text style={styles.studentRating}>★ {user.teacherRating}</Text> : null}
            </View>
            {firstScheduleIsLive ? (
              <Pressable onPress={() => studentJoinUrl && void openDashboardLink(studentJoinUrl)} style={styles.studentJoinAction} accessibilityRole="button">
                <Video size={16} color="#B91C1C" />
                <Text style={styles.studentJoinActionText}>{studentJoinUrl ? 'Vào lớp ngay' : 'Chưa có link học'}</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.studentKpiGrid}>
            {[
              { label: 'Đã học', value: sessionCountsAvailable ? `${completedSessions} / ${totalSessions}` : '—', sub: 'buổi', icon: BookOpen, iconBackground: '#EF4444', tone: colors.red },
              { label: 'Còn lại', value: sessionCountsAvailable ? String(Math.max(0, totalSessions - completedSessions)) : '—', sub: 'buổi', icon: Clock, iconBackground: '#1E3A8A', tone: colors.blue },
              { label: 'Điểm TB', value: (currentEnrollment?.avgGrade ?? user?.avgGrade) == null ? '—' : String(currentEnrollment?.avgGrade ?? user?.avgGrade), sub: '/ 10', icon: Star, iconBackground: '#F97316', tone: '#D97706' },
              { label: 'Tiến độ', value: studentProgress == null ? '—' : `${studentProgress}%`, sub: 'hoàn thành', icon: TrendingUp, iconBackground: '#34D399', tone: colors.green },
            ].map(({ label, value, sub, icon: Icon, iconBackground, tone }) => (
              <Card key={label} style={styles.studentKpi}>
                <View style={[styles.studentKpiIcon, { backgroundColor: iconBackground }]}><Icon size={21} color="#FFFFFF" strokeWidth={2.5} /></View>
                <View style={styles.studentKpiContent}>
                  <Text style={styles.studentKpiLabel}>{label}</Text>
                  <View style={styles.studentKpiMetric}>
                    <Text numberOfLines={1} adjustsFontSizeToFit style={[styles.studentKpiValue, { color: tone }]}>{value}</Text>
                    <Text numberOfLines={1} style={styles.studentKpiUnit}>{sub}</Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          <View style={styles.sectionWrap}>
            <Card style={styles.todoPanel}>
              <View style={styles.todoHeader}>
                <View style={styles.todoHeaderIcon}><Zap size={20} color="#FFFFFF" fill="#FFFFFF" /></View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Việc cần làm hôm nay</Text>
                  <Text style={styles.todoSubtitle}>Các hoạt động đang chờ bạn</Text>
                </View>
                {width >= 640 ? <Text style={styles.todoOverviewPill}>Tổng quan</Text> : null}
              </View>
              <View style={styles.todoCards}>
              {[
              {
                title: 'Trắc nghiệm buổi học',
                detail: quizzes.loading ? '—' : pendingQuizCount ? `${pendingQuizCount} bài chưa làm` : 'Không có bài chờ',
                action: 'Làm ngay',
                icon: Trophy,
                route: 'StudentExam' as const,
                tone: styles.quizTodo,
                iconTone: styles.quizTodoIcon,
                color: '#DC2626',
                badge: pendingQuizCount,
              },
              {
                title: 'Bài tập về nhà',
                detail: assignments.loading ? '—' : `${pendingAssignments.length} bài cần nộp`,
                action: pendingAssignments.length ? 'Nộp ngay' : 'Xem ngay',
                icon: ClipboardList,
                route: 'Assignments' as const,
                tone: styles.homeworkTodo,
                iconTone: styles.homeworkTodoIcon,
                color: '#EA580C',
                badge: pendingAssignments.length,
              },
              {
                title: 'Lịch học sắp tới',
                detail: schedules.loading ? '—' : `${(isTeacher ? upcomingTeacherSchedules : upcomingStudentSchedules).length} buổi sắp tới`,
                action: 'Xem lịch',
                icon: Calendar,
                route: 'Schedule' as const,
                tone: styles.scheduleTodo,
                iconTone: styles.scheduleTodoIcon,
                color: '#2563EB',
                badge: 0,
              },
              {
                title: 'Tin nhắn & Phản hồi',
                detail: messages.loading ? '—' : `${unreadMessages ?? '—'} tin nhắn mới`,
                action: 'Xem ngay',
                icon: MessageSquare,
                route: 'Messages' as const,
                tone: styles.messagesTodo,
                iconTone: styles.messagesTodoIcon,
                color: '#7C3AED',
                badge: unreadMessages ?? 0,
              },
            ].map(({ title, detail, action, icon: Icon, route, tone, iconTone, color, badge }) => (
              <Pressable key={title} onPress={() => {
                if (route === 'Messages' || route === 'Schedule') tabNavigation.navigate(route);
                else navigation?.navigate(route);
              }} accessibilityRole="button" style={[styles.todoCard, tone]}>
                <View style={[styles.todoCardIcon, iconTone]}>
                  <Icon size={24} color="#FFFFFF" strokeWidth={2.4} />
                  {badge > 0 ? <Text style={styles.todoBadge}>{badge > 99 ? '99+' : badge}</Text> : null}
                </View>
                <View style={styles.todoCardContent}>
                  <Text numberOfLines={2} style={styles.todoCardTitle}>{title}</Text>
                  <Text numberOfLines={1} style={[styles.todoDetail, { color }]}>{detail}</Text>
                  <View style={styles.todoCta}><Text style={styles.todoCtaText}>{action}</Text><ChevronRight size={14} color={colors.ink} /></View>
                </View>
              </Pressable>
            ))}
              </View>
            </Card>
          </View>
          <View style={styles.sectionWrap}>
            <View style={styles.materialPanel}>
              <View style={styles.materialHeading}>
                <Download size={16} color="#CBD5E1" />
                <Text style={styles.materialHeadingText}>Tài liệu</Text>
              </View>
              {materials.loading ? <Text style={styles.materialEmpty}>Đang tải tài liệu...</Text> : null}
              {!materials.loading && !materials.error && dashboardMaterials.length ? dashboardMaterials.slice(0, 3).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => item.url ? void openDashboardLink(item.url) : navigation?.navigate('Materials')}
                  accessibilityRole="button"
                  accessibilityLabel={`Mở tài liệu ${item.title}`}
                  style={styles.materialRow}
                >
                  <Text style={[
                    styles.materialType,
                    item.type === 'PDF' ? styles.materialTypePdf : item.type === 'EXCEL' ? styles.materialTypeExcel : styles.materialTypeOther,
                  ]}>{item.type || 'DOC'}</Text>
                  <Text numberOfLines={1} style={styles.materialTitle}>{item.title}</Text>
                  <Download size={16} color="#7DD3FC" />
                </Pressable>
              )) : null}
              {!materials.loading && !materials.error && !dashboardMaterials.length ? (
                <Text style={styles.materialEmpty}>Chưa có tài liệu.</Text>
              ) : null}
              <Pressable onPress={() => navigation?.navigate('Materials')} accessibilityRole="button" style={styles.materialAction}>
                <Text style={styles.materialActionText}>Xem tất cả</Text><ArrowRight size={15} color="#BAE6FD" />
              </Pressable>
            </View>
          </View>
          <View style={styles.sectionWrap}>
            <Card style={styles.gradePanel}>
              <Pressable onPress={() => navigation?.navigate('Grades')} accessibilityRole="button" style={styles.gradeHeading}>
                <View style={styles.gradeHeadingTitle}>
                  <View style={styles.gradeHeadingIcon}><ClipboardList size={17} color="#059669" /></View>
                  <Text numberOfLines={2} style={styles.gradeHeadingText}>Nhật ký học tập &amp; Điểm số</Text>
                </View>
                <Text numberOfLines={1} style={styles.gradeCount}>{assignments.loading || quizzes.loading || evaluationActivity.loading || profile.loading
                  ? '—'
                  : `${gradeEntries.length} lượt ghi nhận`}</Text>
              </Pressable>
              {assignments.loading || quizzes.loading || evaluationActivity.loading || profile.loading
                ? <Text style={styles.muted}>Đang tải nhật ký...</Text>
                : (
                <>
                  {gradeEntries.length ? gradeEntries.slice(0, 3).map((item) => (
                    <View key={`student-grade-${item.id}`} style={styles.gradeRow}>
                    <Text style={styles.gradeRowTitle}>{item.note}</Text>
                    <Text style={styles.gradeRowMeta}>{item.date}{item.grade == null ? '' : `  ·  Điểm: ${item.grade}`}</Text>
                    </View>
                      )) : (
                        <View style={styles.gradeEmpty}>
                          <View style={styles.gradeEmptyIcon}><ClipboardList size={20} color="#CBD5E1" /></View>
                          <Text style={styles.gradeEmptyTitle}>Chưa có dữ liệu điểm số.</Text>
                          <Text style={styles.gradeEmptyCopy}>Bài nộp, trắc nghiệm và điểm sẽ hiện tại đây.</Text>
                        </View>
                      )}
                </>
              )}
            </Card>
          </View>
        </>
      )}

      {isTeacher ? <View style={styles.sectionWrap}>
        <SectionHeading title="Truy cập nhanh" />
        <View style={styles.quickGrid}>
          {quickActions.map(({ title, icon: Icon, route, tint, tone }) => (
            <Pressable
              key={title}
              onPress={() => {
                const routeName = route as string;
                switch (routeName) {
                  case 'Assignments':
                    navigation?.navigate('Assignments');
                    break;
                  case 'Materials':
                    navigation?.navigate('Materials');
                    break;
                  case 'TeacherTraining':
                    navigation?.navigate('TeacherTraining');
                    break;
                  case 'TeacherFinance':
                    navigation?.navigate('TeacherFinance');
                    break;
                  case 'Feed':
                    navigation?.navigate('Feed');
                    break;
                  case 'StudentLearning':
                    navigation?.navigate('StudentLearning');
                    break;
                  case 'Evaluations':
                    navigation?.navigate('Evaluations');
                    break;
                  case 'Schedule':
                    tabNavigation.navigate('Schedule');
                    break;
                  case 'NotificationCenter':
                    navigation?.navigate('NotificationCenter');
                    break;
                  default:
                    break;
                }
              }}
              style={[styles.quickAction, width < 360 && styles.quickActionSmall]}
              accessibilityRole="button"
              accessibilityLabel={title}
            >
              <View style={[styles.quickIcon, { backgroundColor: tint, borderColor: `${tone}25` }]}><Icon size={23} color={tone} strokeWidth={2.5} /></View>
              <Text style={styles.quickTitle}>{title}</Text>
            </Pressable>
          ))}
        </View>
      </View> : null}

      {user && !user.previewMode ? <Pressable
        onPress={() => tabNavigation.navigate('Support')}
        style={styles.helpCard}
        accessibilityRole="button"
        accessibilityLabel="Mở lựa chọn hỗ trợ"
      >
        <View style={styles.helpRobotStage} pointerEvents="none">
          <View style={styles.helpRobotHalo} />
          <Animated.View style={[styles.helpRobot, { transform: [{ translateY: supportBotMotion.interpolate({ inputRange: [0, 1], outputRange: [2, -4] }) }] }]}>
            <Bot size={28} color="#E6FFFB" strokeWidth={1.9} />
          </Animated.View>
          <Sparkles size={14} color="#FDE68A" style={styles.helpRobotSparkle} />
          <View style={styles.helpRobotStatus}><View style={styles.helpRobotStatusDot} /><Text style={styles.helpRobotStatusText}>AI</Text></View>
        </View>
        <View style={styles.flex}>
          <View style={styles.helpTitleRow}>
            <Text style={styles.helpTitle}>Hỗ trợ Thắng Tin Học</Text>
            <View style={styles.helpOnline}><View style={styles.helpOnlineDot} /><Text style={styles.helpOnlineText}>SẴN SÀNG</Text></View>
          </View>
          <Text style={styles.helpText}>Chọn Trợ lý AI hoặc nhân viên hỗ trợ</Text>
        </View>
        <View style={styles.helpArrow}><ArrowRight size={17} color="#FFFFFF" /></View>
      </Pressable> : null}
    </AppScreen>
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
  screen: { paddingTop: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.lg, backgroundColor: '#F5F8FC' },
  studentScreen: { paddingTop: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.md, backgroundColor: '#F5F8FC' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: '#DFEAF2', backgroundColor: '#F0F6FA' },
  greetingIcon: { width: 52, height: 52, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand, borderWidth: 1, borderColor: '#FCA5A5', shadowColor: colors.brandDark, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  greeting: { flex: 1, gap: 4 },
  greetingMeta: { color: colors.brand, fontSize: typography.micro, fontWeight: '800', letterSpacing: 1.1 },
  greetingTitle: { color: '#17314C', fontSize: typography.title, fontWeight: '800', letterSpacing: -0.5 },
  greetingSub: { color: '#63778B', fontSize: typography.small, lineHeight: 19 },
  bannerWrap: { position: 'relative', borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas },
  dashboardBanner: { width: '100%', aspectRatio: 5, minHeight: 72, maxHeight: 150 },
  bannerDots: { position: 'absolute', bottom: spacing.sm, alignSelf: 'center', flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(15, 23, 42, 0.3)' },
  bannerDot: { width: 7, height: 7, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.55)' },
  bannerDotActive: { width: 16, backgroundColor: '#FFFFFF' },
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
  courseSwitcher: { gap: spacing.xs },
  courseSwitcherLabel: { color: colors.muted, fontSize: typography.caption, fontWeight: '800', letterSpacing: 0.5, paddingHorizontal: spacing.xs },
  courseSwitcherList: { gap: spacing.md, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  courseCard: { width: 272, minHeight: 156, justifyContent: 'flex-start', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, gap: spacing.xs },
  courseCardActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  coursePillText: { color: '#1E293B', fontSize: typography.body, fontWeight: '800', lineHeight: 20 },
  coursePillTextActive: { color: '#1E40AF' },
  courseCompleted: { color: '#64748B', fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.6 },
  courseTeacher: { color: colors.muted, fontSize: typography.caption },
  courseProgressTrack: { height: 6, marginTop: spacing.xs, borderRadius: radius.pill, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  courseProgress: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.red },
  courseProgressCompleted: { backgroundColor: colors.green },
  courseProgressActive: { backgroundColor: '#3B82F6' },
  courseProgressMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  courseProgressText: { color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
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
  todoBadge: { position: 'absolute', top: -7, right: -8, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, textAlign: 'center', overflow: 'hidden', backgroundColor: '#DC2626', color: '#FFFFFF', fontSize: typography.micro, lineHeight: 20, fontWeight: '900', borderWidth: 2, borderColor: '#FFFFFF' },
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
