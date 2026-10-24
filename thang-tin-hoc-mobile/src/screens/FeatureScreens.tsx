import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  BookOpen, CalendarDays, Check, Clock3, FileSpreadsheet, FileText, Film, GraduationCap, Link2,
  Eye, EyeOff, MapPin, MessageCircle, UserRound, Users, WalletCards,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../app/AuthContext';
import {
  AppHeader, AppScreen, AssignmentCard, Avatar, Card, EmptyState, ErrorState,
  LoadingSkeleton, MenuRow, PrimaryButton, ProgressBar, ScheduleCard, SearchField,
  SectionHeading, StatusBadge, uiStyles,
} from '../components/ui';
import { useMockResource } from '../hooks/useMockResource';
import {
  assignmentService, gradeService, learningService, materialService, notificationService, scheduleService, studentProfileService, studentService,
} from '../services/mockService';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';
import type { AppNotification, Assignment, DemoGradeRecord, DemoStudent, LearningMaterial, ScheduleItem } from '../types';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

function isOverdueAttendance(item: ScheduleItem) {
  if (!item.date || !item.attendanceStatus || item.attendanceStatus !== 'pending' || item.status === 'cancelled') return false;
  const times = item.time?.match(/(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/);
  if (!times) return false;
  const endAt = new Date(`${item.date}T${times[2]}:00+07:00`).getTime();
  return Number.isFinite(endAt) && Date.now() > endAt + 60 * 60 * 1000;
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
  const [selectedCourse, setSelectedCourse] = useState('Tất cả');
  const [showStudentNote, setShowStudentNote] = useState(false);
  const [studentNote, setStudentNote] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [classTime, setClassTime] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [classDate, setClassDate] = useState('');
  const loader = useCallback(() => scheduleService.list(isTeacher ? 'teacher' : 'student'), [isTeacher]);
  const resource = useMockResource(loader);
  const studentsLoader = useCallback(() => studentService.assigned(), []);
  const studentsResource = useMockResource(studentsLoader);
  const filters = isTeacher ? ['Tất cả', 'Đang học', 'Học xong'] : ['Tất cả', 'Hôm nay', 'Tuần này', 'Sắp tới'];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7) + (weekOffset * 7));
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })} – ${weekEnd.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;
  const weekDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return { dateKey, weekday: date.toLocaleDateString('vi-VN', { weekday: 'short' }), day: date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }) };
  });
  const today = new Date();
  const now = today;
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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
      if (selectedCourse !== 'Tất cả' && (item.courseName || item.title) !== selectedCourse) return false;
    }
    if (['Sắp tới', 'Tuần này'].includes(filter) && item.status !== 'upcoming') return false;
    if (filter === 'Hôm nay') return item.dateLabel === 'Hôm nay';
    return true;
  });
  const allScheduleItems = itemsOverride || resource.data || [];
  const studentCourses = ['Tất cả', ...new Set(allScheduleItems.map((item) => item.courseName || item.title).filter(Boolean))];
  const studentMonthItems = allScheduleItems.filter((item) => {
    if (!item.date) return false;
    const itemDate = new Date(`${item.date}T00:00:00`);
    return itemDate.getMonth() === new Date().getMonth() && itemDate.getFullYear() === new Date().getFullYear();
  });
  const learningLog = allScheduleItems;
  const studentDiaryItems = learningLog.filter((item) => {
    const date = item.date ? new Date(`${item.date}T00:00:00`) : null;
    if (studentDiaryFilter === 'Ngày' && (!date || date.toDateString() !== new Date().toDateString())) return false;
    if (studentDiaryFilter === 'Tuần' && (!date || date < weekStart || date > weekEnd)) return false;
    if (studentDiaryFilter === 'Tháng' && (!date || date.getMonth() !== new Date().getMonth() || date.getFullYear() !== new Date().getFullYear())) return false;
    if (studentDiaryFilter === 'Chưa điểm danh' && item.attendanceStatus !== 'pending') return false;
    if (studentDiaryFilter === 'Lịch hủy' && item.status !== 'cancelled') return false;
    return true;
  }).sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));
  const teacherMonthItems = allScheduleItems.filter((item) => item.date && new Date(`${item.date}T00:00:00`).getMonth() === new Date().getMonth() && new Date(`${item.date}T00:00:00`).getFullYear() === new Date().getFullYear());
  const teacherScheduleItems = isTeacher ? scheduleItems
    .filter((item) => !teacherQuery.trim() || `${item.studentName || ''} ${item.title}`.toLocaleLowerCase('vi-VN').includes(teacherQuery.trim().toLocaleLowerCase('vi-VN')))
    : scheduleItems;
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
  const selectedItem = teacherScheduleItems.find((item) => item.id === selectedId);
  const toggleDaySort = (dayIndex: number) => {
    setGridSort((current) => current.kind === 'day' && current.dayIndex === dayIndex
      ? current.dir === 'asc'
        ? { kind: 'day', dir: 'desc', dayIndex }
        : { kind: 'name', dir: 'asc', dayIndex: 0 }
      : { kind: 'day', dir: 'asc', dayIndex });
  };
  const selectSlot = (startTime: string | null) => {
    if (!selectedStudentId || !selectedStudent || !classDate) return;
    const current = itemsOverride || resource.data || [];
    const currentSlot = current.find((item) => item.id === selectedId);
    if (!startTime) {
      if (currentSlot) setItemsOverride(current.map((item) => item.id === currentSlot.id ? { ...item, status: 'cancelled' } : item));
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
  };

  return (
    <AppScreen>
      <AppHeader
        title={isTeacher ? 'Quản lý Lịch dạy & Điểm danh' : 'Lịch học'}
        subtitle={isTeacher ? 'Xếp lịch theo tuần và xem nhật ký giảng dạy' : 'Theo dõi các buổi học của bạn'}
      />
      {!isTeacher && resource.loading ? <LoadingSkeleton rows={1} /> : null}
      {!isTeacher && !resource.loading ? (
        <>
          <View style={styles.scheduleStats}>
            {[
              { label: 'Đã học tháng này', value: studentMonthItems.filter((item) => item.status === 'completed').length },
              { label: 'Buổi sắp tới', value: studentMonthItems.filter((item) => item.status === 'upcoming').length },
              { label: 'Đã hủy', value: studentMonthItems.filter((item) => item.status === 'cancelled').length },
            ].map((stat) => (
              <Card key={stat.label} style={styles.scheduleStat}>
                <Text style={styles.scheduleStatValue}>{stat.value}</Text>
                <Text style={styles.metaText}>{stat.label}</Text>
              </Card>
            ))}
          </View>
          <Card style={styles.weeklyGridCard}>
            <SectionHeading title="Lịch học theo tuần" />
            <Text style={styles.metaText}>Chỉ xem các ca đã xếp. Chọn buổi để xem chi tiết hoặc ghi chú.</Text>
            <View style={styles.weekNavigator}>
              <Pressable onPress={() => setWeekOffset((value) => value - 1)} style={styles.weekArrow} accessibilityRole="button" accessibilityLabel="Tuần trước"><Text style={styles.weekArrowText}>‹</Text></Pressable>
              <Pressable onPress={() => setWeekOffset(0)} accessibilityRole="button" accessibilityLabel="Về tuần hiện tại"><Text style={styles.weekLabel}>{weekLabel}</Text></Pressable>
              <Pressable onPress={() => setWeekOffset((value) => value + 1)} style={styles.weekArrow} accessibilityRole="button" accessibilityLabel="Tuần sau"><Text style={styles.weekArrowText}>›</Text></Pressable>
            </View>
            <FilterChips items={studentCourses} selected={selectedCourse} onSelect={setSelectedCourse} />
            <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={styles.weekGridContent}>
              <View>
                <View style={styles.weekGridHeader}>
                  <View style={[styles.weekGridNameCell, styles.weekGridHeaderCell]}><Text style={styles.weekGridHeaderText}>Khóa học</Text></View>
                  {weekDays.map((day) => (
                    <View key={day.dateKey} style={[styles.weekGridDayCell, styles.weekGridHeaderCell]}>
                      <Text style={styles.weekGridHeaderText}>{day.weekday}</Text>
                      <Text style={styles.weekGridDate}>{day.day}</Text>
                    </View>
                  ))}
                </View>
                {[...new Set(scheduleItems.map((item) => item.courseName || item.title))].map((courseName) => (
                  <View key={courseName} style={styles.weekGridRow}>
                    <View style={styles.weekGridNameCell}><Text numberOfLines={3} style={styles.weekGridStudentName}>{courseName}</Text></View>
                    {weekDays.map((day) => {
                      const item = scheduleItems.find((scheduled) => scheduled.date === day.dateKey && (scheduled.courseName || scheduled.title) === courseName);
                      return item ? (
                        <Pressable key={day.dateKey} onPress={() => setSelectedId(item.id)} style={[styles.weekGridDayCell, styles.weekGridSlotCell, styles.weekGridBookedCell]} accessibilityRole="button" accessibilityLabel={`${courseName}, ${day.weekday} ${day.day}, ${item.time}`}>
                          <Text numberOfLines={2} style={styles.weekGridBookedText}>{item.time}</Text>
                          <Text numberOfLines={1} style={styles.weekGridStatus}>{item.status === 'completed' ? 'Đã học' : item.status === 'cancelled' ? 'Đã hủy' : 'Đã xếp'}</Text>
                        </Pressable>
                      ) : <View key={day.dateKey} style={[styles.weekGridDayCell, styles.weekGridSlotCell]}><Text style={styles.metaText}>—</Text></View>;
                    })}
                  </View>
                ))}
                {!scheduleItems.length ? <Text style={styles.muted}>Không có lịch trong tuần này.</Text> : null}
              </View>
            </ScrollView>
          </Card>
          <FilterChips items={filters} selected={filter} onSelect={setFilter} />
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
      {!isTeacher ? <FilterChips items={filters} selected={filter} onSelect={setFilter} /> : null}
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!isTeacher && !resource.loading && !resource.error && !teacherScheduleItems.length ? <EmptyState title="Chưa có lịch học" message="Lịch mới sẽ xuất hiện tại đây." /> : null}
      {!isTeacher && !resource.loading && !resource.error && teacherScheduleItems.map((item) => (
          <Pressable key={item.id} onPress={() => setSelectedId(item.id)} accessibilityRole="button" accessibilityLabel={`Chi tiết ${item.title}`}>
            <ScheduleCard item={item} />
          </Pressable>
      ))}
      {!isTeacher && !resource.loading && !resource.error ? (
        <View style={styles.group}>
          <SectionHeading title="Nhật ký học tập" />
          <FilterChips items={['Tất cả', 'Ngày', 'Tuần', 'Tháng', 'Chưa điểm danh', 'Lịch hủy']} selected={studentDiaryFilter} onSelect={setStudentDiaryFilter} />
          {studentDiaryItems.map((item) => (
            <Card key={`log-${item.id}`} style={styles.learningLogRow}>
              <View style={styles.summaryIcon}><Check size={18} color={colors.green} /></View>
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.metaText}>{item.dateLabel || item.date || '—'} · {item.time || '—'}</Text>
                <Text style={styles.metaText}>Giảng viên: {item.person || '—'} · {item.status === 'cancelled' ? 'Đã hủy' : item.attendanceStatus === 'present' ? 'Có mặt' : item.attendanceStatus === 'late' ? 'Đi trễ' : item.attendanceStatus === 'absent' ? 'Vắng' : item.attendanceStatus === 'excused' ? 'Có phép' : item.status === 'completed' ? 'Đã hoàn thành' : 'Chưa điểm danh'}</Text>
                {item.grade != null ? <Text style={styles.metaText}>Điểm: {item.grade}/10</Text> : null}
                {item.note ? <Text style={styles.metaText}>Ghi chú: {item.note}</Text> : null}
              </View>
            </Card>
          ))}
          {!studentDiaryItems.length ? <EmptyState title="Chưa có nhật ký học tập" message="Không có buổi học phù hợp với bộ lọc đã chọn." /> : null}
        </View>
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
                <Text style={styles.metaText}>Trạng thái: {item.status === 'cancelled' ? 'Đã hủy' : item.attendanceStatus === 'pending' || !item.attendanceStatus ? 'Chưa điểm danh' : item.attendanceStatus === 'present' ? 'Có mặt' : item.attendanceStatus === 'late' ? 'Đi trễ' : item.attendanceStatus === 'absent' ? 'Vắng' : 'Có phép'}</Text>
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
          <PrimaryButton
            title={selectedItem.confirmedByStudent ? 'Đã xác nhận tham gia' : 'Xác nhận tham gia'}
            variant="secondary"
            disabled={selectedItem.confirmedByStudent}
            onPress={() => setItemsOverride((itemsOverride || resource.data || []).map((item) => item.id === selectedItem.id ? { ...item, confirmedByStudent: true } : item))}
          />
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
              <PrimaryButton title="Gửi Ghi Chú" disabled={!studentNote.trim()} onPress={() => {
                if (!selectedItem) return;
                setItemsOverride((itemsOverride || resource.data || []).map((item) => item.id === selectedItem.id ? { ...item, note: studentNote.trim() } : item));
                setShowStudentNote(false);
                Alert.alert('Bản demo', 'Ghi chú chỉ được lưu trong giao diện hiện tại, chưa gửi tới giảng viên.');
              }} />
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
                <Text style={styles.metaText}>{selectedStudent?.name || 'Học viên'} · {selectedStudent?.course || '—'} · {classDate}</Text>
                <Text style={styles.metaText}>Ca 90 phút · chọn giờ để cập nhật lịch demo trên thiết bị này.</Text>
              </View>
              <Pressable onPress={() => setShowCreate(false)} accessibilityRole="button" accessibilityLabel="Đóng chọn khung giờ">
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
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
                  <Pressable key={option.start} disabled={unavailable} onPress={() => selectSlot(option.start)} style={[styles.slotOption, classTime === option.start && styles.slotOptionSelected, unavailable && styles.slotOptionDisabled]} accessibilityRole="button" accessibilityState={{ selected: classTime === option.start, disabled: unavailable }}>
                    <Text style={[styles.slotOptionText, classTime === option.start && styles.slotOptionTextSelected, unavailable && styles.slotOptionTextDisabled]}>{option.label}{unavailable ? ` · ${unavailableReason}` : ''}</Text>
                  </Pressable>
                );
              })}
              {selectedId ? <Pressable onPress={() => selectSlot(null)} style={styles.clearSlotAction} accessibilityRole="button"><Text style={styles.clearSlotActionText}>Bỏ ca khỏi lịch</Text></Pressable> : null}
            </ScrollView>
            <PrimaryButton title="Đóng" variant="quiet" onPress={() => setShowCreate(false)} />
          </View>
        </View>
      </Modal>
      <Card style={styles.noticeCard}>
        <CalendarDays size={19} color={colors.brand} />
        <Text style={styles.muted}>Lịch hiển thị chỉ là dữ liệu demo; các thay đổi không đồng bộ với trung tâm.</Text>
      </Card>
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
  const [submissionFile, setSubmissionFile] = useState<string | null>(null);
  const [filePickerVisible, setFilePickerVisible] = useState(false);
  const [localSubmittedIds, setLocalSubmittedIds] = useState<string[]>([]);
  const loader = useCallback(() => assignmentService.list(isTeacher ? 'teacher' : 'student'), [isTeacher]);
  const resource = useMockResource(loader);
  const studentsLoader = useCallback(() => studentService.assigned(), []);
  const studentsResource = useMockResource(studentsLoader);
  const allItems = overrides || resource.data || [];
  const teacherStudents = studentsResource.data || [];
  const courses = [...new Set(teacherStudents.map((student) => student.course).filter(Boolean))];
  const courseStudents = teacherStudents.filter((student) => !course || student.course === course);
  const items = useMemo(() => allItems.filter((item) => (
    filter === 'Tất cả'
    || (filter === 'Chờ xử lý' && ['Chưa làm', 'Cần chấm'].includes(item.status))
    || item.status === filter
  )), [allItems, filter]);
  const filters = isTeacher
    ? ['Tất cả', 'Cần chấm', 'Đã nộp']
    : ['Tất cả', 'Chưa làm', 'Đã nộp', 'Quá hạn'];
  const saveGrade = () => {
    if (!selected || grade === '' || Number(grade) < 0 || Number(grade) > 10) {
      Alert.alert('Điểm chưa hợp lệ', 'Nhập điểm từ 0 đến 10.');
      return;
    }
    const updated = allItems.map((item) => item.id === selected.id
      ? { ...item, status: 'Đã chấm' as const, grade: Number(grade), teacherFeedback: feedback.trim() }
      : item);
    setOverrides(updated);
    setSelected(null);
    setGrade('');
    setFeedback('');
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
      <FilterChips items={filters} selected={filter} onSelect={setFilter} />
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
          onPress={() => { setSelected(item); setSubmissionFile(null); }}
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
            <Pressable onPress={() => Alert.alert('Tệp đề bài demo', selected.attachedFileUrl ? `Liên kết mẫu: ${selected.attachedFileUrl}` : selected.attachedFileName || '—')} style={styles.fileLinkRow} accessibilityRole="button" accessibilityLabel="Mở tệp đề bài">
              <FileText size={18} color={colors.brand} /><Text style={styles.fileLinkText}>{selected.attachedFileName || 'Tệp đề bài'}</Text><Text style={styles.fileLinkAction}>Mở</Text>
            </Pressable>
          ) : null}
          {selected.assignedStudentNames?.length ? <Text style={styles.metaText}>Học viên được giao: {selected.assignedStudentNames.join(', ')}</Text> : null}
          {isTeacher ? (
            <>
              <SectionHeading title={`Bài nộp (${selected.submissions?.length || 0})`} />
              {(selected.submissions || []).map((submission) => (
                <Card key={submission.id} style={styles.submissionCard}>
                  <Text style={styles.cardTitle}>{submission.studentName}</Text>
                  <Text style={styles.metaText}>{submission.submittedAt}</Text>
                  <Pressable onPress={() => Alert.alert('Tệp bài nộp demo', submission.submittedFileUrl ? `Mở tệp mẫu: ${submission.submittedFileUrl}` : 'Không có tệp đính kèm.')} style={styles.fileLinkRow} accessibilityRole="button" accessibilityLabel={`Mở tệp ${submission.submittedFileUrl || 'bài nộp'}`}>
                    <FileText size={18} color={colors.brand} />
                    <Text style={styles.fileLinkText}>{submission.submittedFileUrl || 'Không có file'}</Text>
                    <Text style={styles.fileLinkAction}>Mở</Text>
                  </Pressable>
                  {submission.grade != null ? <Text style={styles.metaText}>Điểm: {submission.grade}/10 · {submission.teacherFeedback || ''}</Text> : null}
                </Card>
              ))}
              <Text style={styles.fieldLabel}>Điểm (0–10)</Text>
              <TextInput value={grade} onChangeText={setGrade} keyboardType="decimal-pad" placeholder="Nhập điểm" style={styles.formInput} accessibilityLabel="Điểm bài tập demo" />
              <TextInput value={feedback} onChangeText={setFeedback} placeholder="Nhận xét / chữa bài" multiline style={[styles.formInput, styles.formTextarea]} accessibilityLabel="Nhận xét bài tập demo" />
              <PrimaryButton title="Lưu điểm demo" onPress={saveGrade} />
            </>
          ) : (
            <>
              {selected.grade != null ? <Text style={styles.metaText}>Điểm: {selected.grade}/10 · {selected.teacherFeedback || ''}</Text> : null}
              {submissionFile ? (
                <View style={styles.fileSelection}>
                  <FileText size={18} color={colors.brand} />
                  <Text numberOfLines={1} style={styles.flex}>{submissionFile}</Text>
                  {!localSubmittedIds.includes(selected.id) ? <Pressable onPress={() => { setSubmissionFile(null); setLocalSubmittedIds((current) => current.filter((id) => id !== selected.id)); }} accessibilityRole="button" accessibilityLabel="Bỏ tệp đã chọn"><Text style={styles.fileLinkAction}>Bỏ</Text></Pressable> : null}
                </View>
              ) : null}
              <PrimaryButton title={submissionFile ? 'Đổi tệp' : 'Chọn tệp nộp bài'} variant="secondary" disabled={localSubmittedIds.includes(selected.id) || selected.status === 'Đã nộp' || selected.status === 'Đã chấm'} onPress={() => setFilePickerVisible(true)} />
              <PrimaryButton
                title={selected.status === 'Đã nộp' || selected.status === 'Đã chấm' || localSubmittedIds.includes(selected.id) ? 'Đã nộp bài demo' : 'Nộp bài demo'}
                disabled={!submissionFile || selected.status === 'Đã nộp' || selected.status === 'Đã chấm' || localSubmittedIds.includes(selected.id)}
                onPress={() => {
                  const updated = allItems.map((item) => item.id === selected.id ? { ...item, status: 'Đã nộp' as const } : item);
                  setOverrides(updated);
                  setSelected({ ...selected, status: 'Đã nộp' });
                  setLocalSubmittedIds((current) => [...current, selected.id]);
                }}
              />
              <Text style={styles.note}>Chọn tệp mẫu và nộp để xem trạng thái demo. Không upload tệp.</Text>
            </>
          )}
        </Card>
      ) : null}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Tạo bài tập demo</Text>
            <TextInput value={title} onChangeText={setTitle} placeholder="Tên bài tập" style={styles.formInput} />
            <TextInput value={description} onChangeText={setDescription} placeholder="Mô tả / yêu cầu" multiline style={[styles.formInput, styles.formTextarea]} />
            <Text style={styles.fieldLabel}>Link File đề bài (Google Drive...)</Text>
            <TextInput value={attachedFileUrl} onChangeText={setAttachedFileUrl} placeholder="https://..." autoCapitalize="none" keyboardType="url" style={styles.formInput} accessibilityLabel="Link File đề bài Google Drive" />
            {attachedFileUrl.trim() ? <Pressable onPress={() => Alert.alert('Liên kết demo', attachedFileUrl.trim())} style={styles.fileLinkRow} accessibilityRole="button"><Link2 size={17} color={colors.brand} /><Text numberOfLines={1} style={styles.fileLinkText}>Xem trước liên kết</Text></Pressable> : null}
            <Text style={styles.fieldLabel}>Khóa học</Text>
            {studentsResource.loading ? <Text style={styles.note}>Đang tải khóa học demo…</Text> : null}
            {studentsResource.error ? <Text style={styles.note}>Không tải được khóa học demo: {studentsResource.error}</Text> : null}
            {courses.length ? (
              <View style={styles.choiceWrap}>
                {courses.map((courseOption) => <Pressable key={courseOption} onPress={() => { setCourse(courseOption); setAssignedStudentIds([]); }} style={[styles.choice, course === courseOption && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: course === courseOption }}><Text style={[styles.choiceText, course === courseOption && styles.choiceTextActive]}>{courseOption}</Text></Pressable>)}
              </View>
            ) : <Text style={styles.note}>Chưa có khóa học trong dữ liệu demo.</Text>}
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
            <Text style={styles.note}>Đính kèm tệp và giao bài thật vẫn thực hiện trên website; bản mobile không upload hoặc gửi bài.</Text>
            <PrimaryButton title="Thêm bài tập demo" onPress={() => {
              if (!title.trim()) {
                Alert.alert('Thiếu thông tin', 'Nhập tên bài tập.');
                return;
              }
              if (courses.length && !course) {
                Alert.alert('Chưa chọn khóa học', 'Chọn khóa học trước khi tạo bài tập demo.');
                return;
              }
              if (!assignToAll && !assignedStudentIds.length) {
                Alert.alert('Chưa chọn học viên', 'Chọn ít nhất một học viên hoặc giao cho cả lớp.');
                return;
              }
              const parsedDeadline = deadline.trim() ? new Date(`${deadline.trim()}T23:59:59`).getTime() : null;
              if (deadline.trim() && (!/^\d{4}-\d{2}-\d{2}$/.test(deadline.trim()) || parsedDeadline === null || !Number.isFinite(parsedDeadline) || parsedDeadline <= Date.now())) {
                Alert.alert('Hạn nộp chưa hợp lệ', 'Nhập ngày hợp lệ trong tương lai theo định dạng YYYY-MM-DD.');
                return;
              }
              const assignedStudents = assignToAll ? courseStudents : courseStudents.filter((student) => assignedStudentIds.includes(student.id));
              setOverrides([{
                id: `task-${Date.now()}`, title: title.trim(), subject: course || user?.course || 'Khóa học',
                teacher: user?.name || 'Giảng viên', deadline: deadline.trim() || '—',
                status: 'Chưa làm', description: description.trim(), attachedFileUrl: attachedFileUrl.trim() || undefined, assignedStudentNames: assignedStudents.map((student) => student.name),
              }, ...allItems]);
              setTitle('');
              setDescription('');
              setAttachedFileUrl('');
              setDeadline('');
              setCourse('');
              setAssignToAll(true);
              setAssignedStudentIds([]);
              setShowCreate(false);
            }} />
            <PrimaryButton title="Đóng" variant="quiet" onPress={() => setShowCreate(false)} />
          </View>
        </View>
      </Modal>
      <Modal visible={filePickerVisible} transparent animationType="slide" onRequestClose={() => setFilePickerVisible(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard}>
          <View style={styles.rowBetween}><Text style={styles.cardTitle}>Chọn tệp mẫu để nộp</Text><Pressable onPress={() => setFilePickerVisible(false)} accessibilityRole="button"><Text style={styles.closeText}>Đóng</Text></Pressable></View>
          {['Bai-lam-Excel-demo.xlsx', 'Bai-tap-Word-demo.docx', 'Anh-bai-lam-demo.jpg'].map((file) => <Pressable key={file} style={styles.filePickerOption} onPress={() => { setSubmissionFile(file); setFilePickerVisible(false); }} accessibilityRole="button"><FileText size={18} color={colors.brand} /><Text style={styles.flex}>{file}</Text><Text style={styles.fileLinkAction}>Chọn</Text></Pressable>)}
          <Text style={styles.note}>Chỉ chọn tệp mẫu cục bộ; không truy cập thư viện thiết bị hoặc tải tệp lên.</Text>
        </View></View>
      </Modal>
      <Text style={styles.footnote}>Không upload, nộp bài hoặc chấm điểm thật trong bản demo.</Text>
    </AppScreen>
  );
}

