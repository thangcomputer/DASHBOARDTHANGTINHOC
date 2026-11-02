/**
 * LessonPracticeScreens.tsx
 * Màn hình luyện bài theo bài học — tương đương LessonPracticeCatalogPage,
 * LessonPracticeUnitsPage, LessonPracticePlayerPage của web app.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  BookOpen, CheckCircle, ChevronRight, Clapperboard, GraduationCap, Lock, Play, RotateCcw,
} from 'lucide-react-native';
import {
  AppHeader, AppScreen, Card, EmptyState, ErrorState, LoadingSkeleton, PrimaryButton, ProgressBar,
  useBrandingHeaderScrollHandler,
} from '../components/ui';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';
import lessonPracticeApi, { type LPCourse, type LPChapter, type LPLesson, type LPQuestion } from '../services/lessonPracticeApi';
import { useAuth } from '../app/AuthContext';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

// ── Catalog Screen ─────────────────────────────────────────────────────────────

export function LessonPracticeCatalogScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const [courses, setCourses] = useState<LPCourse[]>([]);
  const [progress, setProgress] = useState<Record<string, { completed: number; total: number }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user || user.previewMode) {
      setCourses([
        {
          id: 'word-basic', name: 'Microsoft Word - Cơ bản', enrolled: true,
          deliveryMode: 'self', offerType: 'single',
          subjects: [
            { id: 'word-1', name: 'Làm quen với Word', totalUnitCount: 5, completedUnitCount: 3 },
            { id: 'word-2', name: 'Định dạng văn bản', totalUnitCount: 8, completedUnitCount: 0 },
          ],
        },
        {
          id: 'excel-basic', name: 'Microsoft Excel - Cơ bản', enrolled: true,
          deliveryMode: 'self', offerType: 'single',
          subjects: [
            { id: 'excel-1', name: 'Nhập liệu & công thức', totalUnitCount: 6, completedUnitCount: 2 },
          ],
        },
        {
          id: 'powerpoint-adv', name: 'PowerPoint Nâng cao', enrolled: false, price: 299000,
          deliveryMode: 'instructor', offerType: 'single',
          subjects: [],
        },
      ]);
      setProgress({
        'word-1': { completed: 3, total: 5 },
        'word-2': { completed: 0, total: 8 },
        'excel-1': { completed: 2, total: 6 },
      });
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [catalog, prog] = await Promise.all([
        lessonPracticeApi.getCatalog(),
        lessonPracticeApi.getProgress(),
      ]);
      setCourses(catalog);
      setProgress(prog);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const getCourseProgress = (course: LPCourse) => {
    let completed = 0; let total = 0;
    for (const sub of course.subjects || []) {
      const p = progress[sub.id];
      if (p) { completed += p.completed; total += p.total; }
      else { total += sub.totalUnitCount || 0; completed += sub.completedUnitCount || 0; }
    }
    return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  if (loading) {
    return (
      <AppScreen>
        <AppHeader title="Luyện bài theo bài học" />
        <LoadingSkeleton rows={4} />
      </AppScreen>
    );
  }

  if (error) {
    return (
      <AppScreen>
        <AppHeader title="Luyện bài theo bài học" />
        <ErrorState onRetry={load} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader
        title="Luyện bài theo bài học"
        subtitle="Học và luyện tập từng bài theo khóa học của bạn"
      />
      <View style={styles.catalogList}>
        {courses.length === 0 ? (
          <EmptyState title="Chưa có khóa học" message="Bạn chưa đăng ký khóa học nào." />
        ) : courses.map((course) => {
          const prog = getCourseProgress(course);
          return (
            <Card key={course.id} style={styles.courseCard}>
              <View style={[styles.courseCardBanner, { backgroundColor: course.enrolled ? colors.brand : colors.muted }]}>
                {course.deliveryMode === 'instructor'
                  ? <GraduationCap size={20} color="#FFFFFF" />
                  : <Clapperboard size={20} color="#FFFFFF" />}
                <Text style={styles.courseCardBannerLabel}>
                  {course.deliveryMode === 'instructor' ? 'Học cùng giảng viên' : 'Tự học qua video'}
                </Text>
                {!course.enrolled ? <Lock size={16} color="#FFFFFF" style={{ marginLeft: 'auto' }} /> : null}
              </View>
              <View style={styles.courseCardBody}>
                <Text style={styles.courseCardName}>{course.name}</Text>
                {course.enrolled ? (
                  <>
                    <ProgressBar value={prog.percent} />
                    <Text style={styles.courseCardProgress}>{prog.completed}/{prog.total} bài đã học • {prog.percent}%</Text>
                    <View style={styles.subjectList}>
                      {(course.subjects || []).map((sub) => (
                        <Pressable
                          key={sub.id}
                          style={({ pressed }) => [styles.subjectRow, pressed && styles.pressed]}
                          onPress={() => navigation.navigate('LessonPracticeUnits', {
                            subjectId: sub.id, subjectName: sub.name, courseName: course.name,
                          })}
                          accessibilityRole="button"
                        >
                          <View style={styles.subjectInfo}>
                            <Text style={styles.subjectName}>{sub.name}</Text>
                            <Text style={styles.subjectMeta}>
                              {sub.completedUnitCount ?? 0}/{sub.totalUnitCount ?? 0} bài
                            </Text>
                          </View>
                          <ChevronRight size={16} color={colors.muted} />
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : (
                  <View style={styles.lockedInfo}>
                    <Text style={styles.lockedPrice}>
                      {course.price ? `${course.price.toLocaleString('vi-VN')}₫` : 'Liên hệ tư vấn'}
                    </Text>
                    <PrimaryButton
                      title="Đăng ký ngay"
                      variant="secondary"
                      onPress={() => Alert.alert('Đăng ký', 'Vui lòng liên hệ trung tâm để đăng ký khóa học này.')}
                    />
                  </View>
                )}
              </View>
            </Card>
          );
        })}
      </View>
    </AppScreen>
  );
}

// ── Units Screen ───────────────────────────────────────────────────────────────

type UnitsRouteProps = NativeStackScreenProps<AppStackParamList, 'LessonPracticeUnits'>['route'];

export function LessonPracticeUnitsScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<UnitsRouteProps>();
  const { subjectId, subjectName, courseName } = route.params;
  const { user } = useAuth();
  const [chapters, setChapters] = useState<LPChapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user || user.previewMode) {
      setChapters([
        {
          id: 'ch1', title: 'Chương 1: Làm quen giao diện',
          units: [
            { id: 'u1', title: 'Bài 1: Khởi động và giao diện', completed: true, quizCount: 3, duration: 10 },
            { id: 'u2', title: 'Bài 2: Thanh công cụ Ribbon', completed: true, quizCount: 4, duration: 12 },
            { id: 'u3', title: 'Bài 3: Tạo file mới & lưu', completed: false, quizCount: 5, duration: 15 },
          ],
        },
        {
          id: 'ch2', title: 'Chương 2: Soạn thảo văn bản',
          units: [
            { id: 'u4', title: 'Bài 4: Nhập và chỉnh sửa văn bản', completed: false, locked: false, quizCount: 6, duration: 18 },
            { id: 'u5', title: 'Bài 5: Định dạng chữ', completed: false, locked: false, quizCount: 5, duration: 14 },
            { id: 'u6', title: 'Bài 6: Paragraph & Spacing', completed: false, locked: true, quizCount: 4, duration: 12 },
          ],
        },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await lessonPracticeApi.getSubjectUnits(subjectId);
      setChapters(data.chapters || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải danh sách bài học.');
    } finally {
      setLoading(false);
    }
  }, [subjectId, user]);

  useEffect(() => { void load(); }, [load]);

  if (loading) {
    return (
      <AppScreen>
        <AppHeader title={subjectName} subtitle={courseName} onBack={() => navigation.goBack()} />
        <LoadingSkeleton rows={6} />
      </AppScreen>
    );
  }

  if (error) {
    return (
      <AppScreen>
        <AppHeader title={subjectName} subtitle={courseName} onBack={() => navigation.goBack()} />
        <ErrorState onRetry={load} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader title={subjectName} subtitle={courseName} onBack={() => navigation.goBack()} />
      <View style={styles.chapterList}>
        {chapters.map((chapter) => (
          <View key={chapter.id} style={styles.chapter}>
            <Text style={styles.chapterTitle}>{chapter.title}</Text>
            {chapter.units.map((unit) => (
              <Pressable
                key={unit.id}
                style={({ pressed }) => [styles.unitRow, pressed && styles.pressed, unit.locked && styles.unitLocked]}
                onPress={() => {
                  if (unit.locked) {
                    Alert.alert('Đã khóa', 'Bạn cần hoàn thành bài học trước để mở bài này.');
                    return;
                  }
                  navigation.navigate('LessonPracticePlayer', {
                    unitId: unit.id, unitTitle: unit.title, subjectName, courseName,
                  });
                }}
                accessibilityRole="button"
              >
                <View style={[styles.unitStatus, unit.completed && styles.unitStatusDone, unit.locked && styles.unitStatusLocked]}>
                  {unit.completed ? <CheckCircle size={16} color={colors.green} />
                    : unit.locked ? <Lock size={14} color={colors.muted} />
                    : <Play size={14} color={colors.brand} />}
                </View>
                <View style={styles.unitInfo}>
                  <Text style={[styles.unitTitle, unit.locked && styles.unitTitleLocked]}>{unit.title}</Text>
                  <Text style={styles.unitMeta}>
                    {unit.quizCount ? `${unit.quizCount} câu hỏi` : ''}{unit.duration ? ` • ${unit.duration} phút` : ''}
                  </Text>
                </View>
                {!unit.locked ? <ChevronRight size={16} color={colors.muted} /> : null}
              </Pressable>
            ))}
          </View>
        ))}
      </View>
    </AppScreen>
  );
}

// ── Player Screen ─────────────────────────────────────────────────────────────

type PlayerRouteProps = NativeStackScreenProps<AppStackParamList, 'LessonPracticePlayer'>['route'];

export function LessonPracticePlayerScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<PlayerRouteProps>();
  const handleHeaderScroll = useBrandingHeaderScrollHandler();
  const { unitId, unitTitle, subjectName, courseName } = route.params;
  const { user } = useAuth();
  const [lessons, setLessons] = useState<LPLesson[]>([]);
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizResult, setQuizResult] = useState<{ score: number; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user || user.previewMode) {
      setLessons([
        {
          id: 'l1', title: 'Video bài học', duration: 12,
          videoUrl: undefined,
          content: 'Trong bài này, chúng ta sẽ học về giao diện của Microsoft Word bao gồm thanh Ribbon, Quick Access Toolbar và các thành phần cơ bản.',
        },
        {
          id: 'l2', title: 'Câu hỏi ôn tập', duration: 5,
          questions: [
            { id: 'pq1', type: 'single_choice', text: 'Tab nào chứa lệnh Save trong Word?', options: ['File', 'Home', 'Insert', 'View'], correctAnswer: 0 },
            { id: 'pq2', type: 'single_choice', text: 'Ribbon là gì?', options: ['Thanh công cụ trên cùng', 'Thanh cuộn', 'Con trỏ chuột', 'Thanh trạng thái'], correctAnswer: 0 },
          ],
        },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await lessonPracticeApi.getUnit(unitId);
      setLessons(data.lessons || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải bài học.');
    } finally {
      setLoading(false);
    }
  }, [unitId, user]);

  useEffect(() => { void load(); }, [load]);

  const currentLesson = lessons[currentLessonIndex];
  const hasQuiz = Boolean(currentLesson?.questions?.length);

  const handleSubmitQuiz = useCallback(async () => {
    if (!currentLesson?.questions) return;
    const total = currentLesson.questions.length;
    let correct = 0;
    for (const q of currentLesson.questions) {
      const ans = answers[q.id];
      if (q.type === 'single_choice' && ans === q.correctAnswer) correct++;
    }
    if (!user?.previewMode) {
      try {
        await lessonPracticeApi.submitQuiz(unitId, currentLesson.id, answers);
      } catch { /* ignore */ }
    }
    setQuizResult({ score: Math.round((correct / total) * 100), total });
    setQuizSubmitted(true);
  }, [currentLesson, answers, unitId, user]);

  const handleComplete = useCallback(async () => {
    if (!currentLesson) return;
    if (!user?.previewMode) {
      try { await lessonPracticeApi.completeLesson(unitId, currentLesson.id); } catch { /* ignore */ }
    }
    if (currentLessonIndex < lessons.length - 1) {
      setCurrentLessonIndex((i) => i + 1);
      setAnswers({});
      setQuizSubmitted(false);
      setQuizResult(null);
    } else {
      Alert.alert('Hoàn thành!', `Bạn đã học xong: ${unitTitle}`, [
        { text: 'Quay lại', onPress: () => navigation.goBack() },
      ]);
    }
  }, [currentLesson, currentLessonIndex, lessons.length, unitId, unitTitle, navigation, user]);

  if (loading) {
    return (
      <AppScreen>
        <AppHeader title={unitTitle} subtitle={subjectName} onBack={() => navigation.goBack()} />
        <LoadingSkeleton rows={4} />
      </AppScreen>
    );
  }

  if (error) {
    return (
      <AppScreen>
        <AppHeader title={unitTitle} subtitle={subjectName} onBack={() => navigation.goBack()} />
        <ErrorState onRetry={load} />
      </AppScreen>
    );
  }

  return (
    <AppScreen scroll={false}>
      <AppHeader
        title={unitTitle}
        subtitle={`${subjectName} • ${currentLessonIndex + 1}/${lessons.length}`}
        onBack={() => navigation.goBack()}
      />
      <ScrollView style={styles.playerBody} contentContainerStyle={styles.playerContent} onScroll={handleHeaderScroll} scrollEventThrottle={16}>
        {currentLesson ? (
          <>
            {/* Lesson Title */}
            <View style={styles.lessonTitleRow}>
              <View style={styles.lessonTitleIcon}>
                {hasQuiz ? <BookOpen size={18} color={colors.brand} /> : <Play size={18} color={colors.brand} />}
              </View>
              <Text style={styles.lessonTitle}>{currentLesson.title}</Text>
            </View>

            {/* Content */}
            {currentLesson.content ? (
              <Card style={styles.contentCard}>
                <Text style={styles.contentText}>{currentLesson.content}</Text>
              </Card>
            ) : null}

            {/* Video placeholder */}
            {!hasQuiz && !currentLesson.content ? (
              <View style={styles.videoPlaceholder}>
                <Clapperboard size={40} color={colors.muted} />
                <Text style={styles.videoPlaceholderText}>Video bài học</Text>
                <Text style={styles.videoPlaceholderSub}>{currentLesson.duration} phút</Text>
              </View>
            ) : null}

            {/* Quiz */}
            {hasQuiz && currentLesson.questions ? (
              <View style={styles.quizSection}>
                <Text style={styles.quizTitle}>Câu hỏi ôn tập</Text>
                {currentLesson.questions.map((q, qi) => (
                  <Card key={q.id} style={styles.quizCard}>
                    <Text style={styles.quizQNum}>Câu {qi + 1}</Text>
                    <Text style={styles.quizQText}>{q.text}</Text>
                    {q.type === 'single_choice' && q.options ? (
                      <View style={styles.quizOptions}>
                        {q.options.map((opt, oi) => {
                          const selected = answers[q.id] === oi;
                          const isCorrect = quizSubmitted && oi === q.correctAnswer;
                          const isWrong = quizSubmitted && selected && oi !== q.correctAnswer;
                          return (
                            <Pressable
                              key={oi}
                              style={[
                                styles.quizOption,
                                selected && styles.quizOptionSelected,
                                isCorrect && styles.quizOptionCorrect,
                                isWrong && styles.quizOptionWrong,
                              ]}
                              onPress={() => !quizSubmitted && setAnswers((prev) => ({ ...prev, [q.id]: oi }))}
                              accessibilityRole="radio"
                              disabled={quizSubmitted}
                            >
                              <Text style={[styles.quizOptionText, (isCorrect || (selected && !isWrong)) && { color: '#FFFFFF', fontWeight: '700' }]}>{opt}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                  </Card>
                ))}

                {quizResult ? (
                  <View style={styles.quizResultBanner}>
                    <Text style={styles.quizResultText}>
                      Kết quả: {quizResult.score}% ({Math.round(quizResult.score * quizResult.total / 100)}/{quizResult.total} câu đúng)
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {/* Footer actions */}
      <View style={styles.playerFooter}>
        {currentLessonIndex > 0 ? (
          <Pressable
            style={styles.playerNavBtn}
            onPress={() => { setCurrentLessonIndex((i) => i - 1); setAnswers({}); setQuizSubmitted(false); setQuizResult(null); }}
            accessibilityRole="button"
          >
            <Text style={styles.playerNavBtnText}>← Bài trước</Text>
          </Pressable>
        ) : <View />}

        {hasQuiz && !quizSubmitted ? (
          <PrimaryButton
            title="Kiểm tra"
            onPress={handleSubmitQuiz}
            disabled={Object.keys(answers).length === 0}
          />
        ) : (
          <PrimaryButton
            title={currentLessonIndex < lessons.length - 1 ? 'Bài tiếp →' : 'Hoàn thành ✓'}
            onPress={handleComplete}
          />
        )}
      </View>
    </AppScreen>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Catalog
  catalogList: { gap: spacing.md, padding: spacing.lg },
  courseCard: { padding: 0, overflow: 'hidden' },
  courseCardBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  courseCardBannerLabel: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.8, flex: 1 },
  courseCardBody: { padding: spacing.lg, gap: spacing.sm },
  courseCardName: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  courseCardProgress: { color: colors.muted, fontSize: typography.caption },
  subjectList: { gap: spacing.xs, marginTop: spacing.xs },
  subjectRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.canvas },
  subjectInfo: { flex: 1 },
  subjectName: { color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
  subjectMeta: { color: colors.muted, fontSize: typography.micro },
  lockedInfo: { gap: spacing.sm },
  lockedPrice: { color: colors.brand, fontSize: typography.small, fontWeight: '800' },
  pressed: { opacity: 0.72 },

  // Units
  chapterList: { padding: spacing.lg, gap: spacing.lg },
  chapter: { gap: spacing.sm },
  chapterTitle: { color: colors.muted, fontSize: typography.caption, fontWeight: '800', letterSpacing: 0.8 },
  unitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line },
  unitLocked: { opacity: 0.55 },
  unitStatus: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  unitStatusDone: { backgroundColor: colors.greenSoft },
  unitStatusLocked: { backgroundColor: colors.canvas },
  unitInfo: { flex: 1 },
  unitTitle: { color: colors.ink, fontSize: typography.caption, fontWeight: '700' },
  unitTitleLocked: { color: colors.muted },
  unitMeta: { color: colors.muted, fontSize: typography.micro, marginTop: 2 },

  // Player
  playerBody: { flex: 1 },
  playerContent: { padding: spacing.lg, gap: spacing.lg },
  lessonTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  lessonTitleIcon: { width: 36, height: 36, borderRadius: radius.sm, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  lessonTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '800', flex: 1 },
  contentCard: { gap: spacing.sm },
  contentText: { color: colors.ink, fontSize: typography.body, lineHeight: 26 },
  videoPlaceholder: { height: 200, backgroundColor: '#1E293B', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  videoPlaceholderText: { color: '#94A3B8', fontSize: typography.small, fontWeight: '700' },
  videoPlaceholderSub: { color: '#64748B', fontSize: typography.caption },

  // Quiz
  quizSection: { gap: spacing.md },
  quizTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  quizCard: { gap: spacing.sm },
  quizQNum: { color: colors.muted, fontSize: typography.caption, fontWeight: '700' },
  quizQText: { color: colors.ink, fontSize: typography.small, lineHeight: 20 },
  quizOptions: { gap: spacing.xs, marginTop: spacing.xs },
  quizOption: { padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas },
  quizOptionSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  quizOptionCorrect: { borderColor: colors.green, backgroundColor: colors.greenSoft },
  quizOptionWrong: { borderColor: colors.red, backgroundColor: colors.redSoft },
  quizOptionText: { color: colors.ink, fontSize: typography.caption },
  quizResultBanner: { backgroundColor: colors.goldSoft, padding: spacing.md, borderRadius: radius.sm, alignItems: 'center' },
  quizResultText: { color: '#805900', fontSize: typography.small, fontWeight: '800' },

  // Footer
  playerFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: colors.surface },
  playerNavBtn: { padding: spacing.md },
  playerNavBtnText: { color: colors.muted, fontSize: typography.small, fontWeight: '700' },
});
