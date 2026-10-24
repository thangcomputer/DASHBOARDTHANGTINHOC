import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  ArrowRight, Award, Bell, BookOpen, CalendarDays, ClipboardCheck, FileText, GraduationCap,
  MessageCircle, Star, Users, WalletCards, UserPlus,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../app/AuthContext';
import { Avatar, AppScreen, Card, ErrorState, LoadingSkeleton, ScheduleCard, SectionHeading, StatusBadge, ProgressBar } from '../components/ui';
import {
  assignmentService, financeService, learningService, materialService, messageService,
  notificationService, quizService, scheduleService, studentService,
} from '../services/mockService';
import { useMockResource } from '../hooks/useMockResource';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';

type RootNavigation = NativeStackNavigationProp<AppStackParamList>;
type TabNavigation = BottomTabNavigationProp<MainTabsParamList>;

export function HomeScreen() {
  const { user } = useAuth();
  const tabNavigation = useNavigation<TabNavigation>();
  const navigation = tabNavigation.getParent<RootNavigation>();
  const { width } = useWindowDimensions();
  const isTeacher = user?.role === 'teacher';
  const schedulesLoader = useCallback(() => scheduleService.list(isTeacher ? 'teacher' : 'student'), [isTeacher]);
  const assignmentsLoader = useCallback(() => assignmentService.list(isTeacher ? 'teacher' : 'student'), [isTeacher]);
  const learningLoader = useCallback(() => learningService.courses(), []);
  const notificationsLoader = useCallback(() => notificationService.list(isTeacher ? 'teacher' : 'student'), [isTeacher]);
  const studentsLoader = useCallback(() => studentService.assigned(), []);
  const financeLoader = useCallback(() => financeService.list(), []);
  const materialsLoader = useCallback(() => materialService.list(), []);
  const quizzesLoader = useCallback(() => quizService.studentList(), []);
  const messagesLoader = useCallback(() => messageService.conversations('student'), []);
  const schedules = useMockResource(schedulesLoader);
  const assignments = useMockResource(assignmentsLoader);
  const learning = useMockResource(learningLoader);
  const notifications = useMockResource(notificationsLoader);
  const students = useMockResource(studentsLoader);
  const finance = useMockResource(financeLoader);
  const materials = useMockResource(materialsLoader);
  const quizzes = useMockResource(quizzesLoader);
  const messages = useMockResource(messagesLoader);

  const firstSchedule = schedules.data?.find((item) => item.status === 'upcoming');
  const unreadNotifications = notifications.data?.filter((item) => item.unread) || [];
  const firstUnreadNotification = unreadNotifications[0];
  const assignmentsToGrade = assignments.data?.filter((item) => item.status === 'Cần chấm') || [];
  const unreadCount = unreadNotifications.length;
  const pendingAssignments = assignments.data?.filter((item) => item.status === 'Chưa làm' || item.status === 'Quá hạn') || [];
  const unreadMessages = messages.data?.reduce((count, item) => count + item.unread, 0);
  const gradeEntries = schedules.data?.filter((item) => item.grade != null) || [];
  const completedSessions = user?.completedSessions;
  const totalSessions = user?.totalSessions;
  const sessionCountsAvailable = completedSessions != null && totalSessions != null && totalSessions > 0;
  const studentProgress = completedSessions != null && totalSessions != null && totalSessions > 0
    ? Math.round((completedSessions / totalSessions) * 100)
    : null;
  const quickActions = isTeacher ? [
        { title: 'Bảng tin', icon: MessageCircle, route: 'Feed' as const, tint: colors.blueSoft },
        { title: 'Giao bài tập & kiểm tra', icon: FileText, route: 'Assignments' as const, tint: colors.goldSoft },
        { title: 'Khóa đào tạo', icon: GraduationCap, route: 'TeacherTraining' as const, tint: colors.purpleSoft },
        { title: 'Tài chính', icon: WalletCards, route: 'TeacherFinance' as const, tint: colors.greenSoft },
      ] : [
        { title: 'Video khóa học', icon: BookOpen, route: 'StudentLearning' as const, tint: colors.purpleSoft },
        { title: 'Bài tập và tài nguyên', icon: FileText, route: 'Materials' as const, tint: colors.blueSoft },
        { title: 'Đánh giá GV', icon: Star, route: 'Evaluations' as const, tint: colors.goldSoft },
        { title: 'Phòng thi', icon: GraduationCap, route: 'StudentExam' as const, tint: colors.redSoft },
      ];

  return (
    <AppScreen contentStyle={styles.screen}>
      <View style={styles.topRow}>
        <View style={styles.greeting}>
          <Text style={styles.greetingMeta}>{isTeacher ? 'KHÔNG GIAN GIẢNG DẠY' : 'TRUNG TÂM THẮNG TIN HỌC'}</Text>
          <Text style={styles.greetingTitle}>{isTeacher ? `Chào mừng, ${user?.name || 'Giảng viên'}!` : `Chào mừng, ${user?.name}! 👋`}</Text>
          <Text style={styles.greetingSub}>{isTeacher ? 'Ưu tiên điểm danh, lịch dạy và học viên được phân công.' : '“Học hôm nay, thành công mai sau.”'}</Text>
        </View>
        <Pressable
          onPress={() => tabNavigation.navigate('Notifications')}
          style={styles.notificationButton}
          accessibilityRole="button"
          accessibilityLabel={`Thông báo, ${unreadCount} chưa đọc`}
        >
          <Bell size={20} color={colors.ink} />
          {unreadCount ? <View style={styles.notificationDot} /> : null}
        </Pressable>
      </View>

      {schedules.loading || assignments.loading || notifications.loading || students.loading || (isTeacher && learning.loading) || (isTeacher && finance.loading) || (!isTeacher && (materials.loading || quizzes.loading || messages.loading))
        ? <LoadingSkeleton rows={1} />
        : null}
      {schedules.error || assignments.error || notifications.error || students.error || (isTeacher && learning.error) || (isTeacher && finance.error) || (!isTeacher && (materials.error || quizzes.error || messages.error)) ? (
        <ErrorState onRetry={() => {
          schedules.reload();
          assignments.reload();
          notifications.reload();
          students.reload();
          learning.reload();
          finance.reload();
          materials.reload();
          quizzes.reload();
          messages.reload();
        }} />
      ) : null}

      {isTeacher ? (
        <>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Công việc cần xử lý ngay" />
            <View style={styles.teacherActionGrid}>
              {[
                {
                  title: 'Điểm danh',
                  detail: schedules.loading ? '—' : `${schedules.data?.filter((item) => item.status === 'upcoming' && item.dateLabel === 'Hôm nay').length ?? '—'} buổi hôm nay`,
                  icon: ClipboardCheck,
                  onPress: () => navigation?.navigate('Attendance'),
                  tint: colors.greenSoft,
                },
                {
                  title: 'Chấm điểm',
                  detail: assignments.loading ? '—' : assignmentsToGrade.length ? `${assignmentsToGrade.length} bài chờ chấm` : 'Không có bài chờ chấm',
                  icon: FileText,
                  onPress: () => navigation?.navigate('Assignments'),
                  tint: colors.goldSoft,
                },
                {
                  title: 'Tin nhắn',
                  detail: 'Mở hộp thư',
                  icon: MessageCircle,
                  onPress: () => tabNavigation.navigate('Messages'),
                  tint: colors.purpleSoft,
                },
                {
                  title: 'Xếp lịch',
                  detail: 'Thêm buổi dạy mới',
                  icon: CalendarDays,
                  onPress: () => tabNavigation.navigate('Schedule'),
                  tint: colors.blueSoft,
                },
              ].map(({ title, detail, icon: Icon, onPress, tint }) => (
                <Pressable key={title} onPress={onPress} style={styles.teacherAction} accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`}>
                  <View style={[styles.teacherActionIcon, { backgroundColor: tint }]}><Icon size={19} color={colors.brandDark} /></View>
                  <View style={styles.flex}>
                    <Text style={styles.cardTitle}>{title}</Text>
                    <Text numberOfLines={2} style={styles.muted}>{detail}</Text>
                  </View>
                  <ArrowRight size={17} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Tổng quan tháng này" />
            <View style={styles.teacherStatsGrid}>
              {[
                { label: `Thu nhập ${finance.data?.[0]?.month || 'tháng này'}`, value: finance.data?.[0] ? formatCurrency(finance.data[0].amount) : '—', detail: finance.loading ? '—' : finance.data?.[0]?.status || '—', icon: WalletCards },
                { label: 'Đang dạy', value: students.data ? String(students.data.filter((student) => student.enrollmentStatus === 'active').length) : '—', detail: students.data ? 'học viên' : '—', icon: Users },
                { label: 'HV mới', value: '—', detail: '—', icon: UserPlus },
                { label: '5 sao', value: '—', detail: '—', icon: Award },
                { label: 'Uy tín', value: '—', detail: '—', icon: Star },
              ].map(({ label, value, detail, icon: Icon }) => (
                <Card key={label} style={{ ...styles.teacherStatCard, padding: width < 360 ? spacing.sm : spacing.md }}>
                  <View style={styles.teacherStatTop}>
                    <View style={styles.teacherStatIcon}><Icon size={17} color={colors.brand} /></View>
                    <Text numberOfLines={2} style={styles.teacherStatLabel}>{label}</Text>
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit style={styles.teacherStatValue}>{value}</Text>
                  <Text style={styles.muted}>{detail}</Text>
                </Card>
              ))}
            </View>
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Lịch dạy hôm nay" action="Xem lịch" onPress={() => tabNavigation.navigate('Schedule')} />
            {!schedules.loading && !schedules.error
              ? firstSchedule
                ? <ScheduleCard item={firstSchedule} />
                : <Card><Text style={styles.muted}>Chưa có lớp học sắp tới.</Text></Card>
              : null}
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Học viên được phân công" action="Xem tất cả" onPress={() => tabNavigation.navigate('Students')} />
            {students.data?.filter((student) => student.enrollmentStatus === 'active').map((student) => (
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
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Bài tập cần chấm" action="Mở danh sách" onPress={() => navigation?.navigate('Assignments')} />
            {!assignments.loading && !assignments.error && assignmentsToGrade.length ? (
              <Card style={styles.reviewCard}>
                <View style={styles.reviewIcon}><ClipboardCheck size={20} color={colors.purple} /></View>
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
        </>
      ) : (
        <>
          <Pressable onPress={() => navigation?.navigate('StudentLearning')} accessibilityRole="button">
            <View style={styles.studentCourseCard}>
              <Text style={styles.studentCourseEyebrow}>{firstSchedule ? 'LỚP HỌC SẮP DIỄN RA' : 'CHƯA CÓ LỊCH SẮP TỚI'}</Text>
              <Text numberOfLines={2} style={styles.studentCourseTitle}>{user?.course || firstSchedule?.courseName || '—'}</Text>
              <Text style={styles.studentCourseCopy}>{firstSchedule ? `${firstSchedule.time} · ${firstSchedule.dateLabel}` : 'Lịch học mới sẽ hiển thị tại đây.'}</Text>
              <View style={styles.studentCourseFooter}>
                <Text numberOfLines={1} style={styles.studentCourseTeacher}>GV: {user?.teacherName || firstSchedule?.teacherName || firstSchedule?.person || '—'}</Text>
                {user?.teacherRating ? <Text style={styles.studentRating}>★ {user.teacherRating}</Text> : null}
              </View>
              {firstSchedule?.learningMode === 'Trực tuyến' && !firstSchedule.meetingUrl ? (
                <Text style={styles.studentCourseCopy}>Chưa có link học</Text>
              ) : null}
            </View>
          </Pressable>
          <View style={styles.studentKpiGrid}>
            {[
              { label: 'Đã học', value: sessionCountsAvailable ? `${completedSessions} / ${totalSessions}` : '—', sub: 'buổi', icon: BookOpen, tint: colors.redSoft, tone: colors.red },
              { label: 'Còn lại', value: sessionCountsAvailable ? String(Math.max(0, totalSessions - completedSessions)) : '—', sub: 'buổi', icon: CalendarDays, tint: colors.blueSoft, tone: colors.blue },
              { label: 'Điểm TB', value: user?.avgGrade == null ? '—' : String(user.avgGrade), sub: '/ 10', icon: Star, tint: colors.goldSoft, tone: '#D97706' },
              { label: 'Tiến độ', value: studentProgress == null ? '—' : `${studentProgress}%`, sub: 'hoàn thành', icon: GraduationCap, tint: colors.greenSoft, tone: colors.green },
            ].map(({ label, value, sub, icon: Icon, tint, tone }) => (
              <Card key={label} style={styles.studentKpi}>
                <View style={[styles.studentKpiIcon, { backgroundColor: tint }]}><Icon size={18} color={tone} /></View>
                <Text style={styles.studentKpiLabel}>{label}</Text>
                <Text style={[styles.studentKpiValue, { color: tone }]}>{value}</Text>
                <Text style={styles.muted}>{sub}</Text>
              </Card>
            ))}
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Việc cần làm hôm nay" />
            <Text style={styles.muted}>Các hoạt động đang chờ bạn</Text>
            {[
              { title: 'Trắc nghiệm buổi học', detail: quizzes.loading ? '—' : quizzes.data?.length ? `${quizzes.data.length} bài được giao` : 'Không có bài chờ', icon: ClipboardCheck, route: 'StudentExam' as const },
              { title: 'Bài tập về nhà', detail: assignments.loading ? '—' : `${pendingAssignments.length} bài cần nộp`, icon: FileText, route: 'Assignments' as const },
              { title: 'Lịch học sắp tới', detail: schedules.loading ? '—' : `${schedules.data?.filter((item) => item.status === 'upcoming').length ?? '—'} buổi sắp tới`, icon: CalendarDays, route: 'Schedule' as const },
              { title: 'Tin nhắn & Phản hồi', detail: messages.loading ? '—' : `${unreadMessages ?? '—'} tin nhắn mới`, icon: MessageCircle, route: 'Messages' as const },
            ].map(({ title, detail, icon: Icon, route }) => (
              <Pressable key={title} onPress={() => {
                if (route === 'Messages' || route === 'Schedule') tabNavigation.navigate(route);
                else navigation?.navigate(route);
              }} accessibilityRole="button" style={styles.studentTodo}>
                <View style={styles.studentTodoIcon}><Icon size={21} color={colors.brand} /></View>
                <View style={styles.flex}><Text style={styles.cardTitle}>{title}</Text><Text style={styles.muted}>{detail}</Text></View>
                <Text style={styles.studentTodoCta}>Xem ngay ›</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Tài liệu" action="Xem tất cả" onPress={() => navigation?.navigate('Materials')} />
            {!materials.loading && !materials.error && materials.data?.length ? materials.data.slice(0, 3).map((item) => (
              <Pressable key={item.id} onPress={() => navigation?.navigate('Materials')} accessibilityRole="button">
                <Card style={styles.studentMaterialRow}>
                  <View style={styles.studentKpiIcon}><BookOpen size={18} color={colors.brand} /></View>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
                    <Text numberOfLines={1} style={styles.muted}>{item.subject}</Text>
                  </View>
                  <ArrowRight size={17} color={colors.brand} />
                </Card>
              </Pressable>
            )) : null}
            {!materials.loading && !materials.error && !materials.data?.length ? (
              <Card><Text style={styles.muted}>Chưa có tài liệu.</Text></Card>
            ) : null}
          </View>
          <View style={styles.sectionWrap}>
            <SectionHeading title="Nhật ký học tập & Điểm số" action="Xem tất cả" onPress={() => navigation?.navigate('Grades')} />
            {schedules.loading ? <Text style={styles.muted}>— lượt ghi nhận</Text> : (
              <>
                <Text style={styles.muted}>{gradeEntries.length} lượt ghi nhận</Text>
                {gradeEntries.length ? gradeEntries.slice(0, 3).map((item) => (
                  <Card key={`student-grade-${item.id}`}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.muted}>{item.dateLabel} · Điểm: {item.grade}</Text>
                  </Card>
                )) : <Text style={styles.muted}>Chưa có dữ liệu điểm số.</Text>}
              </>
            )}
          </View>
          {firstUnreadNotification ? (
            <Pressable
              onPress={() => tabNavigation.navigate('Notifications')}
              accessibilityRole="button"
              accessibilityLabel={`Thông báo chưa đọc: ${firstUnreadNotification.title}`}
            >
              <Card style={styles.notificationPreview}>
                <View style={styles.notificationPreviewIcon}><Bell size={18} color={colors.brandDark} /></View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>{firstUnreadNotification.title}</Text>
                  <Text numberOfLines={2} style={styles.muted}>{firstUnreadNotification.message}</Text>
                </View>
                <ArrowRight size={18} color={colors.brand} />
              </Card>
            </Pressable>
          ) : !notifications.loading && !notifications.error ? (
            <Card style={styles.notificationPreview}>
              <View style={styles.notificationPreviewIcon}><Bell size={18} color={colors.brandDark} /></View>
              <Text style={styles.muted}>Không có thông báo mới.</Text>
            </Card>
          ) : null}
        </>
      )}

      <View style={styles.sectionWrap}>
        <SectionHeading title="Truy cập nhanh" />
        <View style={styles.quickGrid}>
          {quickActions.map(({ title, icon: Icon, route, tint }) => (
            <Pressable
              key={title}
              onPress={() => {
                if (route === 'Assignments') navigation?.navigate('Assignments');
                else if (route === 'Materials') navigation?.navigate('Materials');
                else if (route === 'TeacherTraining') navigation?.navigate('TeacherTraining');
                else if (route === 'TeacherFinance') navigation?.navigate('TeacherFinance');
                else if (route === 'Feed') navigation?.navigate('Feed');
                else if (route === 'StudentLearning') navigation?.navigate('StudentLearning');
                else if (route === 'Evaluations') navigation?.navigate('Evaluations');
                else if (route === 'StudentExam') navigation?.navigate('StudentExam');
              }}
              style={[styles.quickAction, width < 360 && styles.quickActionSmall]}
              accessibilityRole="button"
              accessibilityLabel={title}
            >
              <View style={[styles.quickIcon, { backgroundColor: tint }]}><Icon size={20} color={colors.brandDark} /></View>
              <Text style={styles.quickTitle}>{title}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable onPress={() => tabNavigation.navigate('Messages')} style={styles.helpCard} accessibilityRole="button">
        <View style={styles.helpIcon}><MessageCircle size={18} color="#FFFFFF" /></View>
        <View style={styles.flex}>
          <Text style={styles.helpTitle}>Cần hỗ trợ?</Text>
          <Text style={styles.helpText}>Nhắn tin với {isTeacher ? 'trung tâm' : 'giảng viên'} của bạn</Text>
        </View>
        <ArrowRight size={18} color="#FFFFFF" />
      </Pressable>
    </AppScreen>
  );
}

function StudentHero({ progress, compact, onPress }: { progress: number; compact: boolean; onPress: () => void }) {
  const { user } = useAuth();
  return (
    <Pressable onPress={onPress} style={[styles.heroCard, compact && styles.heroCompact]} accessibilityRole="button">
      <View style={styles.heroTop}>
        <View style={styles.courseTag}><GraduationCap size={14} color="#D8F3EF" /><Text style={styles.courseTagText}>KHÓA HỌC CỦA BẠN</Text></View>
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
  screen: { paddingTop: spacing.lg, gap: spacing.xl },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  greeting: { flex: 1, gap: 4 },
  greetingMeta: { color: colors.brand, fontSize: 10, fontWeight: '800', letterSpacing: 1.3 },
  greetingTitle: { color: colors.ink, fontSize: typography.title, fontWeight: '800', letterSpacing: -0.5 },
  greetingSub: { color: colors.muted, fontSize: typography.small, lineHeight: 19 },
  notificationButton: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', width: 9, height: 9, borderRadius: 5, top: 9, right: 10, backgroundColor: colors.red, borderWidth: 1.5, borderColor: colors.surface },
  heroCard: { backgroundColor: colors.brandDark, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, overflow: 'hidden' },
  heroCompact: { padding: spacing.lg },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  courseTag: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  courseTagText: { color: '#D8F3EF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontSize: typography.heading, fontWeight: '800', lineHeight: 25, marginTop: spacing.xs },
  heroMeta: { color: '#C3DDDC', fontSize: typography.small },
  heroProgress: { gap: spacing.sm, marginTop: spacing.sm },
  heroProgressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroPercent: { color: '#FFFFFF', fontSize: typography.heading, fontWeight: '800' },
  sectionWrap: { gap: spacing.md },
  teacherActionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  teacherAction: { width: '48%', minHeight: 76, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teacherActionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  teacherStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  teacherStatCard: { width: '48%', padding: spacing.md, gap: spacing.xs },
  teacherStatTop: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teacherStatIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  teacherStatLabel: { flex: 1, color: colors.muted, fontSize: typography.caption, fontWeight: '700', lineHeight: 16 },
  teacherStatValue: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' },
  teacherStudentCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  studentCourseCard: { backgroundColor: '#1E293B', borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, borderWidth: 1, borderColor: '#334155' },
  studentCourseEyebrow: { color: '#FCA5A5', fontSize: typography.caption, fontWeight: '800', letterSpacing: 0.8 },
  studentCourseTitle: { color: '#FFFFFF', fontSize: typography.heading, lineHeight: 25, fontWeight: '800' },
  studentCourseCopy: { color: '#CBD5E1', fontSize: typography.small, lineHeight: 20 },
  studentCourseFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: 1, borderTopColor: '#475569', paddingTop: spacing.md },
  studentCourseTeacher: { flex: 1, color: '#F8FAFC', fontSize: typography.small, fontWeight: '700' },
  studentRating: { color: '#FDE68A', fontSize: typography.small, fontWeight: '800' },
  studentKpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  studentKpi: { width: '48%', minHeight: 144, justifyContent: 'space-between' },
  studentKpiIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  studentKpiLabel: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  studentKpiValue: { fontSize: typography.heading, fontWeight: '800' },
  studentTodo: { backgroundColor: colors.surface, minHeight: 82, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  studentMaterialRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  studentTodoIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  studentTodoCta: { color: colors.brand, fontSize: typography.caption, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickAction: { width: '47.8%', minHeight: 91, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, justifyContent: 'space-between' },
  quickActionSmall: { width: '47%' },
  quickIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  notificationPreview: { flexDirection: 'row', alignItems: 'center' },
  notificationPreviewIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  attentionCard: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  muted: { color: colors.muted, fontSize: typography.small, lineHeight: 19 },
  cardTitle: { color: colors.ink, fontWeight: '700', fontSize: typography.body, lineHeight: 21 },
  reviewCard: { flexDirection: 'row', alignItems: 'center' },
  reviewIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.purpleSoft, alignItems: 'center', justifyContent: 'center' },
  taskCard: { gap: spacing.sm },
  taskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  helpCard: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  helpIcon: { width: 38, height: 38, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  helpTitle: { color: '#FFFFFF', fontWeight: '800', fontSize: typography.body },
  helpText: { color: '#D8F3EF', fontSize: typography.caption, marginTop: 2 },
});