export function MaterialsScreen() {
  const navigation = useNavigation<Navigation>();
  const loader = useCallback(() => materialService.list(), []);
  const resource = useMockResource(loader);
  const [tab, setTab] = useState('Tài liệu');
  const materials = resource.data || [];
  const visibleMaterials = materials.filter((item) => tab === 'Video' ? item.type === 'VIDEO' : item.type !== 'VIDEO');
  return (
    <AppScreen>
      <AppHeader
        title="Tài liệu học tập"
        subtitle="Tài nguyên từ các lớp của bạn"
      />
      <FilterChips
        items={['Tài liệu', 'Video', 'Bài tập', 'Trắc nghiệm', 'Đánh giá', 'Phần mềm']}
        selected={tab}
        onSelect={(value) => {
          if (value === 'Bài tập') { navigation.navigate('Assignments'); return; }
          if (value === 'Trắc nghiệm') { navigation.navigate('StudentExam'); return; }
          if (value === 'Đánh giá') { navigation.navigate('Evaluations'); return; }
          if (value === 'Phần mềm') { navigation.navigate('SoftwareLinks'); return; }
          setTab(value);
        }}
      />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && !visibleMaterials.length ? <EmptyState title={tab === 'Video' ? 'Chưa có video học tập' : 'Chưa có tài liệu'} message="Nội dung mới sẽ được hiển thị tại đây." /> : null}
      {!resource.loading && !resource.error && visibleMaterials.map((item) => (
        <MaterialRow key={item.id} item={item} />
      ))}
      <Text style={styles.footnote}>Nút mở tài liệu chỉ minh họa giao diện, không tải file.</Text>
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
    <Pressable
      onPress={() => Alert.alert('Tài liệu demo', 'Chức năng mở/tải tài liệu chưa được kết nối.')}
      accessibilityRole="button"
    >
      <Card style={styles.materialRow}>
        <View style={styles.fileIcon}>{iconMap[item.type]}</View>
        <View style={styles.rowCopy}>
          <View style={styles.rowBetween}>
            <Text style={styles.fileType}>{item.type}</Text>
            <Text style={styles.metaText}>{item.size}</Text>
          </View>
          <Text style={styles.cardTitle}>{item.title}</Text>
          <Text style={styles.metaText}>{item.subject}  ·  {item.date}</Text>
        </View>
      </Card>
    </Pressable>
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

export function NotificationsScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const loader = useCallback(() => notificationService.list(user?.role === 'teacher' ? 'teacher' : 'student'), [user?.role]);
  const resource = useMockResource(loader);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [filter, setFilter] = useState('Tất cả');
  const [category, setCategory] = useState('Tất cả');
  const [page, setPage] = useState(1);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [routeMessage, setRouteMessage] = useState('');
  const notifications = (resource.data || []).filter((item) => !hiddenIds.includes(item.id));
  const webCategories = ['Hệ thống', 'Khóa học', 'Tài chính', 'Lịch dạy', 'Thi', 'Đánh giá', 'Tin nhắn', 'Admin', 'Tin tức', 'Đào tạo', 'Thông báo'];
  const categories = ['Tất cả', ...new Set([...webCategories, ...notifications.map(notificationCategory)])];
  const categoryItems = notifications.filter((item) => category === 'Tất cả' || notificationCategory(item) === category);
  const matchingItems = categoryItems.filter((item) => {
    const isUnread = item.unread && !readIds.includes(item.id);
    return filter === 'Tất cả' || (filter === 'Chưa đọc' ? isUnread : !isUnread);
  });
  const pageCount = Math.max(1, Math.ceil(matchingItems.length / 20));
  const currentPage = Math.min(page, pageCount);
  const pageItems = matchingItems.slice((currentPage - 1) * 20, currentPage * 20);
  const visibleUnread = pageItems.filter((item) => item.unread && !readIds.includes(item.id));
  const visibleRead = pageItems.filter((item) => !item.unread || readIds.includes(item.id));

  const markAll = () => setReadIds((current) => [...new Set([...current, ...notifications.map((item) => item.id)])]);
  const toggle = (id: string) => setReadIds((current) => (
    current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  ));
  const openRelated = (item: AppNotification) => {
    const type = String(item.type || item.payload?.type || item.category).trim().toUpperCase();
    const path = String(item.targetPath || '').toLowerCase();
    const target = path.includes('inbox') || type === 'MESSAGE'
      ? { tab: 'Messages' as const }
      : path.includes('schedule') || type === 'SCHEDULE' || notificationCategory(item) === 'Lịch dạy'
        ? { tab: 'Schedule' as const }
        : path.includes('assignment') || type === 'ASSIGNMENT' || item.category === 'Bài tập'
          ? { screen: 'Assignments' as const }
          : path.includes('finance') || type === 'FINANCE' || notificationCategory(item) === 'Tài chính'
            ? user?.role === 'teacher' ? { screen: 'TeacherFinance' as const } : { screen: 'Tuition' as const }
            : path.includes('exam') || type === 'EXAM'
              ? user?.role === 'student' ? { screen: 'StudentExam' as const } : { screen: 'TeacherQuizzes' as const }
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
      setRouteMessage('Chưa có màn hình mobile phù hợp cho loại thông báo này. Chi tiết vẫn được giữ để xem.');
      return;
    }
    setSelectedNotification(null);
    setRouteMessage('');
    if ('tab' in target) navigation.navigate('MainTabs', target.tab === 'Messages' ? { screen: 'Messages' } : { screen: 'Schedule' });
    else navigation.navigate(target.screen);
  };
  const hideNotification = (id: string) => {
    setHiddenIds((current) => [...current, id]);
    if (selectedNotification?.id === id) setSelectedNotification(null);
  };

  return (
    <AppScreen>
      <AppHeader
        title="Thông báo"
        subtitle={`${notifications.filter((item) => item.unread && !readIds.includes(item.id)).length} chưa đọc · ${notifications.length} tổng cộng`}
        right={<View style={styles.headerActions}>
          <Pressable onPress={resource.reload} style={styles.readAll} accessibilityRole="button" accessibilityLabel="Làm mới thông báo">
            <Text style={styles.readAllText}>Làm mới</Text>
          </Pressable>
          {notifications.some((item) => item.unread && !readIds.includes(item.id)) ? (
            <Pressable onPress={markAll} style={styles.readAll} accessibilityRole="button">
              <Text style={styles.readAllText}>Đọc tất cả</Text>
            </Pressable>
          ) : null}
        </View>}
      />
      <FilterChips items={['Tất cả', 'Chưa đọc', 'Đã đọc']} selected={filter} onSelect={(value) => { setFilter(value); setPage(1); }} />
      <FilterChips items={categories} selected={category} onSelect={(value) => { setCategory(value); setPage(1); }} />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && !notifications.length ? <EmptyState title="Bạn đã cập nhật!" message="Thông báo mới sẽ được hiển thị tại đây." /> : null}
      {selectedNotification ? (
        <Card style={styles.studentDetail}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{selectedNotification.title}</Text>
            <Pressable onPress={() => setSelectedNotification(null)} accessibilityRole="button" accessibilityLabel="Đóng chi tiết thông báo">
              <Text style={styles.closeText}>Đóng</Text>
            </Pressable>
          </View>
          <Text style={styles.metaText}>{selectedNotification.category} · {selectedNotification.time}</Text>
          <Text style={styles.muted}>{selectedNotification.message}</Text>
          {routeMessage ? <Text style={styles.notificationRouteNote}>{routeMessage}</Text> : null}
          {selectedNotification.unread && !readIds.includes(selectedNotification.id) ? (
            <PrimaryButton title="Đánh dấu đã đọc" variant="secondary" onPress={() => {
              toggle(selectedNotification.id);
              setSelectedNotification({ ...selectedNotification, unread: false });
            }} />
          ) : null}
          <View style={styles.modalActions}>
            <PrimaryButton title="Ẩn thông báo" variant="quiet" onPress={() => hideNotification(selectedNotification.id)} />
            <PrimaryButton title="Mở mục liên quan" variant="secondary" onPress={() => openRelated(selectedNotification)} />
          </View>
        </Card>
      ) : null}
      {visibleUnread.length ? (
        <View style={styles.group}>
          <SectionHeading title="Mới" />
          {visibleUnread.map((item) => <NotificationCard key={item.id} item={item} onPress={() => { setSelectedNotification(item); setRouteMessage(''); toggle(item.id); }} onDismiss={() => hideNotification(item.id)} />)}
        </View>
      ) : null}
      {visibleRead.length ? (
        <View style={styles.group}>
          <SectionHeading title="Trước đó" />
          {visibleRead.map((item) => <NotificationCard key={item.id} item={item} onPress={() => { setSelectedNotification(item); setRouteMessage(''); }} onDismiss={() => hideNotification(item.id)} />)}
        </View>
      ) : null}
      {!resource.loading && !resource.error && notifications.length > 0 && !visibleUnread.length && !visibleRead.length ? <EmptyState title="Không có thông báo" message="Không có thông báo trong bộ lọc đã chọn." /> : null}
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
    </AppScreen>
  );
}

