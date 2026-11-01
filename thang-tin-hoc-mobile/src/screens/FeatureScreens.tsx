import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  Ban, Bell, BookOpen, BookText, CalendarDays, Check, CheckCircle, ChevronDown, Clock3, FileSpreadsheet,
  FileText, Film, GraduationCap, Link2, LogOut, Mail, MapPin, MessageCircle, MoreHorizontal, Phone, RefreshCw, Settings, Table2, Trash2, UserRound, Users, WalletCards, X,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
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
  assignmentService, gradeService, learningService, materialService, messageService, notificationService, scheduleService, studentProfileService, studentService, teacherProfileService,
} from '../services/mockService';
import { SOCKET_EVENTS } from '../services/socketService';
import { PartialAssignmentCreationError } from '../services/assignmentApi';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';
import type { AppNotification, Assignment, Conversation, DemoGradeRecord, DemoStudent, DemoUser, LearningMaterial, ScheduleItem } from '../types';
import type { TeacherProfile, TeacherProfileUpdate } from '../services/teacherApi';
import { updateStudentProfile } from '../services/studentApi';
import type { RawStudent, StudentProfileUpdate } from '../services/studentApi';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
const mobileMakeupRequestsSent = new Set<string>();

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

function canTeacherMarkAttendance(item: ScheduleItem | undefined, now = Date.now()) {
  if (!item || item.status !== 'upcoming' || item.attendanceStatus !== 'pending') return false;
  const bounds = getAttendanceBounds(item);
  return Boolean(bounds && now >= bounds.startAt + 15 * 60 * 1000 && now <= bounds.deadline);
}

