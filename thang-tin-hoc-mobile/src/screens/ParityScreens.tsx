import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../app/AuthContext';
import {
  BookOpen, Building2, CheckCircle2, ChevronRight, CircleDollarSign,
  ClipboardList, GraduationCap, ImagePlus, MessageSquareText, Newspaper, Radio, Star, WalletCards,
} from 'lucide-react-native';
import {
  AppHeader, AppScreen, Avatar, Card, EmptyState, ErrorState, LoadingSkeleton, PrimaryButton,
  ProgressBar, SearchField, SectionHeading, StatusBadge,
} from '../components/ui';
import { useMockResource } from '../hooks/useMockResource';
import {
  evaluationService, feedService, financeService, learningService, quizService,
  softwareService, studentService, trainingService,
} from '../services/mockService';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';
import type {
  DemoEvaluation, DemoFeedPost, DemoNewsItem, DemoQuiz, DemoStudent, DemoTrainingCourse,
  LearningCourse, LearningLesson,
} from '../types';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

type MenuScreen = 'Assignments' | 'Materials' | 'StudentLearning' | 'StudentExam' | 'Evaluations' | 'Feed' | 'News' | 'CenterInfo' | 'Tuition' | 'SoftwareLinks' | 'TeacherQuizzes' | 'TeacherTraining' | 'TeacherFinance';
type MenuItem = { label: string; screen?: MenuScreen; description: string };

const studentMenu: MenuItem[] = [
  { label: 'Bài học', screen: 'StudentLearning', description: 'Khóa học đã đăng ký và tự học qua video' },
  { label: 'Bài tập về nhà', screen: 'Assignments', description: 'Bài tập, hạn nộp và trạng thái bài làm' },
  { label: 'Tài liệu học tập', screen: 'Materials', description: 'Tài liệu và video theo khóa học' },
  { label: 'Phần mềm', screen: 'SoftwareLinks', description: 'Phần mềm được cung cấp theo khóa học' },
  { label: 'Đánh giá giảng viên', screen: 'Evaluations', description: 'Phản hồi theo khóa học và giảng viên' },
  { label: 'Bảng tin', screen: 'Feed', description: 'Bài đăng dành cho lớp học' },
  { label: 'Tin tức', screen: 'News', description: 'Tin tức và thông báo của trung tâm' },
  { label: 'Liên hệ Trung tâm', screen: 'CenterInfo', description: 'Thông tin trung tâm và các mục liên quan' },
  { label: 'Thông tin học phí', screen: 'Tuition', description: 'Trạng thái học phí theo khóa học' },
  { label: 'Phòng thi', screen: 'StudentExam', description: 'Bài thi chứng nhận tiếp tục thực hiện trên website' },
];

const teacherMenu: MenuItem[] = [
  { label: 'Bảng tin', screen: 'Feed', description: 'Bài đăng dành cho lớp học' },
  { label: 'Phần mềm', screen: 'SoftwareLinks', description: 'Phần mềm được cung cấp theo khóa học' },
  { label: 'Giao bài tập & kiểm tra', screen: 'Assignments', description: 'Bài tập, bài nộp và trắc nghiệm' },
  { label: 'Trắc nghiệm mỗi buổi học', screen: 'TeacherQuizzes', description: 'Danh sách bài trắc nghiệm đã tạo' },
  { label: 'Khóa đào tạo', screen: 'TeacherTraining', description: 'Nội dung đào tạo và tài liệu' },
  { label: 'Tài chính', screen: 'TeacherFinance', description: 'Tổng hợp buổi dạy và thanh toán' },
  { label: 'Tin tức', screen: 'News', description: 'Tin tức và thông báo của trung tâm' },
  { label: 'Thông tin Trung tâm', screen: 'CenterInfo', description: 'Thông tin và các mục của trung tâm' },
  { label: 'Bài kiểm tra đầu vào', description: 'WEB-ONLY TẠM THỜI — thực hiện trên website' },
];

export function MobileMenuScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const items = user?.role === 'teacher' ? teacherMenu : studentMenu;
  return (
    <AppScreen>
      <AppHeader title="Danh mục" subtitle="Các mục theo tài khoản hiện tại" />
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={() => {
            if (!item.screen) {
              Alert.alert(item.label, 'Chức năng này hiện được thực hiện trên website.');
              return;
            }
            navigation.navigate(item.screen);
          }}
          accessibilityRole="button"
        >
          <Card style={styles.menuRow}>
            <View style={styles.menuIcon}><MenuIcon label={item.label} /></View>
            <View style={styles.flex}>
              <Text style={styles.title}>{item.label}</Text>
              <Text style={styles.muted}>{item.description}</Text>
            </View>
            <ChevronRight size={19} color={colors.muted} />
          </Card>
        </Pressable>
      ))}
    </AppScreen>
  );
}

function MenuIcon({ label }: { label: string }) {
  const common = { size: 20, color: colors.brand };
  if (label.includes('Video') || label.includes('Khóa đào tạo')) return <GraduationCap {...common} />;
  if (label.includes('Bài tập') || label.includes('Trắc nghiệm') || label.includes('thi')) return <ClipboardList {...common} />;
  if (label.includes('Đánh giá')) return <Star {...common} />;
  if (label.includes('Bảng tin')) return <Radio {...common} />;
  if (label.includes('Tin tức')) return <Newspaper {...common} />;
  if (label.includes('Tài chính') || label.includes('học phí')) return <WalletCards {...common} />;
  if (label.includes('Trung tâm')) return <Building2 {...common} />;
  return <BookOpen {...common} />;
}