function NotificationCard({ item, onPress, onDismiss }: { item: AppNotification; onPress: () => void; onDismiss: () => void }) {
  const tint = item.category === 'Bài tập' ? colors.goldSoft : item.category === 'Tin nhắn' ? colors.purpleSoft : colors.brandSoft;
  return (
    <View style={styles.notificationRow}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${item.title}, ${item.unread ? 'chưa đọc' : 'đã đọc'}`} style={styles.notificationMain}>
        <Card style={styles.notificationCard}>
          <View style={[styles.noticeIcon, { backgroundColor: tint }]}><BookOpen size={17} color={colors.brandDark} /></View>
          <View style={styles.rowCopy}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {!item.unread ? <Check size={15} color={colors.green} /> : null}
            </View>
            <Text style={styles.muted}>{item.message}</Text>
            <Text style={styles.metaText}>{item.category}  ·  {item.time}</Text>
          </View>
          {item.unread ? <View style={styles.unreadDot} /> : null}
        </Card>
      </Pressable>
      <Pressable onPress={onDismiss} style={styles.notificationDismiss} accessibilityRole="button" accessibilityLabel={`Ẩn ${item.title}`}>
        <Text style={styles.closeText}>Ẩn</Text>
      </Pressable>
    </View>
  );
}

export function StudentsScreen() {
  const navigation = useNavigation<Navigation>();
  const loader = useCallback(() => studentService.assigned(), []);
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
  const navigation = useNavigation<Navigation>();
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [savedAttendance, setSavedAttendance] = useState<Record<string, string>>({});
  const [makeupRequestIds, setMakeupRequestIds] = useState<string[]>([]);
  const [makeupModalVisible, setMakeupModalVisible] = useState(false);
  const route = useRoute<RouteProp<AppStackParamList, 'Attendance'>>();
  const scheduleLoader = useCallback(() => scheduleService.list('teacher'), []);
  const scheduleResource = useMockResource(scheduleLoader);
  const studentsLoader = useCallback(() => studentService.assigned(), []);
  const studentsResource = useMockResource(studentsLoader);
  const choices = ['Có mặt', 'Vắng', 'Đi trễ', 'Có phép'];
  const sessions = (scheduleResource.data || []).filter((item) => item.attendanceStatus === 'pending' && item.status !== 'cancelled');
  const selectedSession = sessions.find((item) => item.id === route.params?.scheduleId) || sessions[0];
  const selectedStudent = studentsResource.data?.find((student) => student.id === selectedSession?.studentId);
  const selectedSessionOverdue = selectedSession ? isOverdueAttendance(selectedSession) : false;
  const makeupAlreadyRequested = Boolean(selectedSession && makeupRequestIds.includes(selectedSession.id));

  return (
    <AppScreen>
      <AppHeader title="Điểm danh" subtitle="Chọn buổi dạy chưa điểm danh" />
      {scheduleResource.loading || studentsResource.loading ? <LoadingSkeleton rows={2} /> : null}
      {scheduleResource.error ? <ErrorState onRetry={scheduleResource.reload} /> : null}
      {studentsResource.error ? <ErrorState onRetry={studentsResource.reload} /> : null}
      {!scheduleResource.loading && !scheduleResource.error && !sessions.length ? <EmptyState title="Không có buổi cần điểm danh" message="Các buổi chưa điểm danh sẽ hiển thị tại đây." /> : null}
      {!scheduleResource.loading && !scheduleResource.error && sessions.map((item) => (
        <Pressable key={item.id} onPress={() => navigation.setParams({ scheduleId: item.id })} accessibilityRole="button" accessibilityState={{ selected: item.id === selectedSession?.id }}>
          <Card style={item.id === selectedSession?.id ? styles.attendanceSessionSelected : undefined}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{item.studentName || 'Học viên'}</Text>
              <StatusBadge label={savedAttendance[item.id] || (isOverdueAttendance(item) ? 'Quá hạn điểm danh' : 'Chưa điểm danh')} />
            </View>
            <Text style={styles.metaText}>{item.title} · {item.dateLabel || item.date || '—'} · {item.time || '—'}</Text>
            <Text style={styles.metaText}>{item.location || '—'}</Text>
          </Card>
        </Pressable>
      ))}
      {selectedSession && selectedStudent ? (
        <Card style={styles.attendanceDetail}>
          <View style={styles.rowBetween}>
            <Avatar name={selectedStudent.name} color={selectedStudent.color} size={42} />
            <View style={styles.attendanceMain}>
              <Text style={styles.cardTitle}>{selectedStudent.name}</Text>
              <Text style={styles.metaText}>{selectedStudent.course}</Text>
              <Text style={styles.metaText}>{selectedSession.dateLabel || selectedSession.date || '—'} · {selectedSession.time || '—'} · {selectedSession.location || '—'}</Text>
            </View>
          </View>
          {selectedSessionOverdue ? (
            <View style={styles.makeupRequestCard}>
              <Text style={styles.fieldLabel}>Quá hạn cửa sổ điểm danh 1 giờ</Text>
              <Text style={styles.metaText}>Buổi học này cần Admin xử lý điểm danh bù.</Text>
              <PrimaryButton title={makeupAlreadyRequested ? 'Đã gửi yêu cầu demo' : 'Yêu cầu điểm danh bù'} variant="secondary" disabled={makeupAlreadyRequested} onPress={() => setMakeupModalVisible(true)} />
              {makeupAlreadyRequested ? <Text style={styles.note}>Yêu cầu chỉ được ghi nhận trong phiên demo; không gửi tin nhắn thật.</Text> : null}
            </View>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Trạng thái điểm danh</Text>
              <View style={styles.choiceWrap}>
                {choices.map((choice) => (
                  <Pressable
                    key={choice}
                    onPress={() => {
                      setAttendance((current) => ({ ...current, [selectedSession.id]: choice }));
                      setSavedAttendance((current) => {
                        const next = { ...current };
                        delete next[selectedSession.id];
                        return next;
                      });
                    }}
                    style={[styles.choice, attendance[selectedSession.id] === choice && styles.choiceActive]}
                    accessibilityRole="radio"
                    accessibilityLabel={`${selectedStudent.name}: ${choice}`}
                    accessibilityState={{ selected: attendance[selectedSession.id] === choice }}
                  >
                    <Text style={[styles.choiceText, attendance[selectedSession.id] === choice && styles.choiceTextActive]}>{choice}</Text>
                  </Pressable>
                ))}
              </View>
              <PrimaryButton
                title={savedAttendance[selectedSession.id] === attendance[selectedSession.id] ? 'Đã lưu demo' : 'Lưu điểm danh demo'}
                disabled={!attendance[selectedSession.id] || savedAttendance[selectedSession.id] === attendance[selectedSession.id]}
                onPress={() => setSavedAttendance((current) => ({ ...current, [selectedSession.id]: attendance[selectedSession.id] }))}
              />
              {savedAttendance[selectedSession.id] === attendance[selectedSession.id] ? <Text style={styles.note}>Đã lưu trạng thái trong phiên demo này; chưa gửi lên hệ thống.</Text> : null}
              <Text style={styles.footnote}>Các lựa chọn chỉ được giữ trong màn hình hiện tại.</Text>
            </>
          )}
        </Card>
      ) : null}
      <Modal visible={makeupModalVisible} transparent animationType="slide" onRequestClose={() => setMakeupModalVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <View style={styles.rowCopy}>
                <Text style={styles.cardTitle}>Điểm danh bù</Text>
                <Text style={styles.metaText}>Quá hạn cửa sổ điểm danh 1 giờ</Text>
              </View>
              <Pressable onPress={() => setMakeupModalVisible(false)} accessibilityRole="button" accessibilityLabel="Đóng điểm danh bù">
                <Text style={styles.closeText}>Đóng</Text>
              </Pressable>
            </View>
            <Card style={styles.makeupRequestCard}>
              <Text style={styles.fieldLabel}>Thông tin buổi học</Text>
              <Text style={styles.metaText}>HV: {selectedStudent?.name || '—'}</Text>
              <Text style={styles.metaText}>Khóa: {selectedStudent?.course || selectedSession?.subject || '—'}</Text>
              <Text style={styles.metaText}>Buổi: {selectedSession?.title || '—'}</Text>
              <Text style={styles.metaText}>Lịch: {selectedSession?.dateLabel || selectedSession?.date || '—'}</Text>
              <Text style={styles.metaText}>Giờ: {selectedSession?.time || '—'}</Text>
            </Card>
            <Text style={styles.muted}>Bạn chịu trách nhiệm về buổi học này. Admin sẽ liên hệ học viên để xác nhận đã học; chỉ khi học viên xác nhận, buổi học mới được tính cho giảng viên.</Text>
            {makeupAlreadyRequested ? <Text style={styles.note}>Đã gửi yêu cầu demo — chờ Admin xét duyệt.</Text> : null}
            <View style={styles.modalActions}>
              <PrimaryButton title="Hủy" variant="quiet" onPress={() => setMakeupModalVisible(false)} />
              <PrimaryButton title={makeupAlreadyRequested ? 'Đã gửi' : 'Gửi yêu cầu demo'} disabled={makeupAlreadyRequested} onPress={() => {
                if (!selectedSession) return;
                setMakeupRequestIds((current) => [...new Set([...current, selectedSession.id])]);
              }} />
            </View>
            <Text style={styles.footnote}>Bản demo không gửi tin nhắn cho Admin hoặc học viên.</Text>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

export function GradesScreen() {
  const loader = useCallback(() => gradeService.list(), []);
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
  const { user, signOut, authMode } = useAuth();
  const navigation = useNavigation<Navigation>();
  const isTeacher = user?.role === 'teacher';
  const courseProgress = user?.completedSessions != null && user.totalSessions
    ? Math.round((user.completedSessions / user.totalSessions) * 100)
    : null;
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [profileValues, setProfileValues] = useState({ email: '', bio: '', specialty: '', address: '', zalo: '', voiceRegion: '', age: '', bankName: '', bankAccount: '', accountHolder: '', bankBranch: '' });
  const [savedProfile, setSavedProfile] = useState(false);
  const studentProfileLoader = useCallback(
    () => isTeacher
      ? Promise.resolve({ enrollments: [], videoOrders: [], qaFixture: false })
      : studentProfileService.get(user),
    [isTeacher, user],
  );
  const studentProfileResource = useMockResource(studentProfileLoader);
  const studentProfile = studentProfileResource.data;
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
  const videoOrders = studentProfile?.videoOrders || [];
  return (
    <AppScreen>
      <AppHeader title={isTeacher ? 'Hồ sơ' : 'Cá nhân'} subtitle={isTeacher ? 'Thông tin hồ sơ giảng viên' : 'Thông tin tài khoản demo'} />
      {!isTeacher && studentProfileResource.error ? <ErrorState onRetry={studentProfileResource.reload} /> : null}
      {isTeacher ? (
        <>
          <Card style={styles.teacherProfileHero}>
            <Avatar name={user?.name || 'Demo User'} color={user?.avatarColor} size={72} />
            <Text style={styles.teacherProfileEyebrow}>HỒ SƠ CÁ NHÂN</Text>
            <Text style={styles.teacherProfileName}>{user?.name || '—'}</Text>
            <Text style={styles.teacherProfileSubtitle}>Thông tin cá nhân, ngân hàng và bảo mật · {user?.branch || '—'}</Text>
            <View style={styles.teacherProfileTags}>
              <Text style={styles.teacherProfileStatus}>Trạng thái: —</Text>
              {user?.course ? <Text style={styles.teacherProfileTag}>{user.course}</Text> : null}
            </View>
          </Card>
          <Card style={styles.teacherDetails}>
            <SectionHeading title="Thông tin cá nhân" action="Chỉnh sửa" onPress={() => setShowProfileForm(true)} />
            {[
              ['Họ và tên', user?.name || '—'],
              ['Số điện thoại', user?.phone || '—'],
              ['Zalo', profileValues.zalo || '—'],
              ['Tuổi', profileValues.age ? `${profileValues.age} tuổi` : '—'],
              ['Ngày vào làm', '—'],
              ['Chi nhánh làm việc', user?.branch || '—'],
              ['Email', profileValues.email || '—'],
              ['Địa chỉ (Thường trú/Tạm trú)', profileValues.address || '—'],
              ['Chuyên môn', profileValues.specialty || user?.course || '—'],
              ['Giọng (vùng miền)', profileValues.voiceRegion || '—'],
              ['Giới thiệu bản thân', profileValues.bio || '—'],
            ].map(([label, value]) => (
              <View key={label} style={styles.teacherProfileField}>
                <Text style={styles.teacherProfileLabel}>{label}</Text>
                <Text style={styles.teacherProfileValue}>{value}</Text>
              </View>
            ))}
          </Card>
          <Card style={styles.teacherDetails}>
            <SectionHeading title="Thông tin thanh toán" action="Chỉnh sửa" onPress={() => setShowProfileForm(true)} />
            {!profileValues.bankName && !profileValues.bankAccount && !profileValues.accountHolder
              ? <Text style={styles.note}>Chưa có thông tin thanh toán. Cập nhật tài khoản ngân hàng để Admin có thể chuyển lương.</Text>
              : null}
            {[
              ['Ngân hàng', profileValues.bankName || 'Chưa chọn'],
              ['Số tài khoản', profileValues.bankAccount || '—'],
              ['Tên chủ tài khoản', profileValues.accountHolder || '—'],
              ['Chi nhánh (tùy chọn)', profileValues.bankBranch || 'Không bắt buộc'],
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
              ['Trạng thái', '—'],
              ['Điểm test', '—'],
              ['Lương/buổi', '—'],
              ['Ngày tham gia', '—'],
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
          {studentProfile?.qaFixture ? <Text style={styles.note}>QA fixture — dữ liệu minh họa, không phải dữ liệu tài khoản thật.</Text> : null}
          <Card style={styles.profileCard}>
            <Avatar name={user?.name || 'Demo User'} color={user?.avatarColor} size={68} />
            <Text style={styles.profileName}>{user?.name || '—'}</Text>
            <Text style={styles.muted}>Học viên  ·  {user?.code || '—'}</Text>
            <View style={styles.profileStats}>
              {[
                ['Tiến độ khóa học', user?.completedSessions != null && user.totalSessions ? `${Math.round((user.completedSessions / user.totalSessions) * 100)}%` : '—'],
                ['Điểm trung bình', user?.avgGrade != null ? `${user.avgGrade}` : '—'],
                ['Buổi còn lại', user?.completedSessions != null && user.totalSessions != null ? `${Math.max(user.totalSessions - user.completedSessions, 0)}` : '—'],
              ].map(([label, value]) => (
                <View key={label} style={styles.profileStat}>
                  <Text style={styles.profileStatValue}>{value}</Text>
                  <Text style={styles.profileStatLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </Card>
          <Card style={styles.profileDetails}>
            <SectionHeading title="Thông tin cá nhân" action="Chỉnh sửa" onPress={() => setShowProfileForm(true)} />
            {[
              ['Họ và tên', user?.name || '—'],
              ['Mã học viên', user?.code || '—'],
              ['Số điện thoại', user?.phone || '—'],
              ['Email', savedProfile ? profileValues.email || '—' : user?.email || '—'],
              ['Số điện thoại khác', savedProfile ? profileValues.zalo || '—' : user?.zalo || '—'],
              ['Địa chỉ', savedProfile ? profileValues.address || '—' : user?.address || '—'],
              ['Trung tâm', user?.branch || '—'],
            ].map(([label, value]) => (
              <View key={label} style={styles.teacherProfileField}>
                <Text style={styles.teacherProfileLabel}>{label}</Text>
                <Text style={styles.teacherProfileValue}>{value}</Text>
              </View>
            ))}
          </Card>
          <Card style={styles.profileDetails}>
            <SectionHeading title="Tóm tắt học tập" />
            {enrollments.length ? enrollments.map((enrollment) => (
              <View key={enrollment.id} style={styles.profileCourse}>
                <View style={styles.rowBetween}><Text style={styles.cardTitle}>{enrollment.courseName}</Text><StatusBadge label={enrollment.status} /></View>
                <Text style={styles.metaText}>Giảng viên: {enrollment.teacherName || '—'}{enrollment.registeredAt ? ` · Đăng ký ${enrollment.registeredAt}` : ''}</Text>
                {enrollment.progress != null ? <ProgressBar value={enrollment.progress} /> : null}
                <Text style={styles.metaText}>
                  Tiến độ {enrollment.progress != null ? `${enrollment.progress}%` : '—'}
                  {' · '}Đã học {enrollment.completedSessions ?? '—'}/{enrollment.totalSessions ?? '—'} buổi
                  {' · '}Điểm: {enrollment.avgGrade ?? '—'}
                </Text>
                <Text style={styles.metaText}>
                  Học phí: {enrollment.tuitionAmount != null ? formatCurrency(enrollment.tuitionAmount) : '—'}
                  {' · '}Đã thanh toán: {enrollment.paidAmount != null ? formatCurrency(enrollment.paidAmount) : '—'}
                </Text>
              </View>
            )) : <EmptyState title="Chưa có khóa học" message="Khóa học được phân công sẽ hiển thị tại đây." />}
          </Card>
          <Card style={styles.profileDetails}>
            <SectionHeading title="Học phí & thanh toán" action="Chi tiết" onPress={() => navigation.navigate('Tuition')} />
            <View style={styles.teacherProfileField}>
              <Text style={styles.teacherProfileLabel}>Tình trạng học phí</Text>
              <Text style={styles.teacherProfileValue}>{user?.paid == null ? '—' : user.paid ? 'Đã thanh toán' : 'Chưa thanh toán'}</Text>
            </View>
            <Text style={styles.note}>Mở chi tiết để xem số tiền và trạng thái theo từng khóa học.</Text>
          </Card>
          <Card style={styles.profileDetails}>
            <SectionHeading title="Đơn hàng video" />
            {videoOrders.length ? videoOrders.map((order) => (
              <View key={order.id} style={styles.videoOrderRow}>
                <View style={styles.rowCopy}>
                  <Text style={styles.cardTitle}>{order.courseName}</Text>
                  <Text style={styles.metaText}>{order.date} · {formatCurrency(order.amount)}</Text>
                </View>
                <View style={styles.videoOrderActions}>
                  <StatusBadge label={order.status} />
                  <Pressable onPress={() => Alert.alert(order.status === 'Đã thanh toán' ? 'Tiếp tục học demo' : 'Tiếp tục thanh toán demo', `${order.courseName}: thao tác này chỉ minh họa, không phát sinh thanh toán hoặc mở nội dung thật.`)} style={styles.fileLinkRow} accessibilityRole="button">
                    <Text style={styles.fileLinkAction}>{order.status === 'Đã thanh toán' ? 'Tiếp tục học' : 'Tiếp tục thanh toán'}</Text>
                  </Pressable>
                </View>
              </View>
            )) : <EmptyState title="Chưa có đơn hàng video" message="Đơn hàng khóa học video sẽ được hiển thị tại đây." />}
          </Card>
        </>
      )}
      <Card style={styles.menuCard}>
        {!isTeacher ? <MenuRow icon={<UserRound size={18} color={colors.brand} />} title="Thông tin cá nhân" subtitle="Cập nhật thông tin liên hệ trong bản demo" onPress={() => setShowProfileForm(true)} /> : null}
        <MenuRow icon={<UserRound size={18} color={colors.brand} />} title="Đổi mật khẩu" subtitle="Bảo mật tài khoản đăng nhập" onPress={() => setShowPasswordForm(true)} />
        <MenuRow icon={<BookOpen size={18} color={colors.brand} />} title="Danh mục theo vai trò" subtitle="Chức năng hiện có trên web" onPress={() => navigation.navigate('MobileMenu')} />
        {!isTeacher ? <MenuRow icon={<BookOpen size={18} color={colors.brand} />} title="Tài liệu học tập" onPress={() => navigation.navigate('Materials')} /> : null}
        {!isTeacher ? <MenuRow icon={<GraduationCap size={18} color={colors.brand} />} title="Kết quả học tập" onPress={() => navigation.navigate('Grades')} /> : null}
        <MenuRow icon={<Users size={18} color={colors.brand} />} title="Liên hệ Trung tâm" subtitle="Thông tin trung tâm" onPress={() => navigation.navigate('CenterInfo')} />
        <MenuRow
          icon={<Clock3 size={18} color={colors.red} />}
          title={authMode === 'real' ? 'Đăng xuất' : 'Đăng xuất demo'}
          destructive
          onPress={() => {
            void signOut().catch((error: unknown) => {
              Alert.alert(
                'Đã đăng xuất khỏi thiết bị',
                error instanceof Error ? error.message : 'Không thể xác nhận đăng xuất với máy chủ.',
              );
            });
          }}
        />
      </Card>
      <Modal visible={showProfileForm} transparent animationType="slide" onRequestClose={() => setShowProfileForm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.cardTitle}>Cập nhật thông tin cá nhân</Text>
            {isTeacher ? (
              <>
                <TextInput value={profileValues.email} onChangeText={(email) => setProfileValues({ ...profileValues, email })} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={styles.formInput} />
                <TextInput value={profileValues.bio} onChangeText={(bio) => setProfileValues({ ...profileValues, bio })} placeholder="Giới thiệu" multiline style={[styles.formInput, styles.formTextarea]} />
                <TextInput value={profileValues.specialty} onChangeText={(specialty) => setProfileValues({ ...profileValues, specialty })} placeholder="Chuyên môn" style={styles.formInput} />
                <TextInput value={profileValues.address} onChangeText={(address) => setProfileValues({ ...profileValues, address })} placeholder="Địa chỉ" style={styles.formInput} />
                <TextInput value={profileValues.zalo} onChangeText={(zalo) => setProfileValues({ ...profileValues, zalo })} placeholder="Zalo" style={styles.formInput} />
                <TextInput value={profileValues.voiceRegion} onChangeText={(voiceRegion) => setProfileValues({ ...profileValues, voiceRegion })} placeholder="Khu vực giọng nói" style={styles.formInput} />
                <TextInput value={profileValues.age} onChangeText={(age) => setProfileValues({ ...profileValues, age })} placeholder="Tuổi" keyboardType="number-pad" style={styles.formInput} />
                <TextInput value={profileValues.bankName} onChangeText={(bankName) => setProfileValues({ ...profileValues, bankName })} placeholder="Ngân hàng" style={styles.formInput} />
                <TextInput value={profileValues.bankAccount} onChangeText={(bankAccount) => setProfileValues({ ...profileValues, bankAccount })} placeholder="Tài khoản ngân hàng" style={styles.formInput} />
                <TextInput value={profileValues.accountHolder} onChangeText={(accountHolder) => setProfileValues({ ...profileValues, accountHolder })} placeholder="Tên chủ tài khoản" style={styles.formInput} />
                <TextInput value={profileValues.bankBranch} onChangeText={(bankBranch) => setProfileValues({ ...profileValues, bankBranch })} placeholder="Chi nhánh ngân hàng (tùy chọn)" style={styles.formInput} />
              </>
            ) : (
              <>
                <TextInput value={profileValues.email} onChangeText={(email) => setProfileValues({ ...profileValues, email })} placeholder="Email" keyboardType="email-address" autoCapitalize="none" style={styles.formInput} />
                <TextInput value={profileValues.zalo} onChangeText={(zalo) => setProfileValues({ ...profileValues, zalo })} placeholder="SĐT khác" keyboardType="phone-pad" style={styles.formInput} />
                <TextInput value={profileValues.address} onChangeText={(address) => setProfileValues({ ...profileValues, address })} placeholder="Địa chỉ" style={styles.formInput} />
              </>
            )}
            <Text style={styles.note}>Họ tên và số điện thoại chính không được chỉnh sửa tại đây. Thay đổi chỉ lưu trên giao diện demo.</Text>
            {savedProfile ? <Text style={styles.savedText}>Đã lưu thay đổi demo.</Text> : null}
            <PrimaryButton title="Lưu demo" onPress={() => setSavedProfile(true)} />
            <PrimaryButton title="Đóng" variant="quiet" onPress={() => setShowProfileForm(false)} />
          </View>
        </View>
      </Modal>
      <PasswordChangeModal visible={showPasswordForm} onClose={() => setShowPasswordForm(false)} />
      <Text style={styles.footnote}>Không có thông tin cá nhân thật được lưu hoặc gửi đi.</Text>
    </AppScreen>
  );
}

function PasswordChangeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});
  const [error, setError] = useState('');

  const save = () => {
    if (!currentPassword || !newPassword || !confirmation) {
      setError('Vui lòng nhập đầy đủ mật khẩu hiện tại, mật khẩu mới và xác nhận.');
      return;
    }
    if (newPassword.length < 8) {
      setError('Mật khẩu mới phải có ít nhất 8 ký tự.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('Mật khẩu xác nhận chưa khớp.');
      return;
    }
    Alert.alert('Đã đổi mật khẩu demo', 'Không có mật khẩu thật được gửi hoặc thay đổi.');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmation('');
    setError('');
    onClose();
  };

  const passwordField = (key: string, label: string, value: string, onChangeText: (value: string) => void) => (
    <View key={key} style={styles.passwordField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.passwordInputRow}>
        <TextInput value={value} onChangeText={(next) => { onChangeText(next); setError(''); }} placeholder={label} secureTextEntry={!visibleFields[key]} autoCapitalize="none" style={styles.passwordInput} accessibilityLabel={label} />
        <Pressable onPress={() => setVisibleFields((current) => ({ ...current, [key]: !current[key] }))} accessibilityRole="button" accessibilityLabel={visibleFields[key] ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}>
          {visibleFields[key] ? <EyeOff size={18} color={colors.muted} /> : <Eye size={18} color={colors.muted} />}
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard}>
        <View style={styles.rowBetween}><Text style={styles.cardTitle}>Đổi mật khẩu</Text><Pressable onPress={onClose} accessibilityRole="button"><Text style={styles.closeText}>Đóng</Text></Pressable></View>
        {passwordField('current', 'Mật khẩu hiện tại', currentPassword, setCurrentPassword)}
        {passwordField('new', 'Mật khẩu mới', newPassword, setNewPassword)}
        {passwordField('confirm', 'Xác nhận mật khẩu mới', confirmation, setConfirmation)}
        <Text style={styles.note}>Yêu cầu tối thiểu 8 ký tự. Thao tác chỉ mô phỏng trên thiết bị.</Text>
        {error ? <Text style={styles.passwordError}>{error}</Text> : null}
        <PrimaryButton title="Xác nhận demo" onPress={save} />
        <PrimaryButton title="Hủy" variant="quiet" onPress={onClose} />
      </View></View>
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

function FilterChips({ items, selected, onSelect }: { items: string[]; selected: string; onSelect: (item: string) => void }) {
  return (
    <View style={styles.chips}>
      {items.map((item) => (
        <Pressable
          key={item}
          onPress={() => onSelect(item)}
          style={[styles.chip, selected === item && styles.chipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === item }}
        >
          <Text style={[styles.chipText, selected === item && styles.chipTextActive]}>{item}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: spacing.md },
  scheduleStats: { flexDirection: 'row', gap: spacing.sm },
  assignmentTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  assignmentTab: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  assignmentTabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  assignmentTabText: { color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
  assignmentTabActiveText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '700' },
  scheduleStat: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  scheduleStatValue: { color: colors.brandDark, fontSize: typography.heading, fontWeight: '800' },
  weekNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.sm, minHeight: 48 },
  weekArrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  weekArrowText: { fontSize: 28, lineHeight: 30, color: colors.brandDark, fontWeight: '700' },
  weekLabel: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  scheduleDays: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  scheduleDay: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  scheduleDaySelected: { backgroundColor: colors.brand, borderColor: colors.brand },
  scheduleDayText: { color: colors.ink, fontSize: 10, fontWeight: '700' },
  scheduleDayTextSelected: { color: '#FFFFFF' },
  scheduleSort: { alignSelf: 'flex-end', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  weeklyGridCard: { gap: spacing.sm, paddingHorizontal: spacing.sm },
  weekGridContent: { paddingBottom: spacing.xs },
  weekGridHeader: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, borderLeftWidth: 1, borderLeftColor: colors.line },
  weekGridRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.line, borderLeftWidth: 1, borderLeftColor: colors.line },
  weekGridNameCell: { width: 158, minHeight: 68, justifyContent: 'center', gap: 3, paddingHorizontal: spacing.sm, borderRightWidth: 1, borderRightColor: colors.line, borderBottomWidth: 1, borderBottomColor: colors.line, backgroundColor: colors.surface },
  weekGridDayCell: { width: 105, minHeight: 68, justifyContent: 'center', alignItems: 'center', gap: 2, paddingHorizontal: spacing.xs, borderRightWidth: 1, borderRightColor: colors.line, borderBottomWidth: 1, borderBottomColor: colors.line },
  weekGridHeaderCell: { minHeight: 78, backgroundColor: colors.canvas },
  weekGridSortedCell: { backgroundColor: colors.brandSoft },
  weekGridHeaderText: { color: colors.ink, fontSize: typography.caption, fontWeight: '800', textAlign: 'center' },
  weekGridDate: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  weekGridSort: { minHeight: 28, justifyContent: 'center', paddingHorizontal: spacing.xs },
  weekGridSortText: { color: colors.brand, fontSize: 10, fontWeight: '700' },
  weekGridStudentName: { color: colors.ink, fontSize: typography.caption, fontWeight: '800' },
  weekGridCourse: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  weekGridSlotCell: { backgroundColor: colors.surface },
  weekGridBookedCell: { backgroundColor: colors.goldSoft },
  weekGridLockedCell: { backgroundColor: colors.canvas },
  weekGridSlotText: { color: colors.muted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  weekGridBookedText: { color: '#8A5B00' },
  weekGridStatus: { color: colors.muted, fontSize: 9, fontWeight: '600' },
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
  learningLogRow: { flexDirection: 'row', alignItems: 'center' },
  noticeCard: { flexDirection: 'row', alignItems: 'center' },
  muted: { color: colors.muted, fontSize: typography.small, lineHeight: 20, flex: 1 },
  footnote: { color: colors.muted, fontSize: typography.caption, textAlign: 'center', lineHeight: 18, paddingHorizontal: spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 44, paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  chipActive: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  materialRow: { flexDirection: 'row', alignItems: 'center' },
  fileIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: colors.canvas, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  fileType: { color: colors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  metaText: { color: colors.muted, fontSize: typography.caption, lineHeight: 18 },
  notificationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  notificationPagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: spacing.sm },
  notificationMain: { flex: 1, minWidth: 0 },
  notificationDismiss: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  notificationRouteNote: { padding: spacing.sm, color: colors.brandDark, backgroundColor: colors.goldSoft, borderRadius: radius.md, fontSize: typography.caption },
  notificationCard: { flexDirection: 'row', alignItems: 'flex-start' },
  noticeIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, marginTop: 6 },
  readAll: { padding: spacing.sm },
  readAllText: { color: colors.brand, fontWeight: '700', fontSize: typography.small },
  studentCard: { flexDirection: 'row', alignItems: 'flex-start' },
  studentListItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  studentListMain: { flex: 1, minWidth: 0 },
  studentChatButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: colors.line, marginLeft: spacing.sm },
  studentDetail: { borderColor: colors.brand, backgroundColor: '#FBFEFE' },
  closeText: { color: colors.brand, fontWeight: '700', fontSize: typography.small },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
  progressLabel: { color: colors.brandDark, fontSize: typography.caption, fontWeight: '800', minWidth: 34, textAlign: 'right' },
  classSummary: { flexDirection: 'row', alignItems: 'center' },
  summaryIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  attendanceRow: { flexDirection: 'row', alignItems: 'flex-start' },
  attendanceSessionSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  attendanceDetail: { gap: spacing.md },
  makeupRequestCard: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.goldSoft },
  attendanceMain: { flex: 1, gap: spacing.sm },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  choice: { minHeight: 44, borderRadius: radius.pill, paddingHorizontal: 9, paddingVertical: 7, backgroundColor: colors.canvas, borderWidth: 1, borderColor: colors.line, justifyContent: 'center' },
  choiceActive: { backgroundColor: colors.brandSoft, borderColor: colors.brand },
  choiceText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  choiceTextActive: { color: colors.brandDark },
  resultSummary: { flexDirection: 'row', alignItems: 'center' },
  summaryScore: { color: colors.brand, fontSize: typography.title, fontWeight: '800' },
  subjectCard: { gap: spacing.md },
  gradeHistoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  gradeResult: { alignItems: 'flex-end', gap: spacing.xs },
  gradeScore: { color: colors.brandDark, fontSize: typography.body, fontWeight: '800' },
  examNotice: { backgroundColor: colors.goldSoft, borderColor: '#F3E4BE' },
  profileCard: { alignItems: 'center', paddingVertical: spacing.xxl },
  profileDetails: { gap: spacing.md },
  profileStats: { alignSelf: 'stretch', flexDirection: 'row', gap: spacing.xs, marginTop: spacing.sm },
  profileStat: { alignItems: 'center', backgroundColor: colors.canvas, borderRadius: radius.md, flex: 1, minWidth: 0, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm },
  profileStatValue: { color: colors.ink, fontSize: typography.title, fontWeight: '700' },
  profileStatLabel: { color: colors.muted, fontSize: typography.small, textAlign: 'center' },
  profileCourse: { gap: spacing.sm, borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing.md },
  videoOrderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  videoOrderActions: { alignItems: 'flex-end', gap: spacing.xs },
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
  passwordInputRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  passwordInput: { flex: 1, minWidth: 0, color: colors.ink },
  passwordError: { color: colors.red, fontSize: typography.caption, fontWeight: '700' },
  fieldLabel: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  note: { color: colors.muted, fontSize: typography.caption, lineHeight: 18, fontStyle: 'italic' },
  savedText: { color: colors.green, fontSize: typography.small, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
