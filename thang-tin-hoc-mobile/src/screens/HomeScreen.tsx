import React, { useCallback, useEffect } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import {
  ArrowRight, Award, BookOpen, CalendarDays, ClipboardCheck, FileText, GraduationCap,
  MessageCircle, Star, Users, WalletCards, UserPlus, Trophy, Zap,
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useAuth } from '../app/AuthContext';
import { Avatar, AppScreen, Card, ErrorState, LoadingSkeleton, ScheduleCard, SectionHeading, StatusBadge, ProgressBar } from '../components/ui';
import {
  assignmentService, teacherFinanceService, learningService, materialService, messageService,
  quizService, scheduleService, studentService,
} from '../services/mockService';
import { useMockResource } from '../hooks/useMockResource';
import { SOCKET_EVENTS } from '../services/socketService';
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
  const assignmentsLoader = useCallback(() => assignmentService.list(isTeacher ? 'teacher' : 'student', user), [isTeacher, user]);
  const learningLoader = useCallback(() => learningService.courses(), []);
  const studentsLoader = useCallback(() => studentService.assigned(user), [user]);
  const financeLoader = useCallback(() => isTeacher ? teacherFinanceService.overview(user) : Promise.resolve(null), [isTeacher, user]);
  const materialsLoader = useCallback(() => materialService.list(user), [user]);
  const quizzesLoader = useCallback(() => quizService.studentList(), []);
  const messagesLoader = useCallback(() => messageService.conversations(isTeacher ? 'teacher' : 'student', user), [isTeacher, user]);
  const schedules = useMockResource(schedulesLoader);
  const assignments = useMockResource(assignmentsLoader);
  const learning = useMockResource(learningLoader);
  const students = useMockResource(studentsLoader);
  const finance = useMockResource(financeLoader);
  const materials = useMockResource(materialsLoader);
  const quizzes = useMockResource(quizzesLoader);
  const messages = useMockResource(messagesLoader);
  useEffect(() => {
    const subscriptions = [
      DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_RECEIVED, messages.reload),
      DeviceEventEmitter.addListener(SOCKET_EVENTS.MESSAGE_SENT_ACK, messages.reload),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, [messages.reload]);

  const firstSchedule = schedules.data?.find((item) => item.status === 'upcoming');
  const assignmentsToGrade = assignments.data?.filter((item) => item.status === 'Cần chấm') || [];
  const pendingAssignments = assignments.data?.filter((item) => item.status === 'Chưa làm' || item.status === 'Quá hạn') || [];
  const unreadMessages = messages.data?.reduce((count, item) => count + item.unread, 0);
  const pendingQuizCount = quizzes.data?.length ?? 0;
  const gradeEntries = schedules.data?.filter((item) => item.grade != null) || [];
  const completedSessions = user?.completedSessions;
  const totalSessions = user?.totalSessions;
  const sessionCountsAvailable = completedSessions != null && totalSessions != null && totalSessions > 0;
  const studentProgress = completedSessions != null && totalSessions != null && totalSessions > 0
    ? Math.round((completedSessions / totalSessions) * 100)
    : null;
  const quickActions = [
    { title: 'Bảng tin', icon: MessageCircle, route: 'Feed' as const, tint: colors.blueSoft },
    { title: 'Giao bài tập & kiểm tra', icon: FileText, route: 'Assignments' as const, tint: colors.goldSoft },
    { title: 'Khóa đào tạo', icon: GraduationCap, route: 'TeacherTraining' as const, tint: colors.purpleSoft },
    { title: 'Tài chính', icon: WalletCards, route: 'TeacherFinance' as const, tint: colors.greenSoft },
  ];

  return (
    <AppScreen contentStyle={isTeacher ? styles.screen : styles.studentScreen}>
      <View style={styles.topRow}>
        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>{isTeacher ? `Chào mừng, ${user?.name || 'Giảng viên'}!` : `Chào mừng, ${user?.name}! 👋`}</Text>
          <Text style={styles.greetingSub}>{isTeacher ? 'Ưu tiên điểm danh, lịch dạy và học viên được phân công.' : '“Học hôm nay, thành công mai sau.”'}</Text>
          <Text style={styles.greetingMeta}>{isTeacher ? 'KHÔNG GIAN GIẢNG DẠY' : 'TRUNG TÂM THẮNG TIN HỌC'}</Text>
        </View>
      </View>

      {schedules.loading || assignments.loading || students.loading || (isTeacher && learning.loading) || (isTeacher && finance.loading) || (!isTeacher && (materials.loading || quizzes.loading || messages.loading))
        ? <LoadingSkeleton rows={1} />
        : null}
      {schedules.error || assignments.error || students.error || (isTeacher && learning.error) || (isTeacher && finance.error) || (!isTeacher && (materials.error || quizzes.error || messages.error)) ? (
        <ErrorState onRetry={() => {
          schedules.reload();
          assignments.reload();
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
                { label: 'Đã nhận', value: finance.data ? formatCurrency(finance.data.paidAmount) : '—', detail: 'Tổng thanh toán', icon: WalletCards },
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
          <Pressable
            onPress={() => navigation?.navigate('StudentLearning')}
            accessibilityRole="button"
            accessibilityLabel={`Lớp học sắp diễn ra: ${user?.course || firstSchedule?.courseName || 'mở bài học'}`}
            style={({ pressed }) => pressed && styles.studentCoursePressed}
          >
            <View style={styles.studentCourseCard}>
              <View style={styles.studentCourseTop}>
                <Text style={styles.studentCourseEyebrow}>{firstSchedule ? 'LỚP HỌC SẮP DIỄN RA' : 'CHƯA CÓ LỊCH SẮP TỚI'}</Text>
                <View style={styles.studentCourseArrow}><ArrowRight size={15} color="#FFFFFF" /></View>
              </View>
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
            <SectionHeading title="Luyện tập & Ôn thi" />
            <View style={styles.practiceGrid}>
              <Pressable
                onPress={() => navigation?.navigate('LessonPracticeCatalog')}
                accessibilityRole="button"
                accessibilityLabel="Luyện bài theo bài học"
                style={({ pressed }) => [styles.practiceCard, pressed && styles.pressed]}
              >
                <View style={[styles.practiceIconWrap, { backgroundColor: colors.blueSoft }]}>
                  <BookOpen size={20} color={colors.blue} />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.practiceTitle}>Luyện theo bài học</Text>
                  <Text style={styles.practiceSub}>Theo chương & bài tập</Text>
                </View>
                <ArrowRight size={16} color={colors.muted} />
              </Pressable>

              <Pressable
                onPress={() => navigation?.navigate('CertPrepCatalog')}
                accessibilityRole="button"
                accessibilityLabel="Ôn thi MOS / IC3"
                style={({ pressed }) => [styles.practiceCard, pressed && styles.pressed]}
              >
                <View style={[styles.practiceIconWrap, { backgroundColor: colors.goldSoft }]}>
                  <Award size={20} color="#D97706" />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.practiceTitle}>Ôn thi MOS / IC3</Text>
                  <Text style={styles.practiceSub}>Luyện đề thi thử theo cấp độ</Text>
                </View>
                <ArrowRight size={16} color={colors.muted} />
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionWrap}>
            <Card style={styles.todoPanel}>
              <View style={styles.todoHeader}>
                <View style={styles.todoHeaderIcon}><Zap size={20} color="#FFFFFF" fill="#FFFFFF" /></View>
                <View style={styles.flex}>
                  <Text style={styles.cardTitle}>Việc cần làm hôm nay</Text>
                  <Text style={styles.todoSubtitle}>Các hoạt động đang chờ bạn</Text>
                </View>
              </View>
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
                icon: FileText,
                route: 'Assignments' as const,
                tone: styles.homeworkTodo,
                iconTone: styles.homeworkTodoIcon,
                color: '#EA580C',
                badge: pendingAssignments.length,
              },
              {
                title: 'Lịch học sắp tới',
                detail: schedules.loading ? '—' : `${schedules.data?.filter((item) => item.status === 'upcoming').length ?? '—'} buổi sắp tới`,
                action: 'Xem lịch',
                icon: CalendarDays,
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
                icon: MessageCircle,
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
                  <Text style={styles.cardTitle}>{title}</Text>
                  <Text style={[styles.todoDetail, { color }]}>{detail}</Text>
                  <View style={styles.todoCta}><Text style={styles.todoCtaText}>{action}</Text><ArrowRight size={14} color={colors.ink} /></View>
                </View>
              </Pressable>
            ))}
            </Card>
          </View>
          <View style={styles.sectionWrap}>
            <View style={styles.materialPanel}>
              <View style={styles.materialHeading}>
                <BookOpen size={16} color="#CBD5E1" />
                <Text style={styles.materialHeadingText}>Tài liệu</Text>
              </View>
              {materials.loading ? <Text style={styles.materialEmpty}>Đang tải tài liệu...</Text> : null}
              {!materials.loading && !materials.error && materials.data?.length ? materials.data.slice(0, 3).map((item) => (
                <Pressable key={item.id} onPress={() => navigation?.navigate('Materials')} accessibilityRole="button" style={styles.materialRow}>
                  <Text style={styles.materialType}>{item.type || 'TÀI LIỆU'}</Text>
                  <Text numberOfLines={1} style={styles.materialTitle}>{item.title}</Text>
                  <ArrowRight size={16} color="#7DD3FC" />
                </Pressable>
              )) : null}
              {!materials.loading && !materials.error && !materials.data?.length ? (
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
                <Text style={styles.cardTitle}>Nhật ký học tập &amp; Điểm số</Text>
                <Text style={styles.gradeCount}>{schedules.loading ? '—' : `${gradeEntries.length} lượt ghi nhận`}</Text>
              </Pressable>
              {schedules.loading ? <Text style={styles.muted}>Đang tải nhật ký...</Text> : (
                <>
                  {gradeEntries.length ? gradeEntries.slice(0, 3).map((item) => (
                    <View key={`student-grade-${item.id}`} style={styles.gradeRow}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.muted}>{item.dateLabel} · Điểm: {item.grade}</Text>
                    </View>
                  )) : <Text style={styles.muted}>Chưa có dữ liệu điểm số.</Text>}
                </>
              )}
            </Card>
          </View>
        </>
      )}

      {isTeacher ? <View style={styles.sectionWrap}>
        <SectionHeading title="Truy cập nhanh" />
        <View style={styles.quickGrid}>
          {quickActions.map(({ title, icon: Icon, route, tint }) => (
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
              <View style={[styles.quickIcon, { backgroundColor: tint }]}><Icon size={20} color={colors.brandDark} /></View>
              <Text style={styles.quickTitle}>{title}</Text>
            </Pressable>
          ))}
        </View>
      </View> : null}

      {isTeacher ? <Pressable onPress={() => tabNavigation.navigate('Messages')} style={styles.helpCard} accessibilityRole="button">
        <View style={styles.helpIcon}><MessageCircle size={18} color="#FFFFFF" /></View>
        <View style={styles.flex}>
          <Text style={styles.helpTitle}>Cần hỗ trợ?</Text>
          <Text style={styles.helpText}>Nhắn tin với {isTeacher ? 'trung tâm' : 'giảng viên'} của bạn</Text>
        </View>
        <ArrowRight size={18} color="#FFFFFF" />
      </Pressable> : null}
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
  studentScreen: { paddingTop: spacing.md, paddingBottom: spacing.xxxl, gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  greeting: { flex: 1, gap: 4 },
  greetingMeta: { color: colors.brand, fontSize: typography.micro, fontWeight: '800', letterSpacing: 1.3 },
  greetingTitle: { color: colors.ink, fontSize: typography.title, fontWeight: '800', letterSpacing: -0.5 },
  greetingSub: { color: colors.muted, fontSize: typography.small, lineHeight: 19 },
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
  teacherAction: { width: '48%', minHeight: 76, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teacherActionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  teacherStatsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'space-between' },
  teacherStatCard: { width: '48%', padding: spacing.md, gap: spacing.xs },
  teacherStatTop: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  teacherStatIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  teacherStatLabel: { flex: 1, color: colors.muted, fontSize: typography.caption, fontWeight: '700', lineHeight: 16 },
  teacherStatValue: { color: colors.ink, fontSize: typography.heading, fontWeight: '800' },
  teacherStudentCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  studentCourseCard: { backgroundColor: '#1E293B', borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: '#334155', overflow: 'hidden' },
  studentCoursePressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  studentCourseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  studentCourseArrow: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  studentCourseEyebrow: { color: '#FCA5A5', fontSize: typography.caption, fontWeight: '800', letterSpacing: 0.8 },
  studentCourseTitle: { color: '#FFFFFF', fontSize: typography.heading, lineHeight: 25, fontWeight: '800' },
  studentCourseCopy: { color: '#CBD5E1', fontSize: typography.small, lineHeight: 20 },
  studentCourseFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: 1, borderTopColor: '#475569', paddingTop: spacing.sm },
  studentCourseTeacher: { flex: 1, color: '#F8FAFC', fontSize: typography.small, fontWeight: '700' },
  studentRating: { color: '#FDE68A', fontSize: typography.small, fontWeight: '800' },
  studentKpiGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.sm },
  studentKpi: { width: '48%', minHeight: 132, justifyContent: 'space-between', padding: spacing.md, borderRadius: 14 },
  studentKpiIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  studentKpiLabel: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
  studentKpiValue: { fontSize: typography.heading, fontWeight: '800' },
  todoPanel: { gap: spacing.sm, overflow: 'hidden' },
  todoHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xs },
  todoHeaderIcon: { width: 40, height: 40, borderRadius: 16, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center' },
  todoSubtitle: { color: colors.muted, fontSize: typography.caption, fontWeight: '600', marginTop: 2 },
  todoCard: { minHeight: 116, borderWidth: 1, borderRadius: 16, padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, overflow: 'hidden' },
  quizTodo: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  homeworkTodo: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  scheduleTodo: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  messagesTodo: { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' },
  todoCardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  todoBadge: { position: 'absolute', top: -7, right: -8, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, textAlign: 'center', overflow: 'hidden', backgroundColor: '#DC2626', color: '#FFFFFF', fontSize: typography.micro, lineHeight: 20, fontWeight: '900', borderWidth: 2, borderColor: '#FFFFFF' },
  quizTodoIcon: { backgroundColor: '#E11D48' },
  homeworkTodoIcon: { backgroundColor: '#F97316' },
  scheduleTodoIcon: { backgroundColor: '#3B82F6' },
  messagesTodoIcon: { backgroundColor: '#8B5CF6' },
  todoCardContent: { flex: 1, alignItems: 'flex-start', gap: spacing.xs },
  todoDetail: { fontSize: typography.caption, fontWeight: '700' },
  todoCta: { minHeight: 32, marginTop: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 2 },
  todoCtaText: { color: colors.ink, fontSize: typography.caption, fontWeight: '800' },
  materialPanel: { backgroundColor: '#334155', borderRadius: 16, padding: spacing.lg, gap: spacing.sm },
  materialHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  materialHeadingText: { color: '#CBD5E1', fontSize: typography.small, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  materialRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(71, 85, 105, 0.75)', borderRadius: 12, paddingHorizontal: spacing.md },
  materialType: { color: '#FFFFFF', backgroundColor: '#EA580C', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 3, fontSize: typography.micro, fontWeight: '900' },
  materialTitle: { flex: 1, color: '#FFFFFF', fontSize: typography.caption, fontWeight: '700' },
  materialEmpty: { color: '#CBD5E1', fontSize: typography.caption, paddingVertical: spacing.md },
  materialAction: { minHeight: 40, marginTop: spacing.xs, backgroundColor: 'rgba(71, 85, 105, 0.55)', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  materialActionText: { color: '#BAE6FD', fontSize: typography.caption, fontWeight: '700' },
  gradePanel: { padding: 0, overflow: 'hidden' },
  gradeHeading: { minHeight: 54, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  gradeCount: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  gradeRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: spacing.xs },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickAction: { width: '47.8%', minHeight: 91, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, padding: spacing.md, justifyContent: 'space-between' },
  quickActionSmall: { width: '47%' },
  quickIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  quickTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
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
  practiceGrid: { gap: spacing.sm },
  practiceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, gap: spacing.md },
  practiceIconWrap: { width: 42, height: 42, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  practiceTitle: { fontSize: typography.body, fontWeight: '700', color: colors.ink },
  practiceSub: { fontSize: typography.caption, color: colors.muted, marginTop: 2 },
  pressed: { opacity: 0.8 },
});