export function StudentLearningScreen() {
  const navigation = useNavigation<Navigation>();
  const loader = useCallback(() => learningService.courses(), []);
  const resource = useMockResource(loader);
  const courses = resource.data || [];
  const [expanded, setExpanded] = useState<string[]>([]);
  const [filter, setFilter] = useState('Tất cả');
  const visibleCourses = courses.filter((course) => {
    if (filter === 'Khóa đã đăng ký') return course.enrolled;
    if (filter === 'Tự học qua video') return course.deliveryMode === 'video';
    return true;
  });
  const enrolledCourses = visibleCourses.filter((course) => course.enrolled);
  const otherCourses = visibleCourses.filter((course) => !course.enrolled);
  const toggle = (id: string) => setExpanded((items) => items.includes(id) ? items.filter((value) => value !== id) : [...items, id]);
  return (
    <AppScreen>
      <AppHeader title="Bài học" subtitle="Khóa đã đăng ký và tự học qua video" />
      <View style={styles.chips}>
        {['Tất cả', 'Khóa đã đăng ký', 'Tự học qua video'].map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={[styles.choice, filter === item && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: filter === item }}>
            <Text style={[styles.choiceText, filter === item && styles.choiceTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && visibleCourses.length === 0 ? <EmptyState title="Chưa có khóa học" message="Khóa học sẽ hiển thị tại đây." /> : null}
      {enrolledCourses.length ? <SectionHeading title="LỘ TRÌNH CỦA BẠN · Khóa đã đăng ký" /> : null}
      {enrolledCourses.map((course) => (
        <View key={course._id}>
          <Card style={styles.courseCard}>
            <StatusBadge label="Đã đăng ký" />
            <Text style={styles.title}>{course.title}</Text>
            <Text style={styles.muted}>{course.subject} · {course.software}</Text>
            <ProgressBar value={course.progress} />
            <Text style={styles.caption}>Tiến độ khóa học: {course.progress}%</Text>
            {course.units.length ? (
              <PrimaryButton title={expanded.includes(`${course._id}-all`) ? 'Thu gọn nội dung' : 'Vào học'} variant="secondary" onPress={() => toggle(`${course._id}-all`)} />
            ) : null}
          </Card>
          {expanded.includes(`${course._id}-all`) ? course.units.map((unit) => (
            <View key={unit._id}>
              <Pressable onPress={() => toggle(unit._id)} accessibilityRole="button">
                <Card style={styles.unitRow}>
                  <BookOpen size={18} color={colors.brand} />
                  <Text style={[styles.title, styles.flex]}>{unit.title}</Text>
                  <Text style={styles.muted}>{unit.sections.length} bài học</Text>
                </Card>
              </Pressable>
              {expanded.includes(unit._id) ? unit.sections.map((lesson) => (
                <LessonRow
                  key={lesson._id}
                  lesson={lesson}
                  onPress={() => navigation.navigate('LearningLesson', {
                    courseId: course._id, unitId: unit._id, lessonId: lesson._id,
                  })}
                />
              )) : null}
            </View>
          )) : null}
        </View>
      ))}
      {otherCourses.length ? <SectionHeading title="Khóa học cùng với giảng viên" /> : null}
      {otherCourses.map((course) => (
        <Card key={course._id} style={styles.availableCourse}>
          <View style={styles.courseRibbon}><Text style={styles.courseRibbonText}>{course.deliveryMode === 'video' ? 'TỰ HỌC QUA VIDEO' : 'KHÓA HỌC CÙNG GIẢNG VIÊN'}</Text></View>
          <Text style={styles.cardTitle}>{course.title}</Text>
          <Text style={styles.muted}>{course.subject} · {course.totalSessions || 0} buổi {course.price ? `· ${formatCurrency(course.price)}` : ''}</Text>
          <Text style={styles.caption}>{course.description}</Text>
          <StatusBadge label="Chưa đăng ký" />
          <PrimaryButton title="Xem thông tin khóa học" variant="secondary" onPress={() => Alert.alert('Khóa học', 'Thông tin đăng ký và thanh toán khóa học tiếp tục trên website.')} />
        </Card>
      ))}
      <Text style={styles.note}>Video được giữ ở dạng placeholder; không tải media hoặc gọi dịch vụ web.</Text>
    </AppScreen>
  );
}

export function StudentExamScreen() {
  return (
    <AppScreen>
      <AppHeader title="Phòng thi" subtitle="Các bài thi và kết quả học tập" />
      <View style={styles.examEntryGrid}>
        {[
          { title: 'MOS / IC3', description: 'Thi chứng nhận tiếp tục trên website.' },
          { title: 'Thi chứng nhận môn học', description: 'Chức năng này hiện được thực hiện trên website.' },
          { title: 'Xem điểm của tôi', description: 'Điểm thi chính thức xem trên website.' },
        ].map((item) => (
          <Pressable key={item.title} onPress={() => Alert.alert(item.title, 'Chức năng này hiện được thực hiện trên website.')} accessibilityRole="button">
            <Card style={styles.examEntry}>
              <View style={styles.menuIcon}><GraduationCap size={20} color={colors.brand} /></View>
              <View style={styles.flex}><Text style={styles.cardTitle}>{item.title}</Text><Text style={styles.muted}>{item.description}</Text></View>
              <ChevronRight size={18} color={colors.muted} />
            </Card>
          </Pressable>
        ))}
      </View>
      <SectionHeading title="Thi và trắc nghiệm — WEB-ONLY TẠM THỜI" />
      <Card>
        <Text style={styles.cardTitle}>Thực hiện trên website</Text>
        <Text style={styles.body}>Bài thi, bài trắc nghiệm được giao và điểm chính thức vẫn được giữ trong inventory chức năng web. Mobile hiện không mở attempt, làm bài, camera/proctoring hoặc gửi kết quả.</Text>
      </Card>
    </AppScreen>
  );
}

function LessonRow({ lesson, onPress }: { lesson: LearningLesson; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={lesson.locked} accessibilityRole="button">
      <Card style={{ ...styles.lessonRow, ...(lesson.locked ? styles.dimmed : {}) }}>
        {lesson.completed ? <CheckCircle2 size={19} color={colors.green} /> : <BookOpen size={19} color={colors.brand} />}
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{lesson.title}</Text>
          <Text style={styles.caption}>{lesson.duration} · {lesson.locked ? 'Đang khóa' : lesson.completed ? 'Hoàn thành' : `${lesson.progress}%`}</Text>
        </View>
        <ChevronRight size={18} color={colors.muted} />
      </Card>
    </Pressable>
  );
}

export function LearningLessonScreen() {
  const route = useRoute<NativeStackScreenProps<AppStackParamList, 'LearningLesson'>['route']>();
  const loader = useCallback(() => learningService.courses(), []);
  const resource = useMockResource(loader);
  const [completed, setCompleted] = useState(false);
  const course = resource.data?.find((item) => item._id === route.params.courseId);
  const unit = course?.units.find((item) => item._id === route.params.unitId);
  const lesson = unit?.sections.find((item) => item._id === route.params.lessonId);
  return (
    <AppScreen>
      <AppHeader title={lesson?.title || 'Bài học'} subtitle={`${course?.title || ''} · ${unit?.title || ''}`} />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {lesson ? (
        <>
          <Card style={styles.player}>
            <BookOpen size={38} color={colors.brand} />
            <Text style={styles.title}>Nội dung bài học</Text>
            <Text style={styles.muted}>Trình phát video sẽ được tích hợp theo nguồn nội dung khóa học ở giai đoạn phù hợp.</Text>
          </Card>
          <Card>
            <Text style={styles.cardTitle}>{lesson.title}</Text>
            <Text style={styles.muted}>Thời lượng: {lesson.duration}</Text>
            <Text style={styles.body}>{course?.description}</Text>
            <PrimaryButton title={completed || lesson.completed ? 'Đã hoàn thành' : 'Đánh dấu đã học'} onPress={() => setCompleted(true)} disabled={completed || lesson.completed} />
          </Card>
        </>
      ) : (!resource.loading ? <EmptyState title="Không tìm thấy bài học" message="Bài học này không có trong dữ liệu demo." /> : null)}
    </AppScreen>
  );
}

export function EvaluationsScreen() {
  const loader = useCallback(() => evaluationService.list(), []);
  const resource = useMockResource(loader);
  const [active, setActive] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'center' | 'teacher'>('center');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submittedIds, setSubmittedIds] = useState<string[]>([]);
  const [submittedStars, setSubmittedStars] = useState<Record<string, number>>({});
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  useEffect(() => {
    const existing = resource.data?.filter((evaluation) => evaluation.public && evaluation.existingRating) || [];
    if (!existing.length) return;
    setSubmittedIds((current) => [...new Set([...current, ...existing.map((evaluation) => evaluation.id)])]);
    setSubmittedStars((current) => ({
      ...current,
      ...Object.fromEntries(existing.map((evaluation) => [evaluation.id, evaluation.existingRating!.stars])),
    }));
    setComments((current) => ({
      ...current,
      ...Object.fromEntries(existing.map((evaluation) => [evaluation.id, evaluation.existingRating!.comment || ''])),
    }));
    setAnswers((current) => ({
      ...current,
      ...Object.fromEntries(existing.flatMap((evaluation) => Object.entries(evaluation.existingRating!.criteria || {}).map(([key, value]) => [`${evaluation.id}-${key}`, value]))),
    }));
  }, [resource.data]);
  const updateAnswer = (id: string, value: string) => setAnswers((current) => ({ ...current, [id]: value }));
  const submit = (evaluation: DemoEvaluation) => {
    if (evaluation.public) {
      const criteria = ['teaching', 'voice', 'guidance', 'support'];
      if (criteria.some((key) => !answers[`${evaluation.id}-${key}`])) {
        setValidationMessage('Vui lòng chọn một mức cho từng tiêu chí.');
        return;
      }
      const scoreByKey: Record<string, number> = {
        effective: 5, normal: 3, limited: 1, good: 5, hard: 2,
        fast: 4, ok: 5, slow: 2, enthusiastic: 5, moderate: 3, none: 1,
      };
      const score = criteria.reduce((sum, key) => sum + (scoreByKey[answers[`${evaluation.id}-${key}`]] || 0), 0) / criteria.length;
      setSubmittedStars((current) => ({ ...current, [evaluation.id]: Math.round(score * 10) / 10 }));
    }
    setSubmittedIds((current) => current.includes(evaluation.id) ? current : [...current, evaluation.id]);
    setValidationMessage('');
    setFeedbackMessage('Đã lưu phản hồi trong phiên demo này; chưa gửi tới hệ thống.');
    setActive(null);
  };
  const evaluations = resource.data || [];
  const visibleEvaluations = evaluations.filter((evaluation) => activeTab === 'teacher' ? evaluation.public : !evaluation.public);
  const publicCriteria = [
    { key: 'teaching', label: 'Phương pháp dạy', options: [['effective', 'Hiệu quả'], ['normal', 'Bình thường'], ['limited', 'Kiến thức còn hạn chế']] },
    { key: 'voice', label: 'Giọng nói', options: [['good', 'Ổn'], ['hard', 'Khó nghe']] },
    { key: 'guidance', label: 'Hướng dẫn', options: [['fast', 'Nhanh'], ['ok', 'Ổn'], ['slow', 'Chậm']] },
    { key: 'support', label: 'Hỗ trợ học viên', options: [['enthusiastic', 'Nhiệt tình'], ['moderate', 'Tương đối'], ['none', 'Không hỗ trợ']] },
  ] as const;
  return (
    <AppScreen>
      <AppHeader title="Đánh giá" subtitle="Phản hồi khóa học và giảng viên" />
      <Card style={styles.evaluationIntro}>
        <Star size={24} color={colors.gold} />
        <View style={styles.rowCopy}>
          <Text style={styles.cardTitle}>Trung tâm Lắng nghe Bạn!</Text>
          <Text style={styles.muted}>Phản hồi của bạn giúp chúng tôi cải thiện chất lượng giảng dạy. Mọi đánh giá riêng cho Trung tâm đều được bảo mật 100%.</Text>
        </View>
      </Card>
      <View style={styles.assignmentTabs}>
        {[
          { key: 'center' as const, label: 'Phản hồi Trung tâm' },
          { key: 'teacher' as const, label: 'Đánh giá GV' },
        ].map((tab) => (
          <Pressable key={tab.key} onPress={() => { setActiveTab(tab.key); setActive(null); }} style={[styles.assignmentTab, activeTab === tab.key && styles.assignmentTabActive]} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab.key }}>
            <Text style={[styles.assignmentTabText, activeTab === tab.key && styles.assignmentTabActiveText]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {feedbackMessage ? <Text style={styles.evaluationSuccess}>{feedbackMessage}</Text> : null}
      <SectionHeading title={activeTab === 'center' ? 'Phản hồi về khóa học (Bảo mật)' : 'Đánh giá Giảng viên (Công khai)'} />
      {visibleEvaluations.map((evaluation) => (
        <Card key={evaluation.id}>
          <Text style={styles.cardTitle}>{evaluation.courseName}</Text>
          <Text style={styles.muted}>GV: {evaluation.teacherName || 'Chưa phân công'}</Text>
          <Text style={styles.caption}>Tiến độ: {evaluation.completedSessions}/{evaluation.totalSessions} buổi</Text>
          {submittedIds.includes(evaluation.id) ? (
            <View style={styles.evaluationSubmitted}>
              <StatusBadge label="Đã gửi" />
              {evaluation.public ? <Text style={styles.evaluationRating}>{(submittedStars[evaluation.id] ?? evaluation.existingRating?.stars)?.toFixed(1) || '—'} ★</Text> : null}
            </View>
          ) : null}
          {evaluation.public && evaluation.locked ? (
            <Card style={styles.evaluationLocked}>
              <Text style={styles.cardTitle}>Đánh giá đã khóa</Text>
              <Text style={styles.muted}>Khóa học đã kết thúc; không thể gửi hoặc chỉnh sửa đánh giá này.</Text>
            </Card>
          ) : evaluation.public && evaluation.completedSessions * 2 < evaluation.totalSessions ? (
            <Card style={styles.evaluationLocked}>
              <Text style={styles.cardTitle}>Chưa đủ buổi để được đánh giá</Text>
              <Text style={styles.muted}>Cần học ít nhất {Math.ceil(evaluation.totalSessions / 2)}/{evaluation.totalSessions} buổi (hiện {evaluation.completedSessions}/{evaluation.totalSessions}).</Text>
            </Card>
          ) : (
            <PrimaryButton title={active === evaluation.id ? 'Đóng form' : submittedIds.includes(evaluation.id) || evaluation.completed ? evaluation.public ? 'Cập nhật lại đánh giá' : 'Sửa Phản hồi' : evaluation.public ? 'Đánh giá giảng viên' : 'Gửi Phản hồi'} variant="secondary" onPress={() => { setFeedbackMessage(''); setValidationMessage(''); setActive(active === evaluation.id ? null : evaluation.id); }} />
          )}
          {active === evaluation.id && !evaluation.locked ? (
            <View style={styles.form}>
              {!evaluation.public ? (
                <>
                  {[
                    { key: 'satisfied', label: 'Mức độ hài lòng với trung tâm?', options: [['yes', 'Rất hài lòng'], ['no', 'Bình thường']] },
                    { key: 'lessonClear', label: 'Giảng viên dạy dễ hiểu không?', options: [['yes', 'Dễ hiểu'], ['no', 'Hơi khó hiểu']] },
                  ].map((criterion) => (
                    <View key={criterion.key}>
                      <Text style={styles.fieldLabel}>{criterion.label}</Text>
                      <View style={styles.chips}>
                        {criterion.options.map(([value, label]) => (
                          <Pressable key={value} onPress={() => updateAnswer(`${evaluation.id}-${criterion.key}`, value)} style={[styles.choice, (answers[`${evaluation.id}-${criterion.key}`] || 'yes') === value && styles.choiceActive]}>
                            <Text style={[styles.choiceText, (answers[`${evaluation.id}-${criterion.key}`] || 'yes') === value && styles.choiceTextActive]}>{label}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  ))}
                </>
              ) : publicCriteria.map((criterion) => (
                <View key={criterion.key}>
                  <Text style={styles.fieldLabel}>{criterion.label}</Text>
                  <View style={styles.chips}>
                    {criterion.options.map(([value, label]) => (
                      <Pressable key={value} onPress={() => updateAnswer(`${evaluation.id}-${criterion.key}`, value)} style={[styles.choice, answers[`${evaluation.id}-${criterion.key}`] === value && styles.choiceActive]}>
                        <Text style={[styles.choiceText, answers[`${evaluation.id}-${criterion.key}`] === value && styles.choiceTextActive]}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              {validationMessage ? <Text style={styles.validationText}>{validationMessage}</Text> : null}
              <TextInput value={comments[evaluation.id] || ''} onChangeText={(value) => setComments((current) => ({ ...current, [evaluation.id]: value }))} placeholder={evaluation.public ? 'Chia sẻ thêm nếu bạn muốn...' : 'Nhập điều bạn chưa hài lòng hoặc muốn trung tâm cải thiện...'} multiline style={styles.textArea} />
              <PrimaryButton
                title={evaluation.public && ['teaching', 'voice', 'guidance', 'support'].some((key) => !answers[`${evaluation.id}-${key}`]) ? 'CHỌN ĐỦ TIÊU CHÍ ĐỂ GỬI' : evaluation.public ? submittedIds.includes(evaluation.id) ? 'CẬP NHẬT ĐÁNH GIÁ DEMO' : 'GỬI ĐÁNH GIÁ CÔNG KHAI' : 'GỬI PHẢN HỒI CHO TRUNG TÂM'}
                disabled={evaluation.public && ['teaching', 'voice', 'guidance', 'support'].some((key) => !answers[`${evaluation.id}-${key}`])}
                onPress={() => submit(evaluation)}
              />
              {!evaluation.public ? <Text style={styles.note}>Mọi thông tin bạn gửi ở đây Giảng viên sẽ KHÔNG biết.</Text> : null}
            </View>
          ) : null}
        </Card>
      ))}
      {!resource.loading && !resource.error && !visibleEvaluations.length ? <EmptyState title={activeTab === 'teacher' ? 'Chưa có giảng viên được phân công để đánh giá.' : 'Chưa có khóa học nào để phản hồi.'} message="Các mục đánh giá sẽ xuất hiện theo khóa học và tiến độ." /> : null}
    </AppScreen>
  );
}

export function FeedScreen() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const loader = useCallback(() => feedService.posts(), []);
  const resource = useMockResource(loader);
  const [posts, setPosts] = useState<DemoFeedPost[] | null>(null);
  const [comment, setComment] = useState('');
  const [draft, setDraft] = useState('');
  const [audience, setAudience] = useState('Công khai');
  const [attachImage, setAttachImage] = useState(false);
  const items = posts || resource.data || [];
  return (
    <AppScreen>
      <AppHeader title={isTeacher ? 'Bảng tin trao đổi & Hỏi bài' : 'Bảng tin'} subtitle="Bài đăng dành cho lớp học" />
      {isTeacher ? <Card style={styles.feedComposer}>
        <View style={styles.feedAuthorRow}>
          <Avatar name={user?.name || 'Giảng viên'} color={user?.avatarColor} size={42} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{user?.name || 'Giảng viên'}</Text>
            <Text style={styles.caption}>Giảng viên</Text>
          </View>
        <Pressable onPress={() => Alert.alert('Quyền riêng tư / Đối tượng xem', 'Chọn đối tượng xem bài viết.', [
          { text: 'Công khai', onPress: () => setAudience('Công khai') },
          { text: 'Chỉ Giảng viên & Admin', onPress: () => setAudience('Chỉ Giảng viên & Admin') },
          { text: 'Chỉ Học viên & Admin', onPress: () => setAudience('Chỉ Học viên & Admin') },
          { text: 'Hủy', style: 'cancel' },
        ])} style={styles.privacyButton} accessibilityRole="button" accessibilityLabel="Chọn quyền riêng tư bài đăng">
          <Text style={styles.privacyText}>{audience}</Text>
        </Pressable>
        </View>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Bạn muốn chia sẻ điều gì?" multiline style={styles.feedDraft} accessibilityLabel="Nội dung bài đăng demo" />
        {attachImage ? <View style={styles.feedImagePlaceholder}><ImagePlus size={22} color={colors.muted} /><Text style={styles.metaText}>Ảnh demo · Không tải lên</Text></View> : null}
        <View style={styles.feedComposerActions}>
          <Pressable onPress={() => setAttachImage((value) => !value)} style={styles.feedImageAction} accessibilityRole="button" accessibilityLabel="Thêm ảnh demo">
            <ImagePlus size={19} color={colors.green} /><Text style={styles.actionText}>{attachImage ? 'Bỏ ảnh' : 'Thêm ảnh'}</Text>
          </Pressable>
          <PrimaryButton title="Đăng bài" disabled={!draft.trim()} onPress={() => {
            const content = draft.trim();
            if (!content) return;
            setPosts([{
              id: `feed-${Date.now()}`, author: user?.name || 'Giảng viên', role: 'Giảng viên',
              time: 'Vừa xong', content, audience, mediaType: attachImage ? 'image' : undefined,
              comments: [], reactionCount: 0,
            }, ...items]);
            setDraft('');
            setAttachImage(false);
          }} />
        </View>
        <Text style={styles.note}>Bài đăng và ảnh chỉ được giữ cục bộ trong bản demo.</Text>
      </Card>
        : null}
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {items.map((post) => (
        <Card key={post.id}>
          <View style={styles.feedAuthorRow}><Avatar name={post.author} color={colors.brandSoft} size={42} /><View style={styles.flex}><Text style={styles.cardTitle}>{post.author}</Text><Text style={styles.caption}>{post.role} · {post.time}</Text></View></View>
          {isTeacher ? <Text style={styles.feedAudience}>{post.audience}</Text> : null}
          <Text style={styles.body}>{post.content}</Text>
          {post.mediaType === 'image' ? <View style={styles.feedImagePlaceholder}><ImagePlus size={22} color={colors.muted} /><Text style={styles.metaText}>Ảnh đính kèm demo</Text></View> : null}
          <View style={styles.row}>
            <Pressable onPress={() => setPosts(items.map((item) => item.id === post.id ? { ...item, reactionCount: item.reactionCount + 1 } : item))} style={styles.action}><Star size={16} color={colors.brand} /><Text style={styles.actionText}>Quan tâm {post.reactionCount}</Text></Pressable>
            <Text style={styles.actionText}>{post.comments.length} bình luận</Text>
          </View>
          {post.comments.map((item) => <Text key={item.id} style={styles.comment}><Text style={styles.strong}>{item.author}: </Text>{item.text}</Text>)}
          <View style={styles.commentComposer}>
            <TextInput value={comment} onChangeText={setComment} placeholder="Viết bình luận" style={styles.commentInput} />
            <Pressable onPress={() => {
              const text = comment.trim();
              if (!text) return;
              setPosts(items.map((item) => item.id === post.id ? { ...item, comments: [...item.comments, { id: `comment-${Date.now()}`, author: 'Bạn', text }] } : item));
              setComment('');
            }} accessibilityRole="button" accessibilityLabel="Gửi bình luận demo">
              <MessageSquareText size={20} color={colors.brand} />
            </Pressable>
          </View>
        </Card>
      ))}
      {!resource.loading && !resource.error && !items.length ? <EmptyState title="Chưa có bài đăng" message="Bài đăng mới sẽ hiển thị tại đây." /> : null}
    </AppScreen>
  );
}

export function NewsScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const loader = useCallback(() => feedService.news(), []);
  const resource = useMockResource(loader);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState('Tất cả');
  const [sort, setSort] = useState('Mới nhất');
  const [time, setTime] = useState('Tất cả');
  const [layout, setLayout] = useState<'list' | 'grid'>('list');
  const topics = ['Tất cả', ...new Set((resource.data || []).map((news) => news.topic))];
  const articles = useMemo(() => {
    const filtered = (resource.data || []).filter((news) => (
      `${news.title} ${news.topic} ${news.excerpt}`.toLowerCase().includes(query.toLowerCase())
      && (topic === 'Tất cả' || news.topic === topic)
      && (time === 'Tất cả' || news.publishedAt.toLowerCase().includes('hôm nay'))
    ));
    if (sort === 'Xem nhiều') return filtered.sort((a, b) => b.views - a.views);
    return sort === 'Cũ nhất' ? filtered.reverse() : filtered;
  }, [resource.data, query, sort, time, topic]);
  return (
    <AppScreen>
      <AppHeader title="Tin tức" subtitle="Tin tức và thông báo của trung tâm" />
      {isTeacher ? (
        <>
          <View style={styles.newsSearch}>
            <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => setQuery(draft.trim())} returnKeyType="search" placeholder="Tìm kiếm tin tức" style={styles.newsSearchInput} />
            <Pressable onPress={() => setQuery(draft.trim())} style={styles.newsSearchButton} accessibilityRole="button"><Text style={styles.newsSearchButtonText}>Tìm</Text></Pressable>
          </View>
          <View style={styles.newsToolbar}>
        <Pressable onPress={() => setLayout((current) => current === 'list' ? 'grid' : 'list')} style={styles.newsControl} accessibilityRole="button" accessibilityLabel={`Chuyển sang chế độ ${layout === 'list' ? 'lưới' : 'danh sách'}`}>
          <Text style={styles.newsControlText}>{layout === 'list' ? '▦ Lưới' : '☰ Danh sách'}</Text>
        </Pressable>
        <Pressable onPress={() => Alert.alert('Sắp xếp', 'Chọn thứ tự hiển thị.', [
          { text: 'Mới nhất', onPress: () => setSort('Mới nhất') },
          { text: 'Cũ nhất', onPress: () => setSort('Cũ nhất') },
          { text: 'Xem nhiều', onPress: () => setSort('Xem nhiều') },
          { text: 'Hủy', style: 'cancel' },
        ])} style={styles.newsControl} accessibilityRole="button"><Text style={styles.newsControlText}>Sắp xếp: {sort}</Text></Pressable>
        <Pressable onPress={() => Alert.alert('Thời gian', 'Lọc theo thời gian hiển thị trong dữ liệu demo.', [
          { text: 'Tất cả', onPress: () => setTime('Tất cả') },
          { text: 'Hôm nay', onPress: () => setTime('Hôm nay') },
          { text: 'Hủy', style: 'cancel' },
        ])} style={styles.newsControl} accessibilityRole="button"><Text style={styles.newsControlText}>Thời gian: {time}</Text></Pressable>
          </View>
          <View style={styles.chips}>{topics.map((item) => <Pressable key={item} onPress={() => setTopic(item)} style={[styles.choice, topic === item && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: topic === item }}><Text style={[styles.choiceText, topic === item && styles.choiceTextActive]}>{item}</Text></Pressable>)}</View>
        </>
      ) : <SearchField value={query} onChangeText={setQuery} placeholder="Tìm tin tức" />}
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      <View style={isTeacher && layout === 'grid' ? styles.newsGrid : undefined}>
        {articles.map((news) => (
          <Pressable key={news.id} onPress={() => navigation.navigate('NewsDetail', { newsId: news.id })} style={isTeacher && layout === 'grid' ? styles.newsGridItem : undefined} accessibilityRole="button">
            <Card style={isTeacher && layout === 'grid' ? styles.newsGridCard : undefined}>
              {isTeacher ? <View style={styles.newsThumbnail}><Newspaper size={24} color={colors.muted} /><Text style={styles.metaText}>—</Text></View> : null}
              <Text style={styles.caption}>{news.topic} · {news.publishedAt}</Text>
              <Text style={styles.cardTitle}>{news.title}</Text>
              {!isTeacher || layout === 'list' ? <Text style={styles.body}>{news.excerpt}</Text> : null}
              {isTeacher ? <Text style={styles.metaText}>Tác giả: — · {news.views} lượt xem · {news.publishedAt}</Text> : null}
              <Text style={styles.link}>Xem chi tiết</Text>
            </Card>
          </Pressable>
        ))}
      </View>
      {!resource.loading && !resource.error && !articles.length ? <EmptyState title="Không có tin phù hợp" message="Thử từ khóa khác." /> : null}
    </AppScreen>
  );
}

export function NewsDetailScreen() {
  const route = useRoute<NativeStackScreenProps<AppStackParamList, 'NewsDetail'>['route']>();
  const loader = useCallback(() => feedService.news(), []);
  const resource = useMockResource(loader);
  const news = resource.data?.find((item) => item.id === route.params.newsId);
  return (
    <AppScreen>
      <AppHeader title="Chi tiết tin tức" subtitle={news?.topic} />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {news ? <Card>
        <Text style={styles.title}>{news.title}</Text>
        <Text style={styles.caption}>{news.publishedAt} · {news.views} lượt xem</Text>
        <Text style={styles.body}>{news.content}</Text>
        {news.attachments.map((file) => <Text key={file} style={styles.link}>{file}</Text>)}
      </Card> : null}
    </AppScreen>
  );
}

export function CenterInfoScreen() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const loader = useCallback(() => feedService.centerInfo(), []);
  const resource = useMockResource(loader);
  const center = resource.data;
  const centerSections = isTeacher
    ? center?.sections || []
    : [{ title: 'Nhân sự' }, { title: 'Chi nhánh' }, { title: 'Dịch vụ' }, { title: 'Địa điểm thi' }, { title: 'Chứng chỉ' }];
  const [section, setSection] = useState('Tổng quan');
  return (
    <AppScreen>
      <AppHeader title="Thông tin Trung tâm" subtitle="Thông tin và các mục của trung tâm" />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {center ? (
        <>
          {isTeacher ? <><Pressable onPress={() => Alert.alert('Thông tin Trung tâm', 'Chọn mục cần xem.', [
            { text: 'Tổng quan', onPress: () => setSection('Tổng quan') },
            ...centerSections.map((item: { title: string }) => ({ text: item.title, onPress: () => setSection(item.title) })),
            { text: 'Hủy', style: 'cancel' as const },
          ])} style={styles.centerDropdown} accessibilityRole="button">
            <Text style={styles.centerDropdownText}>{section}  ▾</Text>
          </Pressable>
          <Card style={styles.centerBanner}>
            <View style={styles.centerLogo}><Building2 size={30} color={colors.brand} /></View>
            <Text style={styles.title}>{center.name}</Text>
            <Text style={styles.body}>{center.intro || '—'}</Text>
          </Card>
          {section === 'Tổng quan' ? (
            <Card>
              <SectionHeading title="Thông tin Trung tâm" />
              {[
                ['Thành lập', '—'],
                ['Địa chỉ', center.headquartersAddress || '—'],
                ['Điện thoại', center.contactPhone || '—'],
                ['Email', center.contactEmail || '—'],
                ['Website', center.website || '—'],
                ['Sứ mệnh', center.mission || '—'],
                ['Tầm nhìn', center.vision || '—'],
                ['Giá trị cốt lõi', center.coreValues || '—'],
              ].map(([label, value]) => <View key={label} style={styles.centerInfoRow}><Text style={styles.metaText}>{label}</Text><Text style={styles.centerInfoValue}>{value}</Text></View>)}
            </Card>
          ) : (
            <Card>
              <View style={styles.rowBetween}><Building2 size={18} color={colors.brand} /><Text style={[styles.cardTitle, styles.flex]}>{section}</Text></View>
              <Text style={styles.muted}>—</Text>
            </Card>
          )}
          <SectionHeading title="Các mục Trung tâm" />
          <View style={styles.centerSections}>
            {centerSections.map((item: { title: string }) => (
              <Pressable key={item.title} onPress={() => setSection(item.title)} style={styles.centerSection} accessibilityRole="button">
                <Text style={styles.centerSectionText}>{item.title}</Text><ChevronRight size={17} color={colors.muted} />
              </Pressable>
            ))}
          </View>
          </> : (
            <>
              <Card>
                <Text style={styles.title}>{center.name}</Text>
                <Text style={styles.body}>{center.intro || 'Nội dung giới thiệu chưa có trong dữ liệu demo.'}</Text>
                {[
                  ['Địa chỉ', center.headquartersAddress],
                  ['Điện thoại', center.contactPhone],
                  ['Email', center.contactEmail],
                  ['Website', center.website],
                ].map(([label, value]) => <Text key={label} style={styles.muted}>{label}: {value || 'Chưa có dữ liệu'}</Text>)}
              </Card>
              {centerSections.map((item: { title: string }) => (
                <Card key={item.title} style={styles.unitRow}>
                  <Building2 size={18} color={colors.brand} />
                  <Text style={[styles.cardTitle, styles.flex]}>{item.title}</Text>
                  <ChevronRight size={18} color={colors.muted} />
                </Card>
              ))}
            </>
          )}
        </>
      ) : null}
    </AppScreen>
  );
}

export function SoftwareLinksScreen() {
  const loader = useCallback(() => softwareService.list(), []);
  const resource = useMockResource(loader);
  return (
    <AppScreen>
      <AppHeader title="Phần mềm" subtitle="Các phần mềm trong tài nguyên khóa học" />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {(resource.data || []).map((item) => (
        <Card key={item.id}>
          <Text style={styles.cardTitle}>{item.name}</Text>
          <Text style={styles.caption}>{item.category}</Text>
          <Text style={styles.body}>{item.description}</Text>
          <Text style={styles.muted}>{item.url ? 'Liên kết phần mềm có sẵn' : 'Chưa có liên kết được cung cấp'}</Text>
        </Card>
      ))}
      {!resource.loading && !resource.error && !resource.data?.length ? <EmptyState title="Chưa có phần mềm" message="Phần mềm sẽ hiển thị theo khóa học." /> : null}
    </AppScreen>
  );
}

export function TeacherQuizzesScreen() {
  const navigation = useNavigation<Navigation>();
  const loader = useCallback(() => quizService.list(), []);
  const resource = useMockResource(loader);
  const studentsLoader = useCallback(() => studentService.assigned(), []);
  const studentsResource = useMockResource(studentsLoader);
  const [quizzes, setQuizzes] = useState<DemoQuiz[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [courseName, setCourseName] = useState('');
  const [targetAll, setTargetAll] = useState(true);
  const [targetStudentIds, setTargetStudentIds] = useState<string[]>([]);
  const [timeLimit, setTimeLimit] = useState('20');
  const [startTime, setStartTime] = useState('');
  const [deadline, setDeadline] = useState('');
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState('trung bình');
  const [quizToolsMessage, setQuizToolsMessage] = useState('');
  const [questions, setQuestions] = useState<Array<{ text: string; options: string[]; correctOption: number; explanation: string }>>([
    { text: '', options: ['', '', '', ''], correctOption: 0, explanation: '' },
  ]);
  const items = quizzes || resource.data || [];
  const students = studentsResource.data || [];
  const courses = [...new Set(students.map((student) => student.course).filter(Boolean))];
  const courseStudents = students.filter((student) => !courseName || student.course === courseName);
  const updateQuestion = (questionIndex: number, update: (question: typeof questions[number]) => typeof questions[number]) => {
    setQuestions((current) => current.map((question, index) => index === questionIndex ? update(question) : question));
  };
  const resetCreateForm = () => {
    setTitle('');
    setTargetAll(true);
    setTargetStudentIds([]);
    setTimeLimit('20');
    setStartTime('');
    setDeadline('');
    setQuestions([{ text: '', options: ['', '', '', ''], correctOption: 0, explanation: '' }]);
  };
  return (
    <AppScreen>
      <AppHeader title="Giao bài tập & kiểm tra" subtitle="Quản lý Trắc nghiệm mỗi buổi học" />
      <View style={styles.quizTabs}>
        <View style={[styles.quizTab, styles.quizTabActive]}><Text style={styles.quizTabActiveText}>Bài thi Trắc nghiệm</Text></View>
        <Pressable onPress={() => navigation.navigate('Assignments')} style={styles.quizTab} accessibilityRole="button"><Text style={styles.quizTabText}>Bài tập về nhà (Nộp file)</Text></Pressable>
      </View>
      <SectionHeading title="Quản lý Trắc nghiệm mỗi buổi học" />
      <PrimaryButton title={showCreate ? 'Đóng biểu mẫu' : '+ Tạo bài trắc nghiệm mới'} onPress={() => setShowCreate(!showCreate)} variant="secondary" />
      {showCreate ? (
        <Card>
          <TextInput value={title} onChangeText={setTitle} placeholder="Tên bài trắc nghiệm" style={styles.input} />
          <Text style={styles.fieldLabel}>Khóa học</Text>
          {studentsResource.loading ? <LoadingSkeleton rows={1} /> : null}
          {studentsResource.error ? <ErrorState onRetry={studentsResource.reload} /> : null}
          <View style={styles.chips}>
            {courses.map((course) => <Pressable key={course} onPress={() => { setCourseName(course); setTargetStudentIds([]); }} style={[styles.choice, courseName === course && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: courseName === course }}><Text style={[styles.choiceText, courseName === course && styles.choiceTextActive]}>{course}</Text></Pressable>)}
          </View>
          {!courses.length && !studentsResource.loading ? <Text style={styles.note}>Khóa học chưa có trong dữ liệu demo — không thể gán học viên cụ thể.</Text> : null}
          <Text style={styles.fieldLabel}>Đối tượng</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setTargetAll(true)} style={[styles.choice, targetAll && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: targetAll }}><Text style={[styles.choiceText, targetAll && styles.choiceTextActive]}>Cả lớp ({courseStudents.length || '—'})</Text></Pressable>
            <Pressable onPress={() => setTargetAll(false)} style={[styles.choice, !targetAll && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: !targetAll }}><Text style={[styles.choiceText, !targetAll && styles.choiceTextActive]}>Chọn học viên</Text></Pressable>
          </View>
          {!targetAll ? (
            <View style={styles.studentTargetList}>
              {courseStudents.map((student) => {
                const selected = targetStudentIds.includes(student.id);
                return <Pressable key={student.id} onPress={() => setTargetStudentIds((current) => selected ? current.filter((id) => id !== student.id) : [...current, student.id])} style={[styles.studentTarget, selected && styles.studentTargetSelected]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}><Text style={styles.studentTargetText}>{selected ? '✓  ' : ''}{student.name} · {student.course}</Text></Pressable>;
              })}
              {!courseStudents.length ? <Text style={styles.note}>Không có học viên demo cho khóa này.</Text> : null}
            </View>
          ) : null}
          <TextInput value={timeLimit} onChangeText={setTimeLimit} keyboardType="number-pad" placeholder="Thời gian (phút)" style={styles.input} />
          <TextInput value={startTime} onChangeText={setStartTime} placeholder="Thời gian bắt đầu · YYYY-MM-DD HH:mm" style={styles.input} />
          <TextInput value={deadline} onChangeText={setDeadline} placeholder="Hạn kết thúc · YYYY-MM-DD HH:mm" style={styles.input} />
          <View style={styles.quizTools}>
            <Text style={styles.fieldLabel}>Ngân hàng câu hỏi</Text>
            <View style={styles.quizActions}>
              {['Nhập câu hỏi', 'Mẫu', 'Xuất'].map((action) => (
                <Pressable key={action} onPress={() => setQuizToolsMessage(`${action}: thao tác tệp không được kết nối trong bản demo.`)} style={styles.quizAction} accessibilityRole="button">
                  <Text style={styles.quizActionText}>{action}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Số câu AI</Text>
            <View style={styles.chips}>
              {[5, 10, 15].map((count) => <Pressable key={count} onPress={() => setAiQuestionCount(count)} style={[styles.choice, aiQuestionCount === count && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: aiQuestionCount === count }}><Text style={[styles.choiceText, aiQuestionCount === count && styles.choiceTextActive]}>{count} câu</Text></Pressable>)}
            </View>
            <Text style={styles.fieldLabel}>Độ khó</Text>
            <View style={styles.chips}>
              {['dễ', 'trung bình', 'khó'].map((difficulty) => <Pressable key={difficulty} onPress={() => setAiDifficulty(difficulty)} style={[styles.choice, aiDifficulty === difficulty && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: aiDifficulty === difficulty }}><Text style={[styles.choiceText, aiDifficulty === difficulty && styles.choiceTextActive]}>{difficulty}</Text></Pressable>)}
            </View>
            <PrimaryButton title="Tạo bằng AI (Gemini)" variant="secondary" onPress={() => setQuizToolsMessage(`AI demo: đã chọn ${aiQuestionCount} câu, độ khó ${aiDifficulty}; không gọi AI thật.`)} />
            {quizToolsMessage ? <Text style={styles.note}>{quizToolsMessage}</Text> : null}
            <Text style={styles.note}>AI và Excel trên web không được kết nối từ mobile demo.</Text>
          </View>
          <SectionHeading title={`Câu hỏi (${questions.length})`} action="Thêm câu" onPress={() => setQuestions((current) => [...current, { text: '', options: ['', '', '', ''], correctOption: 0, explanation: '' }])} />
          {questions.map((question, questionIndex) => (
            <View key={`question-${questionIndex}`} style={styles.questionEditor}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Câu {questionIndex + 1}</Text>
                {questions.length > 1 ? <Pressable onPress={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))} style={styles.questionRemove} accessibilityRole="button" accessibilityLabel={`Xóa câu hỏi ${questionIndex + 1}`}><Text style={styles.quizDeleteText}>Xóa câu</Text></Pressable> : null}
              </View>
              <TextInput value={question.text} onChangeText={(text) => updateQuestion(questionIndex, (current) => ({ ...current, text }))} placeholder="Nội dung câu hỏi" style={[styles.input, styles.textArea]} />
              {question.options.map((option, optionIndex) => (
                <View key={`option-${questionIndex}-${optionIndex}`} style={styles.optionRow}>
                  <Pressable onPress={() => updateQuestion(questionIndex, (current) => ({ ...current, correctOption: optionIndex }))} accessibilityRole="radio" accessibilityLabel={`Đánh dấu phương án ${String.fromCharCode(65 + optionIndex)} câu ${questionIndex + 1} là đáp án đúng`} accessibilityState={{ selected: question.correctOption === optionIndex }}>
                    <Text style={[styles.optionToggle, question.correctOption === optionIndex && styles.optionToggleActive]}>{question.correctOption === optionIndex ? '✓' : String.fromCharCode(65 + optionIndex)}</Text>
                  </Pressable>
                  <TextInput value={option} onChangeText={(value) => updateQuestion(questionIndex, (current) => ({ ...current, options: current.options.map((item, index) => index === optionIndex ? value : item) }))} placeholder={`Phương án ${String.fromCharCode(65 + optionIndex)}`} style={[styles.input, styles.flex]} />
                </View>
              ))}
              <TextInput value={question.explanation} onChangeText={(explanation) => updateQuestion(questionIndex, (current) => ({ ...current, explanation }))} placeholder="Giải thích đáp án (nếu có)" multiline style={[styles.input, styles.textArea]} />
            </View>
          ))}
          <Text style={styles.note}>Lịch mở bài, hạn kết thúc và câu hỏi chỉ lưu trong phiên demo. Không tạo bài thi hoặc gửi thông báo thật.</Text>
          <PrimaryButton title="Thêm vào danh sách demo" onPress={() => {
            const value = title.trim();
            const validQuestions = questions.filter((question) => question.text.trim() && question.options.every((option) => option.trim()));
            if (!value || !validQuestions.length || validQuestions.length !== questions.length) {
              Alert.alert('Thiếu nội dung', 'Nhập tên bài, nội dung và đủ bốn phương án cho từng câu hỏi.');
              return;
            }
            if (courses.length && !courseName) {
              Alert.alert('Chưa chọn khóa học', 'Chọn khóa học trước khi tạo bài trắc nghiệm demo.');
              return;
            }
            const limit = Number(timeLimit);
            if (!Number.isFinite(limit) || limit < 1) {
              Alert.alert('Thời gian chưa hợp lệ', 'Nhập thời gian làm bài lớn hơn 0 phút.');
              return;
            }
            const parseSchedule = (value: string) => {
              if (!value.trim()) return null;
              if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(value.trim())) return Number.NaN;
              return new Date(value.trim().replace(' ', 'T')).getTime();
            };
            const startAt = parseSchedule(startTime);
            const deadlineAt = parseSchedule(deadline);
            if ((startTime.trim() && (startAt === null || !Number.isFinite(startAt) || startAt <= Date.now()))
              || (deadline.trim() && (deadlineAt === null || !Number.isFinite(deadlineAt) || deadlineAt <= Date.now()))
              || (startAt !== null && deadlineAt !== null && deadlineAt <= startAt)) {
              Alert.alert('Lịch bài không hợp lệ', 'Thời gian bắt đầu và hạn kết thúc phải đúng định dạng, ở tương lai và hạn kết thúc sau thời gian bắt đầu.');
              return;
            }
            if (!targetAll && !targetStudentIds.length) {
              Alert.alert('Chưa chọn học viên', 'Chọn ít nhất một học viên hoặc giao cho cả lớp.');
              return;
            }
            const assignedStudents = targetAll ? courseStudents : courseStudents.filter((student) => targetStudentIds.includes(student.id));
            setQuizzes([{
              id: `quiz-${Date.now()}`, title: value, courseName: courseName || '—',
              timeLimitMinutes: limit, startTime: startTime.trim() || undefined, deadline: deadline.trim() || '—', questions: validQuestions.length,
              studentCount: assignedStudents.length || undefined,
              assignedStudentNames: assignedStudents.map((student) => student.name),
              submissions: [],
              sampleQuestions: validQuestions.map((question) => ({ text: question.text.trim(), options: question.options.map((option) => option.trim()), correctOption: question.correctOption })),
            }, ...items]);
            resetCreateForm();
            setShowCreate(false);
          }} />
        </Card>
      ) : null}
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {items.map((quiz) => (
        <QuizCard
          key={quiz.id}
          quiz={quiz}
          onDelete={() => setQuizzes(items.filter((item) => item.id !== quiz.id))}
          onRecreate={() => setQuizzes([{ ...quiz, id: `quiz-${Date.now()}`, title: `${quiz.title} (Tạo lại)`, submissions: [] }, ...items])}
        />
      ))}
      {!resource.loading && !resource.error && !items.length ? <EmptyState title="Chưa có bài trắc nghiệm" message="Bài trắc nghiệm đã tạo sẽ hiển thị tại đây." /> : null}
    </AppScreen>
  );
}

function QuizCard({ quiz, onDelete, onRecreate }: { quiz: DemoQuiz; onDelete: () => void; onRecreate: () => void }) {
  const [showResults, setShowResults] = useState(false);
  const scoredSubmissions = quiz.submissions.filter((submission) => Number.isFinite(submission.score));
  const average = scoredSubmissions.length
    ? `${(scoredSubmissions.reduce((sum, submission) => sum + submission.score, 0) / scoredSubmissions.length).toFixed(1)}%`
    : '—';
  return (
    <Card>
      <Text style={styles.cardTitle}>{quiz.title}</Text>
      <Text style={styles.muted}>{quiz.courseName}</Text>
      <View style={styles.quizMetricGrid}>
        {[
          ['Số học viên', quiz.studentCount != null ? String(quiz.studentCount) : '—'],
          ['Thời lượng', `${quiz.timeLimitMinutes} phút`],
          ['Số câu', String(quiz.questions)],
          ['Số bài đã nộp', String(quiz.submissions.length)],
          ['Điểm trung bình', average],
        ].map(([label, value]) => <View key={label} style={styles.quizMetric}><Text style={styles.metaText}>{label}</Text><Text style={styles.cardTitle}>{value}</Text></View>)}
      </View>
      <Text style={styles.caption}>Hạn: {quiz.deadline}</Text>
      {quiz.startTime ? <Text style={styles.caption}>Bắt đầu: {quiz.startTime}</Text> : null}
      {quiz.assignedStudentNames?.length ? <Text style={styles.metaText}>Học viên: {quiz.assignedStudentNames.join(', ')}</Text> : null}
      {quiz.sampleQuestions?.map((question, questionIndex) => (
        <View key={`${quiz.id}-question-${questionIndex}`} style={styles.questionPreview}>
          <Text style={styles.cardTitle}>Câu {questionIndex + 1}: {question.text}</Text>
          {question.options.map((option, optionIndex) => <Text key={`${quiz.id}-option-${optionIndex}`} style={styles.caption}>{String.fromCharCode(65 + optionIndex)}. {option}{question.correctOption === optionIndex ? ' · Đáp án đúng' : ''}</Text>)}
        </View>
      ))}
      <SectionHeading title={`Bài nộp (${quiz.submissions.length})`} />
      {showResults ? quiz.submissions.map((submission) => <Text key={submission.studentName} style={styles.muted}>{submission.studentName} · {submission.score}% · {submission.status === 'passed' ? 'Đạt' : 'Đã nộp'}</Text>) : null}
      <View style={styles.quizActions}>
        <Pressable onPress={onRecreate} style={styles.quizAction} accessibilityRole="button"><Text style={styles.quizActionText}>Tạo lại</Text></Pressable>
        <Pressable onPress={() => setShowResults((value) => !value)} style={styles.quizAction} accessibilityRole="button"><Text style={styles.quizActionText}>{showResults ? 'Ẩn kết quả' : 'Xem kết quả'}</Text></Pressable>
        <Pressable onPress={onDelete} style={[styles.quizAction, styles.quizDelete]} accessibilityRole="button"><Text style={styles.quizDeleteText}>Xóa</Text></Pressable>
      </View>
    </Card>
  );
}

export function TeacherTrainingScreen() {
  const loader = useCallback(() => trainingService.list(), []);
  const resource = useMockResource(loader);
  const softwareLoader = useCallback(() => softwareService.list(), []);
  const software = useMockResource(softwareLoader);
  const courses = resource.data || [];
  const [expanded, setExpanded] = useState<string[]>([]);
  const [tab, setTab] = useState('Khóa học');
  return (
    <AppScreen>
      <AppHeader title="Khóa đào tạo" subtitle="Nội dung học tập và tài liệu được giao" />
      <View style={styles.trainingTabs}>
        {['Khóa học', 'Quy trình', 'Tài liệu', 'Phần mềm'].map((item) => (
          <Pressable key={item} onPress={() => setTab(item)} style={[styles.trainingTab, tab === item && styles.trainingTabActive]} accessibilityRole="button" accessibilityState={{ selected: tab === item }}>
            <Text style={[styles.trainingTabText, tab === item && styles.trainingTabTextActive]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {tab === 'Phần mềm' ? (
        <>
          {software.loading ? <LoadingSkeleton /> : null}
          {software.error ? <ErrorState onRetry={software.reload} /> : null}
          {(software.data || []).map((item) => <Card key={item.id}><Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.metaText}>{item.category}</Text><Text style={styles.muted}>{item.description}</Text></Card>)}
          {!software.loading && !software.error && !software.data?.length ? <EmptyState title="Chưa có phần mềm" message="Chưa có dữ liệu phần mềm trong bản demo." /> : null}
        </>
      ) : tab === 'Tài liệu' ? (
        courses.flatMap((course) => course.files.map((file) => <Card key={`${course.id}-${file}`} style={styles.unitRow}><BookOpen size={18} color={colors.brand} /><View style={styles.flex}><Text style={styles.cardTitle}>{file}</Text><Text style={styles.metaText}>{course.title}</Text></View></Card>))
      ) : (
        courses.map((course) => <TrainingCard key={course.id} course={course} expanded={expanded.includes(course.id)} tab={tab} onToggle={() => setExpanded(expanded.includes(course.id) ? expanded.filter((id) => id !== course.id) : [...expanded, course.id])} />)
      )}
      {!resource.loading && !resource.error && !courses.length && tab !== 'Phần mềm' ? <EmptyState title="Chưa có khóa đào tạo" message="Nội dung sẽ xuất hiện khi được giao." /> : null}
    </AppScreen>
  );
}

function TrainingCard({ course, expanded, tab, onToggle }: { course: DemoTrainingCourse; expanded: boolean; tab: string; onToggle: () => void }) {
  return (
    <Card style={styles.trainingCard}>
      <View style={styles.trainingBanner}><GraduationCap size={22} color="#FFFFFF" /><Text style={styles.trainingBannerText}>ĐÀO TẠO GIẢNG VIÊN</Text></View>
      <Text style={styles.cardTitle}>{course.title}</Text>
      <View style={styles.rowBetween}><Text style={styles.metaText}>Tiến độ khóa học</Text><Text style={styles.cardTitle}>{course.progress}%</Text></View>
      <ProgressBar value={course.progress} />
      <Text style={styles.caption}>{course.lessons.length} bài học</Text>
      <PrimaryButton title={expanded ? 'THU GỌN' : 'VÀO HỌC'} onPress={onToggle} variant="secondary" />
      {expanded ? (
        <>
          {tab !== 'Tài liệu' ? (
            <>
              <SectionHeading title="Quy trình" />
              {course.lessons.map((lesson) => <Text key={lesson.id} style={styles.muted}>{lesson.completed ? '✓' : '○'} {lesson.title} · {lesson.duration}</Text>)}
            </>
          ) : null}
          {tab !== 'Quy trình' ? (
            <>
              <SectionHeading title="Tài liệu" />
              {course.files.map((file) => <Text key={file} style={styles.muted}>{file}</Text>)}
            </>
          ) : null}
          {course.notices.map((notice) => <Text key={notice} style={styles.note}>{notice}</Text>)}
        </>
      ) : null}
    </Card>
  );
}

export function TeacherFinanceScreen() {
  const { user } = useAuth();
  const loader = useCallback(() => financeService.list(), []);
  const resource = useMockResource(loader);
  const transactions = resource.data || [];
  const [filter, setFilter] = useState('Tất cả');
  const paid = transactions.filter((transaction) => transaction.status === 'Đã nhận');
  const pending = transactions.filter((transaction) => transaction.status === 'Chưa nhận');
  const filtered = filter === 'Đã nhận' ? paid : filter === 'Chưa nhận' ? pending : transactions;
  const totalEarned = paid.reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalPending = pending.reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalSessions = transactions.reduce((sum, transaction) => sum + transaction.sessions, 0);
  const maxAmount = Math.max(0, ...transactions.map((transaction) => transaction.amount));
  const showSummary = !resource.loading && !resource.error && transactions.length > 0;
  return (
    <AppScreen>
      <AppHeader title="Tài chính" subtitle="Tổng hợp buổi dạy và thanh toán" />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      <View style={styles.rowBetween}>
        <Text style={styles.title}>Tài chính & Hoa hồng</Text>
        <Text style={styles.financeTeacherName}>GV: {user?.name || '—'}</Text>
      </View>
      <View style={styles.financeStats}>
        {[
          ['Tổng đã nhận', showSummary ? formatCurrency(totalEarned) : '—'],
          ['Chưa nhận', showSummary ? formatCurrency(totalPending) : '—'],
          ['Tổng buổi đã dạy', showSummary ? String(totalSessions) : '—'],
        ].map(([label, value]) => <Card key={label} style={styles.financeStat}><Text style={styles.metaText}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={styles.financeStatValue}>{value}</Text></Card>)}
      </View>
      <Card style={styles.financeChart}>
        <View style={styles.rowBetween}><Text style={styles.cardTitle}>Biểu đồ thu nhập</Text><CircleDollarSign size={20} color={colors.brand} /></View>
        {!showSummary ? <Text style={styles.muted}>Chưa có dữ liệu thống kê</Text> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.financeChartBars}>
            {transactions.map((transaction) => (
              <View key={`chart-${transaction.id}`} style={styles.financeChartColumn}>
                <Text numberOfLines={1} style={styles.financeChartAmount}>{formatCurrency(transaction.amount)}</Text>
                <View style={styles.financeChartTrack}>
                  <View style={[styles.financeChartBar, { height: Math.max(16, Math.round((transaction.amount / maxAmount) * 96)) }]} />
                </View>
                <Text style={styles.financeChartMonth}>T{transaction.month}</Text>
              </View>
            ))}
          </ScrollView>
        )}
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Xuất báo cáo</Text>
        <Text style={styles.metaText}>Tải xuống sao kê thu nhập của bạn</Text>
        <Text style={styles.financeGroupTitle}>TỔNG HỢP</Text>
        <View style={styles.financeActions}>
          {['PDF', 'CSV'].map((action) => (
            <Pressable key={action} onPress={() => Alert.alert(action, 'Xuất tệp chưa được kết nối trong bản demo.')} style={styles.financeExport} accessibilityRole="button" accessibilityLabel={`Xuất báo cáo ${action}`}>
              <Text style={styles.financeExportText}>{action}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.financeGroupTitle}>CHI TIẾT THEO HỌC VIÊN</Text>
        <View style={styles.financeActions}>
          {['PDF chi tiết', 'CSV chi tiết'].map((action) => (
            <Pressable key={action} onPress={() => Alert.alert(action, 'Xuất tệp chưa được kết nối trong bản demo.')} style={[styles.financeExport, styles.financeDetailExport]} accessibilityRole="button">
              <Text style={styles.financeExportText}>{action}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
      <SectionHeading title="Lịch sử chuyển tiền hoa hồng" />
      <View style={styles.chips}>
        {['Tất cả', 'Đã nhận', 'Chưa nhận'].map((item) => <Pressable key={item} onPress={() => setFilter(item)} style={[styles.choice, filter === item && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: filter === item }}><Text style={[styles.choiceText, filter === item && styles.choiceTextActive]}>{item}</Text></Pressable>)}
      </View>
      {filtered.map((transaction) => (
        <Card key={transaction.id}>
          <View style={styles.rowBetween}><Text style={styles.cardTitle}>Kỳ {transaction.month}</Text><StatusBadge label={transaction.status} /></View>
          <Text style={styles.financeAmount}>{formatCurrency(transaction.amount)}</Text>
          <Text style={styles.muted}>{transaction.sessions} buổi · Ngày chuyển: {transaction.date}</Text>
          <Text style={styles.caption}>{transaction.note}</Text>
          <Text style={styles.metaText}>Học viên: {transaction.studentName || '—'} · Phân bổ: {transaction.studentAmount != null ? formatCurrency(transaction.studentAmount) : '—'}</Text>
        </Card>
      ))}
      {!resource.loading && !resource.error && !resource.data?.length ? <EmptyState title="Chưa có dữ liệu tài chính" message="Các kỳ thanh toán sẽ hiển thị tại đây." /> : null}
      <Text style={styles.note}>Dữ liệu là bản demo. Không gọi API, không tạo giao dịch và không xuất/tải tệp thật.</Text>
    </AppScreen>
  );
}

export function TuitionScreen() {
  const loader = useCallback(() => learningService.courses(), []);
  const resource = useMockResource(loader);
  return (
    <AppScreen>
      <AppHeader title="Học phí theo khóa" subtitle="Thông tin học phí trên hồ sơ học viên" />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {(resource.data || []).map((course) => (
        <Card key={course._id}>
          <Text style={styles.cardTitle}>{course.title}</Text>
          <Text style={styles.muted}>Trạng thái thanh toán được xác nhận trên website.</Text>
          <PrimaryButton title="Thanh toán" onPress={() => Alert.alert('Thanh toán', 'Thanh toán chỉ được thực hiện trên website.')} variant="secondary" />
        </Card>
      ))}
      {!resource.loading && !resource.error && !resource.data?.length ? <EmptyState title="Chưa có khóa học" message="Thông tin học phí sẽ xuất hiện theo khóa học." /> : null}
    </AppScreen>
  );
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rowCopy: { flex: 1, minWidth: 0, gap: spacing.xs },
  metaText: { color: colors.muted, fontSize: typography.caption, lineHeight: 18 },
  evaluationIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, backgroundColor: colors.goldSoft },
  assignmentTabs: { flexDirection: 'row', gap: spacing.xs },
  assignmentTab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderBottomWidth: 2, borderBottomColor: colors.line },
  assignmentTabActive: { borderBottomColor: colors.brand },
  assignmentTabText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700', textAlign: 'center' },
  assignmentTabActiveText: { color: colors.brand },
  evaluationSubmitted: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  evaluationRating: { color: colors.gold, fontSize: typography.body, fontWeight: '800' },
  evaluationSuccess: { color: colors.green, fontSize: typography.caption, fontWeight: '700', padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.greenSoft },
  validationText: { color: colors.red, fontSize: typography.caption, fontWeight: '600' },
  evaluationLocked: { marginVertical: spacing.sm, backgroundColor: colors.canvas },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  feedComposer: { gap: spacing.md },
  privacyButton: { maxWidth: '45%', minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.canvas },
  privacyText: { color: colors.brandDark, fontSize: typography.caption, fontWeight: '700' },
  feedDraft: { minHeight: 92, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, color: colors.ink },
  feedImagePlaceholder: { minHeight: 82, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.canvas },
  feedComposerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  feedImageAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  feedAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feedAudience: { alignSelf: 'flex-start', color: colors.muted, fontSize: typography.caption, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.canvas },
  newsSearch: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  newsSearchInput: { flex: 1, minWidth: 0, minHeight: 46, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.ink },
  newsSearchButton: { minHeight: 46, minWidth: 56, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand, borderRadius: radius.md, paddingHorizontal: spacing.md },
  newsSearchButtonText: { color: '#FFFFFF', fontSize: typography.small, fontWeight: '700' },
  newsToolbar: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  newsControl: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  newsControlText: { color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  newsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  newsGridItem: { width: '48%' },
  newsGridCard: { height: '100%', paddingHorizontal: spacing.sm },
  newsThumbnail: { height: 88, alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginBottom: spacing.sm, borderRadius: radius.md, backgroundColor: colors.canvas },
  centerDropdown: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  centerDropdownText: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  centerBanner: { alignItems: 'center', gap: spacing.sm, backgroundColor: colors.brandSoft },
  centerLogo: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  centerInfoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  centerInfoValue: { flex: 1, color: colors.ink, fontSize: typography.small, textAlign: 'right' },
  centerSections: { gap: spacing.xs },
  centerSection: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  centerSectionText: { color: colors.ink, fontSize: typography.small, fontWeight: '600' },
  quizTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  quizTab: { minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  quizTabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  quizTabText: { color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
  quizTabActiveText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '700' },
  quizMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  quizMetric: { width: '47%', minHeight: 58, justifyContent: 'center', padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.canvas },
  quizActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.md },
  quizTools: { gap: spacing.xs, marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas },
  quizAction: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  quizActionText: { color: colors.brand, fontSize: typography.caption, fontWeight: '700' },
  quizDelete: { borderColor: colors.redSoft, backgroundColor: colors.redSoft },
  quizDeleteText: { color: colors.red, fontSize: typography.caption, fontWeight: '700' },
  trainingTabs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  trainingTab: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill },
  trainingTabActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  trainingTabText: { color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  trainingTabTextActive: { color: '#FFFFFF' },
  trainingCard: { overflow: 'hidden' },
  trainingBanner: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: -spacing.lg, marginHorizontal: -spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.brandDark },
  trainingBannerText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800', letterSpacing: 0.5 },
  financeStats: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  financeStat: { flex: 1, minWidth: '30%', paddingHorizontal: spacing.sm },
  financeStatValue: { color: colors.ink, fontSize: typography.body, fontWeight: '800', marginTop: spacing.sm },
  financeChart: { gap: spacing.md, minHeight: 196 },
  financeChartBars: { minHeight: 142, alignItems: 'flex-end', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.sm },
  financeChartColumn: { width: 68, alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  financeChartAmount: { maxWidth: 68, color: colors.muted, fontSize: 10 },
  financeChartTrack: { width: 44, height: 100, justifyContent: 'flex-end', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.line },
  financeChartBar: { width: 40, borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: colors.blue },
  financeChartMonth: { color: colors.brandDark, fontSize: 10, fontWeight: '600' },
  financeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.sm },
  financeExport: { flex: 1, minWidth: '45%', minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.canvas },
  financeDetailExport: { flexBasis: '100%', backgroundColor: colors.greenSoft, borderColor: '#86EFAC' },
  financeExportText: { color: colors.brand, fontSize: typography.caption, fontWeight: '700' },
  financeTeacherName: { maxWidth: '48%', color: colors.muted, fontSize: 10, textAlign: 'right' },
  financeGroupTitle: { color: colors.green, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: spacing.md },
  financeAmount: { color: colors.ink, fontSize: typography.title, fontWeight: '800', marginTop: spacing.sm },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  menuIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  courseCard: { gap: spacing.sm },
  availableCourse: { overflow: 'hidden', borderColor: '#FECACA' },
  courseRibbon: { marginTop: -spacing.lg, marginHorizontal: -spacing.lg, marginBottom: spacing.sm, minHeight: 42, backgroundColor: colors.brand, justifyContent: 'center', paddingHorizontal: spacing.lg },
  courseRibbonText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800', letterSpacing: 0.6 },
  examEntryGrid: { gap: spacing.sm },
  examEntry: { flexDirection: 'row', alignItems: 'center' },
  examQuestion: { borderColor: colors.brand, borderWidth: 1 },
  examOption: { minHeight: 48, justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.md, paddingVertical: spacing.sm },
  player: { minHeight: 188, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: colors.brandSoft, textAlign: 'center' },
  title: { color: colors.ink, fontSize: typography.title, lineHeight: 27, fontWeight: '800' },
  cardTitle: { color: colors.ink, fontSize: typography.body, lineHeight: 22, fontWeight: '700' },
  body: { color: colors.ink, fontSize: typography.body, lineHeight: 23, marginTop: spacing.sm },
  muted: { color: colors.muted, fontSize: typography.small, lineHeight: 20, marginTop: spacing.xs },
  caption: { color: colors.muted, fontSize: typography.caption, lineHeight: 18, marginTop: spacing.xs },
  note: { color: colors.muted, fontSize: typography.caption, fontStyle: 'italic', lineHeight: 18, marginTop: spacing.sm },
  link: { color: colors.brand, fontSize: typography.small, fontWeight: '700', marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  actionText: { color: colors.brand, fontSize: typography.small, fontWeight: '700' },
  comment: { color: colors.ink, fontSize: typography.small, lineHeight: 19, marginTop: spacing.sm },
  strong: { color: colors.ink, fontWeight: '700' },
  commentComposer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line, marginTop: spacing.md, paddingTop: spacing.sm },
  commentInput: { flex: 1, minHeight: 42, paddingHorizontal: spacing.md, backgroundColor: colors.canvas, borderRadius: radius.md, color: colors.ink },
  form: { gap: spacing.md, marginTop: spacing.md },
  fieldLabel: { color: colors.ink, fontSize: typography.small, fontWeight: '700', marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingVertical: 7, paddingHorizontal: 10 },
  choiceActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  choiceText: { color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  choiceTextActive: { color: '#FFFFFF' },
  studentTargetList: { gap: spacing.xs, marginTop: spacing.sm },
  studentTarget: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  studentTargetSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  studentTargetText: { color: colors.ink, fontSize: typography.small },
  questionEditor: { gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  questionRemove: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  textArea: { minHeight: 84, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, color: colors.ink },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionToggle: { width: 34, height: 34, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderRadius: 17, color: colors.ink, backgroundColor: colors.canvas, fontWeight: '800' },
  optionToggleActive: { color: '#FFFFFF', backgroundColor: colors.green },
  questionPreview: { gap: spacing.xs, padding: spacing.md, backgroundColor: colors.canvas, borderRadius: radius.md, marginTop: spacing.sm },
  dimmed: { opacity: 0.56 },
  financeSummary: { alignItems: 'center', gap: spacing.xs, backgroundColor: colors.greenSoft },
  total: { color: colors.ink, fontSize: typography.heading, fontWeight: '800', marginTop: spacing.xs },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
});
