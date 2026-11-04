import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, DeviceEventEmitter, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  Ban, Bell, BookOpen, BookText, CalendarDays, Camera, Check, CheckCircle, ChevronDown, ChevronLeft, ChevronRight, Clock3, Download, FileSpreadsheet,
  FileText, Film, GraduationCap, KeyRound, Landmark, Link2, LogOut, Mail, MapPin, MessageCircle, MoreHorizontal, Phone, Plus, RefreshCw, Save, Search, Send, Settings, Table2, Target, Trash2, UserRound, Users, WalletCards, X,
} from 'lucide-react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../app/AuthContext';
import {
  AppHeader, AppScreen, AssignmentCard, Avatar, Card, EmptyState, ErrorState,
  LoadingSkeleton, MenuRow, PrimaryButton, ProgressBar, SearchField,
  SectionHeading, StatusBadge, uiStyles,
} from '../components/ui';
import { useMockResource } from '../hooks/useMockResource';
import {
  assignmentService, authService, gradeService, learningService, materialService, messageService, notificationService, scheduleService, softwareService, studentProfileService, studentService, teacherProfileService,
} from '../services/mockService';
import { getLastSeenUsersSnapshot, getOnlineUsersSnapshot, SOCKET_EVENTS } from '../services/socketService';
import { getMobileImageSource, resolveMobilePublicUrl } from '../services/apiClient';
import { uploadAndUpdateAvatar } from '../services/avatarApi';
import { PartialAssignmentCreationError, uploadStudentAssignmentFile } from '../services/assignmentApi';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { DemoSoftwareLink } from '../types';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';
import type { AppNotification, Assignment, Conversation, DemoGradeRecord, DemoStudent, DemoUser, LearningMaterial, ScheduleItem } from '../types';
import type { TeacherProfile, TeacherProfileUpdate } from '../services/teacherApi';
import { updateStudentProfile } from '../services/studentApi';
import { buildDirectConversationId } from '../services/messageApi';
import { enableMobilePushNotifications, requestWebNotificationPermission } from '../services/mobilePushNotifications';
import { PinLockSettingsModal } from '../components/pinLock/PinLockSettingsModal';
import { pinUserKey } from '../services/pinLock';
import { OPEN_LEARNING_GOAL_EVENT } from '../services/learningGoalApi';
import type { RawStudent, StudentProfileUpdate, TeacherAssignedStudentDetail } from '../services/studentApi';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
const mobileMakeupRequestsSent = new Set<string>();
const STUDENT_WEEK_CELL_WIDTH = 72;
const TEACHER_WEEK_NAME_CELL_WIDTH = 116;

function getAttendanceBounds(item: ScheduleItem) {
  if (!item.date || item.status === 'cancelled') return null;
  const times = item.time?.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  if (!times) return null;
  const startAt = new Date(`${item.date}T${times[1]}:00+07:00`).getTime();
  const endAt = new Date(`${item.date}T${times[2]}:00+07:00`).getTime();
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt) return null;
  return { startAt, endAt, deadline: endAt + 60 * 60 * 1000 };
}

function isOverdueAttendance(item: ScheduleItem, now = Date.now()) {
  if (!item.attendanceStatus || item.attendanceStatus !== 'pending') return false;
  const bounds = getAttendanceBounds(item);
  return Boolean(bounds && now > bounds.deadline);
}

function getStudentDiaryStatus(item: ScheduleItem, now = Date.now()) {
  if (item.status === 'completed') return { label: 'Đã học', tone: 'completed' as const };
  if (item.status === 'cancelled') return { label: 'Đã hủy', tone: 'cancelled' as const };
  const bounds = getAttendanceBounds(item);
  if (bounds && now >= bounds.startAt && now <= bounds.endAt) return { label: 'Đang diễn ra', tone: 'ongoing' as const };
  if (bounds && now > bounds.endAt) {
    return now <= bounds.deadline
      ? { label: 'Chưa điểm danh', tone: 'pending' as const }
      : { label: 'Quá hạn điểm danh', tone: 'overdue' as const };
  }
  return { label: 'Sắp tới', tone: 'upcoming' as const };
}

function canTeacherMarkAttendance(item: ScheduleItem | undefined, now = Date.now()) {
  if (!item || !isTeacherAttendanceActionPending(item)) return false;
  const bounds = getAttendanceBounds(item);
  return Boolean(bounds && now >= bounds.startAt + 15 * 60 * 1000 && now <= bounds.deadline);
}

function canTeacherRequestMakeup(item: ScheduleItem | undefined, now = Date.now()) {
  if (!item || !isTeacherAttendanceActionPending(item)) return false;
  const bounds = getAttendanceBounds(item);
  return Boolean(bounds && now > bounds.deadline);
}

function isScheduleRescheduleLocked(item: ScheduleItem) {
  return item.status === 'completed'
    || String(item.attendanceConfirmStatus || '').toLowerCase() === 'admin_approved'
    || Boolean(item.confirmedByTeacher);
}

function isTeacherAttendanceActionPending(item: ScheduleItem) {
  const confirmStatus = String(item.attendanceConfirmStatus || '').toLowerCase();
  return item.status === 'upcoming'
    && item.attendanceStatus === 'pending'
    && !item.attendanceConfirmPending
    && ['', 'none'].includes(confirmStatus);
}

function isAttendanceAwaitingStudentConfirmation(item: ScheduleItem) {
  const confirmStatus = String(item.attendanceConfirmStatus || '').toLowerCase();
  return item.status !== 'cancelled'
    && (confirmStatus === 'pending' || (['', 'none'].includes(confirmStatus) && Boolean(item.attendanceConfirmPending)));
}

function teacherAttendanceActionLabel(item: ScheduleItem, now = Date.now()) {
  if (canTeacherMarkAttendance(item, now)) return 'Điểm danh';
  const bounds = getAttendanceBounds(item);
  if (!bounds) return 'Không khả dụng';
  if (now < bounds.startAt + 15 * 60 * 1000) return 'Chờ đủ 15 phút';
  if (now > bounds.deadline) return 'Quá hạn';
  return 'Điểm danh';
}

function attendanceStatusLabel(item: ScheduleItem, now = Date.now()) {
  const confirmStatus = String(item.attendanceConfirmStatus || '').toLowerCase();
  if (confirmStatus === 'admin_rejected' || item.attendanceRejected) return 'Không được tính';
  if (confirmStatus === 'disputed' || item.attendanceDisputed) return 'Chờ Admin xử lý';
  if (confirmStatus === 'pending' || item.attendanceConfirmPending) return 'Chờ học viên xác nhận';
  if (confirmStatus === 'admin_approved') return 'Đã điểm danh bù';
  if (confirmStatus === 'accepted' || item.confirmedByStudent) return 'Đã điểm danh';
  if (item.status === 'completed') return 'Đã điểm danh';
  if (item.status === 'cancelled') return 'Đã hủy';
  if (isOverdueAttendance(item, now)) return 'Quá hạn điểm danh';
  if (item.attendanceStatus === 'present') return 'Có mặt';
  if (item.attendanceStatus === 'absent') return 'Vắng';
  if (item.attendanceStatus === 'late') return 'Đi trễ';
  if (item.attendanceStatus === 'excused') return 'Có phép';
  return 'Chưa điểm danh';
}

function isUpcomingSchedule(item: ScheduleItem) {
  if (item.status !== 'upcoming' || !item.date) return false;
  const times = item.time?.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  if (!times) return item.date >= todayKey;
  const endAt = new Date(`${item.date}T${times[2]}:00+07:00`).getTime();
  return Number.isFinite(endAt) && Date.now() <= endAt;
}