function attendanceStatusLabel(item: ScheduleItem, now = Date.now()) {
  const confirmStatus = String(item.attendanceConfirmStatus || '').toLowerCase();
  if (confirmStatus === 'admin_rejected' || item.attendanceRejected) return 'Không được tính';
  if (confirmStatus === 'disputed' || item.attendanceDisputed) return 'Chờ Admin xử lý';
  if (confirmStatus === 'pending' || item.attendanceConfirmPending) return 'Chờ học viên xác nhận';
  if (confirmStatus === 'admin_approved') return 'Đã điểm danh bù';
  if (confirmStatus === 'accepted' || item.confirmedByStudent) return 'Đã xác nhận';
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
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [filter, setFilter] = useState('Tất cả');
  const [rosterFilter, setRosterFilter] = useState('Đang học');
  const [weekOffset, setWeekOffset] = useState(0);
  const [teacherQuery, setTeacherQuery] = useState('');
  const [gridSort, setGridSort] = useState<{ kind: 'name' | 'day'; dir: 'asc' | 'desc'; dayIndex: number }>({ kind: 'name', dir: 'asc', dayIndex: 0 });
  const [diaryFilter, setDiaryFilter] = useState('Tất cả');
  const [studentDiaryFilter, setStudentDiaryFilter] = useState('Tất cả');
  const [itemsOverride, setItemsOverride] = useState<Awaited<ReturnType<typeof scheduleService.list>> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [showStudentNote, setShowStudentNote] = useState(false);
  const [studentNote, setStudentNote] = useState('');
  const [savingStudentNote, setSavingStudentNote] = useState(false);
  const [respondingAttendance, setRespondingAttendance] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [savingSlot, setSavingSlot] = useState(false);
  const [classTime, setClassTime] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [classDate, setClassDate] = useState('');
  const loader = useCallback(() => scheduleService.list(isTeacher ? 'teacher' : 'student'), [isTeacher]);
  const resource = useMockResource(loader);
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
    if (activeStudentCourse && !matchesScheduleCourse(item, activeStudentCourse, user?.course)) return false;
    const date = item.date ? new Date(`${item.date}T00:00:00`) : null;
    if (studentDiaryFilter === 'Ngày' && (!date || date.toDateString() !== new Date().toDateString())) return false;
    if (studentDiaryFilter === 'Tuần' && (!date || date < weekStart || date > weekEnd)) return false;
    if (studentDiaryFilter === 'Tháng' && (!date || date.getMonth() !== new Date().getMonth() || date.getFullYear() !== new Date().getFullYear())) return false;
    if (studentDiaryFilter === 'Chưa điểm danh' && item.attendanceStatus !== 'pending' && !isOverdueAttendance(item)) return false;
    if (studentDiaryFilter === 'Lịch hủy' && item.status !== 'cancelled') return false;
    return true;
  }).sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));
  const teacherMonthItems = allScheduleItems.filter((item) => item.date && new Date(`${item.date}T00:00:00`).getMonth() === new Date().getMonth() && new Date(`${item.date}T00:00:00`).getFullYear() === new Date().getFullYear());
  const teacherRoster = (studentsResource.data || [])
    .filter((student) => student.enrollmentStatus !== 'cancelled')
    .filter((student) => rosterFilter === 'Đang học'
      ? student.enrollmentStatus !== 'completed'
      : rosterFilter === 'Học xong'
        ? student.enrollmentStatus === 'completed'
        : true)
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
    if (diaryFilter === 'Chưa điểm danh' && item.attendanceStatus !== 'pending') return false;
    if (diaryFilter === 'Lịch hủy' && item.status !== 'cancelled') return false;
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
      setItemsOverride((itemsOverride || resource.data || []).map((item) => item.id === selectedItem.id
        ? { ...item, note: studentNote.trim() }
        : item));
      setShowStudentNote(false);
      Alert.alert(
        'Đã gửi ghi chú',
        user?.previewMode ? 'Ghi chú chỉ lưu trong bản xem trước.' : 'Giảng viên sẽ nhận được ghi chú của bạn.',
      );
    } catch (error) {
      Alert.alert('Không thể gửi ghi chú', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setSavingStudentNote(false);
    }
  };
  const toggleDaySort = (dayIndex: number) => {
    setGridSort((current) => current.kind === 'day' && current.dayIndex === dayIndex
      ? current.dir === 'asc'
        ? { kind: 'day', dir: 'desc', dayIndex }
        : { kind: 'name', dir: 'asc', dayIndex: 0 }
      : { kind: 'day', dir: 'asc', dayIndex });
  };
  const selectSlot = async (startTime: string | null) => {
    if (!selectedStudentId || !selectedStudent || !classDate) return;
    const current = itemsOverride || resource.data || [];
    const currentSlot = current.find((item) => item.id === selectedId);
    if (!startTime) {
      if (!currentSlot) return;
      if (user?.previewMode) {
        setItemsOverride(current.map((item) => item.id === currentSlot.id ? { ...item, status: 'cancelled' } : item));
        setShowCreate(false);
        return;
      }
      Alert.alert('Hủy buổi học', 'Bạn có chắc muốn hủy lịch này không?', [
        { text: 'Giữ lịch', style: 'cancel' },
        {
          text: 'Hủy lịch',
          style: 'destructive',
          onPress: () => {
            setSavingSlot(true);
            scheduleService.cancel(currentSlot.id, 'Giảng viên hủy lịch', user)
              .then(() => {
                setItemsOverride(null);
                resource.reload();
                setShowCreate(false);
              })
              .catch((error: unknown) => {
                Alert.alert('Không thể hủy lịch', error instanceof Error ? error.message : 'Vui lòng thử lại.');
              })
              .finally(() => setSavingSlot(false));
          },
        },
      ]);
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
    if (user?.previewMode) {
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

  return (
    <AppScreen>
      {!isTeacher && resource.loading ? <LoadingSkeleton rows={1} /> : null}
      {!isTeacher && !resource.loading ? (
        <>
          {courseProfile.error ? <ErrorState onRetry={courseProfile.reload} /> : null}
          {studentCourses.length > 1 ? (
            <View style={styles.studentCourseSection}>
              <Text style={styles.studentCoursesLabel}>KHÓA HỌC CỦA BẠN</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.studentCourses}>
                {studentCourses.map((courseName) => {
                  const enrollment = studentEnrollments.find((item) => item.courseName === courseName);
                  const isActive = activeStudentCourse === courseName;
                  const completed = enrollment?.completedSessions ?? (courseName === user?.course ? user?.completedSessions : 0) ?? 0;
                  const total = enrollment?.totalSessions ?? (courseName === user?.course ? user?.totalSessions : 12) ?? 12;
                  const progress = enrollment?.progress != null
                    ? Math.min(100, Math.max(0, Math.round(enrollment.progress)))
                    : total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
                  return (
                    <Pressable
                      key={courseName}
                      onPress={() => setSelectedCourse(courseName)}
                      style={[styles.studentCourseCard, isActive && styles.studentCourseCardActive]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      accessibilityLabel={`Chọn khóa học ${courseName}`}
                    >
                      <Text numberOfLines={2} style={[styles.studentCourseName, isActive && styles.studentCourseNameActive]}>{courseName}</Text>
                      <Text numberOfLines={1} style={styles.studentCourseTeacher}>GV: {enrollment?.teacherName || user?.teacherName || 'Chưa phân công'}</Text>
                      <View style={styles.studentCourseProgressTrack}>
                        <View style={[styles.studentCourseProgressFill, { width: `${progress}%` }]} />
                      </View>
                      <View style={styles.studentCourseProgressMeta}>
                        <Text style={styles.studentCourseTeacher}>{completed}/{total} buổi</Text>
                        <Text style={styles.studentCourseTeacher}>{progress}%</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
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
            <View style={styles.studentWeekNavigator}>
              <Pressable onPress={() => setWeekOffset((value) => value - 1)} style={styles.studentWeekArrow} accessibilityRole="button" accessibilityLabel="Tuần trước">
                <Text style={styles.studentWeekArrowText}>‹ Tuần trước</Text>
              </Pressable>
              <Pressable onPress={() => setWeekOffset(0)} style={styles.studentWeekCurrent} accessibilityRole="button" accessibilityLabel="Về tuần hiện tại">
                <Text style={styles.weekLabel}>{weekLabel}</Text>
              </Pressable>
              <Pressable onPress={() => setWeekOffset((value) => value + 1)} style={styles.studentWeekArrow} accessibilityRole="button" accessibilityLabel="Tuần sau">
                <Text style={styles.studentWeekArrowText}>Tuần sau ›</Text>
              </Pressable>
            </View>
            {activeStudentCourse ? (
              <View style={styles.weekCourseLabel}>
                <Text style={styles.weekCourseLabelCaption}>KHÓA HỌC</Text>
                <Text numberOfLines={1} style={styles.weekCourseLabelName}>{activeStudentCourse}</Text>
              </View>
            ) : null}
            <View style={styles.compactWeekGrid}>
              <View style={styles.compactWeekRow}>
                {weekDays.map((day, index) => (
                  <View key={day.dateKey} style={[styles.compactWeekCell, styles.compactWeekHeaderCell, day.dateKey === todayKey && styles.weekGridTodayCell]}>
                    <Text style={[styles.compactWeekDay, day.dateKey === todayKey && styles.weekGridTodayText]}>
                        {index === 6 ? 'CN' : `T${index + 2}`}
                    </Text>
                    <Text style={[styles.compactWeekDate, day.dateKey === todayKey && styles.weekGridTodayText]}>{day.day}</Text>
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
                          ? 'Quá hạn điểm danh'
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
                        style={[styles.compactWeekCell, styles.compactWeekSlotCell, slotStatusStyle, day.dateKey === todayKey && styles.weekGridTodayColumn]}
                        accessibilityRole="button"
                        accessibilityLabel={`${activeStudentCourse}, ${day.weekday} ${day.day}, ${item.time}, ${slotStatus}`}
                    >
                        <Text numberOfLines={1} style={styles.compactWeekTime}>{time}</Text>
                        <Text numberOfLines={1} style={styles.compactWeekStatus}>{slotStatus}</Text>
                    </Pressable>
                  ) : (
                    <View key={day.dateKey} style={[styles.compactWeekCell, styles.compactWeekSlotCell, day.dateKey === todayKey && styles.weekGridTodayColumn]}>
                        <Text style={styles.compactWeekEmpty}>—</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Card>
        </>
      ) : null}
      {isTeacher && resource.data && !resource.error ? (
        <>
          <View style={styles.scheduleStats}>
            {[
              { label: 'Đã dạy tháng này', value: String(teacherMonthItems.filter((item) => item.status === 'completed').length) },
              { label: 'Buổi sắp tới', value: String(teacherMonthItems.filter((item) => item.status === 'upcoming').length) },
              { label: 'Đã hủy', value: String(teacherMonthItems.filter((item) => item.status === 'cancelled').length) },
            ].map((stat) => <Card key={stat.label} style={styles.scheduleStat}><Text style={styles.scheduleStatValue}>{stat.value}</Text><Text style={styles.metaText}>{stat.label}</Text></Card>)}
          </View>
          <Card style={styles.weeklyGridCard}>
            <SectionHeading title="Xếp lịch dạy theo tuần" />
            <Text style={styles.metaText}>Chọn khung giờ trong ô. Khung trùng giờ sẽ không được xếp.</Text>
            <View style={styles.weekNavigator}>
              <Pressable onPress={() => setWeekOffset((value) => value - 1)} style={styles.weekArrow} accessibilityRole="button" accessibilityLabel="Tuần trước"><Text style={styles.weekArrowText}>‹</Text></Pressable>
              <Pressable onPress={() => setWeekOffset(0)} accessibilityRole="button" accessibilityLabel="Về tuần hiện tại"><Text style={styles.weekLabel}>{weekLabel}</Text></Pressable>
              <Pressable onPress={() => setWeekOffset((value) => value + 1)} style={styles.weekArrow} accessibilityRole="button" accessibilityLabel="Tuần sau"><Text style={styles.weekArrowText}>›</Text></Pressable>
            </View>
            <FilterChips items={['Đang học', 'Học xong', 'Tất cả']} selected={rosterFilter} onSelect={setRosterFilter} />
            <SearchField value={teacherQuery} onChangeText={setTeacherQuery} placeholder="Lọc tên học viên" />
            <Pressable
              onPress={() => setGridSort((current) => ({ kind: 'name', dir: current.kind === 'name' && current.dir === 'asc' ? 'desc' : 'asc', dayIndex: 0 }))}
              style={styles.scheduleSort}
              accessibilityRole="button"
              accessibilityLabel={`Sắp xếp theo tên ${gridSort.kind === 'name' ? gridSort.dir === 'asc' ? 'A–Z' : 'Z–A' : 'A–Z'}`}
            >
              <Text style={styles.scheduleSortText}>Tên: {gridSort.kind === 'name' && gridSort.dir === 'desc' ? 'Z–A' : 'A–Z'}</Text>
            </Pressable>
            {studentsResource.loading ? <LoadingSkeleton rows={1} /> : null}
            {studentsResource.error ? <ErrorState onRetry={studentsResource.reload} /> : null}
            {!studentsResource.loading && !studentsResource.error && !teacherRoster.length ? (
              <EmptyState
                title={teacherQuery.trim() ? 'Không tìm thấy học viên khớp tên' : rosterFilter === 'Học xong' ? 'Không có học viên học xong trên bảng này' : rosterFilter === 'Tất cả' ? 'Chưa có học viên để xếp trên bảng này' : 'Chưa có học viên đang học để xếp trên bảng này'}
                message="Học viên đủ điều kiện sẽ xuất hiện trong bảng xếp lịch."
              />
            ) : null}
            {!studentsResource.loading && !studentsResource.error && teacherRoster.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.weekGridContent}>
                <View>
                  <View style={styles.weekGridHeader}>
                    <View style={[styles.weekGridNameCell, styles.weekGridHeaderCell]}><Text style={styles.weekGridHeaderText}>Học viên</Text></View>
                    {weekDays.map((day, index) => {
                      const active = gridSort.kind === 'day' && gridSort.dayIndex === index;
                      return (
                        <View key={day.dateKey} style={[styles.weekGridDayCell, styles.weekGridHeaderCell, active && styles.weekGridSortedCell]}>
                          <Text style={styles.weekGridHeaderText}>{day.weekday}</Text>
                          <Text style={styles.weekGridDate}>{day.day}</Text>
                          <Pressable onPress={() => toggleDaySort(index)} style={styles.weekGridSort} accessibilityRole="button" accessibilityLabel={`Sắp xếp theo giờ ${day.weekday}`}>
                            <Text style={styles.weekGridSortText}>{active ? gridSort.dir === 'asc' ? 'Thấp→cao' : 'Cao→thấp' : 'Giờ'}</Text>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                  {teacherRoster.map((student) => (
                    <View key={student.id} style={styles.weekGridRow}>
                      <View style={styles.weekGridNameCell}>
                        <Text numberOfLines={1} style={styles.weekGridStudentName}>{student.name}</Text>
                        <Text numberOfLines={2} style={styles.weekGridCourse}>{student.course || '—'} · {student.completedSessions ?? '—'}/{student.totalSessions ?? '—'} buổi</Text>
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
                            style={[styles.weekGridDayCell, styles.weekGridSlotCell, scheduled && styles.weekGridBookedCell, locked && styles.weekGridLockedCell]}
                            accessibilityRole="button"
                            accessibilityLabel={`${student.name}, ${day.weekday} ${day.day}, ${scheduled?.time || 'chưa xếp ca'}${locked ? ', đã khóa' : ''}`}
                          >
                            <Text numberOfLines={2} style={[styles.weekGridSlotText, scheduled && styles.weekGridBookedText]}>{scheduled?.time || '—'}</Text>
                            {scheduled?.status === 'completed' ? <Text style={styles.weekGridStatus}>Đã dạy</Text> : null}
                            {scheduled && scheduled.status !== 'completed' ? <Text style={styles.weekGridStatus}>Đã xếp</Text> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : null}
          </Card>
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
          <FilterChips compact items={['Tất cả', 'Ngày', 'Tuần', 'Tháng', 'Chưa điểm danh', 'Lịch hủy']} selected={studentDiaryFilter} onSelect={setStudentDiaryFilter} />
          {studentDiaryItems.map((item) => (
            <Pressable key={`log-${item.id}`} onPress={() => setSelectedId(item.id)} accessibilityRole="button" accessibilityLabel={`Mở chi tiết ${item.title}`}>
              <Card style={styles.learningLogRow}>
                <View style={styles.summaryIcon}><Check size={18} color={colors.green} /></View>
                <View style={styles.rowCopy}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.metaText}>{item.dateLabel || item.date || '—'} · {item.time || '—'}</Text>
                  <Text style={styles.metaText}>Giảng viên: {item.person || '—'} · {attendanceStatusLabel(item)}</Text>
                  {item.grade != null ? <Text style={styles.metaText}>Điểm: {item.grade}/10</Text> : null}
                  {item.note ? <Text style={styles.metaText}>Ghi chú: {item.note}</Text> : null}
                </View>
              </Card>
            </Pressable>
          ))}
          {!studentDiaryItems.length ? <Text style={styles.diaryEmpty}>Không có ca học phù hợp với bộ lọc đã chọn.</Text> : null}
        </Card>
      ) : null}
      {isTeacher && !resource.loading && !resource.error ? (
        <View style={styles.group}>
          <SectionHeading title="Nhật ký giảng dạy" />
          <Text style={styles.metaText}>Xem các ca dạy theo ngày, tuần, tháng, chưa điểm danh hoặc đã hủy.</Text>
          <FilterChips items={['Tất cả', 'Ngày', 'Tuần', 'Tháng', 'Chưa điểm danh', 'Lịch hủy']} selected={diaryFilter} onSelect={setDiaryFilter} />
          {diaryItems.map((item) => (
            <Card key={`teacher-log-${item.id}`} style={styles.learningLogRow}>
              <View style={styles.summaryIcon}><CalendarDays size={18} color={item.status === 'cancelled' ? colors.red : colors.brand} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.metaText}>{item.dateLabel || item.date || '—'} · {item.time || '—'}</Text>
                <Text style={styles.metaText}>Học viên: {item.studentName || '—'} · {item.subject}</Text>
                <Text style={styles.metaText}>Trạng thái: {attendanceStatusLabel(item)}</Text>
                {isTeacher && item.attendanceStatus === 'pending' && item.status !== 'cancelled' ? (
                  <Pressable onPress={() => navigation.navigate('Attendance', { scheduleId: item.id })} style={styles.readAll} accessibilityRole="button">
                    <Text style={styles.readAllText}>Điểm danh</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ))}
          {!diaryItems.length ? <EmptyState title="Chưa có ca dạy" message="Nhật ký giảng dạy sẽ hiển thị sau khi có dữ liệu." /> : null}
        </View>
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
          {selectedItem.note ? <Text style={styles.metaText}>Ghi chú: {selectedItem.note}</Text> : null}
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
            setStudentNote(selectedItem.note || '');
            setShowStudentNote(true);
          }} />
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

export function AssignmentsScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const isTeacher = user?.role === 'teacher';
  const [filter, setFilter] = useState('Tất cả');
  const [overrides, setOverrides] = useState<Assignment[] | null>(null);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [course, setCourse] = useState('');
  const [attachedFileUrl, setAttachedFileUrl] = useState('');
  const [deadline, setDeadline] = useState('');
  const [assignToAll, setAssignToAll] = useState(true);
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
  const [grade, setGrade] = useState('');
  const [feedback, setFeedback] = useState('');
  const [submissionLink, setSubmissionLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingGrade, setIsSavingGrade] = useState(false);
  const [isCreatingAssignment, setIsCreatingAssignment] = useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const loader = useCallback(() => assignmentService.list(isTeacher ? 'teacher' : 'student', user), [isTeacher, user]);
  const resource = useMockResource(loader);
  const studentsLoader = useCallback(() => studentService.assigned(user), [user]);
  const studentsResource = useMockResource(studentsLoader);
  const allItems = overrides || resource.data || [];
  const teacherStudents = studentsResource.data || [];
  const courses = [...new Set(teacherStudents.flatMap((student) => student.courses?.length ? student.courses : [student.course]).filter(Boolean))];
  const courseStudents = teacherStudents.filter((student) => !course || student.courses?.includes(course) || student.course === course);
  const items = useMemo(() => allItems.filter((item) => (
    filter === 'Tất cả'
    || (filter === 'Chờ xử lý' && ['Chưa làm', 'Cần chấm'].includes(item.status))
    || item.status === filter
  )), [allItems, filter]);
  const filters = isTeacher
    ? ['Tất cả', 'Cần chấm', 'Đã chấm']
    : ['Tất cả', 'Chưa làm', 'Đã nộp', 'Quá hạn'];
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
  const submitSelected = async () => {
    if (!selected || !user || user.role !== 'student') return;
    const url = submissionLink.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      Alert.alert('Liên kết chưa hợp lệ', 'Nhập liên kết bài làm bắt đầu bằng http:// hoặc https://.');
      return;
    }
    setIsSubmitting(true);
    try {
      await assignmentService.submit(selected.id, user.id, url);
      setSelected({ ...selected, status: 'Đã nộp' });
      setSubmissionLink('');
      setOverrides(null);
      resource.reload();
      Alert.alert('Đã nộp bài', 'Bài làm đã được gửi đến hệ thống.');
    } catch (error) {
      Alert.alert('Không thể nộp bài', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppScreen>
      <AppHeader
        title={isTeacher ? 'Giao bài tập & kiểm tra' : 'Bài tập'}
        subtitle={isTeacher ? 'Theo dõi bài đã giao và cần chấm' : 'Bài tập trong các khóa học của bạn'}
        right={
          <View style={styles.headerActions}>
            {!isTeacher ? (
              <Pressable onPress={() => navigation.navigate('Materials')} style={styles.readAll} accessibilityRole="button">
                <Text style={styles.readAllText}>Tài liệu</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => setShowCreate(true)} style={styles.readAll} accessibilityRole="button">
                <Text style={styles.readAllText}>Tạo bài</Text>
              </Pressable>
            )}
          </View>
        }
      />
      <FilterChips items={filters} selected={filter} onSelect={setFilter} variant="tabs" />
      {isTeacher ? (
        <View style={styles.assignmentTabs}>
          <Pressable onPress={() => navigation.navigate('TeacherQuizzes')} style={styles.assignmentTab} accessibilityRole="button">
            <Text style={styles.assignmentTabText}>Bài thi Trắc nghiệm</Text>
          </Pressable>
          <View style={[styles.assignmentTab, styles.assignmentTabActive]}><Text style={styles.assignmentTabActiveText}>Bài tập về nhà (Nộp file)</Text></View>
        </View>
      ) : null}
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
          }}
          accessibilityRole="button"
        >
          <AssignmentCard item={item} />
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
                onChangeText={setSubmissionLink}
                placeholder="https://drive.google.com/..."
                autoCapitalize="none"
                keyboardType="url"
                style={styles.formInput}
                accessibilityLabel="Liên kết bài làm"
              />
              <PrimaryButton
                title={isSubmitting ? 'Đang nộp…' : selected.status === 'Đã chấm' ? 'Đã chấm bài' : selected.status === 'Đã nộp' ? 'Nộp lại bài' : 'Nộp bài'}
                disabled={!submissionLink.trim() || isSubmitting || selected.status === 'Đã chấm'}
                loading={isSubmitting}
                onPress={() => { void submitSelected(); }}
              />
              <Text style={styles.note}>Hiện hỗ trợ gửi liên kết bài làm. Tải tệp trực tiếp sẽ được bổ sung sau khi hoàn tất luồng upload native.</Text>
            </>
          )}
        </Card>
      ) : null}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Tạo bài tập</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Tên bài tập" style={styles.formInput} />
            <TextInput value={description} onChangeText={setDescription} placeholder="Mô tả / yêu cầu" multiline style={[styles.formInput, styles.formTextarea]} />
            <Text style={styles.fieldLabel}>Link File đề bài (Google Drive...)</Text>
            <TextInput value={attachedFileUrl} onChangeText={setAttachedFileUrl} placeholder="https://..." autoCapitalize="none" keyboardType="url" style={styles.formInput} accessibilityLabel="Link File đề bài Google Drive" />
            {attachedFileUrl.trim() ? <Pressable onPress={() => { void openAssignmentLink(attachedFileUrl.trim(), 'Tệp đề bài'); }} style={styles.fileLinkRow} accessibilityRole="button"><Link2 size={17} color={colors.brand} /><Text numberOfLines={1} style={styles.fileLinkText}>Xem trước liên kết</Text></Pressable> : null}
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
            <TextInput value={deadline} onChangeText={setDeadline} placeholder="Hạn nộp · YYYY-MM-DD" style={styles.formInput} accessibilityLabel="Hạn nộp bài tập demo" />
            <Text style={styles.note}>Bài tập sẽ được giao trên hệ thống. Tệp đính kèm hiện dùng liên kết tải đã có.</Text>
            <PrimaryButton title={isCreatingAssignment ? 'Đang giao…' : 'Giao bài tập'} disabled={isCreatingAssignment} onPress={() => { void createAssignment(); }} />
            <PrimaryButton title="Đóng" variant="quiet" onPress={() => setShowCreate(false)} />
          </View>
        </View>
      </Modal>
      {isTeacher && user?.previewMode ? <Text style={styles.footnote}>Bản xem trước không gửi dữ liệu lên hệ thống.</Text> : null}
    </AppScreen>
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
  const loader = useCallback(() => notificationService.list(user?.role === 'teacher' ? 'teacher' : 'student'), [user?.role]);
  const resource = useMockResource(loader);
  const [page, setPage] = useState(1);
  const notifications = resource.data || [];
  const matchingItems = notifications;
  const pageCount = Math.max(1, Math.ceil(matchingItems.length / 20));
  const currentPage = Math.min(page, pageCount);
  const pageItems = matchingItems.slice((currentPage - 1) * 20, currentPage * 20);

  const reportNotificationError = (error: unknown, action: string) => {
    Alert.alert(action, error instanceof Error ? error.message : 'Không thể hoàn tất thao tác thông báo.');
  };
  const markAll = () => {
    void notificationService.markRead()
      .then(resource.reload)
      .catch((error: unknown) => reportNotificationError(error, 'Đánh dấu đã đọc'));
  };
  const markRead = (item: AppNotification) => {
    if (!item.unread) return;
    void notificationService.markRead(item.id)
      .then(resource.reload)
      .catch((error: unknown) => reportNotificationError(error, 'Đánh dấu đã đọc'));
  };
  const openRelated = (item: AppNotification) => {
    const type = String(item.type || item.payload?.type || item.category).trim().toUpperCase();
    const path = String(item.targetPath || '').toLowerCase();
    if (path.includes('exam') || type === 'EXAM') {
      if (user?.role === 'student') {
        Alert.alert('Thông báo', 'Mục thi/chứng nhận hiện chỉ thực hiện trên website.');
        return;
      }
      navigation.navigate('TeacherQuizzes');
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
              ? user?.role === 'student' ? { screen: 'Evaluations' as const } : { screen: 'Assignments' as const }
              : path.includes('training') || type === 'TRAINING'
                ? user?.role === 'teacher' ? { screen: 'TeacherTraining' as const } : null
                : path.includes('news') || type === 'NEWS'
                  ? { screen: 'News' as const }
                  : type === 'COURSE' || type === 'STUDENT'
                    ? user?.role === 'student' ? { screen: 'Materials' as const } : { screen: 'TeacherTraining' as const }
                    : path.includes('center') || path.includes('profile')
                      ? { screen: 'CenterInfo' as const }
                      : null;
    if (!target) {
      Alert.alert('Thông báo', 'Chưa có màn hình mobile phù hợp cho loại thông báo này.');
      return;
    }
    if ('tab' in target) navigation.navigate('MainTabs', target.tab === 'Messages' ? { screen: 'Messages' } : { screen: 'Schedule' });
    else navigation.navigate(target.screen);
  };
  const hideNotification = (id: string) => {
    void notificationService.dismiss(id)
      .then(resource.reload)
      .catch((error: unknown) => reportNotificationError(error, 'Ẩn thông báo'));
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
        {notifications.some((item) => item.unread) ? (
          <Pressable onPress={markAll} style={styles.notificationMarkAll} accessibilityRole="button">
            <Check size={14} color={colors.ink} />
            <Text style={styles.notificationMarkAllText}>Đánh dấu là đã đọc</Text>
          </Pressable>
        ) : null}
      </View>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && !notifications.length ? <EmptyState title="Bạn đã cập nhật!" message="Thông báo mới sẽ được hiển thị tại đây." /> : null}
      {pageItems.length ? (
        <View style={styles.notificationList}>
          {pageItems.map((item, index) => (
            <NotificationCard
              key={item.id}
              item={item}
              last={index === pageItems.length - 1}
              onPress={() => {
                markRead(item);
                openRelated(item);
                onClose?.();
              }}
              onMarkRead={() => markRead(item)}
              onDismiss={() => hideNotification(item.id)}
            />
          ))}
        </View>
      ) : null}
      {!resource.loading && !resource.error && notifications.length > 0 && !pageItems.length ? <EmptyState title="Không có thông báo" message="Không có thông báo trong bộ lọc đã chọn." /> : null}
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
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationOverlayContent}>
              {notificationContent}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
  return <AppScreen contentStyle={styles.notificationScreen}>{notificationContent}</AppScreen>;
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
            <Text style={styles.notificationItemCategory}>{category.toUpperCase()}</Text>
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
  const [note, setNote] = useState('');
  const students = (resource.data || []).filter((student) => (
    `${student.name} ${student.phone || ''} ${student.course}`.toLowerCase().includes(query.toLowerCase())
    && (statusFilter === 'Tất cả' || (
      statusFilter === 'Đang học'
        ? student.enrollmentStatus === 'active'
        : statusFilter === 'Học xong'
          ? student.enrollmentStatus === 'completed'
          : student.enrollmentStatus === 'cancelled'
    ))
  ));
  return (
    <AppScreen>
      <AppHeader title="Học viên" subtitle={`${resource.data?.length || 0} học viên được phân công`} />
      <SearchField value={query} onChangeText={setQuery} placeholder="Tìm họ, tên, SĐT..." />
      <FilterChips items={['Tất cả', 'Đang học', 'Học xong', 'Thôi học']} selected={statusFilter} onSelect={setStatusFilter} />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && !students.length ? <EmptyState title="Không tìm thấy học viên" message="Thử tìm theo tên hoặc khóa học khác." /> : null}
      {!resource.loading && !resource.error && students.map((student) => (
        <View key={student.id} style={styles.studentListItem}>
          <Pressable onPress={() => { setNote(student.notes || ''); setSelectedStudent(student); }} accessibilityRole="button" accessibilityLabel={`Mở hồ sơ ${student.name}`} style={styles.studentListMain}>
            <StudentCard student={student} />
          </Pressable>
          <Pressable onPress={() => navigation.navigate('Conversation', { conversationId: `student-${student.id}`, conversationName: student.name })} accessibilityRole="button" accessibilityLabel={`Nhắn tin với ${student.name}`} style={styles.studentChatButton}>
            <MessageCircle size={19} color={colors.brand} />
          </Pressable>
        </View>
      ))}
      {selectedStudent ? (
        <Card style={styles.studentDetail}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{selectedStudent.name}</Text>
            <Pressable onPress={() => setSelectedStudent(null)} accessibilityRole="button"><Text style={styles.closeText}>Đóng</Text></Pressable>
          </View>
          <Text style={styles.muted}>{selectedStudent.course}  ·  {selectedStudent.lastClass}</Text>
          <Text style={styles.metaText}>SĐT: {selectedStudent.phone || 'Chưa có dữ liệu'} · Trạng thái: {selectedStudent.enrollmentStatus === 'completed' ? 'Học xong' : selectedStudent.enrollmentStatus === 'cancelled' ? 'Thôi học' : 'Đang học'}</Text>
          <ProgressBar value={selectedStudent.progress} />
          <Text style={styles.metaText}>Tiến độ học tập: {selectedStudent.progress}%</Text>
          <Text style={styles.metaText}>Buổi học: {selectedStudent.completedSessions || 0}/{selectedStudent.totalSessions || 0} · Còn lại: {selectedStudent.remainingSessions ?? 0}</Text>
          {selectedStudent.attendance?.map((item) => <Text key={`${item.date}-${item.course}`} style={styles.metaText}>{item.date} · {item.course} · {item.status}</Text>)}
          <TextInput value={note} onChangeText={setNote} placeholder="Ghi chú học viên (demo)" multiline style={[styles.formInput, styles.formTextarea]} />
          <View style={styles.choiceWrap}>
            <Pressable onPress={() => navigation.navigate('Conversation', { conversationId: 'chat-2' })} style={styles.choice}><Text style={styles.choiceText}>Nhắn tin</Text></Pressable>
            <Pressable onPress={() => Alert.alert('Kết quả học tập', 'Kết quả demo: tiến độ ' + selectedStudent.progress + '%')} style={styles.choice}><Text style={styles.choiceText}>Kết quả</Text></Pressable>
            <Pressable onPress={() => {
              setSelectedStudent({ ...selectedStudent, notes: note.trim() });
              Alert.alert('Đã lưu demo', 'Ghi chú chỉ tồn tại trong màn hình hiện tại.');
            }} style={styles.choice}><Text style={styles.choiceText}>Lưu ghi chú</Text></Pressable>
          </View>
        </Card>
      ) : null}
    </AppScreen>
  );
}

function StudentCard({ student }: { student: DemoStudent }) {
  return (
    <View style={styles.studentCard}>
      <Avatar name={student.name} color={student.color} />
      <View style={styles.rowCopy}>
        <View style={styles.rowBetween}><Text style={styles.cardTitle}>{student.name}</Text><StatusBadge label={student.status} /></View>
        <Text numberOfLines={1} style={styles.metaText}>{student.course}</Text>
        <Text style={styles.metaText}>Truy cập lần cuối: —</Text>
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
              <Avatar name={selectedStudent.name} color={selectedStudent.color} size={58} />
              <View style={styles.attendanceStudentCopy}>
                <Text style={styles.attendanceStudentName}>{selectedStudent.name}</Text>
                <Text style={styles.metaText}>{selectedSession.courseName || selectedStudent.course}</Text>
                <Text style={styles.metaText}>{selectedSession.dateLabel || selectedSession.date || '—'} · {selectedSession.time || '—'}</Text>
              </View>
              <StatusBadge label={pendingAttendance ? 'Chờ ghi nhận' : selectedSession ? attendanceStatusLabel(selectedSession, attendanceNow) : 'Chưa điểm danh'} />
              <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Đóng điểm danh" style={styles.attendanceBackButton}>
                <X size={18} color={colors.muted} />
              </Pressable>
            </View>
            <View style={styles.attendanceProgressTrack}>
              <View style={[styles.attendanceProgressFill, { width: `${sessionTotal ? Math.min(100, (completedSessions / sessionTotal) * 100) : 0}%` }]} />
            </View>
            <Text style={styles.attendanceProgressText}>TIẾN ĐỘ KHÓA HỌC · {completedSessions}/{sessionTotal} BUỔI ({sessionTotal ? Math.round((completedSessions / sessionTotal) * 100) : 0}%)</Text>
          </Card>
          <View style={styles.attendanceStatRow}>
            <View style={[styles.attendanceStatCard, styles.attendanceStatBlue]}>
              <Text style={styles.attendanceStatLabel}>ĐÃ HỌC</Text>
              <Text style={[styles.attendanceStatValue, { color: '#2563EB' }]}>{completedSessions}</Text>
              <Text style={styles.attendanceStatFoot}>BUỔI</Text>
            </View>
            <View style={[styles.attendanceStatCard, styles.attendanceStatGold]}>
              <Text style={styles.attendanceStatLabel}>CÒN LẠI</Text>
              <Text style={[styles.attendanceStatValue, { color: '#D97706' }]}>{Math.max(0, sessionTotal - completedSessions)}</Text>
              <Text style={styles.attendanceStatFoot}>BUỔI</Text>
            </View>
            <View style={[styles.attendanceStatCard, styles.attendanceStatPurple]}>
              <Text style={styles.attendanceStatLabel}>ĐIỂM TB</Text>
              <Text style={[styles.attendanceStatValue, { color: '#9333EA' }]}>{selectedStudent.avgGrade || 0}<Text style={styles.attendanceStatSuffix}>/10</Text></Text>
              <Text style={styles.attendanceStatFoot}>ĐÁNH GIÁ CHUNG</Text>
            </View>
          </View>
          {isMakeupOverdue && !attendanceAlreadySubmitted ? (
            <Card style={styles.makeupRequestCard}>
              <Text style={styles.cardTitle}>Đã quá hạn điểm danh 1 giờ</Text>
              <Text style={styles.metaText}>
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
                <Text style={styles.attendanceWaitingText}>ĐANG XÁC NHẬN</Text>
              </View>
              <Pressable onPress={cancelPendingAttendance} style={styles.attendanceUndoButton} accessibilityRole="button">
                <Text style={styles.attendanceUndoText}>✕  HỦY ĐIỂM DANH ({confirmRemaining}S)</Text>
              </Pressable>
            </View>
          ) : attendanceAlreadySubmitted || committingAttendance ? (
            <View style={styles.attendanceSubmittedRow}>
              <View style={styles.attendanceWaitingButton}>
                <CheckCircle size={16} color="#94A3B8" />
                <Text style={styles.attendanceWaitingText}>
                  {committingAttendance
                    ? 'ĐANG GHI NHẬN'
                    : selectedSession?.attendanceDisputed
                      ? 'CHỜ ADMIN XỬ LÝ'
                      : selectedSession?.attendanceRejected
                        ? 'BUỔI KHÔNG ĐƯỢC TÍNH'
                        : selectedSession?.attendanceConfirmPending
                          ? 'CHỜ HỌC VIÊN XÁC NHẬN'
                          : selectedSession?.attendanceConfirmStatus === 'admin_approved'
                            ? 'ADMIN ĐÃ ĐIỂM DANH BÙ'
                            : 'ĐÃ ĐIỂM DANH'}
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
                <Text style={styles.attendanceModalLabel}>HỌC VIÊN</Text>
                <Text style={styles.attendanceModalName}>{selectedStudent?.name}</Text>
                <Text style={styles.attendanceModalProgress}>Tiến độ hiện tại: {completedSessions}/{sessionTotal} buổi</Text>
              </View>
              <View>
                <Text style={styles.attendanceFieldLabel}>ĐÁNH GIÁ BUỔI HỌC (0-10)</Text>
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
                <Text style={styles.attendanceFieldLabel}>GHI CHÚ NHANH</Text>
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
                  <Text style={styles.attendanceModalCancelText}>HỦY</Text>
                </Pressable>
                <Pressable onPress={confirmAttendance} style={styles.attendanceModalConfirm} accessibilityRole="button">
                  <Text style={styles.attendanceModalConfirmText}>XÁC NHẬN ĐIỂM DANH</Text>
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
  const courseProgress = user?.completedSessions != null && user.totalSessions
    ? Math.round((user.completedSessions / user.totalSessions) * 100)
    : null;
  const [showStudentProfileForm, setShowStudentProfileForm] = useState(false);
  const [showTeacherProfileForm, setShowTeacherProfileForm] = useState(false);
  const [previewStudentUpdates, setPreviewStudentUpdates] = useState<Record<string, string>>({});
  const [openStudentSections, setOpenStudentSections] = useState({
    courses: true,
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
  const teacherDate = (key: string) => {
    const value = teacherText(key, '');
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const teacherStatus = (() => {
    const status = teacherText('status', '').toLowerCase();
    if (['active', 'đang hoạt động'].includes(status)) return 'Đang hoạt động';
    if (['pending', 'chờ duyệt'].includes(status)) return 'Chờ duyệt';
    if (['suspended', 'tạm khóa'].includes(status)) return 'Tạm khóa';
    if (['inactive', 'ngừng hoạt động'].includes(status)) return 'Ngừng hoạt động';
    return status || '—';
  })();
  const teacherVoice = ({
    bac: 'Miền Bắc',
    trung: 'Miền Trung',
    nam: 'Miền Nam',
    tay: 'Tây Nguyên',
  } as Record<string, string>)[teacherText('voiceRegion')] || teacherText('voiceRegion');
  const teacherBank = profileTeacher?.bankAccount && typeof profileTeacher.bankAccount === 'object'
    ? profileTeacher.bankAccount as Record<string, unknown>
    : {};
  const teacherBankText = (key: string, fallback = '—') => {
    const value = teacherBank[key];
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
  };
  const enrollments = studentProfile?.enrollments.length ? studentProfile.enrollments : (user?.course ? [{
    id: 'primary-course',
    courseName: user.course,
    teacherName: user.teacherName,
    progress: courseProgress || 0,
    completedSessions: user.completedSessions,
    totalSessions: user.totalSessions,
    avgGrade: user.avgGrade,
    status: 'Đang học' as const,
    tuitionAmount: undefined,
    paidAmount: undefined,
  }] : []);
  const toggleStudentSection = (section: keyof typeof openStudentSections) => {
    setOpenStudentSections((current) => ({ ...current, [section]: !current[section] }));
  };
  return (
    <AppScreen>
      <AppHeader title="Hồ sơ" subtitle={isTeacher ? 'Thông tin hồ sơ giảng viên' : 'Thông tin tài khoản học viên'} icon={UserRound} />
      {studentProfileResource.loading ? <LoadingSkeleton /> : null}
      {studentProfileResource.error ? <ErrorState onRetry={studentProfileResource.reload} /> : null}
      {isTeacher ? (
        <>
          <Card style={styles.teacherProfileHero}>
            <Avatar name={teacherText('name', user?.name || 'Giảng viên')} color={user?.avatarColor} size={72} />
            <Text style={styles.teacherProfileEyebrow}>HỒ SƠ CÁ NHÂN</Text>
            <Text style={styles.teacherProfileName}>{teacherText('name', user?.name || '—')}</Text>
            <Text style={styles.teacherProfileSubtitle}>Thông tin cá nhân, ngân hàng và bảo mật · {user?.branch || '—'}</Text>
            <View style={styles.teacherProfileTags}>
              <Text style={styles.teacherProfileStatus}>Trạng thái: {teacherStatus}</Text>
              {teacherText('specialty') !== '—' ? <Text style={styles.teacherProfileTag}>{teacherText('specialty')}</Text> : null}
            </View>
          </Card>
          <Card style={styles.teacherDetails}>
            <SectionHeading title="Thông tin cá nhân" action="Chỉnh sửa" onPress={() => setShowTeacherProfileForm(true)} />
            {[
              ['Họ và tên', teacherText('name', user?.name || '—')],
              ['Mã giảng viên', teacherText('teacherCode')],
              ['Số điện thoại', teacherText('phone', user?.phone || '—')],
              ['Zalo', teacherText('zalo', user?.zalo || '—')],
              ['Tuổi', typeof profileTeacher?.age === 'number' ? `${profileTeacher.age} tuổi` : '—'],
              ['Ngày vào làm', teacherDate('startDate')],
              ['Chi nhánh làm việc', user?.branch || '—'],
              ['Email', teacherText('email', user?.email || '—')],
              ['Địa chỉ (Thường trú/Tạm trú)', teacherText('address', user?.address || '—')],
              ['Chuyên môn', teacherText('specialty', user?.course || '—')],
              ['Giọng (vùng miền)', teacherVoice],
              ['Giới thiệu bản thân', teacherText('bio')],
            ].map(([label, value]) => (
              <View key={label} style={styles.teacherProfileField}>
                <Text style={styles.teacherProfileLabel}>{label}</Text>
                <Text style={styles.teacherProfileValue}>{value}</Text>
              </View>
            ))}
          </Card>
          <Card style={styles.teacherDetails}>
            <SectionHeading title="Thông tin thanh toán" action="Chỉnh sửa" onPress={() => setShowTeacherProfileForm(true)} />
            {[
              ['Ngân hàng', teacherBankText('bankName')],
              ['Số tài khoản', teacherBankText('accountNumber')],
              ['Tên chủ tài khoản', teacherBankText('accountHolder', teacherBankText('accountName'))],
              ['Chi nhánh', teacherBankText('bankBranch')],
            ].map(([label, value]) => (
              <View key={label} style={styles.teacherProfileField}>
                <Text style={styles.teacherProfileLabel}>{label}</Text>
                <Text style={styles.teacherProfileValue}>{value}</Text>
              </View>
            ))}
          </Card>
          <Card style={styles.teacherDetails}>
            <SectionHeading title="Trạng thái tài khoản" />
            {[
              ['Trạng thái', teacherStatus],
              ['Điểm test', typeof profileTeacher?.testScore === 'number' ? `${profileTeacher.testScore}` : '—'],
              ['Lương/buổi', typeof profileTeacher?.baseSalaryPerSession === 'number' ? formatCurrency(profileTeacher.baseSalaryPerSession) : '—'],
              ['Ngày tham gia', teacherDate('startDate')],
            ].map(([label, value]) => (
              <View key={label} style={styles.teacherProfileField}>
                <Text style={styles.teacherProfileLabel}>{label}</Text>
                <Text style={styles.teacherProfileValue}>{value}</Text>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <>
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
            <View style={styles.studentProfileRows}>
              {[
                { label: 'Họ và tên', value: studentText('name', user?.name || 'Chưa cập nhật'), Icon: UserRound },
                { label: 'Số điện thoại', value: studentText('phone', user?.phone || 'Chưa cập nhật'), Icon: Phone },
                { label: 'Email', value: studentText('email', user?.email || 'Chưa cập nhật'), Icon: Mail },
                { label: 'Số điện thoại khác', value: studentText('zalo', user?.zalo || 'Chưa cập nhật'), Icon: Phone },
                { label: 'Địa chỉ', value: studentText('address', user?.address || 'Chưa cập nhật'), Icon: MapPin },
              ].map(({ label, value, Icon }) => (
                <View key={label} style={styles.studentProfileInfoRow}>
                  <Icon size={16} color="#94A3B8" />
                  <View style={styles.studentProfileInfoCopy}>
                    <Text style={styles.studentProfileLabel}>{label}</Text>
                    <Text style={styles.studentProfileValue}>{value}</Text>
                  </View>
                </View>
              ))}
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
          <MenuRow icon={<BookOpen size={18} color={colors.brand} />} title="Danh mục theo vai trò" subtitle="Chức năng hiện có trên web" onPress={() => navigation.navigate('MobileMenu')} />
          <MenuRow icon={<Users size={18} color={colors.brand} />} title="Liên hệ Trung tâm" subtitle="Thông tin trung tâm" onPress={() => navigation.navigate('CenterInfo')} />
          <MenuRow icon={<Clock3 size={18} color={colors.red} />} title="Đăng xuất" destructive onPress={handleSignOut} />
        </Card>
      ) : (
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => [styles.profileSignOutButton, pressed && styles.profileSignOutButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Đăng xuất"
        >
          <LogOut size={18} color={colors.red} />
          <Text style={styles.profileSignOutText}>Đăng xuất</Text>
        </Pressable>
      )}
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
    </AppScreen>
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
  const [email, setEmail] = useState(typeof profile?.email === 'string' ? profile.email : '');
  const [zalo, setZalo] = useState(typeof profile?.zalo === 'string' ? profile.zalo : '');
  const [address, setAddress] = useState(typeof profile?.address === 'string' ? profile.address : '');
  const [gender, setGender] = useState<'male' | 'female'>(profile?.gender === 'female' || profile?.gender === 'Nữ' ? 'female' : 'male');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) {
      Alert.alert('Không thể lưu hồ sơ', 'Vui lòng đăng nhập lại rồi thử lần nữa.');
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
      <View style={styles.modalBackdrop}>
        <ScrollView contentContainerStyle={styles.modalCard} keyboardShouldPersistTaps="handled">
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>Chỉnh sửa thông tin</Text>
            <Pressable onPress={onClose} accessibilityRole="button"><Text style={styles.closeText}>Đóng</Text></Pressable>
          </View>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Nhập email" keyboardType="email-address" autoCapitalize="none" style={styles.formInput} />
          <Text style={styles.fieldLabel}>Số điện thoại khác</Text>
          <TextInput value={zalo} onChangeText={setZalo} placeholder="Nhập số điện thoại liên hệ" keyboardType="phone-pad" style={styles.formInput} />
          <Text style={styles.fieldLabel}>Địa chỉ</Text>
          <TextInput value={address} onChangeText={setAddress} placeholder="Nhập địa chỉ" style={styles.formInput} />
          <Text style={styles.fieldLabel}>Giới tính</Text>
          <View style={styles.choiceWrap}>
            {(['male', 'female'] as const).map((value) => {
              const selected = gender === value;
              return (
                <Pressable
                  key={value}
                  onPress={() => setGender(value)}
                  style={[styles.choice, selected && styles.choiceActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.choiceText, selected && styles.choiceTextActive]}>{value === 'male' ? 'Nam' : 'Nữ'}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.note}>Họ tên và số điện thoại đăng nhập do trung tâm quản lý.</Text>
          <PrimaryButton title={saving ? 'Đang lưu…' : 'Lưu thay đổi'} disabled={saving} onPress={() => { void save(); }} />
          <PrimaryButton title="Hủy" variant="quiet" disabled={saving} onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
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
  const bank = profile?.bankAccount && typeof profile.bankAccount === 'object'
    ? profile.bankAccount as Record<string, unknown>
    : {};
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
      <View style={styles.modalBackdrop}>
        <ScrollView contentContainerStyle={styles.modalCard}>
          <Text style={styles.cardTitle}>Cập nhật hồ sơ giảng viên</Text>
          <TextInput value={email} onChangeText={setEmail} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={styles.formInput} />
          <TextInput value={zalo} onChangeText={setZalo} placeholder="Zalo" keyboardType="phone-pad" style={styles.formInput} />
          <TextInput value={age} onChangeText={setAge} placeholder="Tuổi" keyboardType="number-pad" style={styles.formInput} />
          <TextInput value={address} onChangeText={setAddress} placeholder="Địa chỉ" style={styles.formInput} />
          <TextInput value={bio} onChangeText={setBio} placeholder="Giới thiệu bản thân" multiline style={[styles.formInput, styles.formTextarea]} />
          <TextInput value={voiceRegion} onChangeText={setVoiceRegion} placeholder="Giọng: bac / trung / nam / tay" autoCapitalize="none" style={styles.formInput} />
          <SectionHeading title="Thông tin thanh toán" />
          <TextInput value={bankName} onChangeText={setBankName} placeholder="Ngân hàng" style={styles.formInput} />
          <TextInput value={accountNumber} onChangeText={setAccountNumber} placeholder="Số tài khoản" keyboardType="number-pad" style={styles.formInput} />
          <TextInput value={accountHolder} onChangeText={setAccountHolder} placeholder="Tên chủ tài khoản" style={styles.formInput} />
          <TextInput value={bankBranch} onChangeText={setBankBranch} placeholder="Chi nhánh ngân hàng" style={styles.formInput} />
          <Text style={styles.note}>Họ tên, số điện thoại chính, chuyên môn và trạng thái do trung tâm quản lý.</Text>
          <PrimaryButton title={saving ? 'Đang lưu…' : 'Lưu thay đổi'} disabled={saving} onPress={() => { void save(); }} />
          <PrimaryButton title="Hủy" variant="quiet" disabled={saving} onPress={onClose} />
        </ScrollView>
      </View>
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

function FilterChips({ items, selected, onSelect, compact = false, variant = 'chips' }: { items: string[]; selected: string; onSelect: (item: string) => void; compact?: boolean; variant?: 'chips' | 'tabs' }) {
  if (variant === 'tabs') {
    return (
      <View style={styles.filterTabs} accessibilityRole="tablist">
        {items.map((item) => {
          const active = selected === item;
          return (
            <Pressable
              key={item}
              onPress={() => onSelect(item)}
              style={[styles.filterTab, active && styles.filterTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.filterTabText, active && styles.filterTabTextActive]}>{item}</Text>
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
  assignmentTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  assignmentTab: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  assignmentTabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  assignmentTabText: { color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
  assignmentTabActiveText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '700' },
  scheduleStat: { flex: 1, minWidth: 0, alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.md, gap: 4 },
  scheduleStatIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scheduleStatLabel: { color: colors.muted, fontSize: typography.micro, fontWeight: '800', textAlign: 'center', textTransform: 'uppercase', minHeight: 24 },
  scheduleStatValue: { color: colors.brandDark, fontSize: typography.heading, fontWeight: '800' },
  scheduleStatUnit: { color: colors.muted, fontSize: typography.micro, fontWeight: '600' },
  weekNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, minHeight: 48 },
  studentWeekNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, borderColor: colors.brand, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: 5, minHeight: 42 },
  studentWeekArrow: { minHeight: 32, minWidth: 68, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderRadius: radius.sm, backgroundColor: '#F1F2F4' },
  studentWeekArrowText: { color: '#3F454D', fontSize: typography.micro, fontWeight: '800' },
  studentWeekCurrent: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  weekArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  weekArrowText: { fontSize: 28, lineHeight: 30, color: colors.brandDark, fontWeight: '700' },
  weekLabel: { color: colors.brandDark, fontSize: typography.caption, fontWeight: '700' },
  scheduleDays: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  scheduleDay: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  scheduleDaySelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  scheduleDayText: { color: colors.ink, fontSize: typography.micro, fontWeight: '700' },
  scheduleDayTextSelected: { color: '#FFFFFF' },
  scheduleSort: { alignSelf: 'flex-end', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  weeklyGridCard: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, overflow: 'hidden' },
  weeklyGridHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  weeklyGridHeadingCopy: { flex: 1, gap: 2 },
  weeklyGridTitle: { color: colors.ink, fontSize: typography.small, lineHeight: 19, fontWeight: '800' },
  diaryHeadingIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  diaryDescription: { color: colors.muted, fontSize: typography.caption, lineHeight: 15 },
  studentDiaryHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  weekCourseLabel: { gap: 2, paddingHorizontal: spacing.xs },
  weekCourseLabelCaption: { color: colors.muted, fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.4 },
  weekCourseLabelName: { color: colors.ink, fontSize: typography.micro, fontWeight: '700' },
  compactWeekGrid: { width: '100%', borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.line },
  compactWeekRow: { flexDirection: 'row' },
  compactWeekCell: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line },
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
  weekGridNameCell: { width: 132, minHeight: 60, justifyContent: 'center', gap: 3, paddingHorizontal: spacing.sm, borderRightWidth: 1, borderRightColor: colors.line, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  weekGridDayCell: { width: 96, minHeight: 60, justifyContent: 'center', alignItems: 'center', gap: 2, paddingHorizontal: spacing.xs, borderRightWidth: 1, borderRightColor: colors.line, borderBottomWidth: 1, borderBottomColor: colors.line },
  weekGridHeaderCell: { minHeight: 64, backgroundColor: colors.canvas },
  weekGridSortedCell: { backgroundColor: colors.brandSoft },
  weekGridHeaderText: { color: colors.ink, fontSize: typography.caption, fontWeight: '800', textAlign: 'center' },
  weekGridDate: { color: colors.muted, fontSize: typography.micro, fontWeight: '600' },
  weekGridTodayCell: { backgroundColor: colors.brandSoft },
  weekGridTodayText: { color: colors.brandDark },
  weekGridTodayColumn: { backgroundColor: '#FFF7F7' },
  weekGridSort: { minHeight: 28, justifyContent: 'center', paddingHorizontal: spacing.xs },
  weekGridSortText: { color: colors.brand, fontSize: typography.micro, fontWeight: '700' },
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
  scheduleSortText: { color: colors.brand, fontSize: typography.caption, fontWeight: '700' },
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
  compactChips: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: colors.line },
  compactChipsContent: { alignItems: 'stretch', gap: 14, paddingHorizontal: spacing.md },
  chip: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
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
  studentCard: { flexDirection: 'row', alignItems: 'flex-start' },
  studentListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  studentListMain: { flex: 1, minWidth: 0 },
  studentChatButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: colors.line, marginLeft: spacing.sm },
  studentDetail: { borderColor: colors.brand, backgroundColor: '#FBFEFE' },
  closeText: { color: colors.brand, fontWeight: '700', fontSize: typography.small },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  progressLabel: { color: colors.brandDark, fontSize: typography.caption, fontWeight: '800', minWidth: 34, textAlign: 'right' },
  classSummary: { flexDirection: 'row', alignItems: 'center' },
  summaryIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  attendanceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  attendanceSessionSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  attendanceDetail: { gap: spacing.md },
  makeupRequestCard: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldSoft },
  attendanceMain: { flex: 1, gap: spacing.sm },
  attendanceBackButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.canvas },
  attendanceOverview: { gap: spacing.md, paddingBottom: spacing.xl },
  attendanceStudentSummary: { gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md },
  attendanceStudentHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  attendanceStudentCopy: { flex: 1, minWidth: 0, gap: 2 },
  attendanceStudentName: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' },
  attendanceProgressTrack: { height: 8, overflow: 'hidden', borderRadius: radius.pill, backgroundColor: '#E8EEF4' },
  attendanceProgressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: '#2563EB' },
  attendanceProgressText: { color: '#94A3B8', fontSize: typography.micro, fontWeight: '800' },
  attendanceStatRow: { flexDirection: 'row', gap: spacing.xs },
  attendanceStatCard: { flex: 1, minWidth: 0, minHeight: 128, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, paddingVertical: spacing.sm, borderWidth: 1, borderRadius: radius.md, gap: 3 },
  attendanceStatBlue: { backgroundColor: '#F4F9FF', borderColor: '#D5E6FF' },
  attendanceStatGold: { backgroundColor: '#FFFCF2', borderColor: '#FDE9AE' },
  attendanceStatPurple: { backgroundColor: '#FCF8FF', borderColor: '#EBD8FF' },
  attendanceStatLabel: { color: colors.muted, fontSize: 9, fontWeight: '800', textAlign: 'center' },
  attendanceStatValue: { fontSize: 28, lineHeight: 34, fontWeight: '900' },
  attendanceStatFoot: { color: colors.muted, fontSize: 9, textAlign: 'center', fontWeight: '700' },
  attendanceStatSuffix: { fontSize: typography.micro, fontWeight: '800' },
  attendancePendingNotice: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: radius.md, backgroundColor: '#EFF6FF' },
  attendancePendingText: { flex: 1, color: '#1E3A8A', fontSize: typography.caption, lineHeight: 20, fontWeight: '600' },
  attendanceNoticeClose: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
  attendanceUndoButton: { minHeight: 48, flex: 1.15, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, borderRadius: radius.md, backgroundColor: '#DC2626' },
  attendanceUndoText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800', textAlign: 'center' },
  attendanceSubmittedRow: { flexDirection: 'row', gap: spacing.sm },
  attendanceWaitingButton: { minHeight: 48, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: '#F1F5F9' },
  attendanceWaitingText: { color: '#94A3B8', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  attendanceSessionNote: { color: colors.muted, fontSize: typography.caption, lineHeight: 18 },
  attendanceModalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md, backgroundColor: 'rgba(15, 23, 42, 0.62)' },
  attendanceModalCard: { width: '100%', maxWidth: 440, maxHeight: '90%', overflow: 'hidden', borderRadius: 30, backgroundColor: '#FFFFFF' },
  attendanceModalHeader: { minHeight: 92, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, backgroundColor: '#0DA76B' },
  attendanceModalIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)' },
  attendanceModalHeading: { flex: 1, minWidth: 0, gap: 3 },
  attendanceModalTitle: { color: '#FFFFFF', fontSize: typography.body, fontWeight: '900' },
  attendanceModalSubtitle: { color: '#D1FAE5', fontSize: typography.micro, fontWeight: '800', textTransform: 'uppercase' },
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
  profileSignOutButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderColor: colors.redSoft, borderRadius: radius.md, backgroundColor: colors.surface },
  profileSignOutButtonPressed: { backgroundColor: colors.redSoft },
  profileSignOutText: { color: colors.red, fontSize: typography.small, fontWeight: '800' },
  studentProfileSectionText: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  studentProfileChevronOpen: { transform: [{ rotate: '180deg' }] },
  studentProfileRows: { paddingVertical: 2 },
  studentProfileInfoRow: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9' },
  studentProfileInfoCopy: { flex: 1, minWidth: 0, gap: 2 },
  studentProfileLabel: { color: '#94A3B8', fontSize: typography.micro, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  studentProfileValue: { color: colors.ink, fontSize: typography.caption, lineHeight: 18, fontWeight: '600' },
  studentProfileCount: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.blueSoft, color: colors.blue, fontSize: typography.micro, fontWeight: '800' },
  studentCourseGrade: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  profileStats: { alignSelf: 'stretch', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  profileStat: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: radius.md, flex: 1, minWidth: 0, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  profileStatValue: { color: colors.ink, fontSize: typography.title, fontWeight: '700' },
  profileStatLabel: { color: colors.muted, fontSize: typography.small, textAlign: 'center' },
  profileCourse: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth },
  teacherProfileHero: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  teacherProfileEyebrow: { color: '#FEE2E2', fontSize: typography.caption, fontWeight: '800', letterSpacing: 1 },
  teacherProfileName: { color: '#FFFFFF', fontSize: typography.heading, fontWeight: '800', textAlign: 'center' },
  teacherProfileSubtitle: { color: '#FEE2E2', fontSize: typography.small, textAlign: 'center' },
  teacherProfileTags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs },
  teacherProfileStatus: { color: '#FFFFFF', fontSize: typography.caption, paddingVertical: 6, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#FCA5A5', borderRadius: radius.pill },
  teacherProfileTag: { color: colors.brandDark, fontSize: typography.caption, fontWeight: '700', paddingVertical: 6, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  teacherDetails: { gap: spacing.sm },
  teacherProfileField: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  teacherProfileLabel: { flex: 1, color: colors.muted, fontSize: typography.small },
  teacherProfileValue: { flex: 1, color: colors.ink, fontSize: typography.small, textAlign: 'right' },
  profileName: { color: colors.ink, fontSize: typography.heading, fontWeight: '800', marginTop: spacing.sm },
  cardTitle: { color: colors.ink, fontWeight: '700', fontSize: typography.body, lineHeight: 21 },
  profileInfo: { width: '100%', gap: spacing.lg, marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  infoValue: { color: colors.ink, fontSize: typography.small, fontWeight: '600' },
  menuCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, gap: spacing.md },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  formInput: { minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink, backgroundColor: colors.surface },
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
