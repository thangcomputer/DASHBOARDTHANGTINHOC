/**
 * CertPrepScreens.tsx
 * Màn hình ôn thi MOS/IC3 - tương đương CertPrepCatalogPage, CertPrepLevelPage,
 * CertPrepStudentPlayer, CertPrepResult của web app.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Award, BookOpen, CheckCircle, ChevronLeft, ChevronRight, Clock, Flag, GraduationCap,
  LayoutGrid, ListChecks, RefreshCw, X,
} from 'lucide-react-native';
import {
  AppHeader, AppScreen, Card, EmptyState, ErrorState, LoadingSkeleton, PrimaryButton,
} from '../components/ui';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';
import certPrepApi, {
  type CertPrepAttempt, type CertPrepCourse, type CertPrepLevel, type CertPrepSession, type CertPrepTest,
  type CertPrepQuestion,
} from '../services/certPrepApi';
import { useAuth } from '../app/AuthContext';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSeconds(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function isAccessExpired(expiresAt?: string) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() < Date.now();
}

// ── CertPrep Catalog ──────────────────────────────────────────────────────────

export function CertPrepCatalogScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const [catalog, setCatalog] = useState<CertPrepCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<CertPrepCourse | null>(null);

  const loadCatalog = useCallback(async () => {
    if (!user || user.previewMode) {
      // Demo mode: dữ liệu giả
      setCatalog([
        {
          id: 'mos-word', name: 'MOS Word 2019', description: 'Ôn thi chứng chỉ Word',
          levels: [
            { id: 'mos-word-basic', title: 'Cơ bản', courseId: 'mos-word' },
            { id: 'mos-word-advanced', title: 'Nâng cao', courseId: 'mos-word' },
          ],
        },
        {
          id: 'mos-excel', name: 'MOS Excel 2019', description: 'Ôn thi chứng chỉ Excel',
          levels: [
            { id: 'mos-excel-basic', title: 'Cơ bản', courseId: 'mos-excel' },
          ],
        },
        {
          id: 'ic3-key', name: 'IC3 - Key Applications', description: 'Ôn thi IC3',
          levels: [
            { id: 'ic3-key-l1', title: 'Level 1', courseId: 'ic3-key' },
          ],
        },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await certPrepApi.getCatalog();
      setCatalog(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải danh sách khóa ôn thi.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void loadCatalog(); }, [loadCatalog]);

  if (loading) {
    return (
      <AppScreen>
        <AppHeader title="Ôn thi MOS / IC3" />
        <LoadingSkeleton rows={4} />
      </AppScreen>
    );
  }

  if (error) {
    return (
      <AppScreen>
        <AppHeader title="Ôn thi MOS / IC3" />
        <ErrorState message={error} onRetry={loadCatalog} />
      </AppScreen>
    );
  }

  if (selectedCourse) {
    return (
      <AppScreen>
        <AppHeader
          title={selectedCourse.name}
          subtitle="Chọn level để xem đề thi"
          onBack={() => setSelectedCourse(null)}
        />
        {isAccessExpired(selectedCourse.expiresAt) ? (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredText}>⚠️ Quyền truy cập đã hết hạn.</Text>
          </View>
        ) : null}
        <View style={styles.levelList}>
          {selectedCourse.levels.map((level) => (
            <Pressable
              key={level.id}
              style={({ pressed }) => [styles.levelCard, pressed && styles.pressed]}
              onPress={() => navigation.navigate('CertPrepLevel', { levelId: level.id, courseName: selectedCourse.name })}
              accessibilityRole="button"
            >
              <View style={styles.levelIcon}>
                <GraduationCap size={20} color={colors.brand} />
              </View>
              <View style={styles.levelInfo}>
                <Text style={styles.levelTitle}>{level.title}</Text>
                {level.subtitle ? <Text style={styles.levelSub}>{level.subtitle}</Text> : null}
              </View>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader title="Ôn thi MOS / IC3" subtitle="Luyện tập và kiểm tra kiến thức theo từng cấp độ" />
      {catalog.length === 0 ? (
        <EmptyState title="Chưa có khóa ôn thi" message="Bạn chưa được cấp quyền truy cập khóa ôn thi nào." />
      ) : (
        <View style={styles.courseGrid}>
          {catalog.map((course) => (
            <Pressable
              key={course.id}
              style={({ pressed }) => [styles.courseCard, pressed && styles.pressed]}
              onPress={() => setSelectedCourse(course)}
              accessibilityRole="button"
            >
              <View style={styles.courseCardHeader}>
                <BookOpen size={22} color="#FFFFFF" />
              </View>
              <View style={styles.courseCardBody}>
                <Text style={styles.courseCardName}>{course.name}</Text>
                {course.description ? <Text style={styles.courseCardDesc}>{course.description}</Text> : null}
                <Text style={styles.courseCardLevels}>{course.levels.length} level</Text>
              </View>
              {isAccessExpired(course.expiresAt) ? (
                <View style={styles.expiredTag}><Text style={styles.expiredTagText}>Hết hạn</Text></View>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}
    </AppScreen>
  );
}

// ── CertPrep Level ────────────────────────────────────────────────────────────

type LevelRouteProps = NativeStackScreenProps<AppStackParamList, 'CertPrepLevel'>['route'];

export function CertPrepLevelScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<LevelRouteProps>();
  const { levelId, courseName } = route.params;
  const { user } = useAuth();
  const [tests, setTests] = useState<CertPrepTest[]>([]);
  const [levelTitle, setLevelTitle] = useState('');
  const [expiresAt, setExpiresAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    if (!user || user.previewMode) {
      setLevelTitle('Level Demo');
      setTests([
        { id: 't1', title: 'Đề thi số 1', questionCount: 20, timeLimitMinutes: 30, status: 'not_started' },
        { id: 't2', title: 'Đề thi số 2', questionCount: 25, timeLimitMinutes: 35, status: 'completed', lastScore: 88 },
        { id: 't3', title: 'Đề thi số 3 (Tổng hợp)', questionCount: 30, timeLimitMinutes: 45, status: 'in_progress', lastSessionId: 'demo-session-1' },
      ]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await certPrepApi.getLevelTests(levelId);
      setLevelTitle(data.level?.title || '');
      setExpiresAt(data.expiresAt);
      setTests(data.tests || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải đề thi.');
    } finally {
      setLoading(false);
    }
  }, [levelId, user]);

  useEffect(() => { void load(); }, [load]);

  const handleStart = useCallback(async (test: CertPrepTest) => {
    if (starting) return;
    if (isAccessExpired(expiresAt)) {
      Alert.alert('Hết hạn', 'Quyền truy cập level này đã hết hạn.');
      return;
    }
    setStarting(true);
    try {
      if (user?.previewMode) {
        navigation.navigate('CertPrepPlayer', { sessionId: 'demo-session', testTitle: test.title });
        return;
      }
      const session = await certPrepApi.startSession(test.id);
      const sid = session?.id || (session as unknown as { _id?: string })?._id;
      if (!sid) throw new Error('Không nhận được phiên từ máy chủ.');
      navigation.navigate('CertPrepPlayer', { sessionId: String(sid), testTitle: test.title });
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không thể bắt đầu bài thi.');
    } finally {
      setStarting(false);
    }
  }, [starting, expiresAt, navigation, user]);

  const handleResume = useCallback((test: CertPrepTest) => {
    if (test.lastSessionId) {
      navigation.navigate('CertPrepPlayer', { sessionId: test.lastSessionId, testTitle: test.title });
    }
  }, [navigation]);

  if (loading) {
    return (
      <AppScreen>
        <AppHeader title="Đề thi" onBack={() => navigation.goBack()} />
        <LoadingSkeleton rows={3} />
      </AppScreen>
    );
  }

  if (error) {
    return (
      <AppScreen>
        <AppHeader title="Đề thi" onBack={() => navigation.goBack()} />
        <ErrorState message={error} onRetry={load} />
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <AppHeader
        title={levelTitle || 'Danh sách đề thi'}
        subtitle={courseName}
        onBack={() => navigation.goBack()}
      />
      {isAccessExpired(expiresAt) ? (
        <View style={styles.expiredBanner}>
          <Text style={styles.expiredText}>⚠️ Quyền truy cập đã hết hạn. Vui lòng liên hệ trung tâm.</Text>
        </View>
      ) : null}
      <View style={styles.testList}>
        {tests.map((test) => (
          <Card key={test.id} style={styles.testCard}>
            <View style={styles.testCardHeader}>
              <View style={styles.testCardTitleRow}>
                <ListChecks size={18} color={colors.brand} />
                <Text style={styles.testCardTitle}>{test.title}</Text>
              </View>
              {test.status === 'completed' && test.lastScore !== undefined ? (
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreText}>{test.lastScore}%</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.testCardMeta}>
              <Text style={styles.testCardMetaText}>
                {test.questionCount} câu • {test.timeLimitMinutes ?? '-'} phút
              </Text>
            </View>
            <View style={styles.testCardActions}>
              {test.status === 'in_progress' && test.lastSessionId ? (
                <PrimaryButton
                  title="Tiếp tục làm"
                  onPress={() => handleResume(test)}
                  variant="secondary"
                />
              ) : null}
              <PrimaryButton
                title={test.status === 'completed' ? 'Làm lại' : 'Bắt đầu'}
                onPress={() => handleStart(test)}
                loading={starting}
              />
            </View>
          </Card>
        ))}
        {tests.length === 0 ? (
          <EmptyState title="Chưa có đề thi" message="Level này chưa có đề thi nào." />
        ) : null}
      </View>
    </AppScreen>
  );
}

// ── CertPrep Player ───────────────────────────────────────────────────────────

type PlayerRouteProps = NativeStackScreenProps<AppStackParamList, 'CertPrepPlayer'>['route'];

export function CertPrepPlayerScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<PlayerRouteProps>();
  const { sessionId, testTitle } = route.params;
  const { user } = useAuth();

  const [questions, setQuestions] = useState<CertPrepQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');
  const [submitDialogVisible, setSubmitDialogVisible] = useState(false);
  const [exitDialogVisible, setExitDialogVisible] = useState(false);
  const [navVisible, setNavVisible] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveQueueRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingAnswersRef = useRef<Record<string, unknown>>({});
  const saveInFlightRef = useRef<Promise<void> | null>(null);

  const loadSession = useCallback(async () => {
    if (user?.previewMode || sessionId === 'demo-session') {
      // Demo questions
      setQuestions([
        { id: 'q1', type: 'single_choice', text: 'Phím tắt Save trong Word là gì?', options: ['Ctrl+S', 'Ctrl+P', 'Ctrl+Z', 'Ctrl+X'], correctAnswer: 0 },
        { id: 'q2', type: 'single_choice', text: 'Để in đậm văn bản, dùng tổ hợp phím nào?', options: ['Ctrl+B', 'Ctrl+I', 'Ctrl+U', 'Ctrl+D'], correctAnswer: 0 },
        { id: 'q3', type: 'multiple_choice', text: 'Các định dạng file Word bao gồm?', options: ['.docx', '.xlsx', '.doc', '.pdf'], correctIndices: [0, 2] },
        { id: 'q4', type: 'single_choice', text: 'Tab nào chứa công cụ định dạng chữ?', options: ['Home', 'Insert', 'View', 'Review'], correctAnswer: 0 },
        { id: 'q5', type: 'single_choice', text: 'Để tạo bảng trong Word, vào tab nào?', options: ['Insert', 'Home', 'Layout', 'Design'], correctAnswer: 0 },
      ]);
      setAnswers({});
      setRemainingSeconds(30 * 60);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const session = await certPrepApi.getSession(sessionId);
      setQuestions(session.questions || []);
      setAnswers(session.answers || {});
      setRemainingSeconds(session.remainingSeconds || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải phiên làm bài.');
    } finally {
      setLoading(false);
    }
  }, [sessionId, user]);

  useEffect(() => { void loadSession(); }, [loadSession]);

  const flushPendingAnswers = useCallback(async () => {
    if (saveQueueRef.current) {
      clearTimeout(saveQueueRef.current);
      saveQueueRef.current = null;
    }
    if (saveInFlightRef.current) await saveInFlightRef.current;
    const pending = pendingAnswersRef.current;
    if (Object.keys(pending).length === 0 || user?.previewMode || sessionId === 'demo-session') return;

    pendingAnswersRef.current = {};
    setSaveStatus('saving');
    setSaveError('');
    const request = certPrepApi.saveAnswers(sessionId, pending);
    saveInFlightRef.current = request;
    try {
      await request;
      setSaveStatus(Object.keys(pendingAnswersRef.current).length ? 'saving' : 'saved');
    } catch (e) {
      pendingAnswersRef.current = { ...pending, ...pendingAnswersRef.current };
      setSaveStatus('error');
      setSaveError(e instanceof Error ? e.message : 'Không thể lưu câu trả lời.');
      throw e;
    } finally {
      if (saveInFlightRef.current === request) saveInFlightRef.current = null;
    }
  }, [sessionId, user]);

  // Countdown timer
  useEffect(() => {
    if (loading || remainingSeconds <= 0) return;
    timerRef.current = setInterval(() => {
      setRemainingSeconds((s) => {
        if (s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          void handleSubmit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [loading]);

  const selectAnswer = useCallback((qId: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [qId]: value }));
    pendingAnswersRef.current[qId] = value;
    setSaveStatus('saving');
    setSaveError('');
    if (saveQueueRef.current) clearTimeout(saveQueueRef.current);
    saveQueueRef.current = setTimeout(async () => {
      if (!user?.previewMode && sessionId !== 'demo-session') {
        try {
          await flushPendingAnswers();
        } catch (e) {
          console.error('Không thể tự động lưu câu trả lời ôn thi.', e);
        }
      }
    }, 600);
  }, [flushPendingAnswers, sessionId, user]);

  const handleSubmit = useCallback(async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    setSubmitDialogVisible(false);
    try {
      if (!user?.previewMode && sessionId !== 'demo-session') {
        await flushPendingAnswers();
        await certPrepApi.submitSession(sessionId);
      }
      navigation.replace('CertPrepResult', { sessionId, testTitle });
    } catch (e) {
      Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không thể nộp bài.');
      setSubmitting(false);
    }
  }, [submitting, sessionId, testTitle, navigation, user, flushPendingAnswers]);

  const q = questions[currentIndex];
  const answeredCount = Object.keys(answers).filter((id) => answers[id] !== undefined && answers[id] !== null).length;

  if (loading) {
    return (
      <View style={styles.examShell}>
        <View style={styles.examLoading}>
          <Text style={styles.examLoadingText}>Đang tải phòng thi ôn MOS/IC3...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.examShell}>
        <View style={styles.examLoading}>
          <Text style={styles.examErrorText}>{error}</Text>
          <Pressable style={styles.examBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.examBackBtnText}>Quay lại</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.examShell}>
      {/* Header */}
      <View style={styles.examHeader}>
        <Pressable onPress={() => setExitDialogVisible(true)} style={styles.examHeaderBtn} accessibilityRole="button" accessibilityLabel="Thoát bài thi">
          <X size={20} color="#CBD5E1" />
        </Pressable>
        <View style={styles.examHeaderCenter}>
          <Text style={styles.examTitle} numberOfLines={1}>{testTitle}</Text>
          <Text style={styles.examProgress}>{currentIndex + 1}/{questions.length} câu • {answeredCount} đã trả lời</Text>
          {saveStatus !== 'idle' ? (
            <Text style={[styles.examSaveStatus, saveStatus === 'error' && styles.examSaveStatusError]}>
              {saveStatus === 'saving' ? 'Đang lưu câu trả lời...' : saveStatus === 'saved' ? 'Đã lưu câu trả lời' : `Lỗi lưu: ${saveError}`}
            </Text>
          ) : null}
        </View>
        <View style={styles.examTimer}>
          <Clock size={14} color={remainingSeconds < 120 ? '#F87171' : '#94A3B8'} />
          <Text style={[styles.examTimerText, remainingSeconds < 120 && { color: '#F87171' }]}>
            {formatSeconds(remainingSeconds)}
          </Text>
        </View>
      </View>

      {/* Question */}
      <ScrollView style={styles.examBody} contentContainerStyle={styles.examBodyContent}>
        {q ? (
          <QuestionCard
            question={q}
            index={currentIndex}
            total={questions.length}
            value={answers[q.id]}
            onSelect={(v) => selectAnswer(q.id, v)}
          />
        ) : <Text style={styles.examNoQuestion}>Không có câu hỏi.</Text>}
      </ScrollView>

      {/* Footer */}
      <View style={styles.examFooter}>
        <Pressable
          style={[styles.examNavBtn, currentIndex === 0 && styles.examNavBtnDisabled]}
          onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          disabled={currentIndex === 0}
          accessibilityRole="button"
        >
          <ChevronLeft size={20} color={currentIndex === 0 ? '#475569' : '#E2E8F0'} />
          <Text style={[styles.examNavBtnText, currentIndex === 0 && { color: '#475569' }]}>Câu trước</Text>
        </Pressable>

        <Pressable style={styles.examNavGrid} onPress={() => setNavVisible(true)} accessibilityRole="button">
          <LayoutGrid size={18} color="#94A3B8" />
        </Pressable>

        {currentIndex < questions.length - 1 ? (
          <Pressable style={styles.examNavBtn} onPress={() => setCurrentIndex((i) => i + 1)} accessibilityRole="button">
            <Text style={styles.examNavBtnText}>Câu tiếp</Text>
            <ChevronRight size={20} color="#E2E8F0" />
          </Pressable>
        ) : (
          <Pressable style={styles.examSubmitBtn} onPress={() => setSubmitDialogVisible(true)} accessibilityRole="button">
            <Flag size={16} color="#FFFFFF" />
            <Text style={styles.examSubmitBtnText}>Nộp bài</Text>
          </Pressable>
        )}
      </View>

      {/* Question Navigator */}
      <Modal visible={navVisible} transparent animationType="slide" onRequestClose={() => setNavVisible(false)}>
        <Pressable style={styles.navOverlay} onPress={() => setNavVisible(false)}>
          <View style={styles.navSheet}>
            <Text style={styles.navSheetTitle}>Câu hỏi</Text>
            <View style={styles.navGrid}>
              {questions.map((qItem, idx) => (
                <Pressable
                  key={qItem.id}
                  style={[
                    styles.navItem,
                    answers[qItem.id] !== undefined && styles.navItemAnswered,
                    idx === currentIndex && styles.navItemCurrent,
                  ]}
                  onPress={() => { setCurrentIndex(idx); setNavVisible(false); }}
                  accessibilityRole="button"
                >
                  <Text style={[styles.navItemText, answers[qItem.id] !== undefined && styles.navItemTextAnswered]}>{idx + 1}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.navLegend}>
              <View style={[styles.navLegendDot, styles.navItemAnswered]} /><Text style={styles.navLegendLabel}>Đã trả lời</Text>
              <View style={[styles.navLegendDot, styles.navItemCurrent]} /><Text style={styles.navLegendLabel}>Đang xem</Text>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Submit Dialog */}
      <Modal visible={submitDialogVisible} transparent animationType="fade" onRequestClose={() => setSubmitDialogVisible(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Nộp bài?</Text>
            <Text style={styles.dialogBody}>
              Bạn đã trả lời <Text style={{ color: colors.brand, fontWeight: '800' }}>{answeredCount}/{questions.length}</Text> câu.
              {answeredCount < questions.length ? '\n\nCâu chưa trả lời sẽ bị tính sai.' : ''}
            </Text>
            <View style={styles.dialogActions}>
              <Pressable style={styles.dialogCancel} onPress={() => setSubmitDialogVisible(false)}>
                <Text style={styles.dialogCancelText}>Làm tiếp</Text>
              </Pressable>
              <Pressable style={styles.dialogConfirm} onPress={() => handleSubmit(false)}>
                {submitting ? <Text style={styles.dialogConfirmText}>Đang nộp...</Text> : <Text style={styles.dialogConfirmText}>Nộp bài</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Exit Dialog */}
      <Modal visible={exitDialogVisible} transparent animationType="fade" onRequestClose={() => setExitDialogVisible(false)}>
        <View style={styles.dialogOverlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Thoát bài thi?</Text>
            <Text style={styles.dialogBody}>Bài thi sẽ được lưu lại. Bạn có thể tiếp tục sau.</Text>
            <View style={styles.dialogActions}>
              <Pressable style={styles.dialogCancel} onPress={() => setExitDialogVisible(false)}>
                <Text style={styles.dialogCancelText}>Tiếp tục làm</Text>
              </Pressable>
              <Pressable style={styles.dialogConfirm} onPress={async () => {
                try {
                  if (!user?.previewMode && sessionId !== 'demo-session') {
                    await flushPendingAnswers();
                    await certPrepApi.pauseSession(sessionId);
                  }
                  setExitDialogVisible(false);
                  navigation.goBack();
                } catch (e) {
                  Alert.alert('Lỗi', e instanceof Error ? e.message : 'Không thể lưu tiến độ bài thi.');
                }
              }}>
                <Text style={styles.dialogConfirmText}>Thoát</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({
  question, index, total, value, onSelect,
}: {
  question: CertPrepQuestion;
  index: number;
  total: number;
  value: unknown;
  onSelect: (v: unknown) => void;
}) {
  return (
    <View style={styles.questionCard}>
      <Text style={styles.questionNum}>Câu {index + 1}/{total}</Text>
      <Text style={styles.questionText}>{question.text}</Text>
      {question.type === 'single_choice' && question.options ? (
        <View style={styles.optionList}>
          {question.options.map((opt, i) => (
            <Pressable
              key={i}
              style={[styles.optionItem, value === i && styles.optionItemSelected]}
              onPress={() => onSelect(i)}
              accessibilityRole="radio"
            >
              <View style={[styles.optionRadio, value === i && styles.optionRadioSelected]}>
                {value === i ? <View style={styles.optionRadioDot} /> : null}
              </View>
              <Text style={[styles.optionText, value === i && styles.optionTextSelected]}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {question.type === 'multiple_choice' && question.options ? (
        <View style={styles.optionList}>
          {question.options.map((opt, i) => {
            const selected = Array.isArray(value) && (value as number[]).includes(i);
            return (
              <Pressable
                key={i}
                style={[styles.optionItem, selected && styles.optionItemSelected]}
                onPress={() => {
                  const cur = Array.isArray(value) ? (value as number[]) : [];
                  onSelect(selected ? cur.filter((x) => x !== i) : [...cur, i]);
                }}
                accessibilityRole="checkbox"
              >
                <View style={[styles.optionCheckbox, selected && styles.optionCheckboxSelected]}>
                  {selected ? <CheckCircle size={14} color="#FFFFFF" /> : null}
                </View>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ── CertPrep Result ───────────────────────────────────────────────────────────

type ResultRouteProps = NativeStackScreenProps<AppStackParamList, 'CertPrepResult'>['route'];

export function CertPrepResultScreen() {
  const navigation = useNavigation<Navigation>();
  const route = useRoute<ResultRouteProps>();
  const { sessionId, testTitle } = route.params;
  const { user } = useAuth();
  const [result, setResult] = useState<{ score: number; total: number; correctCount: number; passed?: boolean } | null>(null);
  const [attempts, setAttempts] = useState<CertPrepAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (user?.previewMode || sessionId === 'demo-session') {
        setResult({ score: 80, total: 5, correctCount: 4 });
        setLoading(false);
        return;
      }
      try {
        const r = await certPrepApi.getResult(sessionId);
        setResult(r);
        if (r.testId) {
          certPrepApi.getAttempts(r.testId).then(setAttempts).catch(() => setAttempts([]));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Không thể tải kết quả.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [sessionId, user]);

  if (loading) {
    return (
      <AppScreen>
        <AppHeader title="Kết quả" onBack={() => navigation.navigate('CertPrepCatalog')} />
        <LoadingSkeleton rows={3} />
      </AppScreen>
    );
  }

  if (error || !result) {
    return (
      <AppScreen>
        <AppHeader title="Kết quả" onBack={() => navigation.navigate('CertPrepCatalog')} />
        <ErrorState message={error} onRetry={() => navigation.replace('CertPrepResult', { sessionId, testTitle })} />
      </AppScreen>
    );
  }

  const passed = result.passed ?? result.score >= 70;

  return (
    <AppScreen>
      <AppHeader title="Kết quả bài thi" onBack={() => navigation.navigate('CertPrepCatalog')} />
      <View style={styles.resultContainer}>
        <View style={[styles.resultCircle, passed ? styles.resultCirclePassed : styles.resultCircleFailed]}>
          {passed ? <Award size={36} color="#FFFFFF" /> : <RefreshCw size={36} color="#FFFFFF" />}
        </View>
        <Text style={[styles.resultStatus, passed ? { color: colors.green } : { color: colors.red }]}>
          {passed ? '✅ Đạt yêu cầu' : '❌ Chưa đạt'}
        </Text>
        <Text style={styles.resultTitle}>{testTitle}</Text>
        <View style={styles.resultStats}>
          <View style={styles.resultStat}>
            <Text style={styles.resultStatValue}>{result.score}%</Text>
            <Text style={styles.resultStatLabel}>Điểm số</Text>
          </View>
          <View style={styles.resultStat}>
            <Text style={styles.resultStatValue}>{result.correctCount}</Text>
            <Text style={styles.resultStatLabel}>Câu đúng</Text>
          </View>
          <View style={styles.resultStat}>
            <Text style={styles.resultStatValue}>{result.total - result.correctCount}</Text>
            <Text style={styles.resultStatLabel}>Câu sai</Text>
          </View>
        </View>
        {attempts.length ? (
          <View style={styles.attemptList}>
            <Text style={styles.attemptHeading}>Lịch sử làm bài</Text>
            {attempts.map((row) => (
              <Pressable
                key={row.sessionId}
                onPress={() => { if (row.sessionId !== sessionId) navigation.replace('CertPrepResult', { sessionId: row.sessionId, testTitle }); }}
                style={[styles.attemptRow, row.sessionId === sessionId && styles.attemptRowActive]}
                accessibilityRole="button"
                accessibilityLabel={`Xem lần ${row.attempt}`}
              >
                <Text style={styles.attemptCell}>{`Lần ${row.attempt}`}</Text>
                <Text style={[styles.attemptCell, styles.attemptDate]}>{row.submittedAt ? new Date(row.submittedAt).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '--'}</Text>
                <Text style={styles.attemptCell}>{row.score}</Text>
                <Text style={[styles.attemptCell, { color: row.passed ? colors.green : colors.red }]}>{row.passed ? 'Đạt' : 'Chưa đạt'}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        <PrimaryButton title="Về danh sách đề thi" onPress={() => navigation.navigate('CertPrepCatalog')} />
      </View>
    </AppScreen>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Course catalog
  courseGrid: { gap: spacing.md, padding: spacing.lg },
  courseCard: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  courseCardHeader: { backgroundColor: colors.brand, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', height: 80 },
  courseCardBody: { padding: spacing.lg, gap: spacing.xs },
  courseCardName: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  courseCardDesc: { color: colors.muted, fontSize: typography.caption },
  courseCardLevels: { color: colors.brand, fontSize: typography.caption, fontWeight: '700', marginTop: spacing.xs },
  expiredTag: { position: 'absolute', top: spacing.sm, right: spacing.sm, backgroundColor: colors.redSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  expiredTagText: { color: colors.red, fontSize: typography.micro, fontWeight: '700' },
  expiredBanner: { backgroundColor: colors.goldSoft, margin: spacing.lg, padding: spacing.md, borderRadius: radius.sm },
  expiredText: { color: '#805900', fontSize: typography.caption, fontWeight: '700' },
  pressed: { opacity: 0.75 },

  // Level list
  levelList: { gap: spacing.sm, padding: spacing.lg },
  levelCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line },
  levelIcon: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  levelInfo: { flex: 1 },
  levelTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  levelSub: { color: colors.muted, fontSize: typography.caption, marginTop: 2 },

  // Test list
  testList: { gap: spacing.md, padding: spacing.lg },
  testCard: { gap: spacing.sm },
  testCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  testCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  testCardTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '700', flex: 1 },
  testCardMeta: {},
  testCardMetaText: { color: colors.muted, fontSize: typography.caption },
  testCardActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  scoreBadge: { backgroundColor: colors.greenSoft, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  scoreText: { color: colors.green, fontSize: typography.caption, fontWeight: '800' },

  // Exam shell
  examShell: { flex: 1, backgroundColor: '#0B1018' },
  examLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  examLoadingText: { color: '#94A3B8', fontSize: typography.body, fontWeight: '700' },
  examErrorText: { color: '#F87171', fontSize: typography.body, textAlign: 'center', marginBottom: spacing.lg },
  examBackBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.sm },
  examBackBtnText: { color: '#E2E8F0', fontSize: typography.small, fontWeight: '700' },
  examHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)', gap: spacing.sm },
  examHeaderBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  examHeaderCenter: { flex: 1, alignItems: 'center' },
  examTitle: { color: '#E2E8F0', fontSize: typography.small, fontWeight: '800' },
  examProgress: { color: '#64748B', fontSize: typography.micro, marginTop: 2 },
  examSaveStatus: { color: '#94A3B8', fontSize: typography.micro, marginTop: 2 },
  examSaveStatusError: { color: '#F87171' },
  examTimer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  examTimerText: { color: '#94A3B8', fontSize: typography.caption, fontWeight: '700', fontVariant: ['tabular-nums'] },
  examBody: { flex: 1 },
  examBodyContent: { padding: spacing.lg },
  examNoQuestion: { color: '#64748B', textAlign: 'center', padding: spacing.xl },
  examFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  examNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  examNavBtnDisabled: { opacity: 0.4 },
  examNavBtnText: { color: '#E2E8F0', fontSize: typography.small, fontWeight: '700' },
  examNavGrid: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.sm },
  examSubmitBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.brand, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.sm },
  examSubmitBtnText: { color: '#FFFFFF', fontSize: typography.small, fontWeight: '800' },

  // Question card
  questionCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.md, padding: spacing.lg, gap: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  questionNum: { color: '#64748B', fontSize: typography.caption, fontWeight: '700' },
  questionText: { color: '#E2E8F0', fontSize: typography.body, lineHeight: 24 },
  optionList: { gap: spacing.sm, marginTop: spacing.xs },
  optionItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.03)' },
  optionItemSelected: { borderColor: colors.brand, backgroundColor: 'rgba(220,38,38,0.12)' },
  optionRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  optionRadioSelected: { borderColor: colors.brand },
  optionRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.brand },
  optionCheckbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: '#475569', alignItems: 'center', justifyContent: 'center' },
  optionCheckboxSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  optionText: { color: '#CBD5E1', fontSize: typography.small, flex: 1 },
  optionTextSelected: { color: '#FFFFFF', fontWeight: '700' },

  // Navigator
  navOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  navSheet: { backgroundColor: '#1E293B', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.xl },
  navSheetTitle: { color: '#E2E8F0', fontSize: typography.small, fontWeight: '800', marginBottom: spacing.lg },
  navGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  navItem: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  navItemAnswered: { backgroundColor: colors.greenSoft, borderColor: colors.green },
  navItemCurrent: { backgroundColor: colors.brand, borderColor: colors.brandDark },
  navItemText: { color: '#94A3B8', fontSize: typography.caption, fontWeight: '700' },
  navItemTextAnswered: { color: colors.green },
  navLegend: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg },
  navLegendDot: { width: 14, height: 14, borderRadius: 3 },
  navLegendLabel: { color: '#94A3B8', fontSize: typography.caption, marginRight: spacing.md },

  // Dialogs
  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  dialog: { backgroundColor: '#1E293B', borderRadius: radius.lg, padding: spacing.xl, width: '100%', maxWidth: 340, gap: spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  dialogTitle: { color: '#FFFFFF', fontSize: typography.heading, fontWeight: '800' },
  dialogBody: { color: '#94A3B8', fontSize: typography.small, lineHeight: 20 },
  dialogActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  dialogCancel: { flex: 1, padding: spacing.md, borderRadius: radius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' },
  dialogCancelText: { color: '#94A3B8', fontSize: typography.small, fontWeight: '700' },
  dialogConfirm: { flex: 1, padding: spacing.md, borderRadius: radius.sm, backgroundColor: colors.brand, alignItems: 'center' },
  dialogConfirmText: { color: '#FFFFFF', fontSize: typography.small, fontWeight: '800' },

  // Result
  resultContainer: { alignItems: 'center', padding: spacing.xl, gap: spacing.lg },
  attemptList: { alignSelf: 'stretch', gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: spacing.md },
  attemptHeading: { color: colors.ink, fontSize: typography.caption, fontWeight: '900', marginBottom: spacing.xs },
  attemptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.xs, borderRadius: radius.sm },
  attemptRowActive: { backgroundColor: colors.brandSoft },
  attemptCell: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  attemptDate: { flex: 1, color: colors.muted, fontWeight: '500' },
  resultCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  resultCirclePassed: { backgroundColor: colors.green },
  resultCircleFailed: { backgroundColor: colors.red },
  resultStatus: { fontSize: typography.small, fontWeight: '800' },
  resultTitle: { color: colors.ink, fontSize: typography.heading, fontWeight: '800', textAlign: 'center' },
  resultStats: { flexDirection: 'row', gap: spacing.xxl, marginVertical: spacing.md },
  resultStat: { alignItems: 'center', gap: 4 },
  resultStatValue: { color: colors.ink, fontSize: typography.title, fontWeight: '900' },
  resultStatLabel: { color: colors.muted, fontSize: typography.caption },
});