function normalizeScheduleCourseName(name: string) {
  return name.trim().toLocaleLowerCase('vi').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatScheduleLabel(value: string) {
  return value.trim().toLocaleLowerCase('vi-VN').replace(/(^|[\s([{])([\p{L}\p{N}])/gu, (_, prefix: string, initial: string) => (
    `${prefix}${initial.toLocaleUpperCase('vi-VN')}`
  ));
}

function matchesScheduleCourse(item: ScheduleItem, courseName: string, fallbackCourse?: string) {
  return normalizeScheduleCourseName(item.courseName || fallbackCourse || item.title) === normalizeScheduleCourseName(courseName);
}

async function openAssignmentLink(url: string | undefined, label: string) {
  if (!url) {
    Alert.alert('Không có liên kết', `${label} chưa có liên kết để mở.`);
    return;
  }
  try {
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert('Không thể mở liên kết', error instanceof Error ? error.message : 'Vui lòng thử lại.');
  }
}

export function ScheduleScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<MainTabsParamList, 'Schedule'>>();
  const screenScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const isLocalSchedulePreview = Boolean(user?.previewMode || (__DEV__ && process.env.EXPO_PUBLIC_MOBILE_UI_QA_STATE));
  const [scheduleNow, setScheduleNow] = useState(() => Date.now());
  const [filter, setFilter] = useState('Tất cả');
  const [rosterFilter, setRosterFilter] = useState('Đang học');
  const [weekOffset, setWeekOffset] = useState(0);
  const [teacherScheduleView, setTeacherScheduleView] = useState<'month' | 'week'>('week');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const date = new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const [teacherQuery, setTeacherQuery] = useState('');
  const [showTeacherSearch, setShowTeacherSearch] = useState(false);
  const [teacherCourseFilter, setTeacherCourseFilter] = useState('Tất cả khóa');
  const [showCoursePicker, setShowCoursePicker] = useState(false);
  const [gridSort, setGridSort] = useState<{ kind: 'name' | 'day'; dir: 'asc' | 'desc'; dayIndex: number }>({ kind: 'name', dir: 'asc', dayIndex: 0 });
  const [sortMenu, setSortMenu] = useState<{ kind: 'day'; dayIndex: number } | null>(null);
  const [diaryFilter, setDiaryFilter] = useState('Tất cả');
  const [studentDiaryFilter, setStudentDiaryFilter] = useState('Tất cả');
  const [itemsOverride, setItemsOverride] = useState<Awaited<ReturnType<typeof scheduleService.list>> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notificationScheduleId, setNotificationScheduleId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [showStudentCoursePicker, setShowStudentCoursePicker] = useState(false);
  const [showStudentNote, setShowStudentNote] = useState(false);
  const [studentNote, setStudentNote] = useState('');
  const [savingStudentNote, setSavingStudentNote] = useState(false);
  const [respondingAttendance, setRespondingAttendance] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<ScheduleItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancellingSchedule, setCancellingSchedule] = useState(false);
  const [makeupTarget, setMakeupTarget] = useState<ScheduleItem | null>(null);
  const [sendingMakeupRequest, setSendingMakeupRequest] = useState(false);
  const [, setMakeupRequestsRevision] = useState(0);
  const [classTime, setClassTime] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [classDate, setClassDate] = useState('');
  const loader = useCallback(() => scheduleService.list(isTeacher ? 'teacher' : 'student'), [isTeacher]);
  const resource = useMockResource(loader);
  useEffect(() => {
    const focusScheduleId = route.params?.focusScheduleId;
    if (!focusScheduleId || resource.loading || !resource.data) return;
    const focusedSchedule = resource.data.find((item) => item.id === focusScheduleId);
    if (!focusedSchedule) {
      Alert.alert('Không tìm thấy buổi học', 'Buổi học trong thông báo không còn trong lịch của bạn.');
      navigation.setParams({ focusScheduleId: undefined });
      return;
    }
    setSelectedId(focusedSchedule.id);
    setNotificationScheduleId(isTeacher ? focusedSchedule.id : null);
    setTimeout(() => screenScrollRef.current?.scrollToEnd({ animated: true }), 120);
    navigation.setParams({ focusScheduleId: undefined });
  }, [isTeacher, navigation, resource.data, resource.loading, route.params?.focusScheduleId]);
  useFocusEffect(useCallback(() => {
    setScheduleNow(Date.now());
    resource.reload();
  }, [resource.reload]));
  useEffect(() => {
    const interval = setInterval(() => setScheduleNow(Date.now()), 15_000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    const scheduleEvents = [
      SOCKET_EVENTS.SCHEDULE_NEW,
      SOCKET_EVENTS.SCHEDULE_UPDATED,
      SOCKET_EVENTS.SCHEDULE_CANCELLED,
    ];
    const idOf = (value: unknown) => {
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return String(record._id || record.id || '');
      }
      return String(value || '');
    };
    const subscriptions = scheduleEvents.map((eventName) => DeviceEventEmitter.addListener(eventName, (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const event = payload as Record<string, unknown>;
      const schedule = event.schedule && typeof event.schedule === 'object'
        ? event.schedule as Record<string, unknown>
        : event;
      const ownerId = isTeacher
        ? idOf(schedule.teacherId || event.teacherId)
        : idOf(schedule.studentId || event.studentId);
      if (ownerId && ownerId !== user?.id) return;
      resource.reload();
    }));
    const refreshSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.DATA_REFRESH, (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const type = String((payload as Record<string, unknown>).type || '').toLowerCase();
      if (type === 'schedule' || type === 'schedules') resource.reload();
    });
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      refreshSubscription.remove();
    };
  }, [isTeacher, resource.reload, user?.id]);
  const courseProfileLoader = useCallback(
    () => user?.role === 'student' && !user.previewMode ? studentProfileService.get(user) : Promise.resolve(null),
    [user],
  );
  const courseProfile = useMockResource(courseProfileLoader);
  const studentsLoader = useCallback(() => studentService.assigned(user), [user]);
  const studentsResource = useMockResource(studentsLoader);
  useEffect(() => {
    const eventNames = [
      SOCKET_EVENTS.ATTENDANCE_AWAITING_CONFIRM,
      SOCKET_EVENTS.ATTENDANCE_DISPUTED,
      SOCKET_EVENTS.ATTENDANCE_CONFIRMED,
      SOCKET_EVENTS.ATTENDANCE_REJECTED,
      SOCKET_EVENTS.ATTENDANCE_ADMIN_MAKEUP_COMPLETED,
    ];
    const subscriptions = eventNames.map((eventName) => DeviceEventEmitter.addListener(eventName, (payload: {
      studentId?: string;
      teacherId?: string;
    }) => {
      if (user?.role === 'student' && payload?.studentId && String(payload.studentId) !== user.id) return;
      if (user?.role === 'teacher' && payload?.teacherId && String(payload.teacherId) !== user.id) return;
      resource.reload();
      courseProfile.reload();
      studentsResource.reload();
    }));
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [courseProfile.reload, resource.reload, studentsResource.reload, user]);
  const filters = isTeacher ? ['Tất cả', 'Đang học', 'Học xong'] : ['Tất cả', 'Hôm nay', 'Tuần này', 'Sắp tới'];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) + (weekOffset * 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const formatScheduleDay = (date: Date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  const weekLabel = `${formatScheduleDay(weekStart)} – ${formatScheduleDay(weekEnd)}/${weekEnd.getFullYear()}`;
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { dateKey, weekday: index === 6 ? 'Chủ nhật' : `Thứ ${index + 2}`, day: formatScheduleDay(date) };
  });
  const today = new Date();
  const now = today;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const allScheduleItems = itemsOverride || resource.data || [];
  const makeupStudent = makeupTarget
    ? studentsResource.data?.find((student) => student.id === makeupTarget.studentId)
    : undefined;
  const makeupStudentName = makeupStudent?.name || makeupTarget?.studentName || 'Học viên';
  const makeupCourseName = makeupTarget?.courseName || makeupStudent?.course || '—';
  const makeupCompletedSessions = makeupStudent?.completedSessions || 0;
  const makeupTotalSessions = makeupStudent?.totalSessions || 0;
  const makeupAlreadyRequested = Boolean(
    makeupTarget && user && mobileMakeupRequestsSent.has(`${user.id}:${makeupTarget.id}`),
  );
  const studentEnrollments = courseProfile.data?.qaFixture
    ? user?.enrollments || []
    : courseProfile.data?.enrollments || user?.enrollments || [];
  const courseNames = [
    ...studentEnrollments
      .filter((enrollment) => enrollment.status !== 'Thôi học')
      .map((enrollment) => enrollment.courseName),
    ...allScheduleItems.map((item) => item.courseName),
    user?.course,
  ].map((name) => String(name || '').trim()).filter(Boolean);
  const studentCourses = [...new Map(courseNames.map((name) => [normalizeScheduleCourseName(name), name])).values()];
  const activeStudentCourse = studentCourses.includes(selectedCourse) ? selectedCourse : studentCourses[0] || '';
  const scheduleItems = (itemsOverride || resource.data || []).filter((item) => {
    if (isTeacher) {
      if (filter === 'Đang học' && item.status !== 'upcoming') return false;
      if (filter === 'Học xong' && item.status !== 'completed') return false;
      if (weekOffset !== 0 && !item.date) return false;
      if (item.date) {
        const scheduleDate = new Date(`${item.date}T00:00:00`);
        if (scheduleDate < weekStart || scheduleDate > weekEnd) return false;
      }
    } else {
      if (weekOffset !== 0 && (!item.date || new Date(`${item.date}T00:00:00`) < weekStart || new Date(`${item.date}T00:00:00`) > weekEnd)) return false;
      if (activeStudentCourse && !matchesScheduleCourse(item, activeStudentCourse, user?.course)) return false;
    }
    if (['Sắp tới', 'Tuần này'].includes(filter) && item.status !== 'upcoming') return false;
    if (filter === 'Hôm nay') return item.dateLabel === 'Hôm nay';
    return true;
  });
  const studentMonthItems = allScheduleItems.filter((item) => {
    if (!item.date) return false;
    if (activeStudentCourse && !matchesScheduleCourse(item, activeStudentCourse, user?.course)) return false;
    const itemDate = new Date(`${item.date}T00:00:00`);
    return itemDate.getMonth() === new Date().getMonth() && itemDate.getFullYear() === new Date().getFullYear();
  });
  const studentDiaryItems = allScheduleItems.filter((item) => {
    const date = item.date ? new Date(`${item.date}T00:00:00`) : null;
    if (studentDiaryFilter === 'Ngày' && (!date || date.toDateString() !== new Date().toDateString())) return false;
    if (studentDiaryFilter === 'Tuần' && (!date || date < weekStart || date > weekEnd)) return false;
    if (studentDiaryFilter === 'Tháng' && (!date || date.getMonth() !== new Date().getMonth() || date.getFullYear() !== new Date().getFullYear())) return false;
    if (studentDiaryFilter === 'Chưa điểm danh' && !['pending', 'overdue'].includes(getStudentDiaryStatus(item).tone)) return false;
    if (studentDiaryFilter === 'Lịch hủy' && item.status !== 'cancelled') return false;
    return true;
  }).sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));
  const calendarYear = calendarMonth.getFullYear();
  const calendarMonthIndex = calendarMonth.getMonth();
  const calendarMonthItems = allScheduleItems.filter((item) => {
    if (!item.date) return false;
    const date = new Date(`${item.date}T00:00:00`);
    return date.getMonth() === calendarMonthIndex && date.getFullYear() === calendarYear;
  });
  const calendarDays = [
    ...Array.from({ length: new Date(calendarYear, calendarMonthIndex, 1).getDay() }, () => null),
    ...Array.from({ length: new Date(calendarYear, calendarMonthIndex + 1, 0).getDate() }, (_, index) => index + 1),
  ];
  while (calendarDays.length % 7 !== 0) calendarDays.push(null);
  const selectedCalendarItems = calendarMonthItems
    .filter((item) => item.date === selectedCalendarDate)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const eligibleTeacherStudents = (studentsResource.data || [])
    .filter((student) => student.enrollmentStatus !== 'cancelled');
  const teacherCourseFilters = [
    'Tất cả khóa',
    ...new Set(eligibleTeacherStudents.flatMap((student) => [
      ...(student.courses || []),
      ...(student.enrollments || []).map((enrollment) => enrollment.courseName),
      student.course,
    ]).map((course) => course.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b, 'vi'))),
  ];
  const teacherRoster = eligibleTeacherStudents
    .filter((student) => rosterFilter === 'Đang học'
      ? student.enrollmentStatus !== 'completed'
      : rosterFilter === 'Học xong'
        ? student.enrollmentStatus === 'completed'
        : true)
    .filter((student) => teacherCourseFilter === 'Tất cả khóa'
      || student.course === teacherCourseFilter
      || student.courses?.includes(teacherCourseFilter)
      || student.enrollments?.some((enrollment) => enrollment.courseName === teacherCourseFilter))
    .filter((student) => !teacherQuery.trim() || `${student.name} ${student.course}`.toLocaleLowerCase('vi-VN').includes(teacherQuery.trim().toLocaleLowerCase('vi-VN')))
    .sort((a, b) => {
      if (gridSort.kind === 'day') {
        const dateKey = weekDays[gridSort.dayIndex]?.dateKey;
        const timeFor = (studentId: string, studentName: string) => allScheduleItems.find((item) => item.date === dateKey
          && (item.studentId === studentId || (!item.studentId && item.studentName === studentName))
          && item.status !== 'cancelled')?.time?.match(/\d{2}:\d{2}/)?.[0] || null;
        const first = timeFor(a.id, a.name);
        const second = timeFor(b.id, b.name);
        if (first && second && first !== second) return gridSort.dir === 'asc' ? first.localeCompare(second) : second.localeCompare(first);
        if (first && !second) return -1;
        if (!first && second) return 1;
      }
      const nameDirection = gridSort.kind === 'day' ? 1 : gridSort.dir === 'asc' ? 1 : -1;
      return nameDirection * a.name.localeCompare(b.name, 'vi');
    });
  const selectedStudent = teacherRoster.find((student) => student.id === selectedStudentId)
    || studentsResource.data?.find((student) => student.id === selectedStudentId);
  const activeScheduleEnrollments = (selectedStudent?.enrollments || [])
    .filter((enrollment) => enrollment.status === 'Đang học');
  const selectedScheduleEnrollment = activeScheduleEnrollments.find(
    (enrollment) => enrollment.id === selectedEnrollmentId,
  );
  const blockedByEnrollment = Boolean(selectedStudent?.enrollments?.length && !selectedScheduleEnrollment && !selectedId);
  const slotOptions = Array.from({ length: 32 }, (_, index) => {
    const minutes = 7 * 60 + index * 30;
    if (minutes + 90 > 24 * 60) return null;
    const start = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
    const endMinutes = minutes + 90;
    const end = endMinutes === 24 * 60
      ? '24:00'
      : `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    return { start, label: `${start} - ${end}` };
  }).filter((option): option is { start: string; label: string } => option !== null);
  const diaryItems = allScheduleItems.filter((item) => {
    const date = item.date ? new Date(`${item.date}T00:00:00`) : null;
    if (diaryFilter === 'Ngày' && (!date || date.toDateString() !== new Date().toDateString())) return false;
    if (diaryFilter === 'Tuần' && (!date || date < weekStart || date > weekEnd)) return false;
    if (diaryFilter === 'Tháng' && (!date || date.getMonth() !== new Date().getMonth() || date.getFullYear() !== new Date().getFullYear())) return false;
    if (diaryFilter === 'Chưa điểm danh' && !isTeacherAttendanceActionPending(item)) return false;
    if (diaryFilter === 'Chờ xác nhận' && !isAttendanceAwaitingStudentConfirmation(item)) return false;
    if (diaryFilter === 'Hủy' && item.status !== 'cancelled') return false;
    return true;
  }).sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));
  const selectedItem = allScheduleItems.find((item) => item.id === selectedId);
  const respondToAttendance = async (decision: 'accept' | 'dispute') => {
    if (!selectedItem) return;
    setRespondingAttendance(true);
    try {
      await scheduleService.confirmAttendance(selectedItem.id, decision, user);
      setItemsOverride((itemsOverride || resource.data || []).map((item) => item.id === selectedItem.id
        ? {
          ...item,
          confirmedByStudent: decision === 'accept',
          attendanceConfirmPending: false,
          attendanceDisputed: decision === 'dispute',
          attendanceStatus: decision === 'accept' ? 'present' : item.attendanceStatus,
          status: decision === 'accept' ? 'completed' : item.status,
        }
        : item));
      Alert.alert(
        decision === 'accept' ? 'Đã xác nhận' : 'Đã gửi phản hồi',
        decision === 'accept'
          ? 'Buổi học đã được xác nhận.'
          : 'Buổi học chưa được tính vào tiến độ; trung tâm sẽ xử lý phản hồi.',
      );
    } catch (error) {
      Alert.alert('Không thể cập nhật điểm danh', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setRespondingAttendance(false);
    }
  };
  const saveScheduleNote = async () => {
    if (!selectedItem || !studentNote.trim()) return;
    setSavingStudentNote(true);
    try {
      await scheduleService.saveStudentNote(selectedItem.id, studentNote.trim(), user);
      if (isLocalSchedulePreview) {
        setItemsOverride((itemsOverride || resource.data || []).map((item) => item.id === selectedItem.id
          ? { ...item, studentNote: studentNote.trim() }
          : item));
      } else {
        setItemsOverride(null);
        resource.reload();
      }
      setShowStudentNote(false);
      Alert.alert(
        'Đã gửi ghi chú',
        isLocalSchedulePreview ? 'Ghi chú chỉ lưu trong bản xem trước.' : 'Giảng viên sẽ nhận được ghi chú của bạn.',
      );
    } catch (error) {
      Alert.alert('Không thể gửi ghi chú', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setSavingStudentNote(false);
    }
  };
  const selectSlot = async (startTime: string | null) => {
    if (!selectedStudentId || !selectedStudent || !classDate) return;
    const current = itemsOverride || resource.data || [];
    const currentSlot = current.find((item) => item.id === selectedId);
    if (!startTime) {
      if (!currentSlot) return;
      if (isLocalSchedulePreview) {
        setItemsOverride(current.map((item) => item.id === currentSlot.id ? { ...item, status: 'cancelled' } : item));
        setShowCreate(false);
        return;
      }
      setCancelTarget(currentSlot);
      setCancelReason('');
      setShowCreate(false);
      return;
    }
    if (classDate < todayKey) {
      Alert.alert('Không thể xếp lịch', 'Không thể sửa lịch đã qua ngày.');
      return;
    }
    if (currentSlot?.status === 'completed') {
      Alert.alert('Không thể đổi ca', 'Buổi đã điểm danh — không đổi giờ từ bảng này.');
      return;
    }
    const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3, 5));
    const endMinutes = startMinutes + 90;
    if (classDate === todayKey && endMinutes <= now.getHours() * 60 + now.getMinutes()) {
      Alert.alert('Không thể xếp lịch', 'Ca này đã kết thúc — chỉ xếp khung giờ hiện tại trở đi.');
      return;
    }
    const conflicts = current.filter((item) => item.id !== selectedId && item.date === classDate && item.status === 'upcoming').some((item) => {
      const match = item.time.match(/(\d{2}):(\d{2})/);
      if (!match) return false;
      const otherStart = Number(match[1]) * 60 + Number(match[2]);
      return startMinutes < otherStart + 90 && otherStart < endMinutes;
    });
    if (conflicts) {
      Alert.alert('Khung giờ đã có lịch', 'Giảng viên đã có lịch trùng thời gian này. Vui lòng chọn khung giờ khác.');
      return;
    }
    const studentConflict = current.find((item) => (
      item.id !== selectedId
      && item.date === classDate
      && item.studentId === selectedStudentId
      && item.status !== 'cancelled'
    ));
    if (studentConflict) {
      Alert.alert('Học viên đã có lịch', `Học viên đã có ca ${studentConflict.subject || 'khác'} trong ngày.`);
      return;
    }
    const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
    const displayEnd = endMinutes === 24 * 60 ? '24:00' : endTime;
    const time = `${startTime} – ${displayEnd}`;
    const dateLabel = new Date(`${classDate}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    if (isLocalSchedulePreview) {
      if (currentSlot) {
        setItemsOverride(current.map((item) => item.id === currentSlot.id ? { ...item, time, status: 'upcoming', attendanceStatus: 'pending' } : item));
      } else {
        setItemsOverride([{
          id: `class-${Date.now()}`,
          title: `${selectedStudent.course} · Buổi học`,
          subject: selectedStudent.course,
          person: user?.name || 'Giảng viên',
          dateLabel,
          date: classDate,
          time,
          location: '—',
          studentId: selectedStudent.id,
          studentName: selectedStudent.name,
          status: 'upcoming',
          attendanceStatus: 'pending',
          color: colors.brand,
        }, ...current]);
      }
      setShowCreate(false);
      return;
    }

    if (!user || user.role !== 'teacher') {
      Alert.alert('Không thể xếp lịch', 'Tài khoản giảng viên không hợp lệ.');
      return;
    }
    setSavingSlot(true);
    try {
      const apiEndTime = endMinutes >= 24 * 60 ? '23:59' : endTime;
      if (currentSlot) {
        await scheduleService.update(currentSlot.id, { date: classDate, startTime, endTime: apiEndTime }, user);
      } else {
        await scheduleService.create({
          teacherId: user.id,
          studentId: selectedStudent.id,
          date: classDate,
          startTime,
          endTime: apiEndTime,
          course: selectedScheduleEnrollment?.courseName || selectedStudent.course,
          ...(selectedScheduleEnrollment?.id ? { enrollmentId: selectedScheduleEnrollment.id } : {}),
        }, user);
      }
      setItemsOverride(null);
      resource.reload();
      setShowCreate(false);
    } catch (error) {
      Alert.alert('Không thể lưu lịch', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setSavingSlot(false);
    }
  };

  const confirmCancelSchedule = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    setCancellingSchedule(true);
    try {
      if (isLocalSchedulePreview) {
        setItemsOverride((itemsOverride || resource.data || []).map((item) => (
          item.id === cancelTarget.id ? { ...item, status: 'cancelled', note: cancelReason.trim() } : item
        )));
      } else {
        await scheduleService.cancel(cancelTarget.id, cancelReason.trim(), user);
        setItemsOverride(null);
        resource.reload();
      }
      setCancelTarget(null);
      setCancelReason('');
      Alert.alert(
        'Đã hủy lịch',
        isLocalSchedulePreview ? 'Lịch chỉ được hủy trong bản xem trước.' : 'Lịch học đã được cập nhật trên hệ thống.',
      );
    } catch (error) {
      Alert.alert('Không thể hủy lịch', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setCancellingSchedule(false);
    }
  };

  const sendMakeupRequestToAdmin = async () => {
    if (!makeupTarget || !user || sendingMakeupRequest || makeupAlreadyRequested) return;
    setSendingMakeupRequest(true);
    try {
      let contacts: Conversation[] = [];
      try {
        contacts = await messageService.conversations('teacher', user);
      } catch (error) {
        console.warn('Không tải được danh bạ Admin; dùng hộp thư Admin mặc định.', error);
      }
      const staffContacts = contacts.filter((contact) => (
        ['admin', 'staff'].includes(String(contact.participantRole || '').toLowerCase())
        || ['admin', 'recruitment'].includes(String(contact.category || '').toLowerCase())
      ));
      const admin = staffContacts.find((contact) => contact.participantId === 'admin')
        || staffContacts.find((contact) => String(contact.adminRole || '').toUpperCase() === 'SUPER_ADMIN')
        || staffContacts.find((contact) => String(contact.adminRole || '').toUpperCase() === 'HIGH_ADMIN')
        || staffContacts[0]
        || ({
          id: 'admin',
          name: 'Admin',
          role: 'Admin',
          participantId: 'admin',
          participantRole: 'admin',
          category: 'admin',
          lastMessage: '',
          time: '',
          unread: 0,
          color: '#334155',
        } satisfies Conversation);
      const studentId = makeupTarget.studentId || '';
      const safeStudentName = makeupStudentName.replace(/[|⟦⟧]/g, ' ').trim() || 'Học viên';
      const studentToken = studentId
        ? `⟦student_detail:${studentId}:attendance:${makeupTarget.id}|${safeStudentName}⟧`
        : safeStudentName;
      const makeupSessionNumber = makeupCompletedSessions + 1;
      const dateLabel = makeupTarget.dateLabel || makeupTarget.date || 'Chưa xác định';
      const content = [
        '[Yêu cầu điểm danh bù]',
        `GV gửi yêu cầu: ${user.name}`,
        `HV: ${studentToken}`,
        `Khóa: ${makeupCourseName}`,
        makeupTotalSessions > 0
          ? `Buổi: ${makeupSessionNumber}/${makeupTotalSessions}`
          : `Buổi tiếp theo (đã học ${makeupCompletedSessions})`,
        `Lịch: ${dateLabel} · ${makeupTarget.time || 'Chưa xác định'}`,
        '',
        '› Bấm tên học viên ở dòng HV để mở hồ sơ và điểm danh bù.',
        '',
        'Nội dung xác nhận:',
        '- Giảng viên chịu trách nhiệm về buổi học này.',
        '- Admin sẽ liên hệ học viên để xác nhận học viên đã học buổi này chưa.',
        '- Chỉ khi học viên đồng ý đã học, buổi này mới được tính cho giảng viên.',
        '',
        'Lý do: Quá hạn cửa sổ điểm danh 1 giờ của giảng viên — nhờ Admin xử lý điểm danh bù.',
      ].join('\n');
      await messageService.send(admin, content, user);
      mobileMakeupRequestsSent.add(`${user.id}:${makeupTarget.id}`);
      setMakeupRequestsRevision((revision) => revision + 1);
      setMakeupTarget(null);
      Alert.alert('Đã gửi yêu cầu', 'Admin sẽ liên hệ học viên xác nhận. Buổi chỉ được tính khi Admin điểm danh bù.');
    } catch (error) {
      Alert.alert('Không gửi được yêu cầu', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setSendingMakeupRequest(false);
    }
  };

  const changeCalendarMonth = (offset: number) => {
    const nextMonth = new Date(calendarYear, calendarMonthIndex + offset, 1);
    const selectedDay = Number(selectedCalendarDate.slice(-2)) || 1;
    const day = Math.min(selectedDay, new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate());
    setCalendarMonth(nextMonth);
    setSelectedCalendarDate(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  };
  const openWeekForCalendarDate = (dateKey: string) => {
    const target = new Date(`${dateKey}T00:00:00`);
    const currentMonday = new Date();
    currentMonday.setDate(currentMonday.getDate() - ((currentMonday.getDay() + 6) % 7));
    currentMonday.setHours(0, 0, 0, 0);
    const targetMonday = new Date(target);
    targetMonday.setDate(targetMonday.getDate() - ((targetMonday.getDay() + 6) % 7));
    targetMonday.setHours(0, 0, 0, 0);
    setWeekOffset(Math.round((targetMonday.getTime() - currentMonday.getTime()) / (7 * 24 * 60 * 60 * 1000)));
    setTeacherScheduleView('week');
  };
  const openScheduleEditor = (item: ScheduleItem) => {
    if (isScheduleRescheduleLocked(item)) {
      Alert.alert('Không thể sửa ca dạy', 'Buổi học đã được điểm danh bù và không thể thay đổi lịch.');
      return;
    }
    const student = studentsResource.data?.find((candidate) => (
      (item.studentId && candidate.id === item.studentId)
      || (item.studentName && candidate.name === item.studentName)
    ));
    if (!student || !item.date) {
      Alert.alert('Không thể mở ca dạy', 'Không tìm thấy thông tin học viên hoặc ngày dạy của ca này.');
      return;
    }
    const matchingEnrollment = (student.enrollments || []).find((enrollment) => (
      enrollment.id === item.enrollmentId
      || (item.courseName && normalizeScheduleCourseName(enrollment.courseName) === normalizeScheduleCourseName(item.courseName))
    ));
    setSelectedId(item.id);
    setSelectedStudentId(student.id);
    setSelectedEnrollmentId(matchingEnrollment?.id || student.enrollments?.find((enrollment) => enrollment.status === 'Đang học')?.id || '');
    setClassDate(item.date);
    setClassTime(item.time.match(/\d{1,2}:\d{2}/)?.[0] || '');
    setShowCreate(true);
  };

  const sortDayIndex = sortMenu?.kind === 'day' ? sortMenu.dayIndex : -1;

  return (
    <AppScreen scrollViewRef={screenScrollRef}>
      <Card style={styles.scheduleHero}>
        <View style={styles.scheduleHeroIcon}>
          <CalendarDays size={22} color={colors.brand} />
        </View>
        <View style={styles.rowCopy}>
          <Text style={styles.scheduleHeroTitle}>
            {isTeacher ? 'Quản lý Lịch dạy & Điểm danh' : 'Quản lý Lịch học & Điểm danh'}
          </Text>
          {isTeacher ? <Text style={styles.metaText}>Xếp lịch theo tuần và xem nhật ký giảng dạy</Text> : null}
        </View>
      </Card>
      {!isTeacher && resource.loading ? <LoadingSkeleton rows={1} /> : null}
      {!isTeacher && !resource.loading ? (
        <>
          {courseProfile.error ? <ErrorState onRetry={courseProfile.reload} /> : null}
          <View style={styles.scheduleStats}>
            {[
              { label: 'Đã học tháng này', value: studentMonthItems.filter((item) => item.status === 'completed').length, icon: CheckCircle, color: colors.green },
              { label: 'Buổi sắp tới', value: studentMonthItems.filter(isUpcomingSchedule).length, icon: Clock3, color: '#D97706' },
              { label: 'Đã hủy', value: studentMonthItems.filter((item) => item.status === 'cancelled').length, icon: Ban, color: colors.red },
            ].map((stat) => (
              <Card key={stat.label} style={styles.scheduleStat}>
                <View style={[styles.scheduleStatIcon, { backgroundColor: stat.color === colors.green ? colors.greenSoft : stat.color === '#D97706' ? colors.goldSoft : colors.redSoft }]}>
                  <stat.icon size={17} color={stat.color} />
                </View>
                <Text style={styles.scheduleStatLabel}>{stat.label}</Text>
                <Text style={[styles.scheduleStatValue, { color: stat.color }]}>{stat.value} <Text style={styles.scheduleStatUnit}>buổi</Text></Text>
              </Card>
            ))}
          </View>
          <Card style={styles.weeklyGridCard}>
            <View style={styles.weeklyGridHeading}>
              <View style={styles.scheduleOverviewIcon}><Table2 size={18} color={colors.brand} /></View>
              <View style={styles.weeklyGridHeadingCopy}>
                <Text style={styles.weeklyGridTitle}>Lịch học theo tuần</Text>
              </View>
            </View>
            <Pressable
              onPress={() => setShowStudentCoursePicker(true)}
              style={styles.courseFilterSelect}
              accessibilityRole="button"
              accessibilityLabel={`Chọn khóa học, hiện tại ${activeStudentCourse || 'chưa có khóa học'}`}
              accessibilityState={{ expanded: showStudentCoursePicker }}
            >
              <Text style={styles.courseFilterSelectLabel}>Khóa học</Text>
              <Text numberOfLines={1} style={styles.courseFilterSelectValue}>
                {activeStudentCourse || 'Chưa có khóa học'}
              </Text>
              <ChevronDown size={16} color={colors.brand} />
            </Pressable>
            <View style={styles.teacherWeekRange}>
              <Pressable onPress={() => setWeekOffset((value) => value - 1)} style={styles.teacherWeekRangeArrow} accessibilityRole="button" accessibilityLabel="Tuần trước">
                <ChevronLeft size={16} color={colors.brand} />
              </Pressable>
              <Pressable onPress={() => setWeekOffset(0)} accessibilityRole="button" accessibilityLabel="Về tuần hiện tại">
                <Text style={styles.teacherWeekRangeLabel}>{weekLabel}</Text>
              </Pressable>
              <Pressable onPress={() => setWeekOffset((value) => value + 1)} style={styles.teacherWeekRangeArrow} accessibilityRole="button" accessibilityLabel="Tuần sau">
                <ChevronRight size={16} color={colors.brand} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.teacherCompactScroll}
              horizontal
              nestedScrollEnabled
              showsHorizontalScrollIndicator
            >
              <View style={[styles.compactWeekGrid, { width: weekDays.length * STUDENT_WEEK_CELL_WIDTH }]}>
                <View style={styles.compactWeekRow}>
                  {weekDays.map((day, index) => (
                    <View key={day.dateKey} style={[styles.teacherCompactDayCell, styles.compactWeekHeaderCell, styles.studentCompactWeekHeaderCell, day.dateKey === todayKey && styles.weekGridTodayCell]}>
                      <Text style={[styles.teacherCompactDayText, day.dateKey === todayKey && styles.weekGridTodayText]}>
                        {index === 6 ? 'CN' : `T${index + 2}`}
                      </Text>
                      <Text style={[styles.teacherCompactDateText, day.dateKey === todayKey && styles.weekGridTodayText]}>{day.day}</Text>
                      <View style={styles.teacherCompactSort}>
                        <Text style={styles.teacherCompactSortText}>Giờ</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <View style={styles.compactWeekRow}>
                  {weekDays.map((day) => {
                    const item = scheduleItems.find((scheduled) => scheduled.date === day.dateKey && matchesScheduleCourse(scheduled, activeStudentCourse, user?.course));
                    const slotStatus = item?.status === 'completed'
                      ? 'Đã học'
                      : item?.status === 'cancelled'
                        ? 'Đã hủy'
                        : item && isOverdueAttendance(item)
                          ? 'Trễ'
                          : 'Đã xếp';
                    const slotStatusStyle = item?.status === 'completed'
                      ? styles.weekGridCompletedCell
                      : item?.status === 'cancelled'
                        ? styles.weekGridCancelledCell
                        : item ? styles.weekGridBookedCell : undefined;
                    const time = item?.time.match(/\d{1,2}:\d{2}/)?.[0];
                    return item ? (
                      <Pressable
                        key={day.dateKey}
                        onPress={() => setSelectedId(item.id)}
                        style={[styles.teacherCompactDayCell, styles.compactWeekSlotCell, slotStatusStyle, day.dateKey === todayKey && styles.weekGridTodayColumn]}
                        accessibilityRole="button"
                        accessibilityLabel={`${activeStudentCourse}, ${day.weekday} ${day.day}, ${item.time}, ${slotStatus}`}
                      >
                        <Text numberOfLines={1} style={[styles.teacherCompactTime, styles.weekGridBookedText]}>{time}</Text>
                        <Text numberOfLines={1} style={styles.teacherCompactStatus}>{slotStatus}</Text>
                      </Pressable>
                    ) : (
                      <View key={day.dateKey} style={[styles.teacherCompactDayCell, styles.compactWeekSlotCell, day.dateKey === todayKey && styles.weekGridTodayColumn]}>
                        <Text style={styles.teacherCompactTime}>—</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </ScrollView>
          </Card>
        </>
      ) : null}
      {isTeacher && resource.data && !resource.error ? (
        <>
          <View style={styles.scheduleViewToggle} accessibilityRole="tablist">
            {([
              { key: 'week', label: 'Xếp lịch học viên', icon: Table2 },
              { key: 'month', label: 'Lịch tháng', icon: CalendarDays },
            ] as const).map((view) => {
              const selected = teacherScheduleView === view.key;
              return (
                <Pressable
                  key={view.key}
                  onPress={() => setTeacherScheduleView(view.key)}
                  style={[styles.scheduleViewTab, selected && styles.scheduleViewTabActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                >
                  <view.icon size={16} color={selected ? '#FFFFFF' : colors.muted} />
                  <Text style={[styles.scheduleViewTabText, selected && styles.scheduleViewTabTextActive]}>{view.label}</Text>
                </Pressable>
              );
            })}
          </View>
          {teacherScheduleView === 'month' ? (
            <View style={styles.scheduleStats}>
              {[
                { label: 'Đã dạy', value: calendarMonthItems.filter((item) => item.status === 'completed').length, icon: CheckCircle, color: colors.green },
                { label: 'Sắp tới', value: calendarMonthItems.filter(isUpcomingSchedule).length, icon: Clock3, color: '#D97706' },
                { label: 'Đã hủy', value: calendarMonthItems.filter((item) => item.status === 'cancelled').length, icon: Ban, color: colors.red },
              ].map((stat) => (
                <Card key={stat.label} style={styles.scheduleStat}>
                  <View style={[styles.scheduleStatIcon, { backgroundColor: stat.color === colors.green ? colors.greenSoft : stat.color === '#D97706' ? colors.goldSoft : colors.redSoft }]}>
                    <stat.icon size={17} color={stat.color} />
                  </View>
                  <Text style={styles.scheduleStatLabel}>{stat.label}</Text>
                  <Text style={[styles.scheduleStatValue, { color: stat.color }]}>
                    {stat.value} <Text style={styles.scheduleStatUnit}>buổi</Text>
                  </Text>
                </Card>
              ))}
            </View>
          ) : null}
          {teacherScheduleView === 'month' ? (
            <>
              <Card style={styles.monthCalendarCard}>
                <View style={styles.monthCalendarHeader}>
                  <View style={styles.weeklyGridHeading}>
                    <View style={styles.scheduleOverviewIcon}><CalendarDays size={18} color={colors.brand} /></View>
                    <Text style={styles.weeklyGridTitle}>Lịch theo tháng</Text>
                  </View>
                  <View style={styles.monthCalendarControls}>
                    <Pressable onPress={() => changeCalendarMonth(-1)} style={styles.monthCalendarArrow} accessibilityRole="button" accessibilityLabel="Tháng trước">
                      <ChevronLeft size={19} color={colors.ink} />
                    </Pressable>
                    <Text style={styles.monthCalendarTitle}>{calendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}</Text>
                    <Pressable onPress={() => changeCalendarMonth(1)} style={styles.monthCalendarArrow} accessibilityRole="button" accessibilityLabel="Tháng sau">
                      <ChevronRight size={19} color={colors.ink} />
                    </Pressable>
                  </View>
                </View>
                <View style={styles.monthCalendarWeekdays}>
                  {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day, index) => (
                    <Text key={day} style={[styles.monthCalendarWeekday, index === 0 && styles.monthCalendarSunday]}>{day}</Text>
                  ))}
                </View>
                <View style={styles.monthCalendarGrid}>
                  {Array.from({ length: calendarDays.length / 7 }, (_, weekIndex) => (
                    <View key={`week-${weekIndex}`} style={styles.monthCalendarWeek}>
                      {calendarDays.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) => {
                        if (!day) return <View key={`empty-${weekIndex}-${dayIndex}`} style={styles.monthCalendarCell} />;
                        const dateKey = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const daySchedules = calendarMonthItems.filter((item) => item.date === dateKey);
                        const selected = dateKey === selectedCalendarDate;
                        const isToday = dateKey === todayKey;
                        const dotColors = daySchedules.slice(0, 3).map((item) => (
                          item.status === 'completed'
                            ? colors.green
                            : item.status === 'cancelled'
                              ? colors.red
                              : getStudentDiaryStatus(item).tone === 'ongoing' ? '#16A34A' : '#F59E0B'
                        ));
                        return (
                          <Pressable
                            key={dateKey}
                            onPress={() => setSelectedCalendarDate(dateKey)}
                            style={[styles.monthCalendarCell, styles.monthCalendarDay, isToday && styles.monthCalendarToday, selected && styles.monthCalendarDaySelected]}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            accessibilityLabel={`${day} ${calendarMonth.toLocaleDateString('vi-VN', { month: 'long' })}${daySchedules.length ? `, ${daySchedules.length} buổi` : ', không có lịch'}`}
                          >
                            <Text style={[styles.monthCalendarDayText, dayIndex === 0 && !selected && styles.monthCalendarSunday, isToday && !selected && styles.monthCalendarTodayText, selected && styles.monthCalendarDayTextSelected]}>{day}</Text>
                            <View style={styles.monthCalendarDots}>
                              {dotColors.map((color, dotIndex) => <View key={`${dateKey}-${dotIndex}`} style={[styles.monthCalendarDot, { backgroundColor: selected ? '#FFFFFF' : color }]} />)}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
                <View style={styles.monthCalendarLegend}>
                  {[
                    { label: 'Đã dạy', color: colors.green },
                    { label: 'Sắp tới', color: '#F59E0B' },
                    { label: 'Đã hủy', color: colors.red },
                  ].map((item) => (
                    <View key={item.label} style={styles.monthCalendarLegendItem}>
                      <View style={[styles.monthCalendarDot, { backgroundColor: item.color }]} />
                      <Text style={styles.monthCalendarLegendText}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              </Card>
              <Card style={styles.calendarDayCard}>
                <View style={styles.calendarDayHeader}>
                  <View style={styles.diaryHeadingIcon}><CalendarDays size={16} color={colors.brand} /></View>
                  <View style={styles.weeklyGridHeadingCopy}>
                    <Text style={styles.calendarDayTitle}>
                      {new Date(`${selectedCalendarDate}T00:00:00`).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                    <Text style={styles.calendarDaySubtitle}>Lịch trong ngày đã chọn</Text>
                  </View>
                  <Text style={styles.calendarDayCount}>{selectedCalendarItems.length} buổi</Text>
                </View>
                <View style={styles.calendarAppointments}>
                  {selectedCalendarItems.map((item) => {
                    const canEdit = item.status === 'upcoming'
                      && !isScheduleRescheduleLocked(item)
                      && Boolean(item.date && item.date >= todayKey);
                    const attendancePending = isTeacherAttendanceActionPending(item);
                    const attendanceAwaitingConfirmation = isAttendanceAwaitingStudentConfirmation(item);
                    const attendanceAvailable = canTeacherMarkAttendance(item, scheduleNow);
                    const makeupOverdue = canTeacherRequestMakeup(item, scheduleNow);
                    const makeupRequestSent = Boolean(user && mobileMakeupRequestsSent.has(`${user.id}:${item.id}`));
                    return (
                      <View key={item.id} style={styles.calendarAppointment}>
                        <View style={styles.rowBetween}>
                          <Text numberOfLines={2} style={styles.calendarAppointmentTitle}>{item.studentName || item.person || 'Học viên'}</Text>
                          {!attendanceAwaitingConfirmation ? <StatusBadge label={attendanceStatusLabel(item, scheduleNow)} compact /> : null}
                        </View>
                        <View style={styles.calendarAppointmentInfo}>
                          <Clock3 size={13} color="#FCD34D" />
                          <Text style={styles.calendarAppointmentTime}>{item.time || 'Chưa có giờ'}</Text>
                        </View>
                        <Text style={styles.calendarAppointmentCourse}>{item.courseName || item.subject || item.title}</Text>
                        {item.note ? <Text style={styles.calendarAppointmentNote} numberOfLines={2}>Ghi chú lịch: {item.note}</Text> : null}
                        {item.studentNote ? <Text style={styles.calendarStudentNote} numberOfLines={2}>Học viên nhắn: {item.studentNote}</Text> : null}
                        {canEdit || attendancePending || attendanceAwaitingConfirmation ? (
                          <View style={[styles.calendarActions, attendanceAwaitingConfirmation && styles.calendarActionsSubmitted]}>
                            {attendanceAwaitingConfirmation ? (
                              <>
                                <StatusBadge label={attendanceStatusLabel(item, scheduleNow)} compact />
                                <Pressable
                                  disabled
                                  style={[styles.calendarAttendanceAction, styles.calendarAttendanceActionSubmitted]}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Điểm danh đã gửi, chờ xác nhận ${item.studentName || item.title}`}
                                  accessibilityState={{ disabled: true }}
                                >
                                  <CheckCircle size={14} color="#B91C1C" />
                                  <Text style={[styles.calendarAttendanceActionText, styles.calendarAttendanceActionTextSubmitted]}>Điểm danh</Text>
                                </Pressable>
                              </>
                            ) : attendancePending ? (
                              <Pressable
                                disabled={makeupOverdue ? makeupRequestSent : !attendanceAvailable}
                                onPress={() => {
                                  if (makeupOverdue) {
                                    if (!makeupRequestSent) setMakeupTarget(item);
                                    return;
                                  }
                                  navigation.navigate('Attendance', { scheduleId: item.id });
                                }}
                                style={[
                                  styles.calendarAttendanceAction,
                                  makeupOverdue && (makeupRequestSent ? styles.calendarMakeupActionSent : styles.calendarMakeupAction),
                                  !attendanceAvailable && !makeupOverdue && styles.calendarAttendanceActionDisabled,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={makeupOverdue
                                  ? `${makeupRequestSent ? 'Đã gửi Admin' : 'Điểm danh bù'} ${item.studentName || item.title}`
                                  : attendanceAvailable
                                    ? `Điểm danh ${item.studentName || item.title}`
                                    : `${teacherAttendanceActionLabel(item, scheduleNow)}: ${item.studentName || item.title}`}
                                accessibilityState={{ disabled: makeupOverdue ? makeupRequestSent : !attendanceAvailable }}
                              >
                                <CheckCircle size={14} color={makeupOverdue && makeupRequestSent ? '#64748B' : attendanceAvailable || makeupOverdue ? '#FFFFFF' : '#94A3B8'} />
                                <Text style={[
                                  styles.calendarAttendanceActionText,
                                  makeupOverdue && (makeupRequestSent ? styles.calendarMakeupActionTextSent : styles.calendarMakeupActionText),
                                  !attendanceAvailable && !makeupOverdue && styles.calendarAttendanceActionTextDisabled,
                                ]}>{makeupOverdue ? makeupRequestSent ? 'Đã gửi Admin' : 'Điểm danh bù' : teacherAttendanceActionLabel(item, scheduleNow)}</Text>
                              </Pressable>
                            ) : null}
                            {canEdit && !makeupOverdue ? (
                              <Pressable onPress={() => openScheduleEditor(item)} style={styles.calendarEditAction} accessibilityRole="button">
                                <Text style={styles.calendarEditActionText}>Sửa ca dạy</Text>
                              </Pressable>
                            ) : null}
                            {attendanceAvailable || makeupOverdue ? (
                              <Pressable
                                onPress={() => {
                                  setCancelTarget(item);
                                  setCancelReason('');
                                }}
                                style={styles.calendarCancelAction}
                                accessibilityRole="button"
                              >
                                <Text style={styles.calendarCancelActionText}>Hủy ca</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
                {!selectedCalendarItems.length ? (
                  <View style={styles.calendarDayEmpty}>
                    <Text style={styles.calendarDayEmptyText}>Ngày này chưa có ca dạy.</Text>
                    {selectedCalendarDate >= todayKey ? (
                      <Pressable onPress={() => openWeekForCalendarDate(selectedCalendarDate)} style={styles.calendarAddAction} accessibilityRole="button">
                        <Plus size={16} color="#FFFFFF" />
                        <Text style={styles.calendarAddActionText}>Xếp lịch ngày này</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </Card>
            </>
          ) : null}
          {teacherScheduleView === 'week' ? (
            <Card style={styles.weeklyGridCard}>
              <View style={styles.weeklyGridHeading}>
                <View style={styles.scheduleOverviewIcon}><Table2 size={18} color={colors.brand} /></View>
                <View style={styles.weeklyGridHeadingCopy}>
                  <Text style={styles.weeklyGridTitle}>Xếp lịch học viên theo tuần</Text>
                </View>
              </View>
              <View style={styles.scheduleFilterSection}>
                <View style={styles.scheduleFilterHeading}>
                  <Users size={14} color={colors.muted} />
                  <Text style={styles.scheduleFilterLabel}>Lọc học viên</Text>
                  <Text style={styles.scheduleFilterCount}>{teacherRoster.length} học viên</Text>
                </View>
                <View style={styles.rosterStatusFilters}>
                  {['Đang học', 'Học xong', 'Tất cả'].map((status) => {
                    const selected = rosterFilter === status;
                    const count = status === 'Tất cả'
                      ? eligibleTeacherStudents.length
                      : eligibleTeacherStudents.filter((student) => status === 'Học xong'
                        ? student.enrollmentStatus === 'completed'
                        : student.enrollmentStatus !== 'completed').length;
                    return (
                      <Pressable
                        key={status}
                        onPress={() => setRosterFilter(status)}
                        style={[styles.rosterStatusChip, selected && styles.rosterStatusChipActive]}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <Text numberOfLines={1} style={[styles.rosterStatusText, selected && styles.rosterStatusTextActive]}>{status}</Text>
                        <Text style={[styles.rosterStatusCount, selected && styles.rosterStatusCountActive]}>{count}</Text>
                      </Pressable>
                    );
                  })}
                  <Pressable
                    onPress={() => {
                      if (showTeacherSearch) setTeacherQuery('');
                      setShowTeacherSearch((visible) => !visible);
                    }}
                    style={[styles.rosterSearchIconButton, showTeacherSearch && styles.rosterSearchIconButtonActive]}
                    accessibilityRole="button"
                    accessibilityLabel={showTeacherSearch ? 'Đóng tìm kiếm học viên' : 'Tìm học viên'}
                    accessibilityState={{ expanded: showTeacherSearch }}
                  >
                    {showTeacherSearch ? <X size={15} color={colors.brand} /> : <Search size={15} color={colors.brand} />}
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => setShowCoursePicker(true)}
                  style={styles.courseFilterSelect}
                  accessibilityRole="button"
                  accessibilityLabel={`Chọn khóa học, hiện tại ${teacherCourseFilter}`}
                  accessibilityState={{ expanded: showCoursePicker }}
                >
                  <Text style={styles.courseFilterSelectLabel}>Khóa học</Text>
                  <Text numberOfLines={1} style={styles.courseFilterSelectValue}>
                    {teacherCourseFilter === 'Tất cả khóa' ? 'Tất cả khóa học' : teacherCourseFilter}
                  </Text>
                  <ChevronDown size={16} color={colors.brand} />
                </Pressable>
                {showTeacherSearch ? (
                  <View style={styles.compactRosterSearch}>
                    <Search size={15} color={colors.muted} />
                    <TextInput
                      value={teacherQuery}
                      onChangeText={setTeacherQuery}
                      placeholder="Lọc tên học viên"
                      placeholderTextColor={colors.muted}
                      style={styles.compactRosterSearchInput}
                      accessibilityLabel="Lọc tên học viên"
                      returnKeyType="search"
                    />
                    {teacherQuery ? (
                      <Pressable onPress={() => setTeacherQuery('')} accessibilityRole="button" accessibilityLabel="Xóa từ khóa tìm kiếm">
                        <X size={15} color={colors.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
              {studentsResource.loading ? <LoadingSkeleton rows={1} /> : null}
              {studentsResource.error ? <ErrorState onRetry={studentsResource.reload} /> : null}
              {!studentsResource.loading && !studentsResource.error && !teacherRoster.length ? (
                <EmptyState
                  title={teacherQuery.trim() ? 'Không tìm thấy học viên khớp tên' : rosterFilter === 'Học xong' ? 'Không có học viên học xong trên bảng này' : rosterFilter === 'Tất cả' ? 'Chưa có học viên để xếp trên bảng này' : 'Chưa có học viên đang học để xếp trên bảng này'}
                  message="Học viên đủ điều kiện sẽ xuất hiện trong bảng xếp lịch."
                />
              ) : null}
              {!studentsResource.loading && !studentsResource.error && teacherRoster.length ? (
                <View style={styles.compactWeekGrid}>
                  <View style={styles.teacherWeekRange}>
                    <Pressable
                      onPress={() => setWeekOffset((value) => value - 1)}
                      style={styles.teacherWeekRangeArrow}
                      accessibilityRole="button"
                      accessibilityLabel="Tuần trước"
                    >
                      <ChevronLeft size={16} color={colors.brand} />
                    </Pressable>
                    <Pressable onPress={() => setWeekOffset(0)} accessibilityRole="button" accessibilityLabel="Về tuần hiện tại">
                      <Text style={styles.teacherWeekRangeLabel}>{weekLabel}</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setWeekOffset((value) => value + 1)}
                      style={styles.teacherWeekRangeArrow}
                      accessibilityRole="button"
                      accessibilityLabel="Tuần sau"
                    >
                      <ChevronRight size={16} color={colors.brand} />
                    </Pressable>
                  </View>
                  <ScrollView
                    style={styles.teacherCompactScroll}
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator
                  >
                    <View style={{ width: TEACHER_WEEK_NAME_CELL_WIDTH + weekDays.length * STUDENT_WEEK_CELL_WIDTH }}>
                      <View style={styles.teacherCompactWeekRow}>
                        <View style={[styles.teacherCompactNameCell, styles.compactWeekHeaderCell]}>
                          <Text style={styles.teacherCompactHeaderText}>Học viên</Text>
                        </View>
                        {weekDays.map((day, index) => {
                          const active = gridSort.kind === 'day' && gridSort.dayIndex === index;
                          return (
                            <View key={day.dateKey} style={[styles.teacherCompactDayCell, styles.compactWeekHeaderCell, active && styles.weekGridSortedCell]}>
                              <Text style={[styles.teacherCompactDayText, active && styles.weekGridTodayText]}>{index === 6 ? 'CN' : `T${index + 2}`}</Text>
                              <Text style={styles.teacherCompactDateText}>{day.day}</Text>
                              <Pressable
                                onPress={() => setSortMenu({ kind: 'day', dayIndex: index })}
                                style={[styles.teacherCompactSort, active && styles.weekGridSortActive]}
                                accessibilityRole="button"
                                accessibilityLabel={`Chọn sắp xếp lịch theo giờ ${day.weekday}`}
                              >
                                <Text style={[styles.teacherCompactSortText, active && styles.weekGridSortTextActive]}>
                                  {active ? gridSort.dir === 'asc' ? '↑' : '↓' : 'Giờ'}
                                </Text>
                                {!active ? <ChevronDown size={9} color={colors.muted} /> : null}
                              </Pressable>
                            </View>
                          );
                        })}
                      </View>
                      {teacherRoster.map((student) => (
                        <View key={student.id} style={styles.teacherCompactWeekRow}>
                          <View style={styles.teacherCompactNameCell}>
                            <Text numberOfLines={1} style={styles.teacherCompactStudentName}>{formatScheduleLabel(student.name)}</Text>
                            <Text numberOfLines={2} style={styles.teacherCompactCourse}>{formatScheduleLabel(student.course || '—')}</Text>
                            <Text style={styles.teacherCompactSessions}>{student.completedSessions ?? '—'}/{student.totalSessions ?? '—'} buổi</Text>
                          </View>
                          {weekDays.map((day) => {
                            const scheduled = allScheduleItems.find((item) => (
                              item.date === day.dateKey
                              && (item.studentId === student.id || (!item.studentId && item.studentName === student.name))
                              && item.status !== 'cancelled'
                            ));
                            const start = scheduled?.time.match(/\d{2}:\d{2}/)?.[0];
                            const past = day.dateKey < todayKey;
                            const locked = past || scheduled?.status === 'completed';
                            const statusLabel = scheduled?.status === 'completed'
                              ? 'Dạy'
                              : scheduled && isOverdueAttendance(scheduled)
                                ? 'Trễ'
                                : scheduled ? 'Đã xếp' : '';
                            return (
                              <Pressable
                                key={day.dateKey}
                                disabled={locked}
                                onPress={() => {
                                  setSelectedId(scheduled?.id || null);
                                  setSelectedStudentId(student.id);
                                  const matchingEnrollment = (student.enrollments || []).find((enrollment) => (
                                    enrollment.id === scheduled?.enrollmentId
                                    || (scheduled?.courseName && normalizeScheduleCourseName(enrollment.courseName) === normalizeScheduleCourseName(scheduled.courseName))
                                  ));
                                  setSelectedEnrollmentId(matchingEnrollment?.id || student.enrollments?.find((enrollment) => enrollment.status === 'Đang học')?.id || '');
                                  setClassDate(day.dateKey);
                                  setClassTime(start || '');
                                  setShowCreate(true);
                                }}
                                style={[
                                  styles.teacherCompactDayCell,
                                  styles.compactWeekSlotCell,
                                  scheduled?.status === 'completed' ? styles.weekGridCompletedCell : scheduled ? styles.weekGridBookedCell : undefined,
                                  locked && styles.weekGridLockedCell,
                                  day.dateKey === todayKey && styles.weekGridTodayColumn,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`${student.name}, ${day.weekday} ${day.day}, ${scheduled?.time || 'chưa xếp ca'}${locked ? ', đã khóa' : ''}`}
                              >
                                <Text numberOfLines={1} style={[styles.teacherCompactTime, scheduled && styles.weekGridBookedText]}>{start || '—'}</Text>
                                {statusLabel ? <Text numberOfLines={1} style={styles.teacherCompactStatus}>{statusLabel}</Text> : null}
                              </Pressable>
                            );
                          })}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              ) : null}
            </Card>
          ) : null}
        </>
      ) : null}
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!isTeacher && !resource.loading && !resource.error ? (
        <Card style={styles.studentDiaryCard}>
          <View style={styles.studentDiaryHeading}>
            <View style={styles.diaryHeadingIcon}><BookText size={16} color={colors.brand} /></View>
            <View style={styles.weeklyGridHeadingCopy}>
              <Text style={styles.weeklyGridTitle}>Nhật ký học tập</Text>
            </View>
          </View>
          <View style={styles.studentDiaryFilterContainer}>
            <View style={styles.studentDiaryFilterRow} accessibilityRole="tablist">
              {[
                { value: 'Ngày', label: 'Ngày', dateFilter: true },
                { value: 'Tuần', label: 'Tuần', dateFilter: true },
                { value: 'Tháng', label: 'Tháng', dateFilter: true },
                { value: 'Lịch hủy', label: 'Hủy', dateFilter: true },
                { value: 'Chưa điểm danh', label: 'Chưa điểm danh', dateFilter: false },
              ].map(({ value, label, dateFilter }) => {
                const selected = studentDiaryFilter === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setStudentDiaryFilter(value)}
                    style={[
                      styles.studentDiaryFilter,
                      dateFilter ? styles.studentDiaryDateFilter : styles.studentDiaryStatusFilter,
                      selected && styles.studentDiaryFilterActive,
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.studentDiaryFilterText, selected && styles.studentDiaryFilterTextActive]} numberOfLines={1}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {studentDiaryItems.map((item) => {
            const diaryStatus = getStudentDiaryStatus(item);
            return (
              <Card key={`log-${item.id}`} style={styles.studentDiaryLogRow}>
                <Pressable onPress={() => setSelectedId(item.id)} accessibilityRole="button" accessibilityLabel={`Mở chi tiết ${item.title}`}>
                  <Text numberOfLines={1} style={styles.studentDiaryLogTitle}>
                    {item.courseName || item.subject || item.title}
                  </Text>
                  <Text numberOfLines={1} style={styles.studentDiaryLogMeta}>
                    {item.person || item.teacherName || 'Giảng viên'} · {item.dateLabel || item.date || '—'} · {item.time || '—'}
                  </Text>
                </Pressable>
                <View style={styles.studentDiaryFooter}>
                  <View style={[
                    styles.studentDiaryStatus,
                    diaryStatus.tone === 'completed' ? styles.studentDiaryStatusCompleted
                      : diaryStatus.tone === 'cancelled' ? styles.studentDiaryStatusCancelled
                        : diaryStatus.tone === 'ongoing' ? styles.studentDiaryStatusOngoing
                          : diaryStatus.tone === 'pending' ? styles.studentDiaryStatusPending
                            : diaryStatus.tone === 'overdue' ? styles.studentDiaryStatusOverdue
                              : styles.studentDiaryStatusUpcoming,
                  ]}>
                    <Text style={[
                      styles.studentDiaryStatusText,
                      diaryStatus.tone === 'completed' ? styles.studentDiaryStatusTextCompleted
                        : diaryStatus.tone === 'cancelled' ? styles.studentDiaryStatusTextCancelled
                          : diaryStatus.tone === 'ongoing' ? styles.studentDiaryStatusTextOngoing
                            : diaryStatus.tone === 'pending' ? styles.studentDiaryStatusTextPending
                              : diaryStatus.tone === 'overdue' ? styles.studentDiaryStatusTextOverdue
                                : styles.studentDiaryStatusTextUpcoming,
                    ]}>{diaryStatus.label}</Text>
                  </View>
                  {item.status === 'upcoming' ? (
                    <View style={styles.studentDiaryActions}>
                      {item.meetingUrl ? (
                        <Pressable onPress={() => { void openAssignmentLink(item.meetingUrl, 'Lớp học'); }} style={styles.studentDiaryJoinButton} accessibilityRole="button">
                          <Text style={styles.studentDiaryJoinButtonText}>Vào lớp</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        onPress={() => {
                          setSelectedId(item.id);
                          setStudentNote(item.studentNote || '');
                          setShowStudentNote(true);
                        }}
                        style={styles.studentDiaryNoteButton}
                        accessibilityRole="button"
                      >
                        <Text style={styles.studentDiaryNoteButtonText}>Ghi chú / Đổi lịch</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
                {item.note ? <Text style={styles.studentDiaryNote} numberOfLines={2}>Ghi chú từ giảng viên: {item.note}</Text> : null}
                {item.studentNote ? <Text style={styles.studentDiaryNote} numberOfLines={2}>Ghi chú của bạn: {item.studentNote}</Text> : null}
                {item.grade != null ? <Text style={styles.metaText}>Điểm: {item.grade}/10</Text> : null}
              </Card>
            );
          })}
          {!studentDiaryItems.length ? (
            <Text style={styles.diaryEmpty}>
              {studentDiaryFilter === 'Ngày' ? 'Không có ca học trong ngày hôm nay.'
                : studentDiaryFilter === 'Tuần' ? 'Không có ca học trong tuần này.'
                  : studentDiaryFilter === 'Tháng' ? 'Không có ca học trong tháng này.'
                    : studentDiaryFilter === 'Chưa điểm danh' ? 'Không có ca chưa điểm danh.'
                      : studentDiaryFilter === 'Lịch hủy' ? 'Không có lịch hủy.'
                        : 'Chưa có ca học.'}
            </Text>
          ) : null}
        </Card>
      ) : null}
      {isTeacher && teacherScheduleView === 'week' && !resource.loading && !resource.error ? (
        <Card style={styles.studentDiaryCard}>
          <View style={styles.studentDiaryHeading}>
            <View style={styles.diaryHeadingIcon}><BookText size={16} color={colors.brand} /></View>
            <View style={styles.weeklyGridHeadingCopy}>
              <Text style={styles.weeklyGridTitle}>Nhật ký giảng dạy</Text>
            </View>
            <View style={styles.teacherDiaryCount}>
              <Text style={styles.teacherDiaryCountText}>{diaryItems.length}</Text>
              <Text style={styles.teacherDiaryCountLabel}>ca</Text>
            </View>
          </View>
          <View style={styles.teacherDiaryFilters}>
            <View style={styles.teacherDiaryDateFilters} accessibilityRole="tablist">
              {[
                { label: 'Ngày' },
                { label: 'Tuần' },
                { label: 'Tháng' },
                { label: 'Hủy', count: allScheduleItems.filter((item) => item.status === 'cancelled').length },
              ].map(({ label: filterOption, count }) => {
                const selected = diaryFilter === filterOption;
                const cancelled = filterOption === 'Hủy';
                return (
                  <Pressable
                    key={filterOption}
                    onPress={() => setDiaryFilter(selected ? 'Tất cả' : filterOption)}
                    style={[
                      styles.teacherDiaryDateFilter,
                      cancelled && styles.teacherDiaryDateFilterCancelled,
                      selected && (cancelled ? styles.teacherDiaryDateFilterCancelledActive : styles.teacherDiaryDateFilterActive),
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.teacherDiaryDateFilterText,
                        cancelled && styles.teacherDiaryDateFilterCancelledText,
                        selected && styles.teacherDiaryDateFilterTextActive,
                      ]}
                    >{filterOption}</Text>
                    {count !== undefined ? (
                      <Text style={[styles.teacherDiaryDateFilterCount, selected && styles.teacherDiaryDateFilterCountActive]}>{count}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.teacherDiaryStatusFilters} accessibilityRole="tablist">
              {[
                { label: 'Chưa điểm danh', count: allScheduleItems.filter(isTeacherAttendanceActionPending).length },
                { label: 'Chờ xác nhận', count: allScheduleItems.filter(isAttendanceAwaitingStudentConfirmation).length },
              ].map(({ label, count }) => {
                const selected = diaryFilter === label;
                const awaitingConfirmation = label === 'Chờ xác nhận';
                return (
                  <Pressable
                    key={label}
                    onPress={() => setDiaryFilter(selected ? 'Tất cả' : label)}
                    style={[
                      styles.teacherDiaryStatusFilter,
                      awaitingConfirmation && styles.teacherDiaryConfirmationFilter,
                      selected && (awaitingConfirmation
                        ? styles.teacherDiaryConfirmationFilterActive
                        : styles.teacherDiaryPendingFilterActive),
                    ]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.teacherDiaryStatusFilterText,
                        awaitingConfirmation && styles.teacherDiaryConfirmationFilterText,
                        selected && styles.teacherDiaryStatusFilterTextActive,
                      ]}
                    >{label}</Text>
                    <Text style={[
                      styles.teacherDiaryStatusCount,
                      awaitingConfirmation && styles.teacherDiaryConfirmationCount,
                      selected && styles.teacherDiaryStatusCountActive,
                    ]}>{count}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {diaryItems.map((item) => {
            const date = item.date ? new Date(`${item.date}T00:00:00`) : null;
            const validDate = date && Number.isFinite(date.getTime()) ? date : null;
            const cancelled = item.status === 'cancelled';
            const attendancePending = isTeacherAttendanceActionPending(item);
            const attendanceAwaitingConfirmation = isAttendanceAwaitingStudentConfirmation(item);
            const attendanceAvailable = canTeacherMarkAttendance(item, scheduleNow);
            const makeupOverdue = canTeacherRequestMakeup(item, scheduleNow);
            const makeupRequestSent = Boolean(user && mobileMakeupRequestsSent.has(`${user.id}:${item.id}`));
            return (
              <Card
                key={`teacher-log-${item.id}`}
                style={cancelled ? { ...styles.teacherDiarySession, ...styles.teacherDiarySessionCancelled } : styles.teacherDiarySession}
              >
                <View style={styles.teacherDiarySessionMain}>
                  <View style={[styles.teacherDiaryDateTile, cancelled && styles.teacherDiaryDateTileCancelled]}>
                    {validDate ? (
                      <>
                        <Text style={[styles.teacherDiaryDateMonth, cancelled && styles.teacherDiaryDateMonthCancelled]}>T{validDate.getMonth() + 1}</Text>
                        <Text style={[styles.teacherDiaryDateDay, cancelled && styles.teacherDiaryDateDayCancelled]}>{validDate.getDate()}</Text>
                      </>
                    ) : <CalendarDays size={19} color={cancelled ? colors.red : colors.brand} />}
                  </View>
                  <View style={styles.teacherDiarySessionCopy}>
                    <Text style={styles.teacherDiarySessionTitle}>{item.title}</Text>
                    <View style={styles.teacherDiaryMetaRow}>
                      <Clock3 size={13} color={colors.muted} />
                      <Text style={styles.teacherDiaryMetaText}>{item.dateLabel || item.date || '—'} · {item.time || '—'}</Text>
                    </View>
                    <View style={styles.teacherDiaryMetaRow}>
                      <Users size={13} color={colors.muted} />
                      <Text style={styles.teacherDiaryMetaText}>Học viên: {item.studentName || '—'}</Text>
                    </View>
                    {item.subject ? <Text numberOfLines={1} style={styles.teacherDiarySubject}>{item.subject}</Text> : null}
                  </View>
                </View>
                <View style={styles.teacherDiarySessionFooter}>
                  <StatusBadge label={attendanceStatusLabel(item, scheduleNow)} compact />
                  {attendancePending || attendanceAwaitingConfirmation ? (
                    <View style={styles.teacherDiaryActions}>
                      {attendanceAwaitingConfirmation ? (
                        <Pressable
                          disabled
                          style={[styles.teacherDiaryAttendanceButton, styles.teacherDiaryAttendanceButtonSubmitted]}
                          accessibilityRole="button"
                          accessibilityLabel={`Điểm danh đã gửi, chờ xác nhận ${item.studentName || item.title}`}
                          accessibilityState={{ disabled: true }}
                        >
                          <CheckCircle size={15} color="#B91C1C" />
                          <Text style={[styles.teacherDiaryAttendanceButtonText, styles.teacherDiaryAttendanceButtonTextSubmitted]}>Điểm danh</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          disabled={makeupOverdue ? makeupRequestSent : !attendanceAvailable}
                          onPress={() => {
                            if (makeupOverdue) {
                              if (!makeupRequestSent) setMakeupTarget(item);
                              return;
                            }
                            navigation.navigate('Attendance', { scheduleId: item.id });
                          }}
                          style={[
                            styles.teacherDiaryAttendanceButton,
                            makeupOverdue && (makeupRequestSent ? styles.teacherDiaryMakeupButtonSent : styles.teacherDiaryMakeupButton),
                            !attendanceAvailable && !makeupOverdue && styles.teacherDiaryAttendanceButtonDisabled,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={makeupOverdue
                            ? `${makeupRequestSent ? 'Đã gửi Admin' : 'Điểm danh bù'} ${item.studentName || item.title}`
                            : attendanceAvailable
                              ? `Điểm danh ${item.studentName || item.title}`
                              : `${teacherAttendanceActionLabel(item, scheduleNow)}: ${item.studentName || item.title}`}
                          accessibilityState={{ disabled: makeupOverdue ? makeupRequestSent : !attendanceAvailable }}
                        >
                          <CheckCircle size={15} color={makeupOverdue && makeupRequestSent ? '#64748B' : attendanceAvailable || makeupOverdue ? '#FFFFFF' : '#94A3B8'} />
                          <Text style={[
                            styles.teacherDiaryAttendanceButtonText,
                            makeupOverdue && (makeupRequestSent ? styles.teacherDiaryMakeupButtonTextSent : styles.teacherDiaryMakeupButtonText),
                            !attendanceAvailable && !makeupOverdue && styles.teacherDiaryAttendanceButtonTextDisabled,
                          ]}>{makeupOverdue ? makeupRequestSent ? 'Đã gửi Admin' : 'Điểm danh bù' : teacherAttendanceActionLabel(item, scheduleNow)}</Text>
                        </Pressable>
                      )}
                      {makeupOverdue && !attendanceAwaitingConfirmation ? (
                        <Pressable
                          onPress={() => {
                            setCancelTarget(item);
                            setCancelReason('');
                          }}
                          style={styles.teacherDiaryCancelButton}
                          accessibilityRole="button"
                          accessibilityLabel={`Hủy ca ${item.studentName || item.title}`}
                        >
                          <Ban size={14} color="#FFFFFF" />
                          <Text style={styles.teacherDiaryCancelButtonText}>Hủy ca</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </Card>
            );
          })}
          {!diaryItems.length ? (
            <EmptyState
              title={diaryFilter === 'Hủy' ? 'Chưa có lịch bị hủy' : diaryFilter === 'Chờ xác nhận' ? 'Không có ca chờ xác nhận' : diaryFilter === 'Chưa điểm danh' ? 'Không có ca đang chờ điểm danh' : 'Chưa có ca dạy'}
              message={diaryFilter === 'Ngày' ? 'Không có ca dạy trong ngày hôm nay.' : diaryFilter === 'Tuần' ? 'Không có ca dạy trong tuần này.' : diaryFilter === 'Tháng' ? 'Không có ca dạy trong tháng này.' : 'Các buổi dạy sẽ xuất hiện tại đây.'}
            />
          ) : null}
        </Card>
      ) : null}
      {selectedItem && !isTeacher ? (
        <Card style={styles.studentDetail}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{selectedItem.title}</Text>
            <Pressable onPress={() => setSelectedId(null)} accessibilityRole="button"><Text style={styles.closeText}>Đóng</Text></Pressable>
          </View>
          <Text style={styles.muted}>{selectedItem.dateLabel} · {selectedItem.time}</Text>
          <Text style={styles.muted}>{selectedItem.location} · {selectedItem.person}</Text>
          <StatusBadge label={selectedItem.status} />
          {selectedItem.note ? <Text style={styles.metaText}>Ghi chú từ giảng viên: {selectedItem.note}</Text> : null}
          {selectedItem.studentNote ? <Text style={styles.metaText}>Ghi chú của bạn: {selectedItem.studentNote}</Text> : null}
          {selectedItem.attendanceConfirmPending ? (
            <>
              <Text style={styles.metaText}>Giảng viên đang chờ bạn xác nhận điểm danh buổi học.</Text>
              <PrimaryButton
                title={respondingAttendance ? 'Đang gửi…' : 'Đồng ý điểm danh'}
                variant="secondary"
                disabled={respondingAttendance}
                onPress={() => { void respondToAttendance('accept'); }}
              />
              <PrimaryButton
                title="Không đồng ý"
                variant="quiet"
                disabled={respondingAttendance}
                onPress={() => Alert.alert(
                  'Gửi phản hồi không đồng ý?',
                  'Buổi học sẽ được chuyển cho trung tâm xử lý và chưa tính vào tiến độ.',
                  [
                    { text: 'Quay lại', style: 'cancel' },
                    { text: 'Gửi phản hồi', style: 'destructive', onPress: () => { void respondToAttendance('dispute'); } },
                  ],
                )}
              />
            </>
          ) : selectedItem.attendanceDisputed ? (
            <Text style={styles.metaText}>Bạn đã gửi phản hồi không đồng ý. Trung tâm đang xử lý.</Text>
          ) : selectedItem.attendanceRejected ? (
            <Text style={styles.metaText}>Admin đã không chấp thuận điểm danh. Buổi này không được tính vào tiến độ.</Text>
          ) : selectedItem.confirmedByStudent ? (
            <Text style={styles.metaText}>Bạn đã xác nhận điểm danh buổi học.</Text>
          ) : null}
          <PrimaryButton title="Ghi chú / Đổi lịch" variant="quiet" onPress={() => {
            setStudentNote(selectedItem.studentNote || '');
            setShowStudentNote(true);
          }} />
        </Card>
      ) : null}
      {isTeacher && notificationScheduleId && selectedItem?.id === notificationScheduleId ? (
        <Card style={styles.studentDetail}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Buổi học trong thông báo</Text>
            <Pressable
              onPress={() => {
                setNotificationScheduleId(null);
                setSelectedId(null);
              }}
              accessibilityRole="button"
              accessibilityLabel="Đóng chi tiết buổi học"
            >
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>
          <Text style={styles.cardTitle}>{selectedItem.title}</Text>
          <Text style={styles.muted}>{selectedItem.dateLabel} · {selectedItem.time}</Text>
          <Text style={styles.muted}>Học viên: {selectedItem.studentName || selectedItem.person}</Text>
          {selectedItem.courseName || selectedItem.subject ? (
            <Text style={styles.metaText}>{selectedItem.courseName || selectedItem.subject}</Text>
          ) : null}
          <StatusBadge label={attendanceStatusLabel(selectedItem, scheduleNow)} />
        </Card>
      ) : null}
      <Modal visible={showStudentNote} transparent animationType="slide" onRequestClose={() => setShowStudentNote(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle}>Ghi Chú & Phản Hồi</Text>
                <Text style={styles.metaText}>Gửi trực tiếp cho Giảng viên trên lịch này</Text>
              </View>
              <Pressable onPress={() => setShowStudentNote(false)} accessibilityRole="button" accessibilityLabel="Đóng ghi chú">
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <TextInput
              value={studentNote}
              onChangeText={setStudentNote}
              placeholder="Nhập nội dung ghi chú (VD: Em xin học bù vào thứ 7, Xin đến trễ 10p, ...)"
              multiline
              style={[styles.formInput, styles.formTextarea]}
              accessibilityLabel="Nội dung ghi chú buổi học"
            />
            <View style={styles.modalActions}>
              <PrimaryButton title="Hủy" variant="quiet" onPress={() => setShowStudentNote(false)} />
              <PrimaryButton
                title={savingStudentNote ? 'Đang gửi…' : 'Gửi Ghi Chú'}
                disabled={!studentNote.trim() || savingStudentNote}
                onPress={() => { void saveScheduleNote(); }}
              />
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(cancelTarget)} transparent animationType="fade" onRequestClose={() => setCancelTarget(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle}>Hủy buổi dạy</Text>
                <Text style={styles.metaText}>{cancelTarget?.studentName || 'Học viên'} · {cancelTarget?.dateLabel} · {cancelTarget?.time}</Text>
              </View>
              <Pressable onPress={() => setCancelTarget(null)} accessibilityRole="button" accessibilityLabel="Đóng hủy lịch">
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Nhập lý do hủy buổi học"
              multiline
              style={[styles.formInput, styles.formTextarea]}
              accessibilityLabel="Lý do hủy buổi học"
            />
            <View style={styles.modalActions}>
              <PrimaryButton title="Giữ lịch" variant="quiet" disabled={cancellingSchedule} onPress={() => setCancelTarget(null)} />
              <PrimaryButton
                title={cancellingSchedule ? 'Đang hủy…' : 'Xác nhận hủy'}
                disabled={!cancelReason.trim() || cancellingSchedule}
                onPress={() => { void confirmCancelSchedule(); }}
              />
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        visible={Boolean(makeupTarget)}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!sendingMakeupRequest) setMakeupTarget(null);
        }}
      >
        <View style={styles.makeupModalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              if (!sendingMakeupRequest) setMakeupTarget(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Đóng popup điểm danh bù"
          />
          <View style={styles.makeupModalCard} accessibilityRole="alert">
            <View style={styles.makeupModalHeader}>
              <View style={styles.makeupModalHeaderCopy}>
                <Text style={styles.makeupModalTitle}>Điểm danh bù</Text>
                <Text style={styles.makeupModalSubtitle}>Quá hạn cửa sổ điểm danh 1 giờ</Text>
              </View>
              <Pressable
                onPress={() => setMakeupTarget(null)}
                disabled={sendingMakeupRequest}
                style={styles.makeupModalClose}
                accessibilityRole="button"
                accessibilityLabel="Đóng điểm danh bù"
              >
                <X size={19} color="#FFFFFF" />
              </Pressable>
            </View>
            <ScrollView style={styles.makeupModalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.makeupModalSession}>
                <Text style={styles.makeupModalSectionLabel}>Thông tin buổi học</Text>
                <Text style={styles.makeupModalStudent}>Học viên: {makeupStudentName}</Text>
                <Text style={styles.makeupModalDetail}>Khóa học: <Text style={styles.makeupModalStrong}>{makeupCourseName}</Text></Text>
                {makeupTotalSessions > 0 ? (
                  <Text style={styles.makeupModalDetail}>
                    Buổi: <Text style={styles.makeupModalStrong}>{makeupCompletedSessions + 1}/{makeupTotalSessions}</Text>
                  </Text>
                ) : null}
                <Text style={styles.makeupModalDetail}>Lịch: <Text style={styles.makeupModalStrong}>{makeupTarget?.dateLabel || makeupTarget?.date || 'Chưa xác định'}</Text></Text>
                <Text style={styles.makeupModalDetail}>Giờ: <Text style={styles.makeupModalStrong}>{makeupTarget?.time || 'Chưa xác định'}</Text></Text>
              </View>
              <View style={styles.makeupModalNotice}>
                <Text style={styles.makeupModalNoticeTitle}>Giảng viên lưu ý</Text>
                <Text style={styles.makeupModalNoticeText}>Bạn chịu trách nhiệm về buổi học này.</Text>
                <Text style={styles.makeupModalNoticeText}>
                  Admin sẽ liên hệ học viên để xác nhận buổi học. Buổi chỉ được tính khi học viên xác nhận đã học.
                </Text>
              </View>
              {makeupAlreadyRequested ? (
                <Text style={styles.makeupModalAlreadySent}>Đã gửi yêu cầu — chờ Admin xét duyệt điểm danh bù.</Text>
              ) : null}
            </ScrollView>
            <View style={styles.makeupModalActions}>
              <Pressable
                onPress={() => setMakeupTarget(null)}
                disabled={sendingMakeupRequest}
                style={styles.makeupModalCancel}
                accessibilityRole="button"
              >
                <Text style={styles.makeupModalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable
                onPress={() => { void sendMakeupRequestToAdmin(); }}
                disabled={sendingMakeupRequest || makeupAlreadyRequested}
                style={[
                  styles.makeupModalSend,
                  (sendingMakeupRequest || makeupAlreadyRequested) && styles.makeupModalSendDisabled,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: sendingMakeupRequest || makeupAlreadyRequested }}
              >
                {sendingMakeupRequest
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Send size={16} color="#FFFFFF" />}
                <Text style={styles.makeupModalSendText}>{sendingMakeupRequest ? 'Đang gửi…' : makeupAlreadyRequested ? 'Đã gửi' : 'Gửi Admin'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(sortMenu)} transparent animationType="fade" onRequestClose={() => setSortMenu(null)}>
        <View style={[styles.modalBackdrop, styles.centeredPickerBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSortMenu(null)} accessibilityRole="button" accessibilityLabel="Đóng sắp xếp" />
          <View style={[styles.sortMenuCard, styles.centeredPickerCard]}>
            <View style={styles.sortMenuHeading}>
              <View style={styles.sortMenuIcon}><Table2 size={17} color={colors.brand} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle}>Sắp xếp theo giờ</Text>
                <Text style={styles.metaText}>
                  {weekDays[sortDayIndex]?.weekday}
                </Text>
              </View>
              <Pressable onPress={() => setSortMenu(null)} accessibilityRole="button" accessibilityLabel="Đóng sắp xếp">
                <X size={20} color={colors.muted} />
              </Pressable>
            </View>
            {[
              { label: 'Không sắp xếp theo giờ', value: 'day-none' },
              { label: 'Giờ tăng dần · thấp đến cao', value: 'day-asc' },
              { label: 'Giờ giảm dần · cao đến thấp', value: 'day-desc' },
            ].map((option) => {
              const isSelected = option.value === 'day-none'
                ? gridSort.kind !== 'day' || gridSort.dayIndex !== sortDayIndex
                : gridSort.kind === 'day'
                && gridSort.dayIndex === sortDayIndex
                && gridSort.dir === (option.value === 'day-asc' ? 'asc' : 'desc');
              return (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    if (option.value === 'day-none') setGridSort({ kind: 'name', dir: 'asc', dayIndex: 0 });
                    else if (sortDayIndex >= 0) {
                      setGridSort({
                        kind: 'day',
                        dir: option.value === 'day-asc' ? 'asc' : 'desc',
                        dayIndex: sortDayIndex,
                      });
                    }
                    setSortMenu(null);
                  }}
                  style={[styles.sortMenuOption, isSelected && styles.sortMenuOptionSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.sortMenuOptionText, isSelected && styles.sortMenuOptionTextSelected]}>{option.label}</Text>
                  {isSelected ? <Check size={17} color={colors.brand} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
      <Modal visible={showCoursePicker} transparent animationType="fade" onRequestClose={() => setShowCoursePicker(false)}>
        <View style={[styles.modalBackdrop, styles.centeredPickerBackdrop]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowCoursePicker(false)} accessibilityRole="button" accessibilityLabel="Đóng chọn khóa học" />
          <View style={[styles.sortMenuCard, styles.centeredPickerCard]}>
            <View style={styles.sortMenuHeading}>
              <View style={styles.sortMenuIcon}><BookOpen size={17} color={colors.brand} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle}>Chọn khóa học</Text>
                <Text style={styles.metaText}>Lọc học viên theo khóa</Text>
              </View>
              <Pressable onPress={() => setShowCoursePicker(false)} accessibilityRole="button" accessibilityLabel="Đóng chọn khóa học">
                <X size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView style={styles.coursePickerOptions} showsVerticalScrollIndicator>
              {teacherCourseFilters.map((course) => {
                const selected = teacherCourseFilter === course;
                return (
                  <Pressable
                    key={course}
                    onPress={() => {
                      setTeacherCourseFilter(course);
                      setShowCoursePicker(false);
                    }}
                    style={[styles.sortMenuOption, selected && styles.sortMenuOptionSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text numberOfLines={2} style={[styles.sortMenuOptionText, selected && styles.sortMenuOptionTextSelected]}>
                      {course === 'Tất cả khóa' ? 'Tất cả khóa học' : course}
                    </Text>
                    {selected ? <Check size={17} color={colors.brand} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={showStudentCoursePicker} transparent animationType="fade" onRequestClose={() => setShowStudentCoursePicker(false)}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowStudentCoursePicker(false)} accessibilityRole="button" accessibilityLabel="Đóng chọn khóa học" />
          <View style={styles.sortMenuCard}>
            <View style={styles.sortMenuHeading}>
              <View style={styles.sortMenuIcon}><BookOpen size={17} color={colors.brand} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle}>Chọn khóa học</Text>
                <Text style={styles.metaText}>Lọc lịch học theo khóa</Text>
              </View>
              <Pressable onPress={() => setShowStudentCoursePicker(false)} accessibilityRole="button" accessibilityLabel="Đóng chọn khóa học">
                <X size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView style={styles.coursePickerOptions} showsVerticalScrollIndicator>
              {studentCourses.map((course) => {
                const selected = activeStudentCourse === course;
                return (
                  <Pressable
                    key={course}
                    onPress={() => {
                      setSelectedCourse(course);
                      setShowStudentCoursePicker(false);
                    }}
                    style={[styles.sortMenuOption, selected && styles.sortMenuOptionSelected]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text numberOfLines={2} style={[styles.sortMenuOptionText, selected && styles.sortMenuOptionTextSelected]}>{course}</Text>
                    {selected ? <Check size={17} color={colors.brand} /> : null}
                  </Pressable>
                );
              })}
              {!studentCourses.length ? <Text style={styles.metaText}>Chưa có khóa học để chọn.</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle}>Chọn khung giờ</Text>
                <Text style={styles.metaText}>{selectedStudent?.name || 'Học viên'} · {selectedScheduleEnrollment?.courseName || selectedStudent?.course || '—'} · {classDate}</Text>
                <Text style={styles.metaText}>Ca 90 phút · lịch sẽ được lưu và đồng bộ với hệ thống.</Text>
              </View>
              <Pressable onPress={() => setShowCreate(false)} accessibilityRole="button" accessibilityLabel="Đóng chọn khung giờ">
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            {activeScheduleEnrollments.length > 1 ? (
              <View style={styles.group}>
                <Text style={styles.fieldLabel}>Khóa học / enrollment</Text>
                <View style={styles.choiceWrap}>
                  {activeScheduleEnrollments.map((enrollment) => (
                    <Pressable
                      key={enrollment.id}
                      onPress={() => setSelectedEnrollmentId(enrollment.id)}
                      style={[styles.choice, selectedEnrollmentId === enrollment.id && styles.choiceActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selectedEnrollmentId === enrollment.id }}
                    >
                      <Text style={[styles.choiceText, selectedEnrollmentId === enrollment.id && styles.choiceTextActive]}>
                        {enrollment.courseName}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            <ScrollView style={styles.slotOptionsList} contentContainerStyle={styles.slotOptions}>
              {slotOptions.map((option) => {
                const slotStart = Number(option.start.slice(0, 2)) * 60 + Number(option.start.slice(3, 5));
                const slotEnd = slotStart + 90;
                const unavailableReason = (classDate === todayKey && slotEnd <= now.getHours() * 60 + now.getMinutes())
                  ? 'Đã qua'
                  : (itemsOverride || resource.data || []).some((item) => {
                    if (item.id === selectedId || item.date !== classDate || item.status !== 'upcoming') return false;
                    if (item.studentId === selectedStudentId) return true;
                    const conflictStart = item.time.match(/(\d{2}):(\d{2})/);
                    if (!conflictStart) return false;
                    const otherStart = Number(conflictStart[1]) * 60 + Number(conflictStart[2]);
                    return slotStart < otherStart + 90 && otherStart < slotEnd;
                  }) ? 'Đã có lịch' : '';
                const unavailable = Boolean(unavailableReason);
                return (
                  <Pressable key={option.start} disabled={unavailable || savingSlot || blockedByEnrollment} onPress={() => { void selectSlot(option.start); }} style={[styles.slotOption, classTime === option.start && styles.slotOptionSelected, (unavailable || savingSlot || blockedByEnrollment) && styles.slotOptionDisabled]} accessibilityRole="button" accessibilityState={{ selected: classTime === option.start, disabled: unavailable || savingSlot || blockedByEnrollment }}>
                    <Text style={[styles.slotOptionText, classTime === option.start && styles.slotOptionTextSelected, (unavailable || savingSlot || blockedByEnrollment) && styles.slotOptionTextDisabled]}>{savingSlot ? 'Đang lưu… ' : ''}{option.label}{unavailable ? ` · ${unavailableReason}` : ''}</Text>
                  </Pressable>
                );
              })}
              {selectedId ? <Pressable disabled={savingSlot} onPress={() => { void selectSlot(null); }} style={styles.clearSlotAction} accessibilityRole="button"><Text style={styles.clearSlotActionText}>{savingSlot ? 'Đang cập nhật…' : 'Bỏ ca khỏi lịch'}</Text></Pressable> : null}
            </ScrollView>
            <PrimaryButton title="Đóng" variant="quiet" disabled={savingSlot} onPress={() => setShowCreate(false)} />
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

function TeacherAssignmentCard({ item, courseStudentCount }: { item: Assignment; courseStudentCount: number }) {
  const submissions = item.submissions || [];
  const gradedCount = submissions.filter((submission) => submission.status === 'graded').length;
  const assignedCount = !item.assignedStudentNames || item.assignedStudentNames.includes('Cả lớp')
    ? courseStudentCount
    : item.assignedStudentNames.length;
  const deadlineMatch = item.deadline.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const deadlineAt = deadlineMatch
    ? new Date(Number(deadlineMatch[3]), Number(deadlineMatch[2]) - 1, Number(deadlineMatch[1]), 23, 59, 59).getTime()
    : new Date(item.deadline).getTime();
  const isClosed = Number.isFinite(deadlineAt) && deadlineAt < Date.now();
  return (
    <Card style={styles.teacherAssignmentCard}>
      <View style={styles.teacherAssignmentHeader}>
        <View style={styles.teacherAssignmentTitleWrap}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.metaText}>{item.subject}</Text>
        </View>
        <View style={[styles.teacherAssignmentStatus, isClosed ? styles.teacherAssignmentClosed : styles.teacherAssignmentActive]}>
          <Text style={[styles.teacherAssignmentStatusText, isClosed ? styles.teacherAssignmentClosedText : styles.teacherAssignmentActiveText]}>
            {isClosed ? 'Đã đóng' : 'Hoạt động'}
          </Text>
        </View>
      </View>
      <Text numberOfLines={2} style={styles.teacherAssignmentDescription}>{item.description || 'Không có mô tả.'}</Text>
      <Text style={styles.teacherAssignmentDeadline}>Hạn chót: {item.deadline}</Text>
      <View style={styles.teacherAssignmentMetrics}>
        <View style={styles.teacherAssignmentMetric}>
          <Text style={styles.teacherAssignmentMetricValue}>{submissions.length}</Text>
          <Text style={styles.teacherAssignmentMetricLabel}>Bài nộp</Text>
        </View>
        <View style={styles.teacherAssignmentMetric}>
          <Text style={styles.teacherAssignmentMetricValue}>{gradedCount}</Text>
          <Text style={styles.teacherAssignmentMetricLabel}>Đã chấm</Text>
        </View>
        <View style={styles.teacherAssignmentMetric}>
          <Text style={styles.teacherAssignmentMetricValue}>{Math.max(0, assignedCount - submissions.length)}</Text>
          <Text style={styles.teacherAssignmentMetricLabel}>Chưa nộp</Text>
        </View>
      </View>
    </Card>
  );
}

export function AssignmentsScreen({
  embedded = false,
  focusAssignmentId,
  onAssignmentFocused,
}: {
  embedded?: boolean;
  focusAssignmentId?: string;
  onAssignmentFocused?: () => void;
} = {}) {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<AppStackParamList, 'Assignments'>>();
  const screenScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const isTeacher = user?.role === 'teacher';
  const [filter, setFilter] = useState('Tất cả');
  const [courseFilter, setCourseFilter] = useState('');
  const [coursePickerOpen, setCoursePickerOpen] = useState(false);
  const [overrides, setOverrides] = useState<Assignment[] | null>(null);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [course, setCourse] = useState('');
  const [attachedFileUrl, setAttachedFileUrl] = useState('');
  const [deadline, setDeadline] = useState('');
  const [showDeadlineCalendar, setShowDeadlineCalendar] = useState(false);
  const [deadlineCalendarMonth, setDeadlineCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [assignToAll, setAssignToAll] = useState(true);
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [submissionFile, setSubmissionFile] = useState<{ uri: string; name: string; mimeType?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingGrade, setIsSavingGrade] = useState(false);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const loader = useCallback(() => assignmentService.list(isTeacher ? 'teacher' : 'student', user), [isTeacher, user]);
  const resource = useMockResource(loader);
  useEffect(() => {
    const targetAssignmentId = focusAssignmentId || route.params?.assignmentId;
    if (!targetAssignmentId || resource.loading || !resource.data) return;
    const assignment = resource.data.find((item) => item.id === targetAssignmentId);
    if (!assignment) {
      Alert.alert('Không tìm thấy nội dung', 'Bài tập trong thông báo không còn trong danh sách của bạn.');
      navigation.setParams({ assignmentId: undefined });
      return;
    }
    setSelected(assignment);
    setSelectedSubmissionId(assignment.submissions?.find((submission) => submission.status !== 'graded')?.id
      || assignment.submissions?.[0]?.id
      || null);
    setSubmissionLink(assignment.submissions?.[0]?.submittedFileUrl || '');
    setSubmissionFile(null);
    if (onAssignmentFocused) onAssignmentFocused();
    else if (!embedded) setTimeout(() => screenScrollRef.current?.scrollToEnd({ animated: true }), 120);
    navigation.setParams({ assignmentId: undefined });
  }, [embedded, focusAssignmentId, navigation, onAssignmentFocused, resource.data, resource.loading, route.params?.assignmentId]);
  const studentsLoader = useCallback(() => studentService.assigned(user), [user]);
  const studentsResource = useMockResource(studentsLoader);
  useFocusEffect(useCallback(() => {
    resource.reload();
  }, [resource.reload]));
  useEffect(() => {
    const assignmentSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.ASSIGNMENT_CHANGED, () => {
      resource.reload();
    });
    const submissionSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.SUBMISSION_CHANGED, () => {
      resource.reload();
    });
    const refreshSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.DATA_REFRESH, (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const type = String((payload as Record<string, unknown>).type || '').toLowerCase();
      if (type === 'assignment' || type === 'submission') resource.reload();
    });
    return () => {
      assignmentSubscription.remove();
      submissionSubscription.remove();
      refreshSubscription.remove();
    };
  }, [resource.reload]);
  const allItems = overrides || resource.data || [];
  const teacherStudents = studentsResource.data || [];
  const courses = useMemo(
    () => [...new Set(teacherStudents.flatMap((student) => student.courses?.length ? student.courses : [student.course]).filter(Boolean))],
    [teacherStudents],
  );
  useEffect(() => {
    if (!courses.length) {
      setCourseFilter('');
      return;
    }
    if (!courses.includes(courseFilter)) setCourseFilter(courses[0]);
  }, [courseFilter, courses]);
  const courseStudents = teacherStudents.filter((student) => !course || student.courses?.includes(course) || student.course === course);
  const courseFilterStudents = teacherStudents.filter((student) => !courseFilter || student.courses?.includes(courseFilter) || student.course === courseFilter);
  const deadlineCalendarDays = useMemo(() => {
    const firstWeekday = new Date(deadlineCalendarMonth.getFullYear(), deadlineCalendarMonth.getMonth(), 1).getDay();
    const daysInMonth = new Date(deadlineCalendarMonth.getFullYear(), deadlineCalendarMonth.getMonth() + 1, 0).getDate();
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    return Array.from({ length: cellCount }, (_, index) => {
      const day = index - firstWeekday + 1;
      return day > 0 && day <= daysInMonth ? day : null;
    });
  }, [deadlineCalendarMonth]);
  const items = useMemo(() => allItems.filter((item) => (
    (!isTeacher || !courseFilter || item.subject === courseFilter || item.courseName === courseFilter)
    && (filter === 'Tất cả'
      || (filter === 'Chờ xử lý' && ['Chưa làm', 'Cần chấm'].includes(item.status))
      || item.status === filter)
  )), [allItems, courseFilter, filter, isTeacher]);
  const filters = isTeacher
    ? ['Tất cả', 'Cần chấm', 'Đã chấm']
    : ['Tất cả', 'Chưa làm', 'Đã nộp', 'Quá hạn'];
  const teacherFilterCounts = useMemo(() => {
    if (!isTeacher) return undefined;
    const inCourse = allItems.filter((item) => !courseFilter || item.subject === courseFilter || item.courseName === courseFilter);
    return {
      'Cần chấm': { value: inCourse.filter((item) => item.status === 'Cần chấm').length, color: '#6D28D9', background: '#EDE9FE' },
      'Đã chấm': { value: inCourse.filter((item) => item.status === 'Đã chấm').length, color: '#047857', background: '#D1FAE5' },
    };
  }, [allItems, courseFilter, isTeacher]);
  const openCreateAssignment = () => {
    resetCreateForm();
    setCourse(courseFilter);
    setShowCreate(true);
  };
  const saveGrade = async () => {
    if (!selected || grade === '' || Number(grade) < 0 || Number(grade) > 10) {
      Alert.alert('Điểm chưa hợp lệ', 'Nhập điểm từ 0 đến 10.');
      return;
    }
    const submission = selected.submissions?.find((item) => item.id === selectedSubmissionId)
      || selected.submissions?.find((item) => item.status !== 'graded');
    if (!submission) {
      Alert.alert('Chưa có bài nộp', 'Chỉ có thể chấm điểm sau khi học viên gửi bài.');
      return;
    }
    setIsSavingGrade(true);
    try {
      if (user?.previewMode || (__DEV__ && process.env.EXPO_PUBLIC_MOBILE_UI_QA_STATE)) {
        setOverrides(allItems.map((item) => item.id === selected.id
          ? {
            ...item,
            status: 'Đã chấm',
            submissions: item.submissions?.map((row) => row.id === submission.id
              ? { ...row, status: 'graded', grade: Number(grade), teacherFeedback: feedback.trim() }
              : row),
          }
          : item));
      } else {
        await assignmentService.grade(submission.id, Number(grade), feedback);
        setOverrides(null);
        resource.reload();
      }
      setSelected(null);
      setSelectedSubmissionId(null);
      setGrade('');
      setFeedback('');
      Alert.alert('Đã lưu điểm', user?.previewMode ? 'Điểm chỉ lưu trong bản xem trước.' : 'Điểm và nhận xét đã được lưu.');
    } catch (error) {
      Alert.alert('Không thể lưu điểm', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setIsSavingGrade(false);
    }
  };
  const resetCreateForm = () => {
    setTitle('');
    setDescription('');
    setAttachedFileUrl('');
    setDeadline('');
    setCourse('');
    setAssignToAll(true);
    setAssignedStudentIds([]);
    setEditingAssignmentId(null);
  };
  const startEditAssignment = (assignment: Assignment) => {
    resetCreateForm();
    setEditingAssignmentId(assignment.id);
    setTitle(assignment.title);
    setDescription(assignment.description || '');
    setAttachedFileUrl(assignment.sourceFileUrl || assignment.attachedFileUrl || '');
    setDeadline(assignment.deadlineDate || '');
    setCourse(assignment.subject);
    setShowCreate(true);
  };
  const saveEditedAssignment = async () => {
    if (!editingAssignmentId) return;
    if (!title.trim()) {
      Alert.alert('Thiếu thông tin', 'Nhập tên bài tập.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline.trim())) {
      Alert.alert('Hạn nộp chưa hợp lệ', 'Chọn ngày hạn nộp.');
      return;
    }
    setIsCreatingAssignment(true);
    try {
      await assignmentService.update(editingAssignmentId, { title, description, fileUrl: attachedFileUrl, deadline });
      resetCreateForm();
      setShowCreate(false);
      setSelected(null);
      setOverrides(null);
      resource.reload();
      Alert.alert('Đã cập nhật', 'Bài tập đã được cập nhật.');
    } catch (error) {
      Alert.alert('Không thể cập nhật', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setIsCreatingAssignment(false);
    }
  };
  const confirmDeleteAssignment = (assignment: Assignment) => {
    Alert.alert('Xóa bài tập', `Xóa bài "${assignment.title}"? Bài nộp của học viên cũng sẽ bị xóa.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await assignmentService.remove(assignment.id);
              setSelected(null);
              setOverrides(null);
              resource.reload();
            } catch (error) {
              Alert.alert('Không thể xóa', error instanceof Error ? error.message : 'Vui lòng thử lại.');
            }
          })();
        },
      },
    ]);
  };
  const createAssignment = async () => {
    if (!title.trim()) {
      Alert.alert('Thiếu thông tin', 'Nhập tên bài tập.');
      return;
    }
    if (!course) {
      Alert.alert('Chưa chọn khóa học', 'Chọn khóa học trước khi giao bài.');
      return;
    }
    if (assignToAll && !courseStudents.length) {
      Alert.alert('Chưa có học viên', 'Khóa học này chưa có học viên được phân công để nhận bài tập.');
      return;
    }
    if (!assignToAll && !assignedStudentIds.length) {
      Alert.alert('Chưa chọn học viên', 'Chọn ít nhất một học viên hoặc giao cho cả lớp.');
      return;
    }
    const deadlineValue = deadline.trim();
    const parsedDeadline = deadlineValue ? new Date(`${deadlineValue}T23:59:59`).getTime() : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deadlineValue) || parsedDeadline === null || !Number.isFinite(parsedDeadline) || parsedDeadline <= Date.now()) {
      Alert.alert('Hạn nộp chưa hợp lệ', 'Nhập ngày hợp lệ trong tương lai theo định dạng YYYY-MM-DD.');
      return;
    }
    if (!user || user.role !== 'teacher') {
      Alert.alert('Không thể giao bài', 'Tài khoản giảng viên không hợp lệ.');
      return;
    }
    setIsCreatingAssignment(true);
    try {
      if (user.previewMode || (__DEV__ && process.env.EXPO_PUBLIC_MOBILE_UI_QA_STATE)) {
        const assignedStudents = assignToAll ? courseStudents : courseStudents.filter((student) => assignedStudentIds.includes(student.id));
        setOverrides([{
          id: `task-${Date.now()}`,
          title: title.trim(),
          subject: course,
          teacher: user.name,
          deadline: deadlineValue,
          status: 'Chưa làm',
          description: description.trim(),
          attachedFileUrl: attachedFileUrl.trim() || undefined,
          assignedStudentNames: assignToAll ? ['Cả lớp'] : assignedStudents.map((student) => student.name),
        }, ...allItems]);
      } else {
        const created = await assignmentService.create(user, {
          title,
          courseId: course,
          description,
          fileUrl: attachedFileUrl,
          deadline: deadlineValue,
          studentIds: assignToAll ? courseStudents.map((student) => student.id) : assignedStudentIds,
        });
        setOverrides(null);
        resource.reload();
        Alert.alert('Đã giao bài', created === 1 ? 'Bài tập đã được giao.' : `Đã giao ${created} bài tập.`);
      }
      resetCreateForm();
      setShowCreate(false);
    } catch (error) {
      setOverrides(null);
      resource.reload();
      const partial = error instanceof PartialAssignmentCreationError;
      if (partial) {
        resetCreateForm();
        setShowCreate(false);
      }
      Alert.alert(partial ? 'Đã giao một phần' : 'Không thể giao bài', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setIsCreatingAssignment(false);
    }
  };
  const pickSubmissionFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, multiple: false });
      if (!result.canceled) {
        const file = result.assets[0];
        setSubmissionLink('');
        setSubmissionFile({ uri: file.uri, name: file.name, mimeType: file.mimeType || undefined });
      }
    } catch (error) {
      Alert.alert('Không thể chọn tệp', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  };
  const submitSelected = async () => {
    if (!selected || !user || user.role !== 'student') return;
    const url = submissionLink.trim();
    if (!submissionFile && !/^https?:\/\/\S+$/i.test(url)) {
      Alert.alert('Liên kết chưa hợp lệ', 'Nhập liên kết bài làm bắt đầu bằng HTTP:// hoặc HTTPS://.');
      return;
    }
    setIsSubmitting(true);
    try {
      const submissionUrl = submissionFile
        ? await uploadStudentAssignmentFile(submissionFile)
        : url;
      await assignmentService.submit(selected.id, user.id, submissionUrl);
      setSelected({ ...selected, status: 'Đã nộp' });
      setSubmissionLink('');
      setSubmissionFile(null);
      setOverrides(null);
      resource.reload();
      Alert.alert('Đã nộp bài', 'Bài làm đã được gửi đến hệ thống.');
    } catch (error) {
      Alert.alert('Không thể nộp bài', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const content = (
    <>
      {!embedded ? <AppHeader
        title={isTeacher ? 'Giao bài tập & kiểm tra' : 'Bài tập'}
        subtitle={isTeacher ? 'Theo dõi bài đã giao và cần chấm' : 'Bài tập trong các khóa học của bạn'}
        showBackButton={false}
        centered
        right={!isTeacher && !embedded ? (
          <View style={styles.headerActions}>
            <Pressable onPress={() => navigation.navigate('Materials')} style={styles.readAll} accessibilityRole="button">
              <Text style={styles.readAllText}>Tài liệu</Text>
            </Pressable>
          </View>
        ) : undefined}
      /> : null}
      {isTeacher && !embedded ? (
        <View style={styles.assessmentTabs} accessibilityRole="tablist">
          <Pressable onPress={() => navigation.navigate('TeacherQuizzes')} style={styles.assessmentTab} accessibilityRole="tab" accessibilityState={{ selected: false }}>
            <Text style={styles.assessmentTabText}>Trắc nghiệm</Text>
          </Pressable>
          <View style={[styles.assessmentTab, styles.assessmentTabActive]} accessible accessibilityRole="tab" accessibilityState={{ selected: true }}>
            <Text style={[styles.assessmentTabText, styles.assessmentTabTextActive]}>Bài tập về nhà</Text>
          </View>
        </View>
      ) : null}
      {isTeacher ? (
        <View style={styles.assignToolbar}>
          <Pressable
            onPress={() => setCoursePickerOpen(true)}
            disabled={courses.length <= 1}
            style={styles.assignCoursePill}
            accessibilityRole="button"
            accessibilityLabel={`Bài tập của khóa ${courseFilter || 'chưa chọn'}${courses.length > 1 ? ', bấm để đổi khóa' : ''}`}
          >
            <FileText size={18} color={colors.brand} />
            <View style={styles.flex}>
              <Text style={styles.assignCourseCaption}>Bài tập của</Text>
              <Text numberOfLines={1} style={styles.assignCourseName}>{courseFilter || 'Chưa có khóa học'}</Text>
            </View>
            {courses.length > 1 ? <ChevronDown size={18} color="#B91C1C" /> : null}
          </Pressable>
          <Pressable onPress={openCreateAssignment} style={styles.assignCreateButton} accessibilityRole="button" accessibilityLabel="Tạo bài tập mới">
            <Plus size={16} color="#FFFFFF" />
            <Text style={styles.assignCreateText}>{'Tạo bài\ntập mới'}</Text>
          </Pressable>
        </View>
      ) : null}
      <Modal visible={coursePickerOpen} transparent animationType="fade" onRequestClose={() => setCoursePickerOpen(false)}>
        <Pressable style={styles.assignSheetBackdrop} onPress={() => setCoursePickerOpen(false)} accessibilityLabel="Đóng">
          <Pressable style={styles.assignSheet} onPress={() => {}}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>Chọn khóa học</Text>
              <Pressable onPress={() => setCoursePickerOpen(false)} accessibilityRole="button" accessibilityLabel="Đóng"><X size={20} color={colors.muted} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.assignSheetList}>
              {courses.map((courseOption) => {
                const active = courseFilter === courseOption;
                return (
                  <Pressable
                    key={courseOption}
                    onPress={() => {
                      setCourseFilter(courseOption);
                      setSelected(null);
                      setCoursePickerOpen(false);
                    }}
                    style={[styles.assignSheetOption, active && styles.assignSheetOptionActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text numberOfLines={2} style={[styles.assignSheetOptionText, active && styles.assignSheetOptionTextActive]}>{courseOption}</Text>
                    {active ? <Check size={18} color={colors.brand} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
      <FilterChips items={filters} selected={filter} onSelect={setFilter} variant="tabs" counts={teacherFilterCounts} />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && !items.length ? <EmptyState title="Không có bài tập" message="Thử chọn bộ lọc khác nhé." /> : null}
      {!resource.loading && !resource.error && items.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => {
            setSelected(item);
            setSelectedSubmissionId(item.submissions?.find((submission) => submission.status !== 'graded')?.id || item.submissions?.[0]?.id || null);
            setSubmissionLink(item.submissions?.[0]?.submittedFileUrl || '');
            setSubmissionFile(null);
          }}
          accessibilityRole="button"
        >
          {isTeacher ? (
            <TeacherAssignmentCard item={item} courseStudentCount={courseFilterStudents.length} />
          ) : <AssignmentCard item={item} />}
        </Pressable>
      ))}
      {selected ? (
        <Card style={styles.studentDetail}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{selected.title}</Text>
            <Pressable onPress={() => setSelected(null)} accessibilityRole="button"><Text style={styles.closeText}>Đóng</Text></Pressable>
          </View>
          <Text style={styles.muted}>{selected.subject} · Hạn: {selected.deadline}</Text>
          <Text style={styles.muted}>{selected.description || 'Không có mô tả.'}</Text>
          {selected.attachedFileName || selected.attachedFileUrl ? (
            <Pressable onPress={() => { void openAssignmentLink(selected.attachedFileUrl, 'Tệp đề bài'); }} style={styles.fileLinkRow} accessibilityRole="button" accessibilityLabel="Mở tệp đề bài">
              <FileText size={18} color={colors.brand} /><Text style={styles.fileLinkText}>{selected.attachedFileName || 'Tệp đề bài'}</Text><Text style={styles.fileLinkAction}>Mở</Text>
            </Pressable>
          ) : null}
          {selected.assignedStudentNames?.length ? <Text style={styles.metaText}>Học viên được giao: {selected.assignedStudentNames.join(', ')}</Text> : null}
          {isTeacher && !user?.previewMode && !selected.submissions?.some((submission) => submission.status === 'graded') ? (
            <View style={styles.assignmentManageRow}>
              <Pressable onPress={() => startEditAssignment(selected)} style={styles.assignmentManageButton} accessibilityRole="button" accessibilityLabel="Sửa bài tập">
                <Text style={styles.assignmentManageText}>Sửa bài</Text>
              </Pressable>
              <Pressable onPress={() => confirmDeleteAssignment(selected)} style={styles.assignmentManageButton} accessibilityRole="button" accessibilityLabel="Xóa bài tập">
                <Text style={[styles.assignmentManageText, styles.assignmentManageDanger]}>Xóa bài</Text>
              </Pressable>
            </View>
          ) : null}
          {isTeacher ? (
            <>
              <SectionHeading title={`Bài nộp (${selected.submissions?.length || 0})`} />
              {(selected.submissions || []).map((submission) => (
                <Pressable key={submission.id} onPress={() => setSelectedSubmissionId(submission.id)} accessibilityRole="button" accessibilityState={{ selected: selectedSubmissionId === submission.id }}>
                  <Card style={selectedSubmissionId === submission.id ? { ...styles.submissionCard, ...styles.choiceActive } : styles.submissionCard}>
                    <Text style={styles.cardTitle}>{submission.studentName}</Text>
                    <Text style={styles.metaText}>{submission.submittedAt}</Text>
                    <Pressable onPress={() => { void openAssignmentLink(submission.submittedFileUrl, 'Bài nộp'); }} style={styles.fileLinkRow} accessibilityRole="button" accessibilityLabel={`Mở tệp ${submission.submittedFileUrl || 'bài nộp'}`}>
                      <FileText size={18} color={colors.brand} />
                      <Text style={styles.fileLinkText}>{submission.submittedFileUrl || 'Không có file'}</Text>
                      <Text style={styles.fileLinkAction}>Mở</Text>
                    </Pressable>
                    {submission.grade != null ? <Text style={styles.metaText}>Điểm: {submission.grade}/10 · {submission.teacherFeedback || ''}</Text> : null}
                  </Card>
                </Pressable>
              ))}
              {!selected.submissions?.length ? <Text style={styles.note}>Chưa có bài nộp để chấm.</Text> : null}
              <Text style={styles.fieldLabel}>Điểm (0–10)</Text>
              <TextInput value={grade} onChangeText={setGrade} keyboardType="decimal-pad" placeholder="Nhập điểm" style={styles.formInput} accessibilityLabel="Điểm bài tập" />
              <TextInput value={feedback} onChangeText={setFeedback} placeholder="Nhận xét / chữa bài" multiline style={[styles.formInput, styles.formTextarea]} accessibilityLabel="Nhận xét bài tập" />
              <PrimaryButton title={isSavingGrade ? 'Đang lưu…' : 'Lưu điểm'} disabled={!selectedSubmissionId || !selected.submissions?.some((submission) => submission.id === selectedSubmissionId && submission.status !== 'graded') || isSavingGrade} onPress={() => { void saveGrade(); }} />
            </>
          ) : (
            <>
              {selected.grade != null ? <Text style={styles.metaText}>Điểm: {selected.grade}/10 · {selected.teacherFeedback || ''}</Text> : null}
              {selected.submissions?.[0]?.submittedFileUrl ? (
                <Pressable onPress={() => { void openAssignmentLink(selected.submissions?.[0]?.submittedFileUrl, 'Bài đã nộp'); }} style={styles.fileLinkRow} accessibilityRole="button" accessibilityLabel="Mở bài đã nộp">
                  <FileText size={18} color={colors.brand} />
                  <Text style={styles.fileLinkText}>Mở bài đã nộp</Text>
                  <Text style={styles.fileLinkAction}>Mở</Text>
                </Pressable>
              ) : null}
              <Text style={styles.fieldLabel}>Liên kết bài làm</Text>
              <TextInput
                value={submissionLink}
                onChangeText={(value) => {
                  setSubmissionLink(value);
                  if (value.trim()) setSubmissionFile(null);
                }}
                placeholder="HTTPS://drive.google.com/..."
                autoCapitalize="none"
                keyboardType="url"
                style={styles.formInput}
                accessibilityLabel="Liên kết bài làm"
              />
              <Pressable onPress={() => { void pickSubmissionFile(); }} style={styles.fileLinkRow} accessibilityRole="button">
                <FileText size={18} color={colors.brand} />
                <Text style={styles.fileLinkText}>{submissionFile?.name || 'Chọn tệp bài làm'}</Text>
                <Text style={styles.fileLinkAction}>{submissionFile ? 'Đổi tệp' : 'Chọn tệp'}</Text>
              </Pressable>
              {submissionFile ? (
                <Pressable onPress={() => setSubmissionFile(null)} style={styles.fileLinkRow} accessibilityRole="button">
                  <X size={16} color={colors.muted} /><Text style={styles.note}>Bỏ tệp đã chọn</Text>
                </Pressable>
              ) : null}
              <PrimaryButton
                title={isSubmitting ? 'Đang nộp…' : selected.status === 'Đã chấm' ? 'Đã chấm bài' : selected.status === 'Đã nộp' ? 'Nộp lại bài' : 'Nộp bài'}
                disabled={(!submissionFile && !submissionLink.trim()) || isSubmitting || selected.status === 'Đã chấm'}
                loading={isSubmitting}
                onPress={() => { void submitSelected(); }}
              />
              <Text style={styles.note}>Có thể gửi liên kết hoặc tải tệp bài làm trực tiếp.</Text>
            </>
          )}
        </Card>
      ) : null}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.assignmentModalCard}>
            <ScrollView
              style={styles.assignmentModalScroll}
              contentContainerStyle={styles.assignmentModalContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.cardTitle}>{editingAssignmentId ? 'Sửa bài tập' : 'Tạo bài tập'}</Text>
              <TextInput value={title} onChangeText={setTitle} placeholder="Tên bài tập" style={styles.formInput} />
              <TextInput value={description} onChangeText={setDescription} placeholder="Mô tả / yêu cầu" multiline style={[styles.formInput, styles.formTextarea]} />
              <Text style={styles.fieldLabel}>Link File đề bài (Google Drive...)</Text>
              <TextInput value={attachedFileUrl} onChangeText={setAttachedFileUrl} placeholder="HTTPS://..." autoCapitalize="none" keyboardType="url" style={styles.formInput} accessibilityLabel="Link File đề bài Google Drive" />
              {attachedFileUrl.trim() ? <Pressable onPress={() => { void openAssignmentLink(attachedFileUrl.trim(), 'Tệp đề bài'); }} style={styles.fileLinkRow} accessibilityRole="button"><Link2 size={17} color={colors.brand} /><Text numberOfLines={1} style={styles.fileLinkText}>Xem trước liên kết</Text></Pressable> : null}
              {editingAssignmentId ? <Text style={styles.metaText}>Khóa học: {course}</Text> : null}
              {!editingAssignmentId ? (<>
              <Text style={styles.fieldLabel}>Khóa học</Text>
              {studentsResource.loading ? <Text style={styles.note}>Đang tải khóa học…</Text> : null}
              {studentsResource.error ? <Text style={styles.note}>Không tải được khóa học: {studentsResource.error}</Text> : null}
              {courses.length ? (
                <View style={styles.choiceWrap}>
                  {courses.map((courseOption) => <Pressable key={courseOption} onPress={() => { setCourse(courseOption); setAssignedStudentIds([]); }} style={[styles.choice, course === courseOption && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: course === courseOption }}><Text style={[styles.choiceText, course === courseOption && styles.choiceTextActive]}>{courseOption}</Text></Pressable>)}
                </View>
              ) : <Text style={styles.note}>Chưa có khóa học được phân công.</Text>}
              <Text style={styles.fieldLabel}>Đối tượng giao</Text>
              <View style={styles.choiceWrap}>
                <Pressable onPress={() => setAssignToAll(true)} style={[styles.choice, assignToAll && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: assignToAll }}><Text style={[styles.choiceText, assignToAll && styles.choiceTextActive]}>Cả lớp ({courseStudents.length || '—'})</Text></Pressable>
                <Pressable onPress={() => setAssignToAll(false)} style={[styles.choice, !assignToAll && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: !assignToAll }}><Text style={[styles.choiceText, !assignToAll && styles.choiceTextActive]}>Chọn học viên</Text></Pressable>
              </View>
              {!assignToAll ? courseStudents.map((student) => {
                const selectedStudent = assignedStudentIds.includes(student.id);
                return <Pressable key={student.id} onPress={() => setAssignedStudentIds((current) => selectedStudent ? current.filter((id) => id !== student.id) : [...current, student.id])} style={[styles.choice, selectedStudent && styles.choiceActive]} accessibilityRole="checkbox" accessibilityState={{ checked: selectedStudent }}><Text style={[styles.choiceText, selectedStudent && styles.choiceTextActive]}>{selectedStudent ? '✓  ' : ''}{student.name} · {student.course}</Text></Pressable>;
              }) : null}
              </>) : null}
              <Pressable
                onPress={() => setShowDeadlineCalendar((visible) => !visible)}
                style={styles.deadlinePickerButton}
                accessibilityRole="button"
                accessibilityLabel={deadline ? `Hạn nộp ${deadline}` : 'Chọn ngày hạn nộp'}
                accessibilityState={{ expanded: showDeadlineCalendar }}
              >
                <CalendarDays size={18} color={colors.brand} />
                <Text style={deadline ? styles.deadlinePickerValue : styles.deadlinePickerPlaceholder}>
                  {deadline || 'Chọn ngày hạn nộp'}
                </Text>
                <ChevronDown size={18} color={colors.muted} />
              </Pressable>
              {showDeadlineCalendar ? (
                <View style={styles.deadlineCalendar}>
                  <View style={styles.monthCalendarControls}>
                    <Pressable
                      onPress={() => setDeadlineCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                      style={styles.monthCalendarArrow}
                      accessibilityRole="button"
                      accessibilityLabel="Tháng trước"
                    >
                      <ChevronLeft size={19} color={colors.ink} />
                    </Pressable>
                    <Text style={styles.monthCalendarTitle}>
                      {deadlineCalendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}
                    </Text>
                    <Pressable
                      onPress={() => setDeadlineCalendarMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                      style={styles.monthCalendarArrow}
                      accessibilityRole="button"
                      accessibilityLabel="Tháng sau"
                    >
                      <ChevronRight size={19} color={colors.ink} />
                    </Pressable>
                  </View>
                  <View style={styles.monthCalendarWeekdays}>
                    {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((day) => (
                      <Text key={day} style={styles.monthCalendarWeekday}>{day}</Text>
                    ))}
                  </View>
                  <View style={styles.monthCalendarGrid}>
                    {Array.from({ length: deadlineCalendarDays.length / 7 }, (_, weekIndex) => (
                      <View key={`deadline-week-${weekIndex}`} style={styles.monthCalendarWeek}>
                        {deadlineCalendarDays.slice(weekIndex * 7, weekIndex * 7 + 7).map((day, dayIndex) => {
                          if (!day) return <View key={`deadline-empty-${weekIndex}-${dayIndex}`} style={styles.monthCalendarCell} />;
                          const dateKey = `${deadlineCalendarMonth.getFullYear()}-${String(deadlineCalendarMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                          const selected = dateKey === deadline;
                          const today = new Date();
                          const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                          const isPast = dateKey < todayKey;
                          return (
                            <Pressable
                              key={dateKey}
                              onPress={() => {
                                setDeadline(dateKey);
                                setShowDeadlineCalendar(false);
                              }}
                              disabled={isPast}
                              style={[styles.monthCalendarCell, styles.monthCalendarDay, selected && styles.monthCalendarDaySelected, isPast && styles.deadlineCalendarDayDisabled]}
                              accessibilityRole="button"
                              accessibilityState={{ selected, disabled: isPast }}
                              accessibilityLabel={`${day} ${deadlineCalendarMonth.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}`}
                            >
                              <Text style={[styles.monthCalendarDayText, selected && styles.monthCalendarDayTextSelected, isPast && styles.deadlineCalendarDayTextDisabled]}>{day}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              <Text style={styles.note}>Bài tập sẽ được giao trên hệ thống. Tệp đính kèm hiện dùng liên kết tải đã có.</Text>
            </ScrollView>
            <View style={styles.assignmentModalActions}>
              <PrimaryButton
                title={editingAssignmentId
                  ? (isCreatingAssignment ? 'Đang lưu…' : 'Lưu thay đổi')
                  : (isCreatingAssignment ? 'Đang giao…' : 'Giao bài tập')}
                disabled={isCreatingAssignment}
                onPress={() => { void (editingAssignmentId ? saveEditedAssignment() : createAssignment()); }}
              />
              <Pressable onPress={() => { setShowCreate(false); setEditingAssignmentId(null); }} style={styles.assignmentModalClose} accessibilityRole="button">
                <Text style={styles.assignmentModalCloseText}>Đóng</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {isTeacher && user?.previewMode ? <Text style={styles.footnote}>Bản xem trước không gửi dữ liệu lên hệ thống.</Text> : null}
    </>
  );
  return (
    <View style={styles.assignmentScreen}>
      {embedded ? <View>{content}</View> : <AppScreen scrollViewRef={screenScrollRef}>{content}</AppScreen>}
    </View>
  );
}

export function MaterialsScreen() {
  const { user } = useAuth();
  const loader = useCallback(() => materialService.list(user), [user]);
  const resource = useMockResource(loader);
  const materials = resource.data || [];
  const visibleMaterials = materials.filter((item) => item.type !== 'VIDEO');
  return (
    <AppScreen>
      <AppHeader
        title="Tài liệu học tập"
        subtitle="Tài nguyên từ các lớp của bạn"
        showBackButton={false}
        centered
        compact
      />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && !visibleMaterials.length ? <EmptyState title="Chưa có tài liệu" message="Nội dung mới sẽ được hiển thị tại đây." /> : null}
      {!resource.loading && !resource.error && visibleMaterials.map((item) => (
        <MaterialRow key={item.id} item={item} />
      ))}
    </AppScreen>
  );
}

type StudentResourceTab = 'files' | 'software' | 'assignments';

export function StudentResourcesScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<AppStackParamList, 'Assignments'>>();
  const screenScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [activeTab, setActiveTab] = useState<StudentResourceTab>('files');
  const focusAssignmentId = route.params?.assignmentId;
  const materialsLoader = useCallback(() => materialService.list(user), [user]);
  const softwareLoader = useCallback(() => softwareService.list(user), [user]);
  const assignmentsLoader = useCallback(() => assignmentService.list('student', user), [user]);
  const materialsResource = useMockResource(materialsLoader);
  const softwareResource = useMockResource(softwareLoader);
  const assignmentsResource = useMockResource(assignmentsLoader);
  useEffect(() => {
    if (focusAssignmentId) setActiveTab('assignments');
  }, [focusAssignmentId]);
  const scrollToFocusedAssignment = useCallback(() => {
    setTimeout(() => screenScrollRef.current?.scrollToEnd({ animated: true }), 120);
  }, []);
  const materials = (materialsResource.data || []).filter((item) => item.type !== 'VIDEO');
  const software = softwareResource.data || [];
  const pendingAssignments = (assignmentsResource.data || []).filter((item) => ['Chưa làm', 'Cần chấm'].includes(item.status)).length;
  const tabs: Array<{ id: StudentResourceTab; label: string; count: number }> = [
    { id: 'files', label: 'Tài liệu', count: materials.length },
    { id: 'software', label: 'Phần mềm', count: software.length },
    { id: 'assignments', label: 'Bài tập', count: pendingAssignments },
  ];
  return (
    <AppScreen scrollViewRef={screenScrollRef}>
      <AppHeader title="Bài tập và tài nguyên" subtitle="Tài liệu, phần mềm và bài tập trong khóa học" showBackButton={false} centered compact />
      <View style={styles.assignmentTabs} accessibilityRole="tablist">
        {tabs.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.assignmentTab, activeTab === tab.id && styles.assignmentTabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.id }}
          >
            <Text style={activeTab === tab.id ? styles.assignmentTabActiveText : styles.assignmentTabText}>
              {tab.label}{tab.count ? ` (${tab.count})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      {activeTab === 'files' ? (
        <>
          {materialsResource.loading ? <LoadingSkeleton /> : null}
          {materialsResource.error ? <ErrorState onRetry={materialsResource.reload} /> : null}
          {!materialsResource.loading && !materialsResource.error && !materials.length ? <EmptyState title="Chưa có tài liệu" message="Nội dung mới sẽ được hiển thị tại đây." /> : null}
          {!materialsResource.loading && !materialsResource.error && materials.map((item) => <MaterialRow key={item.id} item={item} />)}
        </>
      ) : null}
      {activeTab === 'software' ? (
        <>
          {softwareResource.loading ? <LoadingSkeleton /> : null}
          {softwareResource.error ? <ErrorState onRetry={softwareResource.reload} /> : null}
          {!softwareResource.loading && !softwareResource.error && !software.length ? <EmptyState title="Chưa có phần mềm" message="Phần mềm của khóa học sẽ hiển thị tại đây." /> : null}
          {!softwareResource.loading && !softwareResource.error && software.map((item: DemoSoftwareLink) => (
            <Card key={item.id} style={styles.materialRow}>
              <View style={styles.fileIcon}><Download size={20} color={colors.brand} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle}>{item.name}</Text>
                <Text style={styles.metaText}>{item.category}</Text>
                {item.description ? <Text style={styles.muted}>{item.description}</Text> : null}
                <Pressable onPress={() => { void openAssignmentLink(item.url, item.name); }} style={styles.fileLinkRow} accessibilityRole="button">
                  <Text style={styles.fileLinkAction}>Mở phần mềm</Text>
                </Pressable>
              </View>
            </Card>
          ))}
        </>
      ) : null}
      {activeTab === 'assignments' ? (
        <AssignmentsScreen
          embedded
          focusAssignmentId={focusAssignmentId}
          onAssignmentFocused={scrollToFocusedAssignment}
        />
      ) : null}
    </AppScreen>
  );
}

function MaterialRow({ item }: { item: LearningMaterial }) {
  const iconMap = {
    PDF: <FileText size={20} color={colors.red} />,
    WORD: <FileText size={20} color={colors.blue} />,
    EXCEL: <FileSpreadsheet size={20} color={colors.green} />,
    VIDEO: <Film size={20} color={colors.purple} />,
    LINK: <Link2 size={20} color={colors.brand} />,
  };
  return (
    <Card style={styles.materialRow}>
      <View style={styles.fileIcon}>{iconMap[item.type]}</View>
      <View style={styles.rowCopy}>
        <View style={styles.rowBetween}>
          <Text style={styles.fileType}>{item.type}</Text>
          <Text style={styles.metaText}>{item.size}</Text>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        <Text style={styles.metaText}>{item.subject}  ·  {item.date}</Text>
        {item.url ? (
          <Pressable onPress={() => { void openAssignmentLink(item.url, item.title); }} style={styles.fileLinkRow} accessibilityRole="button" accessibilityLabel={`Mở tài liệu ${item.title}`}>
            <Text style={styles.fileLinkAction}>Mở tài liệu</Text>
          </Pressable>
        ) : <Text style={styles.note}>Chưa có liên kết tải.</Text>}
      </View>
    </Card>
  );
}

function notificationCategory(item: AppNotification) {
  if (item.payload?.kind === 'feed_interaction') return 'Bảng tin';
  const labels: Record<string, string> = {
    SYSTEM: 'Hệ thống',
    COURSE: 'Khóa học',
    STUDENT: 'Khóa học',
    FINANCE: 'Tài chính',
    SCHEDULE: 'Lịch dạy',
    EXAM: 'Thi',
    EVALUATION: 'Đánh giá',
    GRADE: 'Đánh giá',
    MESSAGE: 'Tin nhắn',
    ADMIN: 'Admin',
    NEWS: 'Tin tức',
    TRAINING: 'Đào tạo',
    ASSIGNMENT: 'Khóa học',
    LESSON: 'Khóa học',
  };
  const raw = String(item.type || item.payload?.type || item.category || '').trim();
  const normalized = raw.toUpperCase();
  if (labels[normalized]) return labels[normalized];
  const aliases: Record<string, string> = {
    'LỊCH HỌC': 'Lịch dạy',
    'HỌC PHÍ': 'Tài chính',
    'BÀI TẬP': 'Khóa học',
    'BÀI KIỂM TRA': 'Thi',
  };
  return aliases[normalized] || item.category || 'Thông báo';
}

export function NotificationsScreen({ overlay = false, onClose }: { overlay?: boolean; onClose?: () => void }) {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const pendingActions = useRef(new Set<string>());
  const pendingNotificationRefresh = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loader = useCallback(
    () => notificationService.list(user?.role === 'teacher' ? 'teacher' : 'student', page),
    [page, user?.role],
  );
  const resource = useMockResource(loader);
  const notifications = resource.data?.items || [];
  const pageCount = Math.max(1, resource.data?.pages || 1);
  const currentPage = Math.min(page, pageCount);
  const pageItems = resource.data?.page === currentPage ? notifications : [];
  const unreadCount = resource.data?.unread || 0;
  const refreshControl = <RefreshControl refreshing={resource.loading} onRefresh={resource.reload} tintColor={colors.brand} />;

  useEffect(() => {
    setPage(1);
  }, [user?.id, user?.role]);
  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.NOTIFICATION, () => {
      if (pendingNotificationRefresh.current) clearTimeout(pendingNotificationRefresh.current);
      pendingNotificationRefresh.current = setTimeout(() => {
        pendingNotificationRefresh.current = null;
        resource.reload();
      }, 100);
    });
    return () => {
      if (pendingNotificationRefresh.current) clearTimeout(pendingNotificationRefresh.current);
      pendingNotificationRefresh.current = null;
      subscription.remove();
    };
  }, [resource.reload]);

  const reportNotificationError = (error: unknown, action: string) => {
    Alert.alert(action, error instanceof Error ? error.message : 'Không thể hoàn tất thao tác thông báo.');
  };
  const markAll = async () => {
    if (!unreadCount || pendingActions.current.has('mark-all')) return;
    pendingActions.current.add('mark-all');
    try {
      await notificationService.markRead();
      DeviceEventEmitter.emit('mobile:notifications-mark-all-read');
      resource.reload();
    } catch (error) {
      reportNotificationError(error, 'Đánh dấu đã đọc');
    } finally {
      pendingActions.current.delete('mark-all');
    }
  };
  const markRead = async (item: AppNotification) => {
    if (!item.unread) return true;
    if (pendingActions.current.has(item.id)) return false;
    pendingActions.current.add(item.id);
    try {
      await notificationService.markRead(item.id);
      DeviceEventEmitter.emit('mobile:notification-read', { id: item.id });
      resource.reload();
      return true;
    } catch (error) {
      reportNotificationError(error, 'Đánh dấu đã đọc');
      return false;
    } finally {
      pendingActions.current.delete(item.id);
    }
  };
  const openRelated = (item: AppNotification) => {
    const type = String(item.type || item.payload?.type || item.category).trim().toUpperCase();
    const path = String(item.targetPath || '').toLowerCase();
    const payload = item.payload || {};
    if (item.payload?.kind === 'lms_qa') {
      Alert.alert('Thông báo', 'Chi tiết hỏi đáp LMS hiện chỉ mở được trên website.');
      return;
    }
    if (payload.kind === 'class_link_updated' && typeof payload.linkHoc === 'string' && payload.linkHoc.trim()) {
      void Linking.openURL(payload.linkHoc.trim()).catch((error: unknown) => reportNotificationError(error, 'Mở lớp học'));
      return;
    }
    if (item.payload?.action === 'blog_published') {
      const newsId = String(item.payload.blogPostId || item.payload.slug || '').trim();
      if (newsId) {
        navigation.navigate('NewsDetail', { newsId });
        return;
      }
    }
    if (payload.kind === 'feed_interaction') {
      navigation.navigate('MainTabs', {
        screen: 'Feed',
        params: {
          postId: String(payload.postId || ''),
          commentId: String(payload.commentId || ''),
          parentCommentId: String(payload.parentCommentId || ''),
        },
      });
      return;
    }
    if (path.includes('/profile')) {
      navigation.navigate('MainTabs', { screen: 'Profile' });
      return;
    }
    if ((path.includes('inbox') || type === 'MESSAGE') && payload.conversationId) {
      navigation.navigate('Conversation', {
        conversationId: String(payload.conversationId),
        conversationName: typeof payload.conversationName === 'string' ? payload.conversationName : undefined,
        participantId: typeof payload.participantId === 'string' ? payload.participantId : undefined,
        participantRole: typeof payload.participantRole === 'string' ? payload.participantRole : undefined,
      });
      return;
    }
    if (path.includes('exam') || type === 'EXAM') {
      if (user?.role === 'student') {
        const quizId = String(payload.quizId || '').trim();
        if (quizId) {
          navigation.navigate('StudentExam', { quizId });
          return;
        }
        Alert.alert('Thông báo', 'Kết quả thi/chứng nhận chi tiết hiện chỉ xem được trên website.');
        return;
      }
      navigation.navigate('TeacherQuizzes');
      return;
    }
    const isAssignment = Boolean(payload.assignmentId)
      || String(payload.type || '').toLowerCase() === 'assignment'
      || path.includes('assignment')
      || /bài tập/i.test(`${item.title} ${item.message}`);
    if (isAssignment) {
      const assignmentId = String(payload.assignmentId || '').trim();
      navigation.navigate('Assignments', assignmentId ? { assignmentId } : undefined);
      return;
    }
    if ((path.includes('schedule') || type === 'SCHEDULE') && payload.scheduleId) {
      navigation.navigate('MainTabs', {
        screen: 'Schedule',
        params: { focusScheduleId: String(payload.scheduleId) },
      });
      return;
    }
    const target = path.includes('inbox') || type === 'MESSAGE'
      ? { tab: 'Messages' as const }
      : path.includes('schedule') || type === 'SCHEDULE' || notificationCategory(item) === 'Lịch dạy'
        ? { tab: 'Schedule' as const }
        : path.includes('assignment') || type === 'ASSIGNMENT' || item.category === 'Bài tập'
          ? { screen: 'Assignments' as const }
          : path.includes('finance') || type === 'FINANCE' || notificationCategory(item) === 'Tài chính'
            ? user?.role === 'teacher' ? { screen: 'TeacherFinance' as const } : { screen: 'Tuition' as const }
            : path.includes('evaluation') || type === 'EVALUATION' || type === 'GRADE'
              ? user?.role === 'student' ? { screen: 'Evaluations' as const } : null
              : path.includes('training') || type === 'TRAINING'
                ? user?.role === 'teacher' ? { screen: 'TeacherTraining' as const } : null
                : path.includes('news') || type === 'NEWS'
                  ? { screen: 'News' as const }
                  : type === 'COURSE' || type === 'STUDENT'
                    ? user?.role === 'student' ? { screen: 'Materials' as const } : { screen: 'TeacherTraining' as const }
                    : path.includes('center')
                      ? { screen: 'CenterInfo' as const }
                      : null;
    if (!target) {
      Alert.alert('Thông báo', 'Chưa có màn hình mobile phù hợp cho loại thông báo này; vui lòng mở trên website.');
      return;
    }
    if ('tab' in target) navigation.navigate('MainTabs', target.tab === 'Messages' ? { screen: 'Messages' } : { screen: 'Schedule' });
    else navigation.navigate(target.screen);
  };
  const openNotification = async (item: AppNotification) => {
    if (!await markRead(item)) return;
    openRelated(item);
    onClose?.();
  };
  const hideNotification = async (item: AppNotification) => {
    if (pendingActions.current.has(item.id)) return;
    pendingActions.current.add(item.id);
    try {
      await notificationService.dismiss(item.id);
      if (item.unread) DeviceEventEmitter.emit('mobile:notification-read', { id: item.id });
      resource.reload();
    } catch (error) {
      reportNotificationError(error, 'Ẩn thông báo');
    } finally {
      pendingActions.current.delete(item.id);
    }
  };

  const notificationContent = (
    <>
      <View style={styles.notificationToolbar}>
        <Pressable
          onPress={() => setPage(1)}
          style={styles.notificationCategoryButton}
          accessibilityRole="button"
          accessibilityLabel="Hiển thị tất cả thông báo"
          accessibilityState={{ selected: true }}
        >
          <Text style={styles.notificationCategoryButtonText}>Tất cả</Text>
        </Pressable>
        {unreadCount > 0 ? (
          <Pressable onPress={() => { void markAll(); }} style={styles.notificationMarkAll} accessibilityRole="button">
            <Check size={14} color={colors.ink} />
            <Text style={styles.notificationMarkAllText}>Đánh dấu là đã đọc</Text>
          </Pressable>
        ) : null}
      </View>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && resource.data?.total === 0 ? <EmptyState title="Bạn đã cập nhật!" message="Thông báo mới sẽ được hiển thị tại đây." /> : null}
      {pageItems.length ? (
        <View style={styles.notificationList}>
          {pageItems.map((item, index) => (
            <NotificationCard
              key={item.id}
              item={item}
              last={index === pageItems.length - 1}
              onPress={() => { void openNotification(item); }}
              onMarkRead={() => { void markRead(item); }}
              onDismiss={() => { void hideNotification(item); }}
            />
          ))}
        </View>
      ) : null}
      {!resource.loading && !resource.error && resource.data && resource.data.total > 0 && !pageItems.length ? <EmptyState title="Không có thông báo" message="Không có thông báo trong bộ lọc đã chọn." /> : null}
      {pageCount > 1 ? (
        <View style={styles.notificationPagination}>
          <Pressable onPress={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1 || resource.loading} style={styles.readAll} accessibilityRole="button" accessibilityState={{ disabled: currentPage <= 1 }}>
            <Text style={styles.readAllText}>Trước</Text>
          </Pressable>
          <Text style={styles.metaText}>Trang {currentPage} / {pageCount}</Text>
          <Pressable onPress={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={currentPage >= pageCount || resource.loading} style={styles.readAll} accessibilityRole="button" accessibilityState={{ disabled: currentPage >= pageCount }}>
            <Text style={styles.readAllText}>Tiếp</Text>
          </Pressable>
        </View>
      ) : null}
    </>
  );
  if (overlay) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.notificationOverlay}>
          <Pressable style={styles.notificationOverlayBackdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Đóng thông báo" />
          <View style={styles.notificationOverlayPanel}>
            <View style={styles.notificationOverlayHeader}>
              <Text style={styles.notificationOverlayTitle}>Thông báo</Text>
              <Pressable onPress={onClose} style={styles.notificationOverlayClose} accessibilityRole="button" accessibilityLabel="Đóng thông báo">
                <X size={20} color={colors.muted} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationOverlayContent} refreshControl={refreshControl}>
              {notificationContent}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
  return <AppScreen contentStyle={styles.notificationScreen} refreshControl={refreshControl}>{notificationContent}</AppScreen>;
}

function NotificationCard({ item, onPress, onMarkRead, onDismiss, last }: { item: AppNotification; onPress: () => void; onMarkRead: () => void; onDismiss: () => void; last: boolean }) {
  const [hovered, setHovered] = useState(false);
  const [showDeleteAction, setShowDeleteAction] = useState(false);
  const category = notificationCategory(item);
  const tint = category === 'Lịch dạy' ? '#FFF7ED' : category === 'Hệ thống' ? colors.brandSoft : colors.blueSoft;
  const iconColor = category === 'Lịch dạy' ? '#EA580C' : category === 'Hệ thống' ? colors.brand : colors.blue;
  const Icon = category === 'Lịch dạy' ? CalendarDays : category === 'Hệ thống' ? Bell : GraduationCap;
  return (
    <View
      style={[styles.notificationItem, !last && styles.notificationItemDivider]}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <View style={styles.notificationItemMain}>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.unread ? 'chưa đọc' : 'đã đọc'}`} style={[styles.notificationItemIcon, { backgroundColor: tint }]}>
          <Icon size={15} color={iconColor} />
          {item.unread ? <View style={styles.notificationItemDot} /> : null}
        </Pressable>
        <View style={styles.notificationItemCopy}>
          <View style={styles.notificationItemMeta}>
            <Text style={styles.notificationItemCategory}>{category}</Text>
            <View style={styles.notificationItemTimeActions}>
              <Text style={styles.notificationItemTime}>{item.time}</Text>
              <Pressable
                onPress={() => setShowDeleteAction((shown) => !shown)}
                style={[styles.notificationItemMoreAction, Platform.OS === 'web' && !hovered && !showDeleteAction && styles.notificationItemMoreActionHidden]}
                disabled={Platform.OS === 'web' && !hovered && !showDeleteAction}
                accessibilityRole="button"
                accessibilityLabel={showDeleteAction ? 'Đóng thao tác thông báo' : 'Tùy chọn thông báo'}
                accessibilityState={{ expanded: showDeleteAction }}
              >
                <MoreHorizontal size={17} color={colors.muted} />
              </Pressable>
            </View>
          </View>
          <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.unread ? 'chưa đọc' : 'đã đọc'}`} style={styles.notificationItemContent}>
            <Text numberOfLines={1} style={styles.notificationItemTitle}>{item.title}</Text>
            <Text numberOfLines={3} style={styles.notificationItemMessage}>{item.message}</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.notificationItemActions}>
        {item.unread ? (
          <Pressable onPress={onMarkRead} style={styles.notificationItemAction} accessibilityRole="button" accessibilityLabel={`Đánh dấu đã đọc: ${item.title}`}>
            <Check size={15} color={colors.green} />
          </Pressable>
        ) : null}
        {showDeleteAction ? (
          <Pressable
            onPress={() => {
              setShowDeleteAction(false);
              onDismiss();
            }}
            style={styles.notificationItemAction}
            accessibilityRole="button"
            accessibilityLabel={`Xóa ${item.title}`}
          >
            <Trash2 size={15} color={colors.red} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function StudentsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const loader = useCallback(() => studentService.assigned(user), [user]);
  const resource = useMockResource(loader);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('Tất cả');
  const [selectedStudent, setSelectedStudent] = useState<DemoStudent | null>(null);
  const [detailTab, setDetailTab] = useState<'Tổng quan' | 'Điểm danh' | 'Kết quả' | 'Cập nhật'>('Tổng quan');
  const [studentDetail, setStudentDetail] = useState<TeacherAssignedStudentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<unknown[]>(getOnlineUsersSnapshot);
  const [lastSeenUsers, setLastSeenUsers] = useState<Record<string, string>>(getLastSeenUsersSnapshot);
  const [note, setNote] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [studentLink, setStudentLink] = useState('');
  const [savingStudentUpdate, setSavingStudentUpdate] = useState(false);
  const detailRequestRef = useRef(0);
  useFocusEffect(useCallback(() => {
    resource.reload();
  }, [resource.reload]));
  const loadStudentDetail = useCallback(async (studentId: string) => {
    const requestId = ++detailRequestRef.current;
    setDetailLoading(true);
    setStudentDetail(null);
    try {
      const detail = await studentService.detail(user, studentId);
      if (requestId === detailRequestRef.current) setStudentDetail(detail);
    } catch (error) {
      if (requestId === detailRequestRef.current) {
        Alert.alert('Không tải được hồ sơ chi tiết', error instanceof Error ? error.message : 'Vui lòng thử lại.');
      }
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  }, [user]);
  useEffect(() => {
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.ONLINE_USERS, (users: unknown) => {
        setOnlineUsers(Array.isArray(users) ? users : []);
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.LAST_SEEN_USERS, (users: unknown) => {
        if (users && typeof users === 'object' && !Array.isArray(users)) {
          setLastSeenUsers(users as Record<string, string>);
        }
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.STUDENT_CHANGED, () => {
        resource.reload();
        if (selectedStudent) void loadStudentDetail(selectedStudent.id);
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.DATA_REFRESH, () => resource.reload()),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_UPDATED, () => {
        if (selectedStudent) void loadStudentDetail(selectedStudent.id);
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_NEW, () => {
        if (selectedStudent) void loadStudentDetail(selectedStudent.id);
      }),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.SCHEDULE_CANCELLED, () => {
        if (selectedStudent) void loadStudentDetail(selectedStudent.id);
      }),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [loadStudentDetail, resource.reload, selectedStudent]);
  const isStudentOnline = (student: DemoStudent) => onlineUsers.some((entry) => {
    if (typeof entry === 'string') return entry === student.id;
    if (!entry || typeof entry !== 'object') return false;
    const record = entry as Record<string, unknown>;
    return String(record.id || record._id || record.userId || record.studentId || '') === student.id;
  });
  const students = (resource.data || [])
    .filter((student) => {
      const searchText = `${student.name} ${student.phone || ''} ${student.zalo || ''} ${student.course} ${(student.courses || []).join(' ')}`.toLowerCase();
      const matchesStatus = statusFilter === 'Tất cả'
        || (statusFilter === 'Đang học' && student.enrollmentStatus === 'active')
        || (statusFilter === 'Học xong' && student.enrollmentStatus === 'completed')
        || (statusFilter === 'Thôi học' && student.enrollmentStatus === 'cancelled');
      return searchText.includes(query.trim().toLowerCase()) && matchesStatus;
    })
    .slice()
    .sort((left, right) => {
      const leftDropped = left.enrollmentStatus === 'cancelled';
      const rightDropped = right.enrollmentStatus === 'cancelled';
      if (leftDropped !== rightDropped) return leftDropped ? 1 : -1;
      const onlineDifference = Number(isStudentOnline(right)) - Number(isStudentOnline(left));
      return onlineDifference || left.name.localeCompare(right.name, 'vi');
    });
  const saveStudentUpdate = async (
    updates: { notes?: string; linkHoc?: string; avgGrade?: number },
    label: string,
  ) => {
    if (!selectedStudent || !user || user.role !== 'teacher' || savingStudentUpdate) return;
    setSavingStudentUpdate(true);
    try {
      const updated = await studentService.updateAssigned(user, selectedStudent.id, selectedStudent.course, updates);
      setSelectedStudent({ ...selectedStudent, ...updated, ...updates });
      resource.reload();
      Alert.alert('Đã lưu thay đổi', `${label} học viên đã được cập nhật.`);
    } catch (error) {
      Alert.alert('Không thể lưu thay đổi', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setSavingStudentUpdate(false);
    }
  };
  const saveStudentGrade = () => {
    const grade = Number(studentGrade.replace(',', '.'));
    if (!studentGrade.trim() || !Number.isFinite(grade) || grade < 0 || grade > 10) {
      Alert.alert('Điểm chưa hợp lệ', 'Nhập điểm trung bình từ 0 đến 10.');
      return;
    }
    void saveStudentUpdate({ avgGrade: grade }, 'Điểm trung bình');
  };
  const failStudentExam = async () => {
    if (!selectedStudent?.studentExamUnlocked || !user || savingStudentUpdate) return;
    setSavingStudentUpdate(true);
    try {
      await studentService.failExam(user, selectedStudent.id, 'Vi phạm quy chế giám sát thi');
      setSelectedStudent({ ...selectedStudent, studentExamUnlocked: false });
      resource.reload();
      Alert.alert('Đã khóa phòng thi', `Đã đánh trượt ${selectedStudent.name} và khóa quyền vào phòng thi.`);
    } catch (error) {
      Alert.alert('Không thể đánh trượt học viên', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setSavingStudentUpdate(false);
    }
  };
  const confirmFailStudentExam = () => {
    if (!selectedStudent?.studentExamUnlocked) return;
    Alert.alert(
      'Xác nhận đánh trượt',
      `Phòng thi của ${selectedStudent.name} sẽ bị khóa ngay lập tức.`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Đánh trượt', style: 'destructive', onPress: () => { void failStudentExam(); } },
      ],
    );
  };
  const closeStudentDetail = () => {
    detailRequestRef.current += 1;
    setSelectedStudent(null);
    setStudentDetail(null);
    setDetailLoading(false);
  };
  const seenLabel = (student: DemoStudent) => {
    const value = lastSeenUsers[student.id] || student.lastSeenAt;
    if (!value) return 'Chưa có dữ liệu truy cập';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Chưa có dữ liệu truy cập'
      : `Truy cập ${date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
  };
  const selectStudent = (student: DemoStudent) => {
    setSelectedStudent(student);
    setDetailTab('Tổng quan');
    setNote(student.notes || '');
    setStudentGrade(student.avgGrade == null ? '' : String(student.avgGrade));
    setStudentLink(student.linkHoc || '');
    void loadStudentDetail(student.id);
  };
  const openStudentConversation = (student: DemoStudent) => {
    if (!user || user.role !== 'teacher') {
      Alert.alert('Không thể mở tin nhắn', 'Vui lòng đăng nhập bằng tài khoản giảng viên.');
      return;
    }
    navigation.navigate('Conversation', {
      conversationId: buildDirectConversationId(user, student.id, 'student'),
      conversationName: student.name,
      participantId: student.id,
      participantRole: 'student',
    });
  };
  return (
    <AppScreen>
      {selectedStudent ? (
        <AppHeader
          title="Hồ sơ học viên"
          subtitle={selectedStudent.name}
          onBack={closeStudentDetail}
          showBackButton
          right={
            <Pressable
              onPress={() => openStudentConversation(selectedStudent)}
              style={styles.studentHeaderAction}
              accessibilityRole="button"
              accessibilityLabel={`Nhắn tin với ${selectedStudent.name}`}
            >
              <MessageCircle size={18} color={colors.brand} />
            </Pressable>
          }
        />
      ) : null}
      {!selectedStudent ? (
        <>
          <SearchField value={query} onChangeText={setQuery} placeholder="Tìm tên, SĐT, Zalo, khóa học..." />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studentFilters}>
            {['Tất cả', 'Đang học', 'Học xong', 'Thôi học'].map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setStatusFilter(filter)}
                style={[styles.studentFilter, statusFilter === filter && styles.studentFilterActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: statusFilter === filter }}
              >
                <Text style={[styles.studentFilterText, statusFilter === filter && styles.studentFilterTextActive]}>{filter}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={styles.studentResultCount}>{students.length} học viên</Text>
          {resource.loading ? <LoadingSkeleton /> : null}
          {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
          {!resource.loading && !resource.error && !students.length ? <EmptyState title="Không tìm thấy học viên" message="Thử tìm theo tên hoặc khóa học khác." /> : null}
          {!resource.loading && !resource.error && students.map((student) => (
            <View key={student.id} style={styles.studentListItem}>
              <Pressable
                onPress={() => selectStudent(student)}
                accessibilityRole="button"
                accessibilityLabel={`Mở hồ sơ ${student.name}`}
                accessibilityState={{ selected: false }}
                style={styles.studentListMain}
              >
                <StudentCard student={student} online={isStudentOnline(student)} lastSeenLabel={seenLabel(student)} />
              </Pressable>
              <View style={styles.studentListActions}>
                <Pressable onPress={() => openStudentConversation(student)} accessibilityRole="button" accessibilityLabel={`Nhắn tin với ${student.name}`} style={styles.studentChatButton}>
                  <MessageCircle size={18} color={colors.brand} />
                </Pressable>
                <ChevronRight size={17} color={colors.muted} />
              </View>
            </View>
          ))}
        </>
      ) : null}
      {selectedStudent ? (
        <Card style={styles.studentDetail}>
          <Text numberOfLines={1} style={styles.studentDetailCourse}>{selectedStudent.course}</Text>
          <View style={styles.studentQuickInfo}>
            <StatusBadge label={selectedStudent.enrollmentStatus === 'completed' ? 'Hoàn thành' : selectedStudent.enrollmentStatus === 'cancelled' ? 'Thôi học' : 'Đang học'} compact />
            <Text style={styles.metaText}>{selectedStudent.phone || 'Chưa có số điện thoại'}</Text>
            {isStudentOnline(selectedStudent) ? <Text style={styles.studentOnlineText}>Đang online</Text> : <Text style={styles.metaText}>{seenLabel(selectedStudent)}</Text>}
          </View>
          <View style={styles.studentDetailTabs}>
            {(['Tổng quan', 'Điểm danh', 'Kết quả', 'Cập nhật'] as const).map((tab) => (
              <Pressable key={tab} onPress={() => setDetailTab(tab)} style={[styles.studentDetailTab, detailTab === tab && styles.studentDetailTabActive]} accessibilityRole="tab" accessibilityState={{ selected: detailTab === tab }}>
                <Text numberOfLines={1} style={[styles.studentDetailTabText, detailTab === tab && styles.studentDetailTabTextActive]}>{tab}</Text>
              </Pressable>
            ))}
          </View>
          {detailTab === 'Tổng quan' ? (
            <View style={styles.studentDetailSection}>
              <View style={styles.studentMetricGrid}>
                <View style={styles.studentMetric}><Text style={styles.studentMetricValue}>{selectedStudent.completedSessions ?? 0}/{selectedStudent.totalSessions ?? 0}</Text><Text style={styles.studentMetricLabel}>Buổi đã học</Text></View>
                <View style={styles.studentMetric}><Text style={styles.studentMetricValue}>{selectedStudent.remainingSessions ?? 0}</Text><Text style={styles.studentMetricLabel}>Buổi còn lại</Text></View>
                <View style={styles.studentMetric}><Text style={styles.studentMetricValue}>{selectedStudent.avgGrade == null ? '—' : `${selectedStudent.avgGrade}/10`}</Text><Text style={styles.studentMetricLabel}>Điểm trung bình</Text></View>
              </View>
              <ProgressBar value={selectedStudent.progress} />
              <Text style={styles.metaText}>Tiến độ khóa đang chọn: {selectedStudent.progress}% · {selectedStudent.lastClass}</Text>
              <SectionHeading title="Khóa học" />
              {(selectedStudent.enrollments || []).length ? selectedStudent.enrollments?.map((enrollment) => (
                <View key={enrollment.id} style={styles.studentCourseRow}>
                  <View style={styles.rowBetween}>
                    <Text numberOfLines={1} style={styles.studentCourseTitle}>{enrollment.courseName}</Text>
                    <StatusBadge label={enrollment.status} compact />
                  </View>
                  <ProgressBar value={enrollment.progress || 0} />
                  <Text style={styles.metaText}>{enrollment.completedSessions || 0}/{enrollment.totalSessions || 0} buổi</Text>
                </View>
              )) : <Text style={styles.note}>Chưa có thông tin khóa học chi tiết.</Text>}
              <Pressable onPress={() => openStudentConversation(selectedStudent)} style={styles.studentPrimaryAction} accessibilityRole="button">
                <MessageCircle size={16} color="#FFFFFF" /><Text style={styles.studentPrimaryActionText}>Nhắn tin với học viên</Text>
              </Pressable>
            </View>
          ) : null}
          {detailTab === 'Điểm danh' ? (
            <View style={styles.studentDetailSection}>
              <SectionHeading title="Lịch sử buổi học" />
              {detailLoading ? <ActivityIndicator color={colors.brand} /> : null}
              {!detailLoading && studentDetail?.attendance.length ? studentDetail.attendance.map((entry) => (
                <View key={entry.id} style={styles.studentHistoryRow}>
                  <View style={styles.flex}>
                    <Text style={styles.studentCourseTitle}>{entry.course}</Text>
                    <Text style={styles.metaText}>{entry.date}{entry.time ? ` · ${entry.time}` : ''}</Text>
                  </View>
                  <StatusBadge label={entry.status === 'completed' ? 'Đã điểm danh' : entry.status} compact />
                </View>
              )) : !detailLoading ? <Text style={styles.note}>Chưa có dữ liệu điểm danh.</Text> : null}
            </View>
          ) : null}
          {detailTab === 'Kết quả' ? (
            <View style={styles.studentDetailSection}>
              <SectionHeading title="Kết quả bài thi" />
              {detailLoading ? <ActivityIndicator color={colors.brand} /> : null}
              {!detailLoading && studentDetail?.examResults.length ? studentDetail.examResults.map((result) => (
                <View key={result.id} style={styles.studentHistoryRow}>
                  <View style={styles.flex}>
                    <Text style={styles.studentCourseTitle}>{result.subject}</Text>
                    <Text style={styles.metaText}>{result.date} · Trắc nghiệm {result.correct}/{result.total}{result.essayScore == null ? '' : ` · Tự luận ${result.essayScore}/10`}</Text>
                    {result.note ? <Text style={styles.metaText}>{result.note}</Text> : null}
                  </View>
                  <StatusBadge label={result.passed ? 'Đạt' : 'Chưa đạt'} compact />
                </View>
              )) : !detailLoading ? <Text style={styles.note}>Chưa có kết quả bài thi.</Text> : null}
            </View>
          ) : null}
          {detailTab === 'Cập nhật' ? (
            <View style={styles.studentDetailSection}>
              <Text style={styles.fieldLabel}>Điểm trung bình (0–10)</Text>
              <View style={styles.rowBetween}>
                <TextInput value={studentGrade} onChangeText={setStudentGrade} keyboardType="decimal-pad" placeholder="Chưa có điểm" style={[styles.formInput, styles.studentUpdateInput]} accessibilityLabel="Điểm trung bình học viên" />
                <Pressable disabled={savingStudentUpdate} onPress={saveStudentGrade} style={[styles.choice, styles.studentUpdateAction]} accessibilityRole="button" accessibilityState={{ disabled: savingStudentUpdate }}>
                  <Text style={styles.choiceText}>{savingStudentUpdate ? 'Đang lưu…' : 'Lưu điểm'}</Text>
                </Pressable>
              </View>
              <Text style={styles.fieldLabel}>Link vào lớp</Text>
              <View style={styles.rowBetween}>
                <TextInput value={studentLink} onChangeText={setStudentLink} placeholder="HTTPS://..." autoCapitalize="none" keyboardType="url" style={[styles.formInput, styles.studentUpdateInput]} accessibilityLabel="Link vào lớp học viên" />
                <Pressable disabled={savingStudentUpdate} onPress={() => { void saveStudentUpdate({ linkHoc: studentLink.trim() }, 'Link vào lớp'); }} style={[styles.choice, styles.studentUpdateAction]} accessibilityRole="button" accessibilityState={{ disabled: savingStudentUpdate }}>
                  <Text style={styles.choiceText}>{savingStudentUpdate ? 'Đang lưu…' : 'Lưu link'}</Text>
                </Pressable>
              </View>
              <Text style={styles.fieldLabel}>Ghi chú giảng viên</Text>
              <TextInput value={note} onChangeText={setNote} placeholder="Ghi chú học viên" multiline style={[styles.formInput, styles.formTextarea]} />
              <Pressable disabled={savingStudentUpdate} onPress={() => { void saveStudentUpdate({ notes: note.trim() }, 'Ghi chú'); }} style={[styles.choice, styles.studentUpdateAction]} accessibilityRole="button" accessibilityState={{ disabled: savingStudentUpdate }}>
                <Text style={styles.choiceText}>{savingStudentUpdate ? 'Đang lưu…' : 'Lưu ghi chú'}</Text>
              </Pressable>
              <Text style={styles.metaText}>Phòng thi: {selectedStudent.studentExamUnlocked ? 'Đã mở' : 'Chưa mở hoặc đã khóa'}</Text>
              <Pressable disabled={!selectedStudent.studentExamUnlocked || savingStudentUpdate} onPress={confirmFailStudentExam} style={[styles.choice, styles.studentUpdateAction, styles.studentDangerAction, (!selectedStudent.studentExamUnlocked || savingStudentUpdate) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityState={{ disabled: !selectedStudent.studentExamUnlocked || savingStudentUpdate }}>
                <Text style={[styles.choiceText, styles.studentDangerActionText]}>{savingStudentUpdate ? 'Đang xử lý…' : 'Đánh trượt và khóa phòng thi'}</Text>
              </Pressable>
            </View>
          ) : null}
        </Card>
      ) : null}
    </AppScreen>
  );
}

function StudentCard({ student, online, lastSeenLabel }: { student: DemoStudent; online: boolean; lastSeenLabel: string }) {
  return (
    <View style={styles.studentCard}>
      <Avatar
        name={student.name}
        color={student.color}
        size={44}
        imageSource={student.avatar ? getMobileImageSource(resolveMobilePublicUrl(student.avatar)) : undefined}
      />
      <View style={styles.rowCopy}>
        <View style={styles.rowBetween}><Text numberOfLines={1} style={styles.cardTitle}>{student.name}</Text><StatusBadge compact label={student.enrollmentStatus === 'completed' ? 'Hoàn thành' : student.enrollmentStatus === 'cancelled' ? 'Thôi học' : 'Đang học'} /></View>
        <Text numberOfLines={1} style={styles.metaText}>{student.course}</Text>
        <Text style={[styles.metaText, online && styles.studentOnlineText]}>{online ? 'Đang online' : lastSeenLabel}</Text>
      </View>
    </View>
  );
}

export function AttendanceScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const route = useRoute<RouteProp<AppStackParamList, 'Attendance'>>();
  const scheduleLoader = useCallback(() => scheduleService.list('teacher'), []);
  const scheduleResource = useMockResource(scheduleLoader);
  const studentsLoader = useCallback(() => studentService.assigned(user), [user]);
  const studentsResource = useMockResource(studentsLoader);
  useEffect(() => {
    const eventNames = [
      SOCKET_EVENTS.ATTENDANCE_AWAITING_CONFIRM,
      SOCKET_EVENTS.ATTENDANCE_DISPUTED,
      SOCKET_EVENTS.ATTENDANCE_CONFIRMED,
      SOCKET_EVENTS.ATTENDANCE_REJECTED,
      SOCKET_EVENTS.ATTENDANCE_ADMIN_MAKEUP_COMPLETED,
    ];
    const subscriptions = eventNames.map((eventName) => DeviceEventEmitter.addListener(eventName, (payload: {
      scheduleId?: string;
      studentId?: string;
      teacherId?: string;
    }) => {
      if (payload?.scheduleId && route.params?.scheduleId
        && String(payload.scheduleId) !== String(route.params.scheduleId)) return;
      if (user?.role === 'student' && payload?.studentId && String(payload.studentId) !== user.id) return;
      if (user?.role === 'teacher' && payload?.teacherId && String(payload.teacherId) !== user.id) return;
      scheduleResource.reload();
      studentsResource.reload();
    }));
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [route.params?.scheduleId, scheduleResource.reload, studentsResource.reload, user]);
  const selectedSession = scheduleResource.data?.find((item) => item.id === route.params?.scheduleId);
  const selectedStudent = studentsResource.data?.find((student) => (
    student.id === selectedSession?.studentId
    && normalizeScheduleCourseName(student.course) === normalizeScheduleCourseName(selectedSession.courseName || selectedSession.title)
  )) || studentsResource.data?.find((student) => student.id === selectedSession?.studentId);
  const sessionTotal = selectedStudent?.totalSessions || 0;
  const completedSessions = selectedStudent?.completedSessions || 0;
  const sessionNumber = Math.min(completedSessions + 1, sessionTotal || completedSessions + 1);
  const [grade, setGrade] = useState('0');
  const [note, setNote] = useState('');
  const [modalDismissed, setModalDismissed] = useState(false);
  const [attendanceNoticeDismissed, setAttendanceNoticeDismissed] = useState(false);
  const [pendingAttendance, setPendingAttendance] = useState<{ endsAt: number; grade: number; note: string } | null>(null);
  const [confirmRemaining, setConfirmRemaining] = useState(0);
  const [committingAttendance, setCommittingAttendance] = useState(false);
  const [attendanceSaved, setAttendanceSaved] = useState(false);
  const [makeupRequestBusy, setMakeupRequestBusy] = useState(false);
  const [makeupRequestedScheduleId, setMakeupRequestedScheduleId] = useState('');
  const [attendanceNow, setAttendanceNow] = useState(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const isMakeupOverdue = Boolean(selectedSession && isOverdueAttendance(selectedSession, attendanceNow));
  const attendanceAlreadySubmitted = Boolean(
    attendanceSaved
    || selectedSession?.attendanceConfirmPending
    || selectedSession?.attendanceDisputed
    || selectedSession?.attendanceRejected
    || selectedSession?.confirmedByTeacher
    || selectedSession?.confirmedByStudent
    || selectedSession?.status === 'completed',
  );
  const attendanceModalVisible = Boolean(
    selectedSession
    && selectedStudent
    && canTeacherMarkAttendance(selectedSession, attendanceNow)
    && !attendanceAlreadySubmitted
    && !isMakeupOverdue
    && !pendingAttendance
    && !modalDismissed,
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setAttendanceNow(Date.now()), 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!pendingAttendance) return undefined;
    const updateRemaining = () => {
      setConfirmRemaining(Math.max(0, Math.ceil((pendingAttendance.endsAt - Date.now()) / 1000)));
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 250);
    return () => clearInterval(interval);
  }, [pendingAttendance]);

  useEffect(() => {
    if (!selectedStudent || !selectedSession) return;
    setGrade(String(selectedStudent.avgGrade || 0));
    setNote(`Buổi ${sessionNumber}: Đã điểm danh hoàn thành buổi học`);
    setMakeupRequestedScheduleId(
      mobileMakeupRequestsSent.has(`${user?.id}:${selectedSession.id}`) ? selectedSession.id : '',
    );
  }, [selectedSession?.id, selectedStudent?.id, sessionNumber, user?.id]);

  const sendAttendanceMakeupRequest = async () => {
    if (!selectedSession || !selectedStudent || !user || makeupRequestBusy
      || makeupRequestedScheduleId === selectedSession.id) return;
    setMakeupRequestBusy(true);
    try {
      let contacts: Conversation[] = [];
      try {
        contacts = await messageService.conversations('teacher', user);
      } catch (error) {
        console.warn('Không tải được danh bạ Admin; dùng hộp thư Admin mặc định.', error);
      }
      const staffContacts = contacts.filter((contact) => (
        ['admin', 'staff'].includes(String(contact.participantRole || '').toLowerCase())
        || ['admin', 'recruitment'].includes(String(contact.category || '').toLowerCase())
      ));
      const admin = staffContacts.find((contact) => contact.participantId === 'admin')
        || staffContacts.find((contact) => String(contact.adminRole || '').toUpperCase() === 'SUPER_ADMIN')
        || staffContacts.find((contact) => String(contact.adminRole || '').toUpperCase() === 'HIGH_ADMIN')
        || staffContacts[0]
        || ({
          id: 'admin',
          name: 'Admin',
          role: 'Admin',
          participantId: 'admin',
          participantRole: 'admin',
          category: 'admin',
          lastMessage: '',
          time: '',
          unread: 0,
          color: '#334155',
        } satisfies Conversation);
      const studentId = selectedStudent.id;
      const safeStudentName = selectedStudent.name.replace(/[|⟦⟧]/g, ' ').trim() || 'Học viên';
      const studentToken = studentId
        ? `⟦student_detail:${studentId}:attendance:${selectedSession.id}|${safeStudentName}⟧`
        : safeStudentName;
      const sessionTotal = selectedStudent.totalSessions || 0;
      const completed = selectedStudent.completedSessions || 0;
      const makeupSessionNumber = completed + 1;
      const dateLabel = selectedSession.dateLabel || selectedSession.date || 'Chưa xác định';
      const content = [
        '[Yêu cầu điểm danh bù]',
        `GV gửi yêu cầu: ${user.name}`,
        `HV: ${studentToken}`,
        `Khóa: ${selectedSession.courseName || selectedStudent.course}`,
        sessionTotal > 0
          ? `Buổi: ${makeupSessionNumber}/${sessionTotal}`
          : `Buổi tiếp theo (đã học ${completed})`,
        `Lịch: ${dateLabel} · ${selectedSession.time}`,
        '',
        '› Bấm tên học viên ở dòng HV để mở hồ sơ và điểm danh bù.',
        '',
        'Nội dung xác nhận:',
        '- Giảng viên chịu trách nhiệm về buổi học này.',
        '- Admin sẽ liên hệ học viên để xác nhận học viên đã học buổi này chưa.',
        '- Chỉ khi học viên đồng ý đã học, buổi này mới được tính cho giảng viên.',
        '',
        'Lý do: Quá hạn cửa sổ điểm danh 1 giờ của giảng viên — nhờ Admin xử lý điểm danh bù.',
      ].join('\n');
      await messageService.send(admin, content, user);
      mobileMakeupRequestsSent.add(`${user.id}:${selectedSession.id}`);
      setMakeupRequestedScheduleId(selectedSession.id);
      Alert.alert('Đã gửi yêu cầu', 'Admin sẽ liên hệ học viên xác nhận. Buổi chỉ được tính khi Admin điểm danh bù.');
    } catch (error) {
      Alert.alert('Không gửi được yêu cầu', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setMakeupRequestBusy(false);
    }
  };

  const confirmAttendanceMakeupRequest = () => {
    if (!selectedSession || !selectedStudent) return;
    Alert.alert(
      'Yêu cầu điểm danh bù',
      `Học viên: ${selectedStudent.name}\nKhóa học: ${selectedSession.courseName || selectedStudent.course}\nThời gian: ${selectedSession.dateLabel} · ${selectedSession.time}\n\nAdmin sẽ liên hệ học viên xác nhận. Chỉ khi được Admin điểm danh bù, buổi học mới tính vào tiến độ.`,
      [
        { text: 'Để sau', style: 'cancel' },
        { text: 'Gửi Admin', onPress: () => { void sendAttendanceMakeupRequest(); } },
      ],
    );
  };

  const closeAttendanceModal = () => setModalDismissed(true);
  const changeGrade = (delta: number) => {
    const currentGrade = Number(grade.replace(',', '.'));
    setGrade(String(Math.min(10, Math.max(0, (Number.isFinite(currentGrade) ? currentGrade : 0) + delta))));
  };
  const confirmAttendance = () => {
    if (!selectedSession || !selectedStudent || committingAttendance || pendingAttendance) return;
    if (!canTeacherMarkAttendance(selectedSession, attendanceNow)) {
      Alert.alert('Chưa thể điểm danh', 'Điểm danh chỉ mở sau 15 phút kể từ giờ bắt đầu và trong vòng 1 giờ sau khi kết thúc.');
      return;
    }
    const parsedGrade = Number(grade.replace(',', '.'));
    if (!Number.isFinite(parsedGrade) || parsedGrade < 0 || parsedGrade > 10) {
      Alert.alert('Điểm không hợp lệ', 'Vui lòng nhập điểm từ 0 đến 10.');
      return;
    }
    const payload = { endsAt: Date.now() + 10_000, grade: parsedGrade, note: note.trim() };
    setPendingAttendance(payload);
    setConfirmRemaining(10);
    setModalDismissed(true);
    setAttendanceNoticeDismissed(false);
    // Keep the delayed commit alive if the user leaves this screen, matching the web flow.
    timerRef.current = setTimeout(async () => {
      timerRef.current = null;
      if (isMountedRef.current) setCommittingAttendance(true);
      try {
        await scheduleService.markAttendance(selectedSession.id, { grade: payload.grade, note: payload.note }, user);
        if (isMountedRef.current) {
          setPendingAttendance(null);
          setAttendanceSaved(true);
          await scheduleResource.reload();
        }
      } catch (error) {
        if (isMountedRef.current) setPendingAttendance(null);
        Alert.alert('Không thể ghi nhận điểm danh', error instanceof Error ? error.message : 'Vui lòng thử lại.');
      } finally {
        if (isMountedRef.current) setCommittingAttendance(false);
      }
    }, 10_000);
  };
  const cancelPendingAttendance = () => {
    if (!pendingAttendance || committingAttendance) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setPendingAttendance(null);
    setModalDismissed(false);
  };
  const openAttendanceModal = () => setModalDismissed(false);

  return (
    <AppScreen>
      {!selectedSession ? (
        <AppHeader title="Điểm danh" subtitle="Mở điểm danh từ cuộc trò chuyện với học viên" />
      ) : null}
      {scheduleResource.loading || studentsResource.loading ? <LoadingSkeleton rows={2} /> : null}
      {scheduleResource.error ? <ErrorState onRetry={scheduleResource.reload} /> : null}
      {studentsResource.error ? <ErrorState onRetry={studentsResource.reload} /> : null}
      {!scheduleResource.loading && !studentsResource.loading && !selectedSession ? (
        <EmptyState
          title="Chưa chọn buổi học"
          message="Mở cuộc trò chuyện với học viên rồi bấm Điểm danh trên thanh tiêu đề để ghi nhận đúng buổi học."
        />
      ) : null}
      {!scheduleResource.loading && !studentsResource.loading && selectedSession && !selectedStudent ? (
        <EmptyState title="Không tìm thấy thông tin học viên" message="Không thể xác định khóa học của buổi này. Hãy tải lại dữ liệu hoặc mở lại từ cuộc trò chuyện." />
      ) : null}
      {selectedSession && selectedStudent ? (
        <ScrollView contentContainerStyle={styles.attendanceOverview} showsVerticalScrollIndicator={false}>
          {pendingAttendance && !attendanceNoticeDismissed ? (
            <View style={styles.attendancePendingNotice}>
              <Text style={styles.attendancePendingText}>Đã ghi nhận — còn {confirmRemaining} giây để hủy điểm danh trước khi tính buổi.</Text>
              <Pressable onPress={() => setAttendanceNoticeDismissed(true)} accessibilityRole="button" accessibilityLabel="Ẩn thông báo" style={styles.attendanceNoticeClose}>
                <X size={16} color="#64748B" />
              </Pressable>
            </View>
          ) : null}
          <Card style={styles.attendanceStudentSummary}>
            <View style={styles.attendanceStudentHeading}>
              <Avatar name={selectedStudent.name} color={selectedStudent.color} size={48} />
              <View style={styles.attendanceStudentCopy}>
                <Text numberOfLines={2} style={styles.attendanceStudentName}>{selectedStudent.name}</Text>
                <Text numberOfLines={2} style={styles.attendanceStudentMeta}>{selectedSession.courseName || selectedStudent.course}</Text>
                <Text numberOfLines={2} style={styles.attendanceStudentMeta}>{selectedSession.dateLabel || selectedSession.date || '—'} · {selectedSession.time || '—'}</Text>
              </View>
              <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Đóng điểm danh" style={styles.attendanceBackButton}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <View style={styles.attendanceStudentStatusRow}>
              <StatusBadge label={pendingAttendance ? 'Chờ ghi nhận' : attendanceStatusLabel(selectedSession, attendanceNow)} />
            </View>
            <View style={styles.attendanceProgressTrack}>
              <View style={[styles.attendanceProgressFill, { width: `${sessionTotal ? Math.min(100, (completedSessions / sessionTotal) * 100) : 0}%` }]} />
            </View>
            <Text style={styles.attendanceProgressText}>Tiến độ khóa học · {completedSessions}/{sessionTotal}  Buổi ({sessionTotal ? Math.round((completedSessions / sessionTotal) * 100) : 0}%)</Text>
          </Card>
          <View style={styles.attendanceStatRow}>
            <View style={[styles.attendanceStatCard, styles.attendanceStatBlue]}>
              <Text style={styles.attendanceStatLabel}>Đã học</Text>
              <Text style={[styles.attendanceStatValue, { color: '#2563EB' }]}>{completedSessions}</Text>
              <Text style={styles.attendanceStatFoot}>Buổi</Text>
            </View>
            <View style={[styles.attendanceStatCard, styles.attendanceStatGold]}>
              <Text style={styles.attendanceStatLabel}>Còn lại</Text>
              <Text style={[styles.attendanceStatValue, { color: '#D97706' }]}>{Math.max(0, sessionTotal - completedSessions)}</Text>
              <Text style={styles.attendanceStatFoot}>Buổi</Text>
            </View>
            <View style={[styles.attendanceStatCard, styles.attendanceStatPurple]}>
              <Text style={styles.attendanceStatLabel}>Điểm tb</Text>
              <Text style={[styles.attendanceStatValue, { color: '#9333EA' }]}>{selectedStudent.avgGrade || 0}<Text style={styles.attendanceStatSuffix}>/10</Text></Text>
              <Text style={styles.attendanceStatFoot}>Đánh giá</Text>
            </View>
          </View>
          {isMakeupOverdue && !attendanceAlreadySubmitted ? (
            <Card style={styles.makeupRequestCard}>
              <View style={styles.makeupRequestHeading}>
                <View style={styles.makeupRequestIcon}><Clock3 size={16} color="#B45309" /></View>
                <Text style={styles.makeupRequestTitle}>Đã quá hạn điểm danh 1 giờ</Text>
              </View>
              <Text style={styles.makeupRequestDescription}>
                Gửi yêu cầu cho Admin xác minh với học viên. Buổi chỉ được tính vào tiến độ và lương sau khi Admin điểm danh bù.
              </Text>
              <PrimaryButton
                title={makeupRequestBusy
                  ? 'Đang gửi yêu cầu…'
                  : makeupRequestedScheduleId === selectedSession.id
                    ? 'Đã gửi — chờ Admin'
                    : 'Yêu cầu điểm danh bù'}
                disabled={makeupRequestBusy || makeupRequestedScheduleId === selectedSession.id}
                onPress={confirmAttendanceMakeupRequest}
              />
            </Card>
          ) : null}
          {pendingAttendance && !committingAttendance ? (
            <View style={styles.attendanceSubmittedRow}>
              <View style={styles.attendanceWaitingButton}>
                <CheckCircle size={16} color="#CBD5E1" />
                <Text style={styles.attendanceWaitingText}>Đang xác nhận</Text>
              </View>
              <Pressable onPress={cancelPendingAttendance} style={styles.attendanceUndoButton} accessibilityRole="button">
                <Text style={styles.attendanceUndoText}>✕  Hủy điểm danh ({confirmRemaining}S)</Text>
              </Pressable>
            </View>
          ) : attendanceAlreadySubmitted || committingAttendance ? (
            <View style={styles.attendanceSubmittedRow}>
              <View style={styles.attendanceWaitingButton}>
                <CheckCircle size={16} color="#94A3B8" />
                <Text style={styles.attendanceWaitingText}>
                  {committingAttendance
                    ? 'Đang ghi nhận'
                    : selectedSession?.attendanceDisputed
                      ? 'Chờ qu?N tr? Vi?N xử lý'
                      : selectedSession?.attendanceRejected
                        ? 'Buổi không được tính'
                        : selectedSession?.attendanceConfirmPending
                          ? 'Chờ học viên xác nhận'
                          : selectedSession?.attendanceConfirmStatus === 'admin_approved'
                            ? 'Qu?N tr? Vi?N đã điểm danh bù'
                            : 'Đã điểm danh'}
                </Text>
              </View>
            </View>
          ) : canTeacherMarkAttendance(selectedSession, attendanceNow) ? (
            <PrimaryButton title="Mở điểm danh" onPress={openAttendanceModal} />
          ) : !isMakeupOverdue ? (
            <Text style={styles.attendanceSessionNote}>
              Điểm danh mở sau 15 phút kể từ giờ bắt đầu và kết thúc sau 1 giờ kể từ giờ học.
            </Text>
          ) : null}
          {!isMakeupOverdue && selectedSession.attendanceConfirmStatus === 'admin_rejected' ? (
            <Text style={styles.attendanceSessionNote}>Admin không chấp thuận điểm danh. Buổi này không được tính vào tiến độ hoặc lương.</Text>
          ) : null}
          {selectedSession.attendanceDisputed ? (
            <Text style={styles.attendanceSessionNote}>Học viên không đồng ý; buổi đang chờ Admin giải quyết và chưa được tính.</Text>
          ) : null}
          {selectedSession.attendanceConfirmStatus === 'admin_approved' ? (
            <Text style={styles.attendanceSessionNote}>Admin đã điểm danh bù; buổi đã được ghi nhận vào tiến độ.</Text>
          ) : null}
          <Text style={styles.attendanceSessionNote}>{pendingAttendance?.note || note}</Text>
        </ScrollView>
      ) : null}
      <Modal visible={attendanceModalVisible} transparent animationType="fade" onRequestClose={closeAttendanceModal}>
        <View style={styles.attendanceModalBackdrop}>
          <View style={styles.attendanceModalCard}>
            <View style={styles.attendanceModalHeader}>
              <View style={styles.attendanceModalIcon}><CheckCircle size={22} color="#FFFFFF" /></View>
              <View style={styles.attendanceModalHeading}>
                <Text style={styles.attendanceModalTitle}>ĐIỂM DANH &amp; CHẤM ĐIỂM</Text>
                <Text numberOfLines={2} style={styles.attendanceModalSubtitle}>{selectedSession?.courseName || selectedSession?.title}</Text>
              </View>
              <Pressable onPress={closeAttendanceModal} accessibilityRole="button" accessibilityLabel="Đóng điểm danh" style={styles.attendanceModalClose}>
                <X size={19} color="#FFFFFF" />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.attendanceModalBody} keyboardShouldPersistTaps="handled">
              <View style={styles.attendanceModalStudent}>
                <Text style={styles.attendanceModalLabel}>Học viên</Text>
                <Text style={styles.attendanceModalName}>{selectedStudent?.name}</Text>
                <Text style={styles.attendanceModalProgress}>Tiến độ hiện tại: {completedSessions}/{sessionTotal} buổi</Text>
              </View>
              <View>
                <Text style={styles.attendanceFieldLabel}>Đánh giá buổi học (0-10)</Text>
                <View style={styles.attendanceGradeInput}>
                  <View style={styles.attendanceGradeStepper}>
                    <Pressable onPress={() => changeGrade(1)} style={styles.attendanceGradeStep} accessibilityRole="button" accessibilityLabel="Tăng điểm">
                      <ChevronDown size={16} color="#64748B" style={{ transform: [{ rotate: '180deg' }] }} />
                    </Pressable>
                    <Pressable onPress={() => changeGrade(-1)} style={styles.attendanceGradeStep} accessibilityRole="button" accessibilityLabel="Giảm điểm">
                      <ChevronDown size={16} color="#64748B" />
                    </Pressable>
                  </View>
                  <TextInput
                    value={grade}
                    onChangeText={setGrade}
                    keyboardType="decimal-pad"
                    accessibilityLabel="Điểm buổi học từ 0 đến 10"
                    style={styles.attendanceGradeValue}
                  />
                  <Text style={styles.attendanceGradeMaximum}>/ 10</Text>
                </View>
              </View>
              <View>
                <Text style={styles.attendanceFieldLabel}>Ghi chú nhanh</Text>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Ví dụ: Học tốt, nộp bài đầy đủ..."
                  multiline
                  textAlignVertical="top"
                  style={styles.attendanceNoteInput}
                />
              </View>
              <View style={styles.attendanceModalActions}>
                <Pressable onPress={closeAttendanceModal} style={styles.attendanceModalCancel} accessibilityRole="button">
                  <Text style={styles.attendanceModalCancelText}>Hủy</Text>
                </Pressable>
                <Pressable onPress={confirmAttendance} style={styles.attendanceModalConfirm} accessibilityRole="button">
                  <Text style={styles.attendanceModalConfirmText}>Xác nhận điểm danh</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

export function GradesScreen() {
  const { user } = useAuth();
  const loader = useCallback(() => gradeService.list(user), [user]);
  const resource = useMockResource(loader);
  const records: DemoGradeRecord[] = resource.data || [];
  const courses = [...new Set(records.map((record) => record.courseName))];
  return (
    <AppScreen>
      <AppHeader title="Nhật ký học tập & Điểm số" subtitle="Bài nộp, trắc nghiệm và điểm theo khóa học" />
      <Card style={styles.resultSummary}>
        <View style={styles.summaryIcon}><WalletCards size={20} color={colors.brand} /></View>
        <View style={styles.rowCopy}>
          <Text style={styles.cardTitle}>Lịch sử kết quả</Text>
          <Text style={styles.metaText}>{courses.length || '—'} khóa học · {records.length || '—'} kết quả</Text>
        </View>
        <GraduationCap size={22} color={colors.brand} />
      </Card>
      {records.some((record) => record.qaFixture) ? <Text style={styles.note}>QA fixture — điểm minh họa, không phải dữ liệu tài khoản thật.</Text> : null}
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {courses.map((course) => (
        <Card key={course} style={styles.subjectCard}>
          <SectionHeading title={course} />
          {records.filter((record) => record.courseName === course).map((record) => (
            <View key={record.id} style={styles.gradeHistoryRow}>
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle}>{record.assessment}</Text>
                <Text style={styles.metaText}>{record.date || '—'}</Text>
                {record.feedback ? <Text style={styles.metaText}>Nhận xét: {record.feedback}</Text> : null}
              </View>
              <View style={styles.gradeResult}>
                <Text style={styles.gradeScore}>{record.score}</Text>
                <StatusBadge label={record.status} />
              </View>
            </View>
          ))}
        </Card>
      ))}
      <Card style={styles.examNotice}>
        <Text style={styles.cardTitle}>Phòng thi / Điểm thi</Text>
        <Text style={styles.muted}>WEB-ONLY TẠM THỜI — vui lòng thực hiện bài thi và xem kết quả thi trên website.</Text>
      </Card>
      {!resource.loading && !resource.error && !records.length ? <EmptyState title="Chưa có dữ liệu điểm số" message="Bài nộp, trắc nghiệm và điểm sẽ hiển thị tại đây." /> : null}
    </AppScreen>
  );
}

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation<Navigation>();
  const isTeacher = user?.role === 'teacher';
  const handleSignOut = () => {
    void signOut().catch((error: unknown) => {
      Alert.alert('Đăng xuất', error instanceof Error ? error.message : 'Không thể thu hồi phiên đăng nhập.');
    });
  };
  const [showStudentProfileForm, setShowStudentProfileForm] = useState(false);
  const [showTeacherProfileForm, setShowTeacherProfileForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showPinSettings, setShowPinSettings] = useState(false);
  const [enablingPush, setEnablingPush] = useState(false);
  const [pushFeedback, setPushFeedback] = useState<{ title: string; message: string } | null>(null);
  const [previewStudentUpdates, setPreviewStudentUpdates] = useState<Record<string, string>>({});
  const [openStudentSections, setOpenStudentSections] = useState({
    courses: false,
  });
  const studentProfileLoader = useCallback(
    async () => {
      if (isTeacher) {
        const teacher = await teacherProfileService.get(user);
        return { teacher, student: null, enrollments: [], videoOrders: [], qaFixture: false };
      }
      const profile = await studentProfileService.get(user);
      return { ...profile, teacher: null };
    },
    [isTeacher, user],
  );
  const studentProfileResource = useMockResource(studentProfileLoader);
  const studentProfile = studentProfileResource.data;
  const profileStudent = studentProfile?.student;
  const profileTeacher = studentProfile?.teacher;
  const studentText = (key: string, fallback = '—') => {
    const value = previewStudentUpdates[key] ?? profileStudent?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  };
  const teacherText = (key: string, fallback = '—') => {
    const value = profileTeacher?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  };
  const teacherStatus = (() => {
    const status = teacherText('status', '').toLowerCase();
    if (['active', 'đang hoạt động'].includes(status)) return 'Đang hoạt động';
    if (['pending', 'chờ duyệt'].includes(status)) return 'Chờ duyệt';
    if (['suspended', 'tạm khóa'].includes(status)) return 'Tạm khóa';
    if (['inactive', 'ngừng hoạt động'].includes(status)) return 'Ngừng hoạt động';
    return status || '—';
  })();
  const enrollments = studentProfile?.enrollments || [];
  const toggleStudentSection = (section: keyof typeof openStudentSections) => {
    setOpenStudentSections((current) => ({ ...current, [section]: !current[section] }));
  };
  const openConfiguredUrl = (value: string, label: string) => {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') throw new Error('Chỉ chấp nhận liên kết HTTPS.');
      void Linking.openURL(url.toString()).catch(() => {
        Alert.alert('Không thể mở liên kết', `Vui lòng thử lại hoặc liên hệ Trung tâm để xem ${label.toLowerCase()}.`);
      });
    } catch {
      Alert.alert('Liên kết chưa sẵn sàng', `Trung tâm chưa cấu hình liên kết ${label.toLowerCase()}.`);
    }
  };
  const enablePush = async () => {
    if (enablingPush) return;
    setEnablingPush(true);
    try {
      if (Platform.OS === 'web') {
        const permission = await requestWebNotificationPermission();
        if (permission === 'granted') {
          setPushFeedback({
            title: 'Đã cho phép thông báo',
            message: 'Trình duyệt đã cấp quyền thông báo. Lưu ý: bản web hiện chưa kết nối dịch vụ push nền, nên bạn chỉ nhận thông báo khi chức năng push web được cấu hình.',
          });
        } else {
          setPushFeedback({
            title: permission === 'denied' ? 'Thông báo đang bị chặn' : 'Chưa cấp quyền thông báo',
            message: permission === 'denied'
              ? 'Hãy mở cài đặt quyền của trang web trong trình duyệt, cho phép Thông báo rồi tải lại trang.'
              : 'Bạn chưa cho phép thông báo. Hãy bấm lại và chọn Cho phép trong hộp thoại của trình duyệt.',
          });
        }
        return;
      }
      const enabled = await enableMobilePushNotifications();
      if (enabled) {
        Alert.alert('Đã bật thông báo', 'Thiết bị này sẽ nhận thông báo khi có cập nhật.');
      } else {
        Alert.alert(
          'Chưa bật được thông báo',
          'Hãy cho phép thông báo trong cài đặt thiết bị để nhận cập nhật.',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Mở cài đặt', onPress: () => { void Linking.openSettings(); } },
          ],
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể bật thông báo trên thiết bị.';
      if (Platform.OS === 'web') setPushFeedback({ title: 'Không thể bật thông báo', message });
      else Alert.alert('Thông báo', message);
    } finally {
      setEnablingPush(false);
    }
  };
  const configuredLinks = [
    {
      title: 'Chính sách quyền riêng tư',
      url: process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL || '',
    },
    {
      title: 'Điều khoản sử dụng',
      url: process.env.EXPO_PUBLIC_TERMS_OF_SERVICE_URL || '',
    },
    {
      title: 'Liên hệ hỗ trợ',
      url: process.env.EXPO_PUBLIC_SUPPORT_URL || '',
    },
  ].filter((item) => item.url.trim());
  return (
    <AppScreen>
      <AppHeader title="Hồ sơ" subtitle={isTeacher ? 'Thông tin hồ sơ giảng viên' : 'Thông tin tài khoản học viên'} icon={UserRound} />
      {studentProfileResource.loading ? <LoadingSkeleton /> : null}
      {studentProfileResource.error ? <ErrorState onRetry={studentProfileResource.reload} /> : null}
      {isTeacher ? (
        <>
          <Card style={styles.teacherProfileHero}>
            <EditableMobileAvatar
              name={teacherText('name', user?.name || 'Giảng viên')}
              avatar={user?.avatar || (typeof profileTeacher?.avatar === 'string' ? profileTeacher.avatar : undefined)}
              size={72}
              color={user?.avatarColor}
            />
            <Text style={styles.teacherProfileEyebrow}>Hồ sơ cá nhân</Text>
            <Text style={styles.teacherProfileName}>{teacherText('name', user?.name || '—')}</Text>
            <Text style={styles.teacherProfileSubtitle}>
              {[user?.branch, user?.phone].filter(Boolean).join(' · ') || 'Thông tin giảng viên'}
            </Text>
            <View style={styles.teacherProfileTags}>
              <Text style={styles.teacherProfileStatus}>Trạng thái: {teacherStatus}</Text>
            </View>
          </Card>
          <Card style={styles.teacherDetails}>
            <SectionHeading title="Thông tin cá nhân" action="Chỉnh sửa" onPress={() => setShowTeacherProfileForm(true)} />
          </Card>
          {typeof profileTeacher?.testScore === 'number' || typeof profileTeacher?.baseSalaryPerSession === 'number' ? (
            <Card style={styles.teacherDetails}>
              <SectionHeading title="Thông tin giảng dạy" />
              {[
                ['Điểm test', typeof profileTeacher?.testScore === 'number' ? `${profileTeacher.testScore}` : '—'],
                ['Lương/buổi', typeof profileTeacher?.baseSalaryPerSession === 'number' ? formatCurrency(profileTeacher.baseSalaryPerSession) : '—'],
              ].filter(([, value]) => value !== '—').map(([label, value]) => (
                <View key={label} style={styles.teacherProfileField}>
                  <Text style={styles.teacherProfileLabel}>{label}</Text>
                  <Text style={styles.teacherProfileValue}>{value}</Text>
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : (
        <>
          <Card style={styles.studentProfileHero}>
            <EditableMobileAvatar
              name={studentText('name', user?.name || 'Học viên')}
              avatar={user?.avatar || (typeof profileStudent?.avatar === 'string' ? profileStudent.avatar : undefined)}
              size={76}
              color={user?.avatarColor}
            />
            <View style={styles.studentProfileHeroCopy}>
              <Text style={styles.studentProfileHeroEyebrow}>Hồ sơ cá nhân</Text>
              <Text style={styles.studentProfileHeroName}>{studentText('name', user?.name || 'Học viên')}</Text>
              <Text style={styles.studentProfileHeroSubtitle}>Chạm vào ảnh để thay đổi ảnh đại diện</Text>
            </View>
          </Card>
          <Card style={styles.studentProfileSection}>
            <View style={styles.studentProfileSectionHeader}>
              <View style={styles.studentProfileSectionTitle}>
                <UserRound size={16} color={colors.green} />
                <Text style={styles.studentProfileSectionText}>Thông tin cá nhân</Text>
              </View>
              <Pressable onPress={() => setShowStudentProfileForm(true)} style={styles.profileEditButton} accessibilityRole="button">
                <Settings size={14} color={colors.brand} />
                <Text style={styles.profileEditButtonText}>Chỉnh sửa</Text>
              </Pressable>
            </View>
          </Card>
          <Card style={styles.profileDetails}>
            <Pressable onPress={() => toggleStudentSection('courses')} style={styles.studentProfileSectionHeader} accessibilityRole="button" accessibilityState={{ expanded: openStudentSections.courses }}>
              <View style={styles.studentProfileSectionTitle}>
                <BookOpen size={16} color={colors.blue} />
                <Text style={styles.studentProfileSectionText}>Khóa học đã đăng ký</Text>
                <Text style={styles.studentProfileCount}>{enrollments.length}</Text>
              </View>
              <ChevronDown size={17} color={colors.muted} style={openStudentSections.courses ? styles.studentProfileChevronOpen : undefined} />
            </Pressable>
            {openStudentSections.courses ? enrollments.length ? enrollments.map((enrollment) => (
              <View key={enrollment.id} style={styles.profileCourse}>
                <View style={styles.rowBetween}><Text style={styles.cardTitle}>{enrollment.courseName}</Text><StatusBadge label={enrollment.status} /></View>
                <Text style={styles.metaText}>GV: {enrollment.teacherName || 'Chưa phân công'}{enrollment.registeredAt ? ` · ${enrollment.registeredAt}` : ''}</Text>
                {enrollment.progress != null ? <ProgressBar value={enrollment.progress} /> : null}
                <View style={styles.studentCourseProgressMeta}>
                  <Text style={styles.metaText}>{enrollment.completedSessions ?? 0}/{enrollment.totalSessions ?? 0} buổi · Tiến độ {enrollment.progress ?? 0}%</Text>
                  <Text style={styles.studentCourseGrade}>{enrollment.avgGrade ?? 0} TB</Text>
                </View>
              </View>
            )) : <EmptyState title="Chưa có khóa học" message="Khóa học được phân công sẽ hiển thị tại đây." /> : null}
          </Card>
        </>
      )}
      {isTeacher ? (
        <Card style={styles.menuCard}>
          <MenuRow icon={<Settings size={18} color={colors.brand} />} title="Thay đổi mật khẩu" subtitle="Cập nhật mật khẩu đăng nhập" onPress={() => setShowPasswordForm(true)} />
          <MenuRow icon={<KeyRound size={18} color={colors.brand} />} title="Khóa mã PIN" subtitle="Tự khóa màn hình khi không thao tác" onPress={() => setShowPinSettings(true)} />
          <MenuRow icon={<Users size={18} color={colors.brand} />} title="Liên hệ Trung tâm" subtitle="Thông tin trung tâm" onPress={() => navigation.navigate('CenterInfo')} />
        </Card>
      ) : (
        <Card style={styles.menuCard}>
          <MenuRow icon={<Settings size={18} color={colors.brand} />} title="Thay đổi mật khẩu" subtitle="Cập nhật mật khẩu đăng nhập" onPress={() => setShowPasswordForm(true)} />
          <MenuRow icon={<KeyRound size={18} color={colors.brand} />} title="Khóa mã PIN" subtitle="Tự khóa màn hình khi không thao tác" onPress={() => setShowPinSettings(true)} />
          <MenuRow icon={<Target size={18} color={colors.brand} />} title="Mục tiêu học" subtitle="Đặt hoặc đổi số giờ học mỗi ngày" onPress={() => DeviceEventEmitter.emit(OPEN_LEARNING_GOAL_EVENT)} borderless />
        </Card>
      )}
      {showPinSettings && user ? (
        <PinLockSettingsModal userKey={pinUserKey(user)} onClose={() => setShowPinSettings(false)} />
      ) : null}
      {!user?.previewMode ? (
        <Card style={styles.menuCard}>
          <SectionHeading title="Cài đặt và hỗ trợ" />
          <MenuRow
            icon={<Bell size={18} color={colors.brand} />}
            title={enablingPush ? 'Đang bật thông báo…' : 'Bật thông báo trên thiết bị'}
            subtitle={Platform.OS === 'web' ? 'Bật quyền thông báo cho trình duyệt này' : 'Chỉ hỏi quyền khi bạn chọn bật'}
            onPress={() => { void enablePush(); }}
          />
          {configuredLinks.map((item, index) => (
            <MenuRow
              key={item.title}
              icon={<Link2 size={18} color={colors.brand} />}
              title={item.title}
              onPress={() => openConfiguredUrl(item.url, item.title)}
              borderless={index === configuredLinks.length - 1}
            />
          ))}
          {!configuredLinks.length ? (
            <Text style={styles.note}>Liên kết quyền riêng tư, điều khoản và hỗ trợ đang chờ Trung tâm cấu hình.</Text>
          ) : null}
        </Card>
      ) : null}
      <Pressable
        onPress={handleSignOut}
        style={({ pressed }) => [styles.profileSignOutButton, pressed && styles.profileSignOutButtonPressed]}
        accessibilityRole="button"
        accessibilityLabel="Đăng xuất"
      >
        <LogOut size={18} color={colors.red} />
        <Text style={styles.profileSignOutText}>Đăng xuất</Text>
      </Pressable>
      {!isTeacher && showStudentProfileForm ? (
        <StudentProfileEditModal
          user={user}
          profile={profileStudent}
          onClose={() => setShowStudentProfileForm(false)}
          onSaved={(updates) => {
            setShowStudentProfileForm(false);
            if (user?.previewMode) setPreviewStudentUpdates((current) => ({ ...current, ...updates }));
            else studentProfileResource.reload();
          }}
        />
      ) : null}
      {isTeacher && showTeacherProfileForm ? (
        <TeacherProfileEditModal
          user={user}
          profile={profileTeacher}
          onClose={() => setShowTeacherProfileForm(false)}
          onSaved={() => {
            setShowTeacherProfileForm(false);
            studentProfileResource.reload();
          }}
        />
      ) : null}
      {showPasswordForm ? (
        <ChangePasswordModal
          onClose={() => setShowPasswordForm(false)}
          onChanged={() => {
            setShowPasswordForm(false);
            Alert.alert('Thành công', 'Mật khẩu đã được thay đổi.');
          }}
        />
      ) : null}
      <Modal
        visible={Boolean(pushFeedback)}
        transparent
        animationType="fade"
        onRequestClose={() => setPushFeedback(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>{pushFeedback?.title}</Text>
            <Text style={styles.metaText}>{pushFeedback?.message}</Text>
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setPushFeedback(null)}
                style={styles.profilePushFeedbackButton}
                accessibilityRole="button"
                accessibilityLabel="Đóng thông báo trạng thái quyền"
              >
                <Text style={styles.profilePushFeedbackButtonText}>Đã hiểu</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

function EditableMobileAvatar({
  name,
  avatar,
  size,
  color,
}: {
  name: string;
  avatar?: string;
  size: number;
  color?: string;
}) {
  const { user, updateAvatar } = useAuth();
  const [uploading, setUploading] = useState(false);
  const chooseAvatar = async () => {
    if (uploading) return;
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Cần quyền truy cập ảnh', 'Cho phép ứng dụng truy cập thư viện ảnh để đổi ảnh đại diện.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.92,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;
      const image = result.assets[0];
      if (image.mimeType && !image.mimeType.toLowerCase().startsWith('image/')) {
        Alert.alert('Ảnh chưa hợp lệ', 'Vui lòng chọn ảnh JPG, PNG hoặc WEBP.');
        return;
      }
      if (image.fileSize != null && image.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Ảnh quá lớn', 'Kích thước ảnh đại diện tối đa là 5MB.');
        return;
      }
      if (user?.previewMode) {
        Alert.alert('Bản xem trước', 'Không thể tải ảnh đại diện lên máy chủ trong bản xem trước.');
        return;
      }
      setUploading(true);
      const extensionByMimeType: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
      };
      const updatedAvatar = await uploadAndUpdateAvatar({
        uri: image.uri,
        name: image.fileName || `avatar-${Date.now()}.${extensionByMimeType[image.mimeType || 'image/jpeg'] || 'jpg'}`,
        mimeType: image.mimeType,
        size: image.fileSize,
        file: image.file,
      });
      await updateAvatar(updatedAvatar);
      Alert.alert('Đã đổi ảnh', 'Ảnh đại diện của bạn đã được cập nhật.');
    } catch (error) {
      Alert.alert('Không thể đổi ảnh đại diện', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setUploading(false);
    }
  };
  const imageSource = avatar ? getMobileImageSource(resolveMobilePublicUrl(avatar)) : undefined;
  return (
    <Pressable
      onPress={() => { void chooseAvatar(); }}
      style={[styles.editableAvatar, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityRole="button"
      accessibilityLabel={uploading ? 'Đang tải ảnh đại diện' : 'Đổi ảnh đại diện'}
      accessibilityState={{ disabled: uploading }}
    >
      <Avatar name={name} color={color} size={size} imageSource={imageSource} />
      <View style={styles.editableAvatarCamera}>
        {uploading ? <Text style={styles.editableAvatarLoading}>…</Text> : <Camera size={14} color="#FFFFFF" />}
      </View>
    </Pressable>
  );
}

function StudentProfileEditModal({
  user,
  profile,
  onClose,
  onSaved,
}: {
  user: DemoUser | null;
  profile: RawStudent | null | undefined;
  onClose: () => void;
  onSaved: (updates: StudentProfileUpdate) => void;
}) {
  const { width } = useWindowDimensions();
  const name = typeof profile?.name === 'string' ? profile.name : user?.name || '';
  const phone = typeof profile?.phone === 'string' ? profile.phone : user?.phone || '';
  const [email, setEmail] = useState(typeof profile?.email === 'string' ? profile.email : '');
  const [zalo, setZalo] = useState(typeof profile?.zalo === 'string' ? profile.zalo : user?.zalo || '');
  const [address, setAddress] = useState(typeof profile?.address === 'string' ? profile.address : '');
  const [gender, setGender] = useState<'male' | 'female'>(profile?.gender === 'female' || profile?.gender === 'Nữ' ? 'female' : 'male');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) {
      Alert.alert('Không thể lưu hồ sơ', 'Vui lòng đăng nhập lại rồi thử lần nữa.');
      return;
    }
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      Alert.alert('Email chưa hợp lệ', 'Kiểm tra lại địa chỉ email rồi thử lưu lần nữa.');
      return;
    }
    const updates: StudentProfileUpdate = {
      email: email.trim(),
      zalo: zalo.trim(),
      address: address.trim(),
      gender,
    };
    setSaving(true);
    try {
      if (!user.previewMode) await updateStudentProfile(user, updates);
      onSaved(updates);
    } catch (error) {
      Alert.alert('Không thể lưu hồ sơ', error instanceof Error ? error.message : 'Đã xảy ra lỗi khi cập nhật hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, styles.studentProfileModalBackdrop]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          style={styles.studentProfileModal}
        >
          <View style={styles.studentProfileModalHeader}>
            <View style={styles.studentProfileModalTitle}>
              <UserRound size={18} color="#0F766E" />
              <Text style={styles.studentProfileModalTitleText}>Cập nhật Hồ sơ Cá nhân</Text>
            </View>
            <Pressable onPress={onClose} style={styles.studentProfileModalClose} accessibilityRole="button" accessibilityLabel="Đóng cập nhật hồ sơ">
              <X size={17} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.studentProfileModalBody} keyboardShouldPersistTaps="handled">
            <View style={styles.studentProfileModalField}>
              <Text style={styles.studentProfileModalLabel}>Họ và tên</Text>
              <TextInput value={name} editable={false} style={[styles.formInput, styles.studentProfileReadOnlyInput]} accessibilityLabel="Họ và tên, không thể chỉnh sửa" />
              <Text style={styles.studentProfileReadonlyNote}>* Tên không thể tự sửa. Vui lòng liên hệ Admin.</Text>
            </View>
            <View style={styles.studentProfileModalField}>
              <Text style={styles.studentProfileModalLabel}>Giới tính chọn ảnh đại diện</Text>
              <View style={styles.studentProfileGenderRow}>
                {([
                  { value: 'male', label: '👨 Nam' },
                  { value: 'female', label: '👩 Nữ' },
                ] as const).map((option) => {
                  const selected = gender === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setGender(option.value)}
                      style={[styles.studentProfileGenderOption, selected && styles.studentProfileGenderOptionSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <Text style={[styles.studentProfileGenderText, selected && styles.studentProfileGenderTextSelected]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View style={[styles.studentProfilePhoneRow, width < 430 && styles.studentProfilePhoneRowStack]}>
              <View style={[styles.studentProfileModalField, styles.studentProfilePhoneField]}>
                <Text style={styles.studentProfileModalLabel}>Số điện thoại</Text>
                <View style={styles.studentProfileInputWithIcon}>
                  <Phone size={15} color="#94A3B8" />
                  <TextInput value={phone} editable={false} style={[styles.studentProfileIconInput, styles.studentProfileReadOnlyInput]} accessibilityLabel="Số điện thoại đăng nhập, không thể chỉnh sửa" />
                </View>
                <Text style={styles.studentProfileReadonlyNote}>* Liên hệ Admin để đổi SĐT.</Text>
              </View>
              <View style={[styles.studentProfileModalField, styles.studentProfilePhoneField]}>
                <Text style={styles.studentProfileModalLabel}>SĐT liên hệ 2</Text>
                <View style={styles.studentProfileInputWithIcon}>
                  <Phone size={15} color="#3B82F6" />
                  <TextInput value={zalo} onChangeText={setZalo} placeholder="Số điện thoại" keyboardType="phone-pad" style={styles.studentProfileIconInput} accessibilityLabel="Số điện thoại liên hệ thứ hai" />
                </View>
              </View>
            </View>
            <View style={styles.studentProfileModalField}>
              <Text style={styles.studentProfileModalLabel}>Email</Text>
              <View style={styles.studentProfileInputWithIcon}>
                <Mail size={15} color="#94A3B8" />
                <TextInput value={email} onChangeText={setEmail} placeholder="Ví dụ: nguyenvan@gmail.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} style={styles.studentProfileIconInput} accessibilityLabel="Email" />
              </View>
            </View>
            <View style={styles.studentProfileModalField}>
              <Text style={styles.studentProfileModalLabel}>Địa chỉ</Text>
              <View style={styles.studentProfileInputWithIcon}>
                <MapPin size={15} color="#94A3B8" />
                <TextInput value={address} onChangeText={setAddress} placeholder="Nhập địa chỉ của bạn" style={styles.studentProfileIconInput} accessibilityLabel="Địa chỉ" />
              </View>
            </View>
            <Pressable
              onPress={() => { void save(); }}
              disabled={saving}
              style={[styles.studentProfileSaveButton, saving && styles.studentProfileSaveButtonDisabled]}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
            >
              <Save size={16} color="#FFFFFF" />
              <Text style={styles.studentProfileSaveButtonText}>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function ChangePasswordModal({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!oldPassword) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Mật khẩu chưa hợp lệ', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Mật khẩu không khớp', 'Vui lòng nhập lại xác nhận mật khẩu mới.');
      return;
    }
    setSaving(true);
    try {
      await authService.changePassword(oldPassword, newPassword);
      onChanged();
    } catch (error) {
      Alert.alert('Không thể đổi mật khẩu', error instanceof Error ? error.message : 'Đã xảy ra lỗi khi đổi mật khẩu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, styles.teacherEditBackdrop]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
          style={styles.changePasswordModal}
        >
          <View style={styles.teacherEditHeader}>
            <View>
              <Text style={styles.teacherEditTitle}>Thay đổi mật khẩu</Text>
              <Text style={styles.teacherEditSubtitle}>Dùng mật khẩu mới cho lần đăng nhập tiếp theo</Text>
            </View>
            <Pressable
              onPress={onClose}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Đóng thay đổi mật khẩu"
              style={styles.teacherEditClose}
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.changePasswordBody}
            contentContainerStyle={styles.changePasswordFields}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TextInput
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Mật khẩu hiện tại"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              style={[styles.formInput, styles.teacherEditInput]}
            />
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Mật khẩu mới (ít nhất 6 ký tự)"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              style={[styles.formInput, styles.teacherEditInput]}
            />
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Nhập lại mật khẩu mới"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              textContentType="newPassword"
              style={[styles.formInput, styles.teacherEditInput]}
            />
          </ScrollView>
          <View style={styles.teacherEditActions}>
            <Pressable
              onPress={onClose}
              disabled={saving}
              style={[styles.teacherEditCancel, saving && styles.teacherEditDisabled]}
            >
              <Text style={styles.teacherEditCancelText}>Hủy</Text>
            </Pressable>
            <Pressable
              onPress={() => { void submit(); }}
              disabled={saving}
              style={[styles.teacherEditSave, saving && styles.teacherEditDisabled]}
            >
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Save size={16} color="#FFFFFF" />}
              <Text style={styles.teacherEditSaveText}>{saving ? 'Đang lưu…' : 'Cập nhật mật khẩu'}</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

type VietQrBank = {
  bin: string;
  shortName: string;
  name: string;
};

function parseVietQrBanks(payload: unknown): VietQrBank[] {
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) {
    return [];
  }
  return payload.data.flatMap((entry): VietQrBank[] => {
    if (!entry || typeof entry !== 'object') return [];
    const bank = entry as Record<string, unknown>;
    const bin = typeof bank.bin === 'string' || typeof bank.bin === 'number' ? String(bank.bin).trim() : '';
    const shortName = typeof bank.shortName === 'string' ? bank.shortName.trim() : '';
    const name = typeof bank.name === 'string' ? bank.name.trim() : '';
    return bin && (shortName || name) ? [{ bin, shortName: shortName || name, name: name || shortName }] : [];
  });
}

function TeacherProfileEditModal({
  user,
  profile,
  onClose,
  onSaved,
}: {
  user: DemoUser | null;
  profile: TeacherProfile | null | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { width } = useWindowDimensions();
  const compactForm = width < 380;
  const bank = profile?.bankAccount && typeof profile.bankAccount === 'object'
    ? profile.bankAccount as Record<string, unknown>
    : {};
  const [banks, setBanks] = useState<VietQrBank[]>([]);
  const [bankLoading, setBankLoading] = useState(true);
  const [bankError, setBankError] = useState('');
  const [bankRetry, setBankRetry] = useState(0);
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [bankCode, setBankCode] = useState(typeof bank.bankCode === 'string' ? bank.bankCode : '');
  const [email, setEmail] = useState(typeof profile?.email === 'string' ? profile.email : '');
  const [zalo, setZalo] = useState(typeof profile?.zalo === 'string' ? profile.zalo : '');
  const [age, setAge] = useState(typeof profile?.age === 'number' ? String(profile.age) : '');
  const [address, setAddress] = useState(typeof profile?.address === 'string' ? profile.address : '');
  const [bio, setBio] = useState(typeof profile?.bio === 'string' ? profile.bio : '');
  const [voiceRegion, setVoiceRegion] = useState(typeof profile?.voiceRegion === 'string' ? profile.voiceRegion : '');
  const [bankName, setBankName] = useState(typeof bank.bankName === 'string' ? bank.bankName : '');
  const [accountNumber, setAccountNumber] = useState(typeof bank.accountNumber === 'string' ? bank.accountNumber : '');
  const [accountHolder, setAccountHolder] = useState(typeof bank.accountHolder === 'string' ? bank.accountHolder : '');
  const [bankBranch, setBankBranch] = useState(typeof bank.bankBranch === 'string' ? bank.bankBranch : '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadBanks = async () => {
      setBankLoading(true);
      setBankError('');
      try {
        const response = await fetch('https://api.vietqr.io/v2/banks', { signal: controller.signal });
        if (!response.ok) throw new Error(`Máy chủ ngân hàng phản hồi HTTP ${response.status}.`);
        const list = parseVietQrBanks(await response.json());
        if (!list.length) throw new Error('Danh sách ngân hàng trả về không hợp lệ.');
        setBanks(list);
      } catch (error) {
        if (controller.signal.aborted) return;
        setBankError(error instanceof Error ? error.message : 'Không tải được danh sách ngân hàng.');
      } finally {
        if (!controller.signal.aborted) setBankLoading(false);
      }
    };
    void loadBanks();
    return () => controller.abort();
  }, [bankRetry]);

  const filteredBanks = useMemo(() => {
    const query = bankSearch.trim().toLocaleLowerCase();
    if (!query) return banks;
    return banks.filter((item) => `${item.shortName} ${item.name} ${item.bin}`.toLocaleLowerCase().includes(query));
  }, [banks, bankSearch]);

  const save = async () => {
    const ageValue = age.trim() ? Number(age) : null;
    if (ageValue !== null && (!Number.isInteger(ageValue) || ageValue < 18 || ageValue > 100)) {
      Alert.alert('Thông tin chưa hợp lệ', 'Tuổi giảng viên phải là số nguyên từ 18 đến 100.');
      return;
    }
    const updates: TeacherProfileUpdate = {
      email: email.trim(),
      zalo: zalo.trim(),
      age: ageValue,
      address: address.trim(),
      bio: bio.trim(),
      voiceRegion,
      bankAccount: {
        bankCode: bankCode.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        bankBranch: bankBranch.trim(),
      },
    };
    setSaving(true);
    try {
      await teacherProfileService.update(user, updates);
      onSaved();
    } catch (error) {
      Alert.alert('Không thể lưu hồ sơ', error instanceof Error ? error.message : 'Đã xảy ra lỗi khi cập nhật hồ sơ.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.modalBackdrop, styles.teacherEditBackdrop]}>
        <View style={styles.teacherEditModal}>
          <View style={styles.teacherEditHeader}>
            <View>
              <Text style={styles.teacherEditTitle}>Chỉnh sửa hồ sơ</Text>
              <Text style={styles.teacherEditSubtitle}>Cập nhật liên hệ và thông tin thanh toán</Text>
            </View>
            <Pressable
              onPress={onClose}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Đóng chỉnh sửa hồ sơ"
              style={styles.teacherEditClose}
            >
              <X size={18} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.teacherEditBody}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.teacherEditSection}>Thông tin cá nhân</Text>
            <View style={[styles.teacherEditRow, compactForm && styles.teacherEditRowCompact]}>
              <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={[styles.formInput, styles.teacherEditInput, styles.teacherEditHalf, compactForm && styles.teacherEditFull]} />
              <TextInput value={zalo} onChangeText={setZalo} placeholder="Zalo" keyboardType="phone-pad" style={[styles.formInput, styles.teacherEditInput, styles.teacherEditHalf, compactForm && styles.teacherEditFull]} />
            </View>
            <View style={[styles.teacherEditRow, compactForm && styles.teacherEditRowCompact]}>
              <TextInput value={age} onChangeText={setAge} placeholder="Tuổi" keyboardType="number-pad" style={[styles.formInput, styles.teacherEditInput, styles.teacherEditAge, compactForm && styles.teacherEditFull]} />
              <TextInput value={address} onChangeText={setAddress} placeholder="Địa chỉ" style={[styles.formInput, styles.teacherEditInput, styles.teacherEditFlex, compactForm && styles.teacherEditFull]} />
            </View>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Giới thiệu bản thân"
              multiline
              style={[styles.formInput, styles.teacherEditInput, styles.teacherEditBio]}
            />
            <View style={styles.teacherEditVoice}>
              <Text style={styles.teacherEditLabel}>Giọng (vùng miền)</Text>
              <View style={styles.teacherEditVoiceOptions}>
                {[
                  ['bac', 'Bắc'],
                  ['trung', 'Trung'],
                  ['nam', 'Nam'],
                  ['tay', 'Miền Tây'],
                ].map(([value, label]) => {
                  const selected = voiceRegion === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setVoiceRegion(selected ? '' : value)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.teacherEditVoiceOption, selected && styles.teacherEditVoiceOptionSelected]}
                    >
                      <Text style={[styles.teacherEditVoiceText, selected && styles.teacherEditVoiceTextSelected]}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Text style={[styles.teacherEditSection, styles.teacherEditPaymentSection]}>Thông tin thanh toán</Text>
            <Text style={styles.teacherEditLabel}>Ngân hàng</Text>
            <Pressable
              onPress={() => setBankPickerVisible(true)}
              style={[styles.formInput, styles.teacherEditInput, styles.teacherEditBankSelect]}
              accessibilityRole="button"
              accessibilityLabel={bankName ? `Ngân hàng ${bankName}, chạm để chọn ngân hàng` : 'Chọn ngân hàng'}
            >
              <Landmark size={16} color={colors.brand} />
              <Text style={[styles.teacherEditBankText, !bankName && styles.teacherEditBankPlaceholder]} numberOfLines={1}>
                {bankName || 'Chọn ngân hàng'}
              </Text>
              <ChevronDown size={16} color={colors.muted} />
            </Pressable>
            {bankError ? (
              <View style={styles.teacherEditBankError}>
                <Text style={styles.teacherEditBankErrorText}>{bankError}</Text>
                <Pressable onPress={() => setBankRetry((count) => count + 1)}>
                  <Text style={styles.teacherEditBankRetry}>Thử tải lại</Text>
                </Pressable>
              </View>
            ) : null}
            <TextInput value={accountNumber} onChangeText={setAccountNumber} placeholder="Số tài khoản" keyboardType="number-pad" style={[styles.formInput, styles.teacherEditInput]} />
            <View style={[styles.teacherEditRow, compactForm && styles.teacherEditRowCompact]}>
              <TextInput value={accountHolder} onChangeText={setAccountHolder} placeholder="Tên chủ tài khoản" style={[styles.formInput, styles.teacherEditInput, styles.teacherEditHalf, compactForm && styles.teacherEditFull]} />
              <TextInput value={bankBranch} onChangeText={setBankBranch} placeholder="Chi nhánh" style={[styles.formInput, styles.teacherEditInput, styles.teacherEditHalf, compactForm && styles.teacherEditFull]} />
            </View>
            <Text style={styles.teacherEditNote}>Tên, số điện thoại chính, chuyên môn và trạng thái do Trung tâm quản lý.</Text>
          </ScrollView>
          <View style={styles.teacherEditActions}>
            <Pressable
              onPress={onClose}
              disabled={saving}
              style={[styles.teacherEditCancel, saving && styles.teacherEditDisabled]}
            >
              <Text style={styles.teacherEditCancelText}>Hủy</Text>
            </Pressable>
            <Pressable
              onPress={() => { void save(); }}
              disabled={saving}
              style={[styles.teacherEditSave, saving && styles.teacherEditDisabled]}
            >
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Save size={16} color="#FFFFFF" />}
              <Text style={styles.teacherEditSaveText}>{saving ? 'Đang lưu…' : 'Lưu thay đổi'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
      <Modal
        visible={bankPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBankPickerVisible(false)}
      >
        <View style={styles.teacherBankPickerBackdrop}>
          <View style={styles.teacherBankPicker}>
            <View style={styles.teacherBankPickerHeader}>
              <Text style={styles.teacherBankPickerTitle}>Chọn ngân hàng</Text>
              <Pressable
                onPress={() => setBankPickerVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Đóng danh sách ngân hàng"
                style={styles.teacherEditClose}
              >
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <View style={styles.teacherBankSearch}>
              <Search size={16} color={colors.muted} />
              <TextInput
                value={bankSearch}
                onChangeText={setBankSearch}
                placeholder="Tìm tên hoặc mã ngân hàng"
                autoCapitalize="none"
                style={styles.teacherBankSearchInput}
              />
            </View>
            {bankLoading ? (
              <View style={styles.teacherBankState}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={styles.teacherBankStateText}>Đang tải danh sách ngân hàng…</Text>
              </View>
            ) : bankError ? (
              <View style={styles.teacherBankState}>
                <Text style={styles.teacherEditBankErrorText}>{bankError}</Text>
                <Pressable onPress={() => setBankRetry((count) => count + 1)}>
                  <Text style={styles.teacherEditBankRetry}>Thử tải lại</Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {filteredBanks.map((item) => (
                  <Pressable
                    key={item.bin}
                    onPress={() => {
                      setBankCode(item.bin);
                      setBankName(item.shortName);
                      setBankPickerVisible(false);
                      setBankSearch('');
                    }}
                    style={styles.teacherBankOption}
                    accessibilityRole="button"
                  >
                    <View style={styles.teacherBankOptionIcon}><Landmark size={16} color={colors.brand} /></View>
                    <View style={styles.teacherBankOptionCopy}>
                      <Text style={styles.teacherBankOptionName}>{item.shortName}</Text>
                      <Text style={styles.teacherBankOptionDetail} numberOfLines={1}>{item.name} · {item.bin}</Text>
                    </View>
                    {bankCode === item.bin ? <Check size={17} color={colors.brand} /> : null}
                  </Pressable>
                ))}
                {!filteredBanks.length ? <Text style={styles.teacherBankStateText}>Không tìm thấy ngân hàng phù hợp.</Text> : null}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      {icon}
      <View style={styles.rowCopy}>
        <Text style={styles.metaText}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

function FilterChips({ items, selected, onSelect, compact = false, variant = 'chips', counts }: {
  items: string[];
  selected: string;
  onSelect: (item: string) => void;
  compact?: boolean;
  variant?: 'chips' | 'tabs';
  counts?: Record<string, { value: number; color: string; background: string }>;
}) {
  if (variant === 'tabs') {
    return (
      <View style={styles.filterTabs} accessibilityRole="tablist">
        {items.map((item) => {
          const active = selected === item;
          const count = counts?.[item];
          return (
            <Pressable
              key={item}
              onPress={() => onSelect(item)}
              style={[styles.filterTab, active && styles.filterTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <View style={styles.filterTabInner}>
                <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{item}</Text>
                {count && count.value > 0 ? (
                  <Text style={[styles.filterTabCount, { color: count.color, backgroundColor: count.background }]}>{count.value}</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  }
  const chips = items.map((item) => (
    <Pressable
      key={item}
      onPress={() => onSelect(item)}
      style={[
        styles.chip,
        compact && styles.compactChip,
        selected === item && (compact ? styles.compactChipActive : styles.chipActive),
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: selected === item }}
    >
      <Text style={[
        styles.chipText,
        compact && styles.compactChipText,
        selected === item && (compact ? styles.compactChipTextActive : styles.chipTextActive),
      ]}>{item}</Text>
    </Pressable>
  ));

  if (compact) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.compactChips}
        contentContainerStyle={styles.compactChipsContent}
      >
        {chips}
      </ScrollView>
    );
  }

  return (
    <View style={styles.chips}>{chips}</View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: spacing.md },
  scheduleHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderColor: '#F1D7D8' },
  scheduleHeroIcon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft, borderWidth: 1, borderColor: '#FECACA' },
  scheduleHeroTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '900', letterSpacing: -0.2 },
  scheduleStats: { flexDirection: 'row', gap: spacing.sm },
  studentCourseSection: { gap: spacing.sm },
  studentCoursesLabel: { color: colors.muted, fontSize: typography.caption, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: spacing.xs },
  studentCourses: { gap: spacing.md, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  studentCourseCard: { width: 242, minHeight: 116, justifyContent: 'space-between', padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, gap: spacing.xs },
  studentCourseCardActive: { borderColor: '#3B82F6', backgroundColor: colors.blueSoft },
  studentCourseName: { color: colors.ink, fontSize: typography.caption, fontWeight: '800', lineHeight: 17 },
  studentCourseNameActive: { color: '#1E40AF' },
  studentCourseTeacher: { color: colors.muted, fontSize: typography.micro, fontWeight: '600' },
  studentCourseProgressTrack: { height: 5, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: '#E9EFF0', marginTop: spacing.xs },
  studentCourseProgressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.brand },
  studentCourseProgressMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  scheduleOverview: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 0, borderWidth: 0, borderLeftWidth: 4, borderLeftColor: colors.brand, backgroundColor: '#FFFEFE' },
  scheduleOverviewIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  scheduleOverviewCopy: { flex: 1, gap: 2 },
  scheduleOverviewTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '800' },
  assessmentTabs: { flexDirection: 'row', marginBottom: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  assessmentTab: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  assessmentTabActive: { borderBottomColor: colors.brand },
  assessmentTabText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700', textAlign: 'center' },
  assessmentTabTextActive: { color: colors.brand, fontWeight: '800' },
  assignmentScreen: { flex: 1 },
  assignToolbar: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.sm, marginBottom: spacing.sm },
  assignCoursePill: {
    flex: 1, minWidth: 0, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md,
    borderWidth: 2, borderColor: '#FECACA', borderRadius: radius.md, backgroundColor: '#FEF2F2',
  },
  assignCourseCaption: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  assignCourseName: { color: '#B91C1C', fontSize: 14, fontWeight: '900' },
  assignCreateButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.brand, boxShadow: '0px 6px 14px rgba(220, 38, 38, 0.28)',
  } as never,
  assignCreateText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', lineHeight: 16 },
  assignSheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2, 6, 23, 0.5)' },
  assignSheet: {
    maxHeight: '70%', gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.xl,
    borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.surface,
  },
  assignSheetList: { gap: spacing.xs },
  assignSheetOption: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md,
    borderWidth: 1, borderColor: colors.line, borderRadius: radius.md,
  },
  assignSheetOptionActive: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  assignSheetOptionText: { flex: 1, color: colors.ink, fontSize: 14, fontWeight: '800' },
  assignSheetOptionTextActive: { color: '#B91C1C' },
  teacherAssignmentCard: { gap: spacing.sm, padding: spacing.md },
  teacherAssignmentHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  teacherAssignmentTitleWrap: { flex: 1, minWidth: 0, gap: 3 },
  teacherAssignmentStatus: { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.sm },
  teacherAssignmentActive: { backgroundColor: colors.greenSoft },
  teacherAssignmentClosed: { backgroundColor: colors.redSoft },
  teacherAssignmentStatusText: { fontSize: typography.micro, fontWeight: '800' },
  teacherAssignmentActiveText: { color: colors.green },
  teacherAssignmentClosedText: { color: colors.red },
  teacherAssignmentDescription: { color: colors.muted, fontSize: typography.caption, lineHeight: 19 },
  teacherAssignmentDeadline: { color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  teacherAssignmentMetrics: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  teacherAssignmentMetric: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3, paddingVertical: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.canvas },
  teacherAssignmentMetricValue: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  teacherAssignmentMetricLabel: { color: colors.muted, fontSize: typography.micro, fontWeight: '700', textAlign: 'center' },
  assignmentTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  assignmentTab: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm },
  assignmentTabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  assignmentTabText: { color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
  assignmentTabActiveText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '700' },
  scheduleStat: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.md, gap: 4 },
  scheduleStatIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scheduleStatLabel: { color: colors.muted, fontSize: typography.micro, fontWeight: '800', textAlign: 'center', minHeight: 24 },
  scheduleStatValue: { color: colors.brandDark, fontSize: typography.heading, fontWeight: '800' },
  scheduleStatUnit: { color: colors.muted, fontSize: typography.micro, fontWeight: '600' },
  scheduleViewToggle: { flexDirection: 'row', gap: 6, padding: 4, borderRadius: radius.md, backgroundColor: '#EFF3F8' },
  scheduleViewTab: { flex: 1, minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  scheduleViewTabActive: { backgroundColor: colors.brand, shadowColor: '#9F1239', shadowOpacity: 0.18, shadowRadius: 6, elevation: 2 },
  scheduleViewTabText: { color: colors.muted, fontSize: typography.caption, fontWeight: '800' },
  scheduleViewTabTextActive: { color: '#FFFFFF' },
  monthCalendarCard: { gap: spacing.md, padding: spacing.md },
  monthCalendarHeader: { gap: spacing.sm },
  monthCalendarControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 42, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#F8FAFC', paddingHorizontal: spacing.xs },
  monthCalendarArrow: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surface },
  monthCalendarTitle: { minWidth: 120, color: colors.ink, fontSize: typography.caption, fontWeight: '900', textAlign: 'center', textTransform: 'capitalize' },
  monthCalendarWeekdays: { flexDirection: 'row', paddingBottom: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.line },
  monthCalendarWeekday: { flex: 1, color: colors.muted, fontSize: typography.micro, fontWeight: '900', textAlign: 'center' },
  monthCalendarSunday: { color: '#E11D48' },
  monthCalendarGrid: { gap: 5 },
  monthCalendarWeek: { flexDirection: 'row', gap: 5 },
  monthCalendarCell: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  monthCalendarDay: { borderWidth: 1, borderColor: 'transparent', backgroundColor: '#FFFFFF' },
  monthCalendarToday: { borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' },
  monthCalendarDaySelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  monthCalendarDayText: { color: colors.ink, fontSize: typography.caption, fontWeight: '800' },
  monthCalendarTodayText: { color: '#4338CA' },
  monthCalendarDayTextSelected: { color: '#FFFFFF' },
  deadlinePickerButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, backgroundColor: colors.surface },
  deadlinePickerValue: { flex: 1, color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  deadlinePickerPlaceholder: { flex: 1, color: colors.muted, fontSize: typography.small },
  deadlineCalendar: { gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  deadlineCalendarDayDisabled: { backgroundColor: '#F1F5F9' },
  deadlineCalendarDayTextDisabled: { color: '#CBD5E1' },
  monthCalendarDots: { minHeight: 7, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, marginTop: 2 },
  monthCalendarDot: { width: 5, height: 5, borderRadius: radius.pill },
  monthCalendarLegend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.md, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: spacing.sm },
  monthCalendarLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  monthCalendarLegendText: { color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  calendarDayCard: { gap: spacing.sm, padding: spacing.md, borderColor: '#E8EDF4', backgroundColor: colors.surface, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 10, elevation: 1 },
  calendarDayHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  calendarDayTitle: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  calendarDaySubtitle: { color: colors.muted, fontSize: typography.micro, fontWeight: '600' },
  calendarDayCount: { paddingHorizontal: spacing.sm, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.brandSoft, color: colors.brandDark, fontSize: typography.micro, fontWeight: '900' },
  calendarAppointments: { gap: spacing.sm },
  calendarAppointment: { gap: spacing.xs, padding: spacing.sm, borderWidth: 1, borderColor: '#E8EDF4', borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  calendarAppointmentTitle: { flex: 1, color: colors.ink, fontSize: typography.caption, lineHeight: 17, fontWeight: '900' },
  calendarAppointmentInfo: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  calendarAppointmentTime: { color: colors.brandDark, fontSize: typography.micro, fontWeight: '800' },
  calendarAppointmentCourse: { color: '#475569', fontSize: typography.micro, lineHeight: 16, fontWeight: '600' },
  calendarAppointmentNote: { color: colors.muted, fontSize: typography.micro, lineHeight: 16 },
  calendarStudentNote: { color: '#1D4ED8', fontSize: typography.micro, lineHeight: 16 },
  calendarActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  calendarActionsSubmitted: { width: '100%', alignItems: 'center', justifyContent: 'space-between' },
  calendarAttendanceAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.brand },
  calendarMakeupAction: { backgroundColor: '#D97706' },
  calendarMakeupActionSent: { backgroundColor: '#E2E8F0' },
  calendarMakeupActionText: { color: '#FFFFFF' },
  calendarMakeupActionTextSent: { color: '#64748B' },
  calendarAttendanceActionDisabled: { backgroundColor: '#E2E8F0' },
  calendarAttendanceActionSubmitted: { backgroundColor: '#FEE2E2' },
  calendarAttendanceActionText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '800' },
  calendarAttendanceActionTextDisabled: { color: '#64748B' },
  calendarAttendanceActionTextSubmitted: { color: '#B91C1C' },
  calendarEditAction: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: '#1D4ED8' },
  calendarEditActionText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '800' },
  calendarCancelAction: { alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: '#7F1D1D' },
  calendarCancelActionText: { color: '#FEE2E2', fontSize: typography.micro, fontWeight: '800' },
  calendarDayEmpty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  calendarDayEmptyText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  calendarAddAction: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: '#2563EB' },
  calendarAddActionText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  weekNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, minHeight: 48 },
  studentWeekNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.brand, borderRadius: radius.sm, backgroundColor: colors.surface, paddingHorizontal: 5, minHeight: 42 },
  studentWeekArrow: { minHeight: 32, minWidth: 68, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderRadius: radius.sm, backgroundColor: '#F1F2F4' },
  studentWeekArrowText: { color: '#3F454D', fontSize: typography.micro, fontWeight: '800' },
  studentWeekCurrent: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  weekArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  weekArrowText: { fontSize: typography.display, lineHeight: 30, color: colors.brandDark, fontWeight: '700' },
  weekLabel: { color: colors.brandDark, fontSize: typography.caption, fontWeight: '700' },
  scheduleDays: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  scheduleDay: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  scheduleDaySelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  scheduleDayText: { color: colors.ink, fontSize: typography.micro, fontWeight: '700' },
  scheduleDayTextSelected: { color: '#FFFFFF' },
  weeklyGridCard: { gap: spacing.md, padding: spacing.md, overflow: 'hidden', borderColor: '#E8EDF4', shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 12, elevation: 1 },
  weeklyGridHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weeklyGridHeadingCopy: { flex: 1, gap: 2 },
  scheduleFilterSection: { gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderColor: '#E8EDF4', borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  scheduleFilterHeading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  scheduleFilterLabel: { color: colors.muted, fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.6 },
  scheduleFilterCount: { marginLeft: 'auto', color: colors.brandDark, fontSize: typography.micro, fontWeight: '800' },
  rosterStatusFilters: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 4 },
  rosterStatusChip: { flex: 1, minWidth: 0, minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 4, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.sm, backgroundColor: colors.surface },
  rosterStatusChipActive: { borderColor: colors.brand, backgroundColor: colors.brand },
  rosterStatusText: { color: colors.muted, fontSize: typography.micro, fontWeight: '800' },
  rosterStatusTextActive: { color: colors.surface },
  rosterStatusCount: { color: colors.muted, fontSize: typography.micro, fontWeight: '800' },
  rosterStatusCountActive: { color: '#FFE4E6' },
  rosterSearchIconButton: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DBEAFE', borderRadius: radius.sm, backgroundColor: '#EFF6FF' },
  rosterSearchIconButtonActive: { borderColor: '#FECACA', backgroundColor: colors.brandSoft },
  courseFilterSelect: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#DBE3EE', borderRadius: radius.sm, backgroundColor: colors.surface },
  courseFilterSelectLabel: { color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  courseFilterSelectValue: { flex: 1, color: colors.brandDark, fontSize: typography.micro, fontWeight: '800', textAlign: 'center' },
  coursePickerOptions: { maxHeight: 360 },
  compactRosterSearch: { flex: 1, minWidth: 0, height: 32, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.surface },
  compactRosterSearchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: colors.ink, fontSize: typography.micro },
  weeklyGridTitle: { color: colors.ink, fontSize: typography.small, lineHeight: 19, fontWeight: '800' },
  diaryHeadingIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  diaryDescription: { color: colors.muted, fontSize: typography.caption, lineHeight: 15 },
  studentDiaryHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  teacherDiaryCount: { minWidth: 42, height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: spacing.xs, borderRadius: radius.md, backgroundColor: '#F1F5F9' },
  teacherDiaryCountText: { color: colors.brandDark, fontSize: typography.caption, fontWeight: '900' },
  teacherDiaryCountLabel: { color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  teacherDiaryFilters: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: '#FAFBFD' },
  teacherDiaryDateFilters: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  teacherDiaryDateFilter: { flex: 1, minWidth: 0, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 3, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: colors.surface },
  teacherDiaryDateFilterActive: { borderColor: colors.brandDark, backgroundColor: colors.brandDark, shadowColor: colors.brandDark, shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  teacherDiaryDateFilterCancelled: { borderColor: '#FECDD3', backgroundColor: '#FFF1F2' },
  teacherDiaryDateFilterCancelledActive: { borderColor: '#BE123C', backgroundColor: '#BE123C', shadowColor: '#BE123C', shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  teacherDiaryDateFilterText: { color: colors.muted, fontSize: typography.micro, fontWeight: '800' },
  teacherDiaryDateFilterCancelledText: { color: '#BE123C' },
  teacherDiaryDateFilterTextActive: { color: colors.surface },
  teacherDiaryDateFilterCount: { minWidth: 20, height: 20, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', paddingHorizontal: 4, borderRadius: radius.pill, backgroundColor: '#FFE4E6', color: '#BE123C', fontSize: typography.micro, fontWeight: '900' },
  teacherDiaryDateFilterCountActive: { backgroundColor: 'rgba(255,255,255,0.2)', color: colors.surface },
  teacherDiaryStatusFilters: { width: '100%', flexDirection: 'row', alignItems: 'stretch', gap: 7 },
  teacherDiaryStatusFilter: { flex: 1, minWidth: 0, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingHorizontal: 8, borderWidth: 1, borderColor: '#FED7AA', borderRadius: 12, backgroundColor: '#FFF7ED' },
  teacherDiaryPendingFilterActive: { borderColor: '#C2410C', backgroundColor: '#C2410C', shadowColor: '#C2410C', shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  teacherDiaryConfirmationFilter: { minWidth: 104, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  teacherDiaryConfirmationFilterActive: { borderColor: '#B91C1C', backgroundColor: '#B91C1C', shadowColor: '#B91C1C', shadowOpacity: 0.16, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  teacherDiaryStatusFilterText: { flexShrink: 1, color: '#9A3412', fontSize: typography.micro, fontWeight: '800' },
  teacherDiaryConfirmationFilterText: { color: '#B91C1C' },
  teacherDiaryStatusFilterTextActive: { color: colors.surface },
  teacherDiaryStatusCount: { minWidth: 20, height: 20, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', paddingHorizontal: 4, borderRadius: radius.pill, backgroundColor: '#FFEDD5', color: '#9A3412', fontSize: typography.micro, fontWeight: '900' },
  teacherDiaryConfirmationCount: { backgroundColor: '#FEE2E2', color: '#B91C1C' },
  teacherDiaryStatusCountActive: { backgroundColor: 'rgba(255,255,255,0.2)', color: colors.surface },
  teacherDiarySession: { gap: spacing.sm, marginHorizontal: spacing.md, marginBottom: spacing.sm, padding: spacing.sm, borderColor: '#E8EDF4', borderRadius: radius.md, backgroundColor: colors.surface },
  teacherDiarySessionCancelled: { borderColor: '#FECDD3', backgroundColor: '#FFFBFC' },
  teacherDiarySessionMain: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  teacherDiaryDateTile: { width: 42, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#EFF6FF' },
  teacherDiaryDateTileCancelled: { backgroundColor: '#FFF1F2' },
  teacherDiaryDateMonth: { color: colors.brand, fontSize: typography.micro, lineHeight: 16, fontWeight: '800' },
  teacherDiaryDateMonthCancelled: { color: '#BE123C' },
  teacherDiaryDateDay: { color: colors.brandDark, fontSize: 18, lineHeight: 22, fontWeight: '900' },
  teacherDiaryDateDayCancelled: { color: '#9F1239' },
  teacherDiarySessionCopy: { flex: 1, minWidth: 0, gap: 4 },
  teacherDiarySessionTitle: { color: colors.ink, fontSize: typography.caption, lineHeight: 17, fontWeight: '900' },
  teacherDiaryMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  teacherDiaryMetaText: { flex: 1, color: colors.muted, fontSize: typography.micro, lineHeight: 15 },
  teacherDiarySubject: { alignSelf: 'flex-start', maxWidth: '100%', paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: '#F1F5F9', color: '#475569', fontSize: typography.micro, fontWeight: '700' },
  teacherDiarySessionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  teacherDiaryActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: spacing.xs },
  teacherDiaryAttendanceButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.brand },
  teacherDiaryMakeupButton: { backgroundColor: '#D97706' },
  teacherDiaryMakeupButtonSent: { backgroundColor: '#E2E8F0' },
  teacherDiaryMakeupButtonText: { color: colors.surface },
  teacherDiaryMakeupButtonTextSent: { color: '#64748B' },
  teacherDiaryAttendanceButtonDisabled: { backgroundColor: '#E2E8F0' },
  teacherDiaryAttendanceButtonSubmitted: { backgroundColor: '#FEE2E2' },
  teacherDiaryAttendanceButtonText: { color: colors.surface, fontSize: typography.micro, fontWeight: '800' },
  teacherDiaryAttendanceButtonTextDisabled: { color: '#64748B' },
  teacherDiaryAttendanceButtonTextSubmitted: { color: '#B91C1C' },
  teacherDiaryCancelButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: '#B91C1C' },
  teacherDiaryCancelButtonText: { color: colors.surface, fontSize: typography.micro, fontWeight: '800' },
  studentDiaryFilterContainer: { borderBottomWidth: 1, borderBottomColor: colors.line },
  studentDiaryFilterRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  studentDiaryFilter: { minHeight: 40, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1.5, borderColor: colors.brand, borderRadius: radius.sm, backgroundColor: colors.surface },
  studentDiaryDateFilter: { flexBasis: '22%', flexGrow: 1, minWidth: 0 },
  studentDiaryStatusFilter: { flexBasis: '48%', flexGrow: 0 },
  studentDiaryFilterActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  studentDiaryFilterText: { color: colors.brand, fontSize: typography.micro, fontWeight: '800' },
  studentDiaryFilterTextActive: { color: colors.surface },
  studentDiaryLogRow: { marginHorizontal: spacing.md, marginBottom: spacing.xs, padding: spacing.md, gap: spacing.xs, borderColor: '#EEF2F7', borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  studentDiaryLogTitle: { color: '#334155', fontSize: typography.caption, lineHeight: 17, fontWeight: '800' },
  studentDiaryLogMeta: { color: colors.muted, fontSize: typography.micro, lineHeight: 16 },
  studentDiaryFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.xs },
  studentDiaryStatus: { alignSelf: 'flex-start', paddingHorizontal: spacing.xs, paddingVertical: 3, borderRadius: 6 },
  studentDiaryStatusText: { fontSize: typography.micro, lineHeight: 14, fontWeight: '900' },
  studentDiaryStatusCompleted: { backgroundColor: '#ECFDF5' },
  studentDiaryStatusTextCompleted: { color: '#047857' },
  studentDiaryStatusCancelled: { backgroundColor: '#FFF1F2' },
  studentDiaryStatusTextCancelled: { color: '#E11D48' },
  studentDiaryStatusOngoing: { backgroundColor: '#ECFDF5' },
  studentDiaryStatusTextOngoing: { color: '#15803D' },
  studentDiaryStatusPending: { backgroundColor: '#FFF7ED' },
  studentDiaryStatusTextPending: { color: '#C2410C' },
  studentDiaryStatusOverdue: { backgroundColor: '#FEF2F2' },
  studentDiaryStatusTextOverdue: { color: '#DC2626' },
  studentDiaryStatusUpcoming: { backgroundColor: '#FFF7ED' },
  studentDiaryStatusTextUpcoming: { color: '#B45309' },
  studentDiaryNote: { color: colors.muted, fontSize: typography.caption, lineHeight: 17 },
  studentDiaryActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  studentDiaryJoinButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: 8, backgroundColor: colors.brand },
  studentDiaryJoinButtonText: { color: colors.surface, fontSize: typography.micro, fontWeight: '900' },
  studentDiaryNoteButton: { minHeight: 36, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1.5, borderColor: colors.brand, borderRadius: 8, backgroundColor: colors.surface },
  studentDiaryNoteButtonText: { color: colors.brand, fontSize: typography.micro, fontWeight: '800' },
  weekCourseLabel: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, paddingHorizontal: spacing.xs },
  weekCourseLabelCaption: { color: colors.muted, fontSize: typography.micro, fontWeight: '600' },
  weekCourseLabelName: { flex: 1, color: colors.ink, fontSize: typography.micro, fontWeight: '700' },
  compactWeekGrid: { width: '100%', borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.line },
  teacherWeekRange: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: '#FFF7F7' },
  teacherWeekRangeArrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  teacherWeekRangeLabel: { color: colors.brandDark, fontSize: typography.micro, fontWeight: '800' },
  teacherCompactScroll: { width: '100%' },
  compactWeekRow: { flexDirection: 'row' },
  compactWeekCell: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  studentWeekCell: {
    width: STUDENT_WEEK_CELL_WIDTH,
    flexBasis: STUDENT_WEEK_CELL_WIDTH,
    flexGrow: 0,
    flexShrink: 0,
  },
  teacherCompactWeekRow: { flexDirection: 'row' },
  teacherCompactNameCell: { width: TEACHER_WEEK_NAME_CELL_WIDTH, flexGrow: 0, flexShrink: 0, minHeight: 72, justifyContent: 'center', gap: 2, paddingHorizontal: 4, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  teacherCompactDayCell: { width: STUDENT_WEEK_CELL_WIDTH, flexGrow: 0, flexShrink: 0, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
  teacherCompactHeaderText: { color: colors.ink, fontSize: typography.caption, lineHeight: 18, fontWeight: '900', textAlign: 'center' },
  teacherCompactDayText: { color: colors.ink, fontSize: typography.caption, lineHeight: 18, fontWeight: '900', textAlign: 'center' },
  teacherCompactDateText: { color: colors.muted, fontSize: typography.micro, lineHeight: 16, textAlign: 'center' },
  studentCompactWeekHeaderCell: { minHeight: 66 },
  teacherCompactSort: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0, paddingHorizontal: 1, borderRadius: radius.sm },
  teacherCompactSortText: { color: colors.muted, fontSize: typography.micro, lineHeight: 16, fontWeight: '700' },
  teacherCompactStudentName: { color: colors.ink, fontSize: typography.caption, lineHeight: 17, fontWeight: '800' },
  teacherCompactCourse: { color: colors.muted, fontSize: typography.micro, lineHeight: 15 },
  teacherCompactSessions: { color: colors.muted, fontSize: typography.micro, lineHeight: 15 },
  teacherCompactTime: { color: colors.muted, fontSize: typography.micro, lineHeight: 15, fontWeight: '800', textAlign: 'center' },
  teacherCompactStatus: { color: colors.muted, fontSize: typography.micro, lineHeight: 15, textAlign: 'center' },
  compactWeekHeaderCell: { minHeight: 48, backgroundColor: colors.canvas, gap: 2 },
  compactWeekDay: { color: colors.ink, fontSize: typography.micro, lineHeight: 14, fontWeight: '800' },
  compactWeekDate: { color: colors.muted, fontSize: typography.micro, lineHeight: 14, fontWeight: '600' },
  compactWeekSlotCell: { minHeight: 44, gap: 2 },
  compactWeekTime: { color: '#8A5B00', fontSize: typography.micro, lineHeight: 14, fontWeight: '800' },
  compactWeekStatus: { color: colors.muted, fontSize: typography.micro, lineHeight: 14 },
  compactWeekEmpty: { color: colors.muted, fontSize: typography.micro },
  weekGridContent: { paddingBottom: spacing.xs },
  weekGridHeader: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, borderLeftWidth: 1, borderLeftColor: colors.line },
  weekGridRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, borderLeftWidth: 1, borderLeftColor: colors.line },
  weekGridNameCell: { width: 116, minHeight: 56, justifyContent: 'center', gap: 3, paddingHorizontal: spacing.xs, borderRightWidth: 1, borderRightColor: colors.line, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  weekGridDayCell: { width: 80, minHeight: 56, justifyContent: 'center', alignItems: 'center', gap: 2, paddingHorizontal: 3, borderRightWidth: 1, borderRightColor: colors.line, borderBottomWidth: 1, borderBottomColor: colors.line },
  weekGridHeaderCell: { minHeight: 60, backgroundColor: colors.canvas },
  weekGridSortedCell: { backgroundColor: colors.brandSoft },
  weekGridHeaderText: { color: colors.ink, fontSize: typography.caption, fontWeight: '800', textAlign: 'center' },
  weekGridDate: { color: colors.muted, fontSize: typography.micro, fontWeight: '600' },
  weekGridTodayCell: { backgroundColor: colors.brandSoft },
  weekGridTodayText: { color: colors.brandDark },
  weekGridTodayColumn: { backgroundColor: '#FFF7F7' },
  weekGridSort: { minHeight: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: spacing.xs, borderRadius: radius.pill, backgroundColor: '#F1F5F9' },
  weekGridSortActive: { backgroundColor: '#DBEAFE' },
  weekGridSortText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  weekGridSortTextActive: { color: colors.brand, fontWeight: '900' },
  weekGridStudentName: { color: colors.ink, fontSize: typography.caption, fontWeight: '800' },
  weekGridCourse: { color: colors.muted, fontSize: typography.micro, lineHeight: 14 },
  weekGridSlotCell: { backgroundColor: colors.surface },
  weekGridBookedCell: { backgroundColor: colors.goldSoft },
  weekGridCompletedCell: { backgroundColor: colors.greenSoft },
  weekGridCancelledCell: { backgroundColor: colors.canvas },
  weekGridLockedCell: { backgroundColor: colors.canvas },
  weekGridSlotText: { color: colors.muted, fontSize: typography.micro, fontWeight: '700', textAlign: 'center' },
  weekGridBookedText: { color: '#8A5B00' },
  weekGridStatus: { color: colors.muted, fontSize: typography.micro, fontWeight: '600' },
  clearSlotAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md },
  clearSlotActionText: { color: colors.red, fontSize: typography.caption, fontWeight: '700' },
  slotOptions: { gap: spacing.xs, paddingVertical: spacing.xs },
  slotOptionsList: { maxHeight: 420 },
  slotOption: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  slotOptionSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  slotOptionDisabled: { backgroundColor: colors.canvas },
  slotOptionText: { color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  slotOptionTextSelected: { color: colors.brandDark },
  slotOptionTextDisabled: { color: colors.muted },
  sortMenuCard: { width: '100%', maxWidth: 420, gap: spacing.xs, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  centeredPickerCard: { maxHeight: '80%' },
  sortMenuHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  sortMenuIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.brandSoft },
  sortMenuOption: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  sortMenuOptionSelected: { backgroundColor: '#EFF6FF' },
  sortMenuOptionText: { color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
  sortMenuOptionTextSelected: { color: colors.brand, fontWeight: '900' },
  teacherScheduleCard: { gap: spacing.xs, borderLeftWidth: 4, borderLeftColor: colors.brand },
  studentDiaryCard: { gap: spacing.sm, padding: 0, overflow: 'hidden' },
  diaryEmpty: { color: colors.muted, fontSize: typography.small, fontWeight: '600', textAlign: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xl },
  learningLogRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.md, marginBottom: spacing.sm },
  muted: { color: colors.muted, fontSize: typography.small, lineHeight: 20, flex: 1 },
  footnote: { color: colors.muted, fontSize: typography.caption, textAlign: 'center', lineHeight: 18, paddingHorizontal: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  filterTabs: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'nowrap', borderBottomWidth: 1, borderBottomColor: colors.line },
  filterTab: { minWidth: 0, minHeight: 44, flex: 1, flexBasis: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterTabActive: { borderBottomColor: colors.brand },
  filterTabText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700', textAlign: 'center' },
  filterTabTextActive: { color: colors.brand, fontWeight: '800' },
  filterTabInner: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterTabCount: { minWidth: 20, paddingHorizontal: 6, borderRadius: 999, overflow: 'hidden', fontSize: 11, fontWeight: '900', textAlign: 'center' },
  compactChips: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.line },
  compactChipsContent: { alignItems: 'stretch', gap: 14, paddingHorizontal: spacing.md },
  chip: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  compactChip: { minHeight: 38, paddingVertical: 8, paddingHorizontal: 2, borderRadius: 0, borderWidth: 0, borderBottomWidth: 2, borderBottomColor: 'transparent', backgroundColor: 'transparent' },
  compactChipActive: { borderBottomColor: colors.brand, backgroundColor: 'transparent' },
  chipActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  compactChipText: { fontSize: typography.caption },
  compactChipTextActive: { color: colors.brandDark },
  chipTextActive: { color: '#FFFFFF' },
  materialRow: { flexDirection: 'row', alignItems: 'center' },
  fileIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  fileType: { color: colors.brand, fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.8 },
  metaText: { color: colors.muted, fontSize: typography.caption, lineHeight: 18 },
  notificationScreen: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  notificationOverlay: { flex: 1, alignItems: 'flex-end', paddingTop: 66, paddingHorizontal: spacing.md, backgroundColor: 'rgba(15, 23, 42, 0.28)' },
  notificationOverlayBackdrop: { ...StyleSheet.absoluteFill },
  notificationOverlayPanel: { width: '100%', maxWidth: 460, maxHeight: '78%', overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: radius.lg, backgroundColor: colors.canvas, shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  notificationOverlayHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: spacing.lg, paddingRight: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  notificationOverlayTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' },
  notificationOverlayClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  notificationOverlayContent: { paddingBottom: spacing.sm },
  notificationToolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  notificationMarkAll: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  notificationMarkAllText: { color: colors.ink, fontSize: typography.micro, fontWeight: '700' },
  notificationCategoryButton: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  notificationCategoryButtonText: { color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  notificationList: { overflow: 'hidden', borderWidth: 1, borderColor: '#E8EDF3', borderRadius: radius.md, backgroundColor: '#FFFEFE' },
  notificationItem: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
  notificationItemDivider: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  notificationItemMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  notificationItemIcon: { position: 'relative', width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  notificationItemDot: { position: 'absolute', top: -2, right: -2, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brand },
  notificationItemCopy: { flex: 1, minWidth: 0, gap: 2 },
  notificationItemContent: { alignSelf: 'stretch' },
  notificationItemMeta: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.xs },
  notificationItemTimeActions: { alignItems: 'flex-end', gap: 1 },
  notificationItemCategory: { color: colors.brand, fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.4 },
  notificationItemTime: { color: colors.muted, fontSize: typography.micro },
  notificationItemMoreAction: { width: 26, height: 28, alignItems: 'center', justifyContent: 'center' },
  notificationItemMoreActionHidden: { opacity: 0 },
  notificationItemTitle: { color: colors.ink, fontSize: typography.caption, lineHeight: 14, fontWeight: '800' },
  notificationItemMessage: { color: colors.muted, fontSize: typography.micro, lineHeight: 15 },
  notificationItemActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  notificationItemAction: { width: 26, height: 28, alignItems: 'center', justifyContent: 'center' },
  notificationPagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  readAll: { padding: spacing.sm },
  readAllText: { color: colors.brand, fontWeight: '700', fontSize: typography.small },
  makeupModalBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(15, 23, 42, 0.62)' },
  makeupModalCard: { width: '100%', maxWidth: 440, maxHeight: '90%', overflow: 'hidden', borderRadius: 28, backgroundColor: colors.surface, shadowColor: '#0F172A', shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  makeupModalHeader: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, backgroundColor: '#D97706' },
  makeupModalHeaderCopy: { flex: 1, gap: 3 },
  makeupModalTitle: { color: '#FFFFFF', fontSize: typography.heading, fontWeight: '900' },
  makeupModalSubtitle: { color: '#FEF3C7', fontSize: typography.small, fontWeight: '700' },
  makeupModalClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.16)' },
  makeupModalBody: { padding: spacing.lg },
  makeupModalSession: { gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: '#FDE68A', borderRadius: radius.md, backgroundColor: '#FFFBEB' },
  makeupModalSectionLabel: { marginBottom: 2, color: '#B45309', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.8 },
  makeupModalStudent: { color: '#1E293B', fontSize: typography.caption, fontWeight: '800' },
  makeupModalDetail: { color: '#475569', fontSize: typography.micro, lineHeight: 19 },
  makeupModalStrong: { color: '#1E293B', fontWeight: '800' },
  makeupModalNotice: { gap: spacing.xs, marginTop: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  makeupModalNoticeTitle: { color: '#1E293B', fontSize: typography.caption, fontWeight: '900' },
  makeupModalNoticeText: { color: '#475569', fontSize: typography.micro, lineHeight: 19 },
  makeupModalAlreadySent: { marginTop: spacing.md, padding: spacing.sm, borderWidth: 1, borderColor: '#FDE68A', borderRadius: radius.sm, backgroundColor: '#FFFBEB', color: '#92400E', fontSize: typography.micro, fontWeight: '700' },
  makeupModalActions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
  makeupModalCancel: { minHeight: 46, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.md, backgroundColor: colors.surface },
  makeupModalCancelText: { color: '#475569', fontSize: typography.caption, fontWeight: '800' },
  makeupModalSend: { minHeight: 46, flex: 1.3, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: '#D97706' },
  makeupModalSendDisabled: { opacity: 0.55 },
  makeupModalSendText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '900' },
  studentCard: { flexDirection: 'row', alignItems: 'flex-start' },
  studentListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  studentListMain: { flex: 1, minWidth: 0 },
  studentListActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  studentFilters: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  studentFilter: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  studentFilterActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  studentFilterText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  studentFilterTextActive: { color: colors.surface },
  studentResultCount: { color: colors.muted, fontSize: typography.caption, fontWeight: '700', marginBottom: spacing.xs },
  studentChatButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.blueSoft },
  studentHeaderAction: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.blueSoft },
  studentDetail: { borderColor: colors.brand, backgroundColor: '#FBFEFE' },
  studentDetailCourse: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  studentQuickInfo: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  studentOnlineText: { color: colors.green, fontSize: typography.caption, fontWeight: '700' },
  studentDetailTabs: { flexDirection: 'row', gap: spacing.xs, paddingVertical: spacing.xs },
  studentDetailTab: { flex: 1, minWidth: 0, minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderRadius: radius.sm, backgroundColor: colors.canvas },
  studentDetailTabActive: { backgroundColor: colors.brand },
  studentDetailTabText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700', textAlign: 'center' },
  studentDetailTabTextActive: { color: colors.surface },
  studentDetailSection: { gap: spacing.sm },
  studentMetricGrid: { flexDirection: 'row', gap: spacing.xs },
  studentMetric: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.canvas },
  studentMetricValue: { color: colors.ink, fontSize: typography.body, fontWeight: '800' },
  studentMetricLabel: { color: colors.muted, fontSize: typography.caption, textAlign: 'center' },
  studentCourseRow: { gap: spacing.xs, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  studentCourseTitle: { flex: 1, color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
  studentHistoryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  studentPrimaryAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: colors.brand },
  studentPrimaryActionText: { color: colors.surface, fontSize: typography.caption, fontWeight: '800' },
  studentUpdateAction: { minHeight: 40, borderRadius: radius.sm, paddingHorizontal: spacing.md },
  studentDangerAction: { borderColor: colors.redSoft, backgroundColor: colors.redSoft },
  studentDangerActionText: { color: colors.red },
  closeText: { color: colors.brand, fontWeight: '700', fontSize: typography.small },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  progressLabel: { color: colors.brandDark, fontSize: typography.caption, fontWeight: '800', minWidth: 34, textAlign: 'right' },
  classSummary: { flexDirection: 'row', alignItems: 'center' },
  summaryIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  attendanceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  attendanceSessionSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  attendanceDetail: { gap: spacing.md },
  makeupRequestCard: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FFFBEB' },
  makeupRequestHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  makeupRequestIcon: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#FEF3C7' },
  makeupRequestTitle: { flex: 1, color: '#92400E', fontSize: typography.caption, fontWeight: '900' },
  makeupRequestDescription: { color: '#78350F', fontSize: typography.micro, lineHeight: 16 },
  attendanceMain: { flex: 1, gap: spacing.sm },
  attendanceBackButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.canvas },
  attendanceOverview: { gap: spacing.md, paddingBottom: spacing.xl },
  attendanceStudentSummary: { gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md, borderColor: '#E5EAF1' },
  attendanceStudentHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attendanceStudentCopy: { flex: 1, minWidth: 0, gap: 2 },
  attendanceStudentName: { color: colors.ink, fontSize: typography.small, lineHeight: 19, fontWeight: '900' },
  attendanceStudentMeta: { color: colors.muted, fontSize: typography.micro, lineHeight: 15 },
  attendanceStudentStatusRow: { flexDirection: 'row', alignItems: 'center', minHeight: 26 },
  attendanceProgressTrack: { height: 8, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: '#E8EEF4' },
  attendanceProgressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: '#2563EB' },
  attendanceProgressText: { color: '#64748B', fontSize: typography.micro, lineHeight: 16, fontWeight: '800' },
  attendanceStatRow: { flexDirection: 'row', gap: spacing.xs },
  attendanceStatCard: { flex: 1, minWidth: 0, minHeight: 106, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, paddingVertical: spacing.sm, borderWidth: 1, borderRadius: radius.md, gap: 3 },
  attendanceStatBlue: { backgroundColor: '#F4F9FF', borderColor: '#D5E6FF' },
  attendanceStatGold: { backgroundColor: '#FFFCF2', borderColor: '#FDE9AE' },
  attendanceStatPurple: { backgroundColor: '#FCF8FF', borderColor: '#EBD8FF' },
  attendanceStatLabel: { color: colors.muted, fontSize: typography.micro, fontWeight: '800', textAlign: 'center' },
  attendanceStatValue: { fontSize: typography.display, lineHeight: 34, fontWeight: '900' },
  attendanceStatFoot: { color: colors.muted, fontSize: typography.micro, lineHeight: 16, textAlign: 'center', fontWeight: '700' },
  attendanceStatSuffix: { fontSize: typography.micro, fontWeight: '800' },
  attendancePendingNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: radius.md, backgroundColor: '#EFF6FF' },
  attendancePendingText: { flex: 1, color: '#1E3A8A', fontSize: typography.caption, lineHeight: 20, fontWeight: '600' },
  attendanceNoticeClose: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  attendanceUndoButton: { minHeight: 48, flex: 1.15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderRadius: radius.md, backgroundColor: '#DC2626' },
  attendanceUndoText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '800', textAlign: 'center' },
  attendanceSubmittedRow: { flexDirection: 'row', gap: spacing.sm },
  attendanceWaitingButton: { minHeight: 48, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: '#F1F5F9' },
  attendanceWaitingText: { color: '#94A3B8', fontSize: typography.micro, fontWeight: '800', textAlign: 'center' },
  attendanceSessionNote: { color: colors.muted, fontSize: typography.caption, lineHeight: 18 },
  attendanceModalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md, backgroundColor: 'rgba(15, 23, 42, 0.62)' },
  attendanceModalCard: { width: '100%', maxWidth: 440, maxHeight: '90%', overflow: 'hidden', borderRadius: 30, backgroundColor: '#FFFFFF' },
  attendanceModalHeader: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: '#0DA76B' },
  attendanceModalIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  attendanceModalHeading: { flex: 1, minWidth: 0, gap: 3 },
  attendanceModalTitle: { color: '#FFFFFF', fontSize: typography.body, fontWeight: '900' },
  attendanceModalSubtitle: { color: '#D1FAE5', fontSize: typography.micro, fontWeight: '800' },
  attendanceModalClose: { width: 34, height: 38, alignItems: 'center', justifyContent: 'center' },
  attendanceModalBody: { gap: spacing.md, padding: spacing.lg, paddingBottom: spacing.lg },
  attendanceModalStudent: { gap: 3, padding: spacing.md, borderWidth: 1, borderColor: '#C9F5E0', borderRadius: 22, backgroundColor: '#ECFDF5' },
  attendanceModalLabel: { color: '#065F46', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.6 },
  attendanceModalName: { color: '#059669', fontSize: typography.heading, fontWeight: '900' },
  attendanceModalProgress: { color: '#10B981', fontSize: typography.caption, fontWeight: '700' },
  attendanceFieldLabel: { marginBottom: spacing.xs, color: '#94A3B8', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.5 },
  attendanceGradeInput: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#E5EDF5', borderRadius: 18, backgroundColor: '#F8FAFC' },
  attendanceGradeStepper: { gap: 2 },
  attendanceGradeStep: { width: 35, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DBE4EF', borderRadius: 8, backgroundColor: '#FFFFFF' },
  attendanceGradeValue: { flex: 1, color: '#334155', fontSize: typography.body, fontWeight: '800', paddingVertical: spacing.xs },
  attendanceGradeMaximum: { color: '#CBD5E1', fontSize: typography.body, fontWeight: '900' },
  attendanceNoteInput: { minHeight: 82, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: '#E5EDF5', borderRadius: 18, backgroundColor: '#F8FAFC', color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  attendanceModalActions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  attendanceModalCancel: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  attendanceModalCancelText: { color: '#94A3B8', fontSize: typography.caption, fontWeight: '900' },
  attendanceModalConfirm: { minHeight: 48, flex: 2, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderRadius: radius.md, backgroundColor: '#0DA76B' },
  attendanceModalConfirmText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '900', textAlign: 'center' },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  choice: { minHeight: 44, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  choiceActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  choiceText: { color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  choiceTextActive: { color: colors.brandDark },
  resultSummary: { flexDirection: 'row', alignItems: 'center' },
  summaryScore: { color: colors.brand, fontSize: typography.title, fontWeight: '800' },
  subjectCard: { gap: spacing.md },
  gradeHistoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  gradeResult: { alignItems: 'flex-end', gap: spacing.xs },
  gradeScore: { color: colors.brandDark, fontSize: typography.body, fontWeight: '800' },
  examNotice: { backgroundColor: colors.goldSoft, borderColor: '#F3E4BE' },
  profileCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  profileDetails: { gap: 0, padding: 0, overflow: 'hidden' },
  studentProfileSection: { gap: 0, padding: 0, overflow: 'hidden' },
  studentProfileSectionHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E9EEF2' },
  studentProfileSectionTitle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  profileEditButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.brandSoft },
  profileEditButtonText: { color: colors.brand, fontSize: typography.caption, fontWeight: '700' },
  profileSignOutButton: { minHeight: 48, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.xl, borderWidth: 1, borderColor: colors.redSoft, borderRadius: radius.md, backgroundColor: colors.surface },
  profileSignOutButtonPressed: { backgroundColor: colors.redSoft },
  profileSignOutText: { color: colors.red, fontSize: typography.small, fontWeight: '800' },
  profilePushFeedbackButton: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: colors.brand },
  profilePushFeedbackButtonText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  studentProfileSectionText: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  studentProfileChevronOpen: { transform: [{ rotate: '180deg' }] },
  studentProfileRows: { paddingVertical: 2 },
  studentProfileInfoRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  studentProfileInfoCopy: { flex: 1, minWidth: 0, gap: 2 },
  studentProfileLabel: { color: '#94A3B8', fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.5 },
  studentProfileValue: { color: colors.ink, fontSize: typography.caption, lineHeight: 18, fontWeight: '600' },
  studentProfileCount: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.blueSoft, color: colors.blue, fontSize: typography.micro, fontWeight: '800' },
  studentCourseGrade: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  profileStats: { alignSelf: 'stretch', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  profileStat: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: radius.md, flex: 1, minWidth: 0, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  profileStatValue: { color: colors.ink, fontSize: typography.title, fontWeight: '700' },
  profileStatLabel: { color: colors.muted, fontSize: typography.small, textAlign: 'center' },
  profileCourse: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth },
  studentProfileHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, backgroundColor: '#F0FDFA', borderColor: '#CCFBF1' },
  studentProfileHeroCopy: { flex: 1, gap: spacing.xs },
  studentProfileHeroEyebrow: { color: '#0F766E', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.8 },
  studentProfileHeroName: { color: colors.ink, fontSize: typography.heading, fontWeight: '900' },
  studentProfileHeroSubtitle: { color: colors.muted, fontSize: typography.caption },
  editableAvatar: { position: 'relative', overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  editableAvatarCamera: { position: 'absolute', right: 0, bottom: 0, width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.surface, borderRadius: radius.pill, backgroundColor: '#0FAF9F' },
  editableAvatarLoading: { color: colors.surface, fontSize: typography.caption, fontWeight: '900' },
  teacherProfileHero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  teacherProfileEyebrow: { color: '#FEE2E2', fontSize: typography.caption, fontWeight: '800', letterSpacing: 1 },
  teacherProfileName: { color: '#FFFFFF', fontSize: typography.heading, fontWeight: '800', textAlign: 'center' },
  teacherProfileSubtitle: { color: '#FEE2E2', fontSize: typography.small, textAlign: 'center' },
  teacherProfileTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs },
  teacherProfileStatus: { color: '#FFFFFF', fontSize: typography.caption, paddingVertical: 6, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#FCA5A5', borderRadius: radius.pill },
  teacherDetails: { gap: spacing.sm },
  teacherProfileEmpty: { color: colors.muted, fontSize: typography.caption, paddingVertical: spacing.xs },
  teacherProfileField: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  teacherProfileFieldStacked: { flexDirection: 'column', alignItems: 'stretch', gap: spacing.xs },
  teacherProfileLabel: { flex: 1, color: colors.muted, fontSize: typography.small },
  teacherProfileValue: { flex: 1, color: colors.ink, fontSize: typography.small, textAlign: 'right' },
  teacherProfileValueFull: { flex: 0, textAlign: 'left' },
  profileName: { color: colors.ink, fontSize: typography.heading, fontWeight: '800', marginTop: spacing.sm },
  cardTitle: { color: colors.ink, fontWeight: '700', fontSize: typography.body, lineHeight: 21 },
  profileInfo: { width: '100%', gap: spacing.lg, marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoValue: { color: colors.ink, fontSize: typography.small, fontWeight: '600' },
  menuCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  centeredPickerBackdrop: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xl },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  assignmentModalCard: { maxHeight: '92%', backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  assignmentModalScroll: { flexShrink: 1 },
  assignmentModalContent: { gap: spacing.sm, paddingBottom: spacing.xs },
  assignmentModalActions: { gap: spacing.xs, paddingTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  assignmentModalClose: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  assignmentManageRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  assignmentManageButton: { flex: 1, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  assignmentManageText: { fontSize: 13, fontWeight: '800', color: colors.ink },
  assignmentManageDanger: { color: colors.brand },
  assignmentModalCloseText: { color: colors.brand, fontSize: typography.caption, fontWeight: '800' },
  teacherEditBackdrop: { justifyContent: 'center', alignItems: 'center', padding: spacing.sm, backgroundColor: 'rgba(15, 23, 42, 0.6)' },
  teacherEditModal: { width: '100%', maxWidth: 480, maxHeight: '92%', overflow: 'hidden', alignSelf: 'center', borderRadius: 22, backgroundColor: colors.surface },
  changePasswordModal: { width: '100%', maxWidth: 440, maxHeight: '92%', overflow: 'hidden', alignSelf: 'center', borderRadius: 22, backgroundColor: colors.surface },
  changePasswordBody: { flexShrink: 1 },
  changePasswordFields: { gap: spacing.sm, padding: spacing.md },
  teacherEditHeader: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: '#F0FDFA' },
  teacherEditTitle: { color: '#115E59', fontSize: typography.body, fontWeight: '900' },
  teacherEditSubtitle: { marginTop: 2, color: colors.muted, fontSize: typography.micro },
  teacherEditClose: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surface },
  teacherEditBody: { gap: 9, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  teacherEditSection: { color: '#0F766E', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.8 },
  teacherEditPaymentSection: { marginTop: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  teacherEditRow: { flexDirection: 'row', gap: spacing.sm },
  teacherEditRowCompact: { flexDirection: 'column' },
  teacherEditInput: { minHeight: 40, paddingHorizontal: spacing.sm, borderRadius: radius.sm, fontSize: typography.caption },
  teacherEditHalf: { flex: 1, minWidth: 0 },
  teacherEditFull: { width: '100%', flex: 0 },
  teacherEditAge: { width: 72 },
  teacherEditFlex: { flex: 1, minWidth: 0 },
  teacherEditBio: { minHeight: 62, paddingTop: spacing.sm, textAlignVertical: 'top' },
  teacherEditVoice: { gap: spacing.xs },
  teacherEditLabel: { color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  teacherEditVoiceOptions: { flexDirection: 'row', gap: spacing.xs },
  teacherEditVoiceOption: { minHeight: 34, flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: '#F8FAFC' },
  teacherEditVoiceOptionSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  teacherEditVoiceText: { color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  teacherEditVoiceTextSelected: { color: colors.brandDark },
  teacherEditNote: { padding: spacing.sm, borderRadius: radius.sm, backgroundColor: '#F8FAFC', color: colors.muted, fontSize: typography.micro, lineHeight: 17 },
  teacherEditActions: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  teacherEditCancel: { minHeight: 42, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: '#F1F5F9' },
  teacherEditCancelText: { color: colors.muted, fontSize: typography.caption, fontWeight: '800' },
  teacherEditSave: { minHeight: 42, flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.brand },
  teacherEditSaveText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  teacherEditDisabled: { opacity: 0.6 },
  teacherEditBankSelect: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 0 },
  teacherEditBankText: { flex: 1, color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  teacherEditBankPlaceholder: { color: colors.muted, fontWeight: '400' },
  teacherEditBankError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.xs },
  teacherEditBankErrorText: { flex: 1, color: colors.red, fontSize: typography.micro, lineHeight: 16 },
  teacherEditBankRetry: { color: colors.brand, fontSize: typography.micro, fontWeight: '800' },
  teacherBankPickerBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md, backgroundColor: 'rgba(15, 23, 42, 0.6)' },
  teacherBankPicker: { width: '100%', maxWidth: 440, maxHeight: '80%', overflow: 'hidden', borderRadius: 18, backgroundColor: colors.surface },
  teacherBankPickerHeader: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  teacherBankPickerTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '900' },
  teacherBankSearch: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, margin: spacing.sm, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: '#F8FAFC' },
  teacherBankSearchInput: { flex: 1, minWidth: 0, minHeight: 40, paddingVertical: 0, color: colors.ink, fontSize: typography.caption },
  teacherBankState: { alignItems: 'center', gap: spacing.sm, padding: spacing.lg },
  teacherBankStateText: { padding: spacing.md, color: colors.muted, fontSize: typography.caption, textAlign: 'center' },
  teacherBankOption: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  teacherBankOptionIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.brandSoft },
  teacherBankOptionCopy: { flex: 1, minWidth: 0, gap: 2 },
  teacherBankOptionName: { color: colors.ink, fontSize: typography.caption, fontWeight: '800' },
  teacherBankOptionDetail: { color: colors.muted, fontSize: typography.micro },
  studentProfileModalBackdrop: { justifyContent: 'center', padding: spacing.md, backgroundColor: 'rgba(15, 23, 42, 0.6)' },
  studentProfileModal: { width: '100%', maxWidth: 440, maxHeight: '94%', alignSelf: 'center', overflow: 'hidden', backgroundColor: colors.surface, borderRadius: 28 },
  studentProfileModalHeader: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, backgroundColor: '#F0FDFA', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  studentProfileModalTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  studentProfileModalTitleText: { color: '#115E59', fontSize: typography.small, fontWeight: '900' },
  studentProfileModalClose: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.surface },
  studentProfileModalBody: { padding: spacing.lg, gap: spacing.md },
  studentProfileModalField: { gap: spacing.xs },
  studentProfileModalLabel: { paddingLeft: spacing.xs, color: '#64748B', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.8 },
  studentProfileReadOnlyInput: { backgroundColor: '#F8FAFC', color: '#334155' },
  studentProfileReadonlyNote: { paddingLeft: spacing.xs, color: colors.red, fontSize: typography.micro, fontStyle: 'italic' },
  studentProfileGenderRow: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs },
  studentProfileGenderOption: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  studentProfileGenderOptionSelected: { borderColor: '#2DD4BF', backgroundColor: '#F0FDFA' },
  studentProfileGenderText: { color: '#475569', fontSize: typography.micro, fontWeight: '700', textAlign: 'center' },
  studentProfileGenderTextSelected: { color: '#0F766E' },
  studentProfilePhoneRow: { flexDirection: 'row', gap: spacing.sm },
  studentProfilePhoneRowStack: { flexDirection: 'column' },
  studentProfilePhoneField: { flex: 1, minWidth: 0 },
  studentProfileInputWithIcon: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  studentProfileIconInput: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 0, color: colors.ink, fontSize: typography.small, fontWeight: '600' },
  studentProfileSaveButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.xs, borderRadius: radius.md, backgroundColor: '#0FAF9F' },
  studentProfileSaveButtonDisabled: { opacity: 0.6 },
  studentProfileSaveButtonText: { color: colors.surface, fontSize: typography.micro, fontWeight: '900', letterSpacing: 1 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  formInput: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.surface },
  studentUpdateInput: { flex: 1 },
  formTextarea: { minHeight: 90, textAlignVertical: 'top', paddingTop: spacing.md },
  submissionCard: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: colors.canvas },
  fileLinkRow: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xs },
  fileLinkText: { flex: 1, minWidth: 0, color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  fileLinkAction: { color: colors.brand, fontSize: typography.caption, fontWeight: '800' },
  fileSelection: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.brandSoft },
  filePickerOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  tuitionAmountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  passwordField: { gap: spacing.xs },
  fieldLabel: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  note: { color: colors.muted, fontSize: typography.caption, lineHeight: 18, fontStyle: 'italic' },
  savedText: { color: colors.green, fontSize: typography.small, fontWeight: '700' },
});
