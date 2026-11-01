import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, BackHandler, DeviceEventEmitter, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import {
  AlertCircle, Award, CheckCircle, ChevronLeft, ChevronRight, Clock, GraduationCap, HelpCircle,
  LayoutGrid, Lock, Monitor, Play, RefreshCw, Trophy, User,
} from 'lucide-react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../app/AuthContext';
import { AppHeader, AppScreen, Card, EmptyState } from '../components/ui';
import {
  getStudentQuizForExam, submitStudentQuiz,
  type StudentQuiz, type StudentQuizDetail, type StudentQuizResult,
} from '../services/studentQuizApi';
import { quizService } from '../services/mockService';
import { colors, radius, spacing, typography } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';

type Navigation = NativeStackNavigationProp<AppStackParamList>;
type RoomTab = 'quiz' | 'cert' | 'scores' | 'mos-ic3';

function countdownText(milliseconds: number) {
  if (milliseconds <= 0) return 'Đã hết hạn';
  const totalSeconds = Math.floor(milliseconds / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (days) return `${days} ngày ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  if (hours) return `${hours} giờ ${String(minutes).padStart(2, '0')} phút`;
  if (minutes) return `${minutes} phút ${seconds} giây`;
  return `${seconds} giây`;
}

function formatExamClock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Chưa xác định'
    : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export function StudentExamScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<RoomTab>('quiz');
  const [quizzes, setQuizzes] = useState<StudentQuiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now());
  const [quizDetail, setQuizDetail] = useState<StudentQuizDetail | null>(null);
  const [result, setResult] = useState<StudentQuizResult | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const isPreview = Boolean(user?.previewMode)
    || (__DEV__ && Boolean(process.env.EXPO_PUBLIC_MOBILE_UI_QA_STATE));

  const loadQuizzes = useCallback(async () => {
    if (!user || user.role !== 'student') {
      setError('Chỉ học viên đã đăng nhập mới xem được bài trắc nghiệm.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      setQuizzes(await quizService.studentList(user));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không tải được danh sách trắc nghiệm.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    if (!quizDetail) void loadQuizzes();
  }, [loadQuizzes, quizDetail]));

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const closeQuiz = useCallback(() => {
    setQuizDetail(null);
    setResult(null);
    setAnswers({});
    setCurrentQuestion(0);
    setSubmitting(false);
    submitLock.current = false;
    void loadQuizzes();
  }, [loadQuizzes]);

  const submitAnswers = useCallback(async (forfeit = false, exitReason = '') => {
    if (!quizDetail || !user || submitLock.current || result) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const payload = quizDetail.questions.map((_, index) => (
        forfeit ? null : answers[index] ?? null
      ));
      setResult(await submitStudentQuiz(user, quizDetail.id, payload, { forfeit, exitReason }));
    } catch (submitError) {
      Alert.alert('Không thể nộp bài', submitError instanceof Error ? submitError.message : 'Vui lòng thử lại.');
      submitLock.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [answers, quizDetail, result, user]);

  useEffect(() => {
    if (!quizDetail || result || submitting) return undefined;
    const timer = setInterval(() => {
      setTimeLeft((remaining) => {
        if (remaining <= 1) {
          clearInterval(timer);
          void submitAnswers();
          return 0;
        }
        return remaining - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [quizDetail, result, submitAnswers, submitting]);

  const openQuiz = async (quiz: StudentQuiz) => {
    if (!user) return;
    if (isPreview) {
      Alert.alert('Chế độ xem trước', 'Không thể bắt đầu hoặc xem lại bài thi trong chế độ xem trước.');
      return;
    }
    try {
      const detail = await getStudentQuizForExam(user, quiz.id);
      setQuizDetail(detail);
      setAnswers({});
      setCurrentQuestion(0);
      if (detail.mySubmission) {
        setResult({
          ...detail.mySubmission,
          detailedReview: detail.detailedReview.length
            ? detail.detailedReview
            : detail.mySubmission.detailedReview,
        });
      } else {
        setResult(null);
        setTimeLeft(detail.timeLimitMinutes * 60);
        submitLock.current = false;
      }
    } catch (openError) {
      Alert.alert('Không thể mở bài thi', openError instanceof Error ? openError.message : 'Vui lòng tải lại danh sách.');
    }
  };

  const requestExit = useCallback(() => {
    if (!quizDetail) return;
    if (result) {
      closeQuiz();
      return;
    }
    Alert.alert(
      'Thoát sẽ bị tính rớt',
      'Bạn đang làm bài. Nếu thoát, hệ thống sẽ ghi nhận 0 điểm và thông báo cho giảng viên.',
      [
        { text: 'Ở lại làm tiếp', style: 'cancel' },
        { text: 'Thoát và nhận 0 điểm', style: 'destructive', onPress: () => void submitAnswers(true, 'Thoát phòng thi giữa giờ') },
      ],
    );
  }, [closeQuiz, quizDetail, result, submitAnswers]);

  useEffect(() => {
    if (!quizDetail) return undefined;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      requestExit();
      return true;
    });
    return () => listener.remove();
  }, [quizDetail, requestExit]);

  useEffect(() => {
    if (!quizDetail || result) return undefined;
    return navigation.addListener('beforeRemove', (event) => {
      event.preventDefault();
      requestExit();
    });
  }, [navigation, quizDetail, requestExit, result]);

  useEffect(() => {
    const active = Boolean(quizDetail && !result);
    DeviceEventEmitter.emit('mobile:exam-room-active', active);
    return () => DeviceEventEmitter.emit('mobile:exam-room-active', false);
  }, [quizDetail, result]);

  const askSubmit = () => {
    const answered = Object.keys(answers).length;
    Alert.alert(
      'Xác nhận nộp bài?',
      `Bạn đã hoàn thành ${answered}/${quizDetail?.questions.length ?? 0} câu. Bạn có chắc chắn muốn nộp bài ngay?`,
      [
        { text: 'Làm tiếp', style: 'cancel' },
        { text: 'Nộp bài ngay', onPress: () => void submitAnswers() },
      ],
    );
  };

  const tabs: Array<{ key: RoomTab; title: string; subtitle: string; Icon: typeof Trophy; tone: string }> = [
    { key: 'quiz', title: 'Trắc nghiệm buổi học', subtitle: 'Bài do giảng viên giao theo buổi học', Icon: Trophy, tone: '#E11D48' },
    { key: 'cert', title: 'Thi chứng nhận môn học', subtitle: 'Thi có camera · theo tiến độ khóa học', Icon: Monitor, tone: '#2563EB' },
    { key: 'scores', title: 'Xem điểm của tôi', subtitle: 'Nhật ký điểm trắc nghiệm & chứng nhận', Icon: Award, tone: '#EA580C' },
    { key: 'mos-ic3', title: 'MOS / IC3', subtitle: 'Ôn tập và luyện thi chứng chỉ', Icon: GraduationCap, tone: '#7C3AED' },
  ];

  if (quizDetail) {
    const question = quizDetail.questions[currentQuestion];
    const isPassed = !result?.forfeit && (result?.status === 'passed' || (result?.score ?? 0) >= 70);
    return (
      <AppScreen scroll={false} contentStyle={styles.examScreen}>
        <AppHeader
          title={result ? 'Kết quả bài trắc nghiệm' : 'Phòng thi trắc nghiệm'}
          subtitle={quizDetail.title}
          onBack={requestExit}
        />
        {result ? (
          <ScrollView contentContainerStyle={styles.resultContent} showsVerticalScrollIndicator={false}>
            <Card style={styles.resultCard}>
              <View style={[styles.resultIcon, isPassed ? styles.resultPassed : styles.resultFailed]}>
                {isPassed ? <Award size={34} color="#34D399" /> : <AlertCircle size={34} color="#F87171" />}
              </View>
              <Text style={styles.resultTitle}>{quizDetail.title}</Text>
              <Text style={styles.examMuted}>Giảng viên: {quizDetail.teacherName}</Text>
              <Text style={[styles.resultScore, isPassed ? styles.passText : styles.failText]}>{result.score}%</Text>
              <Text style={[styles.resultStatus, isPassed ? styles.passText : styles.failText]}>
                {result.forfeit ? 'RỚT · THOÁT GIỮA GIỜ' : isPassed ? 'ĐẠT YÊU CẦU' : 'CHƯA ĐẠT'}
              </Text>
              <View style={styles.resultMetrics}>
                <View style={styles.resultMetric}><Text style={styles.metricLabel}>Số câu đúng</Text><Text style={styles.metricValue}>{result.correctCount}/{result.totalQuestions}</Text></View>
                <View style={styles.resultMetric}><Text style={styles.metricLabel}>Số câu sai</Text><Text style={styles.metricValue}>{Math.max(0, result.totalQuestions - result.correctCount)}</Text></View>
                <View style={styles.resultMetric}><Text style={styles.metricLabel}>Thời gian</Text><Text style={styles.metricValue}>{quizDetail.timeLimitMinutes} phút</Text></View>
                <View style={styles.resultMetric}><Text style={styles.metricLabel}>Ngày nộp</Text><Text style={styles.metricValue}>{formatDate(result.submittedAt)}</Text></View>
              </View>
              {result.exitReason ? <Text style={styles.failText}>{result.exitReason}</Text> : null}
              <Pressable onPress={closeQuiz} style={styles.primaryButton} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>Quay lại danh sách</Text>
              </Pressable>
            </Card>
            {!result.forfeit && result.detailedReview.length ? (
              <View style={styles.reviewList}>
                <Text style={styles.sectionTitle}>Xem lại đáp án</Text>
                {result.detailedReview.map((item, index) => (
                  <Card key={item.id} style={styles.reviewCard}>
                    <Text style={styles.questionLabel}>Câu {index + 1} · {item.isCorrect ? 'Đúng' : 'Chưa đúng'}</Text>
                    <Text style={styles.questionText}>{item.questionText}</Text>
                    <Text style={styles.reviewAnswer}>Đáp án của bạn: {item.userAnswer == null ? 'Chưa trả lời' : item.options[item.userAnswer] || '—'}</Text>
                    <Text style={styles.reviewCorrect}>Đáp án đúng: {item.options[item.correctAnswer] || '—'}</Text>
                    {item.explanation ? <Text style={styles.examMuted}>{item.explanation}</Text> : null}
                  </Card>
                ))}
              </View>
            ) : null}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.roomContent} showsVerticalScrollIndicator={false}>
            <View style={styles.roomHeader}>
              <View style={styles.flex}>
                <Text style={styles.roomTitle}>{quizDetail.title}</Text>
                <Text style={styles.examMuted}>{quizDetail.courseName} · GV: {quizDetail.teacherName}</Text>
              </View>
              <View style={[styles.timerBadge, timeLeft <= 60 && styles.timerUrgent]}>
                <Clock size={17} color={timeLeft <= 60 ? '#F87171' : '#67E8F9'} />
                <Text style={[styles.timerText, timeLeft <= 60 && styles.failText]}>{formatExamClock(timeLeft)}</Text>
              </View>
            </View>
            <View style={styles.answerLayout}>
              <View style={styles.questionPanel}>
                {question ? (
                  <>
                    <View style={styles.questionHeading}>
                      <Text style={styles.questionLabel}>Câu {currentQuestion + 1} / {quizDetail.questions.length}</Text>
                      <Text style={styles.examMuted}>{Object.keys(answers).length} câu đã làm</Text>
                    </View>
                    <Text style={styles.questionText}>{question.questionText}</Text>
                    <View style={styles.optionsList}>
                      {question.options.map((option, index) => {
                        const selected = answers[currentQuestion] === index;
                        return (
                          <Pressable
                            key={`${question.id}-${index}`}
                            onPress={() => setAnswers((previous) => ({ ...previous, [currentQuestion]: index }))}
                            style={[styles.option, selected && styles.optionSelected]}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                          >
                            <Text style={[styles.optionLetter, selected && styles.optionLetterSelected]}>{String.fromCharCode(65 + index)}</Text>
                            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                    <View style={styles.questionNavigation}>
                      <Pressable
                        disabled={currentQuestion === 0}
                        onPress={() => setCurrentQuestion((index) => Math.max(0, index - 1))}
                        style={[styles.secondaryButton, currentQuestion === 0 && styles.disabledButton]}
                        accessibilityRole="button"
                      >
                        <ChevronLeft size={17} color={colors.surface} /><Text style={styles.secondaryButtonText}>Câu trước</Text>
                      </Pressable>
                      {currentQuestion < quizDetail.questions.length - 1 ? (
                        <Pressable onPress={() => setCurrentQuestion((index) => index + 1)} style={styles.nextButton} accessibilityRole="button">
                          <Text style={styles.nextButtonText}>Câu tiếp</Text><ChevronRight size={17} color="#082F49" />
                        </Pressable>
                      ) : (
                        <Pressable onPress={askSubmit} disabled={submitting} style={styles.primaryButton} accessibilityRole="button">
                          <Text style={styles.primaryButtonText}>{submitting ? 'Đang nộp...' : 'Nộp bài'}</Text>
                        </Pressable>
                      )}
                    </View>
                  </>
                ) : <Text style={styles.examMuted}>Bài thi chưa có câu hỏi.</Text>}
              </View>
              <Card style={styles.questionGridPanel}>
                <View style={styles.gridHeading}><LayoutGrid size={17} color="#38BDF8" /><Text style={styles.gridHeadingText}>Danh sách câu hỏi</Text></View>
                <View style={styles.questionGrid}>
                  {quizDetail.questions.map((item, index) => {
                    const selected = currentQuestion === index;
                    const answered = answers[index] !== undefined;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setCurrentQuestion(index)}
                        style={[styles.questionNumber, selected && styles.questionNumberCurrent, answered && !selected && styles.questionNumberAnswered]}
                        accessibilityRole="button"
                        accessibilityLabel={`Câu hỏi ${index + 1}${answered ? ', đã trả lời' : ', chưa trả lời'}`}
                      >
                        <Text style={[styles.questionNumberText, (selected || answered) && styles.questionNumberTextActive]}>{index + 1}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={styles.gridLegend}>Đã làm: {Object.keys(answers).length} · Chưa làm: {quizDetail.questions.length - Object.keys(answers).length}</Text>
                <Pressable onPress={askSubmit} disabled={submitting} style={styles.submitButton} accessibilityRole="button">
                  <Text style={styles.primaryButtonText}>{submitting ? 'Đang nộp...' : 'Nộp bài thi'}</Text>
                </Pressable>
              </Card>
            </View>
          </ScrollView>
        )}
      </AppScreen>
    );
  }

  const columns = width >= 540 ? 2 : 1;
  const submittedQuizzes = quizzes.filter((quiz) => quiz.mySubmission);

  return (
    <AppScreen>
      <AppHeader title="Phòng thi" subtitle="Các bài thi và kết quả học tập" showBackButton={false} centered />
      <View style={[styles.tabGrid, columns === 2 && styles.tabGridWide]}>
        {tabs.map(({ key, title, subtitle, Icon, tone }) => {
          const isCertification = key === 'cert';
          const active = activeTab === key;
          return (
            <View key={key} style={[styles.tabCardWrap, columns === 2 && styles.tabCardWrapWide]}>
              <Pressable
                onPress={() => isCertification ? null : key === 'mos-ic3'
                  ? navigation.navigate('CertPrepCatalog')
                  : setActiveTab(key)}
                disabled={isCertification}
                accessibilityRole="button"
                accessibilityState={{ disabled: isCertification, selected: active }}
                accessibilityLabel={isCertification ? `${title}, chỉ sử dụng trên máy tính` : title}
                style={[styles.tabCard, active && styles.tabCardActive, isCertification && styles.tabCardDisabled]}
              >
                <View style={[styles.tabIcon, { backgroundColor: tone }]}><Icon size={25} color="#FFFFFF" strokeWidth={2.2} /></View>
                <View style={styles.flex}>
                  <Text style={styles.tabTitle}>{title}</Text>
                  <Text style={styles.tabSubtitle}>{isCertification ? 'Chỉ làm bài trên máy tính' : subtitle}</Text>
                </View>
                <ChevronRight size={19} color={colors.muted} />
              </Pressable>
              {isCertification ? (
                <View pointerEvents="none" style={styles.certificationVeil}>
                  <View style={styles.computerOnly}><Lock size={15} color="#64748B" /><Text style={styles.computerOnlyText}>CHỈ DÀNH CHO MÁY TÍNH</Text></View>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {activeTab === 'quiz' ? (
        <>
          <Card style={styles.listHeading}>
            <View style={styles.flex}>
              <View style={styles.headingWithIcon}><Award size={18} color={colors.brand} /><Text style={styles.sectionTitle}>Trắc nghiệm bài học từ Giảng viên</Text></View>
              <Text style={styles.examMuted}>Danh sách các bài thi trắc nghiệm được giảng viên giao theo từng buổi học.</Text>
            </View>
            <Pressable onPress={() => void loadQuizzes()} disabled={loading} style={styles.refreshButton} accessibilityRole="button" accessibilityLabel="Tải lại danh sách">
              <RefreshCw size={17} color={colors.muted} />
            </Pressable>
          </Card>
          {loading ? (
            <View style={styles.centerState}><ActivityIndicator color={colors.brand} size="large" /><Text style={styles.stateText}>Đang tải danh sách bài trắc nghiệm...</Text></View>
          ) : error ? (
            <Card style={styles.stateCard}>
              <AlertCircle size={30} color={colors.red} /><Text style={styles.stateTitle}>Không tải được danh sách</Text><Text style={styles.examMuted}>{error}</Text>
              <Pressable onPress={() => void loadQuizzes()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Thử lại</Text></Pressable>
            </Card>
          ) : quizzes.length === 0 ? (
            <EmptyState title="Hiện chưa có bài trắc nghiệm mới nào" message="Khi giảng viên giao bài thi buổi học, danh sách sẽ hiển thị tại đây." />
          ) : (
            <View style={[styles.quizGrid, width >= 680 && styles.quizGridWide]}>
              {quizzes.map((quiz) => {
                const submission = quiz.mySubmission;
                const hasSubmitted = Boolean(submission);
                const isPassed = !submission?.forfeit && (submission?.passed || (submission?.score ?? 0) >= 70);
                const startAt = quiz.startTime ? new Date(quiz.startTime).getTime() : 0;
                const notYetOpen = !hasSubmitted && Number.isFinite(startAt) && startAt > now;
                const deadlineAt = quiz.deadline ? new Date(quiz.deadline).getTime() : 0;
                const hasValidDeadline = Number.isFinite(deadlineAt) && deadlineAt > 0;
                const expired = !hasSubmitted && !notYetOpen && Number.isFinite(deadlineAt) && deadlineAt > 0 && deadlineAt <= now;
                const countdown = notYetOpen
                  ? `Mở sau: ${countdownText(startAt - now)}`
                  : hasValidDeadline
                    ? expired ? 'Đã hết hạn' : `Hết hạn sau: ${countdownText(deadlineAt - now)}`
                    : '';
                return (
                  <Card key={quiz.id} style={width >= 680 ? { ...styles.quizCard, ...styles.quizCardWide } : styles.quizCard}>
                    <View style={styles.quizCardTop}>
                      <Text style={styles.coursePill}>{quiz.courseName || 'Bài thi buổi học'}</Text>
                      {hasSubmitted ? <Text style={[styles.statusPill, isPassed ? styles.statusPassed : styles.statusFailed]}>{submission?.forfeit ? 'RỚT · THOÁT' : isPassed ? 'ĐẠT' : 'CHƯA ĐẠT'}</Text> : null}
                    </View>
                    <Text style={styles.quizTitle}>{quiz.title}</Text>
                    <View style={styles.quizMeta}><Clock size={13} color={colors.muted} /><Text style={styles.metaText}>{quiz.timeLimitMinutes} phút</Text></View>
                    <View style={styles.quizMeta}><HelpCircle size={13} color={colors.muted} /><Text style={styles.metaText}>{quiz.questionsCount} câu hỏi</Text></View>
                    <View style={styles.quizMeta}><User size={13} color={colors.muted} /><Text numberOfLines={1} style={styles.metaText}>GV: {quiz.teacherName}</Text></View>
                    {countdown ? <View style={styles.quizMeta}><AlertCircle size={13} color={expired || notYetOpen ? '#D97706' : colors.blue} /><Text style={[styles.metaText, (expired || notYetOpen) && styles.warningText]}>{countdown}</Text></View> : null}
                    {hasSubmitted ? (
                      <View style={[styles.scoreStrip, submission?.forfeit && styles.forfeitStrip]}>
                        <Text style={styles.metaText}>{submission?.forfeit ? 'Rớt do thoát giữa giờ' : 'Kết quả đã nộp:'}</Text>
                        <Text style={styles.scoreText}>{submission?.score ?? 0}%{!submission?.forfeit ? ` (${submission?.correctCount ?? 0}/${submission?.totalQuestions ?? 0} câu)` : ''}</Text>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => void openQuiz(quiz)}
                      disabled={isPreview || (!hasSubmitted && (expired || notYetOpen))}
                      style={[styles.quizAction, hasSubmitted ? styles.reviewAction : expired || notYetOpen ? styles.lockedAction : styles.startAction]}
                      accessibilityRole="button"
                    >
                      {hasSubmitted ? <CheckCircle size={15} color="#FFFFFF" /> : expired || notYetOpen ? <Clock size={15} color="#475569" /> : <Play size={15} color="#FFFFFF" />}
                      <Text style={[styles.quizActionText, (expired || notYetOpen) && !hasSubmitted && styles.lockedActionText]}>
                        {hasSubmitted ? `Xem lại bài thi (${submission?.score ?? 0}%)` : notYetOpen ? 'Chưa đến giờ' : expired ? 'Đã hết hạn' : 'Bắt đầu thi trắc nghiệm'}
                      </Text>
                    </Pressable>
                  </Card>
                );
              })}
            </View>
          )}
        </>
      ) : activeTab === 'scores' ? (
        <View style={styles.scoreSection}>
          <Card style={styles.scoreHeader}><Trophy size={18} color={colors.surface} /><Text style={styles.scoreHeaderText}>Nhật ký điểm số</Text></Card>
          <View style={styles.scoreTabs}><Text style={styles.scoreTabActive}>Trắc nghiệm GV</Text><Text style={styles.scoreTabDisabled}>Thi chứng nhận</Text></View>
          {loading ? <View style={styles.centerState}><ActivityIndicator color={colors.brand} /></View> : submittedQuizzes.length ? submittedQuizzes.map((quiz) => (
            <Pressable key={quiz.id} onPress={() => void openQuiz(quiz)} style={styles.scoreRow} accessibilityRole="button">
              <View style={styles.flex}><Text style={styles.quizTitle}>{quiz.title}</Text><Text style={styles.metaText}>{quiz.courseName} · {quiz.mySubmission?.submittedAt ? formatDate(quiz.mySubmission.submittedAt) : 'Đã nộp'}</Text></View>
              <Text style={[styles.scoreText, quiz.mySubmission?.passed ? styles.passText : styles.failText]}>{quiz.mySubmission?.forfeit ? 'RỚT' : `${quiz.mySubmission?.score ?? 0}%`}</Text>
            </Pressable>
          )) : <EmptyState title="Chưa có kết quả trắc nghiệm" message="Kết quả bài làm sẽ hiển thị tại đây sau khi nộp bài." />}
        </View>
      ) : activeTab === 'cert' ? (
        <Card style={styles.disabledInfo}><Monitor size={24} color={colors.muted} /><Text style={styles.sectionTitle}>Thi chứng nhận chỉ trên máy tính</Text><Text style={styles.examMuted}>Để bảo đảm camera và giám sát bài thi, hãy mở Phòng thi trên máy tính.</Text></Card>
      ) : (
        <Card style={styles.disabledInfo}><GraduationCap size={24} color={colors.purple} /><Text style={styles.sectionTitle}>MOS / IC3</Text><Text style={styles.examMuted}>Mở mục ôn tập chứng chỉ để xem đề luyện tập.</Text><Pressable onPress={() => navigation.navigate('CertPrepCatalog')} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Mở ôn tập MOS / IC3</Text></Pressable></Card>
      )}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  examScreen: { flex: 1 },
  tabGrid: { gap: spacing.md, marginBottom: spacing.lg },
  tabGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  tabCardWrap: { position: 'relative' },
  tabCardWrapWide: { width: '48.5%' },
  tabCard: { minHeight: 92, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: spacing.md, elevation: 2 },
  tabCardActive: { borderColor: colors.brand, backgroundColor: '#FFFDFD' },
  tabCardDisabled: { opacity: 0.76 },
  tabIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  tabTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '900' },
  tabSubtitle: { color: colors.muted, fontSize: typography.caption, marginTop: 4, lineHeight: 17 },
  certificationVeil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(255,255,255,0.68)', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  computerOnly: { flexDirection: 'row', gap: 6, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.92)', borderColor: colors.line, borderWidth: 1, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 9 },
  computerOnlyText: { color: '#475569', fontSize: typography.micro, fontWeight: '900' },
  listHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  headingWithIcon: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sectionTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '900', flexShrink: 1 },
  examMuted: { color: colors.muted, fontSize: typography.caption, lineHeight: 18, marginTop: 3 },
  refreshButton: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas },
  centerState: { alignItems: 'center', justifyContent: 'center', padding: spacing.xxxl, gap: spacing.sm },
  stateText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700', textAlign: 'center' },
  stateCard: { alignItems: 'center', gap: spacing.sm },
  stateTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '900' },
  quizGrid: { gap: spacing.md },
  quizGridWide: { flexDirection: 'row', flexWrap: 'wrap' },
  quizCard: { gap: spacing.sm },
  quizCardWide: { width: '48%' },
  quizCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm },
  coursePill: { color: '#4338CA', backgroundColor: '#EEF2FF', borderColor: '#E0E7FF', borderWidth: 1, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 7, fontSize: typography.micro, fontWeight: '900', flexShrink: 1, overflow: 'hidden' },
  statusPill: { borderWidth: 1, borderRadius: 7, paddingVertical: 3, paddingHorizontal: 7, fontSize: typography.micro, fontWeight: '900', overflow: 'hidden' },
  statusPassed: { color: '#047857', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  statusFailed: { color: '#B91C1C', backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  quizTitle: { color: '#0F172A', fontSize: typography.small, fontWeight: '900', lineHeight: 21 },
  quizMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: colors.muted, fontSize: typography.micro, fontWeight: '700', flexShrink: 1 },
  warningText: { color: '#B45309' },
  scoreStrip: { marginTop: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, borderColor: '#A7F3D0', borderWidth: 1, backgroundColor: '#ECFDF5', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  forfeitStrip: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  scoreText: { color: '#047857', fontSize: typography.small, fontWeight: '900' },
  quizAction: { marginTop: spacing.xs, minHeight: 42, borderRadius: radius.sm, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, paddingHorizontal: spacing.sm },
  startAction: { backgroundColor: colors.brand },
  reviewAction: { backgroundColor: '#1E293B' },
  lockedAction: { backgroundColor: '#CBD5E1' },
  quizActionText: { color: colors.surface, fontSize: typography.micro, fontWeight: '900' },
  lockedActionText: { color: '#475569' },
  scoreSection: { gap: spacing.sm },
  scoreHeader: { backgroundColor: colors.brand, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  scoreHeaderText: { color: colors.surface, fontSize: typography.small, fontWeight: '900' },
  scoreTabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: radius.sm, padding: 5, gap: 5 },
  scoreTabActive: { flex: 1, textAlign: 'center', color: colors.brand, backgroundColor: colors.surface, padding: spacing.sm, borderRadius: radius.sm, fontSize: typography.micro, fontWeight: '900', overflow: 'hidden' },
  scoreTabDisabled: { flex: 1, textAlign: 'center', color: colors.muted, padding: spacing.sm, fontSize: typography.micro, fontWeight: '900', overflow: 'hidden' },
  scoreRow: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  disabledInfo: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  examMutedCenter: { textAlign: 'center' },
  roomContent: { paddingBottom: spacing.xxl, gap: spacing.md },
  roomHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: '#0F172A', borderRadius: radius.md },
  roomTitle: { color: '#F8FAFC', fontSize: typography.heading, fontWeight: '900' },
  timerBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm, backgroundColor: '#0E2938', padding: spacing.sm },
  timerUrgent: { backgroundColor: '#3F1D24' },
  timerText: { color: '#67E8F9', fontSize: typography.heading, fontWeight: '900', fontVariant: ['tabular-nums'] },
  failText: { color: '#F87171' },
  passText: { color: '#34D399' },
  answerLayout: { gap: spacing.md },
  questionPanel: { padding: spacing.md, borderRadius: radius.md, backgroundColor: '#111827', borderColor: '#263244', borderWidth: 1 },
  questionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  questionLabel: { color: '#7DD3FC', fontSize: typography.micro, fontWeight: '900' },
  questionText: { color: '#F8FAFC', fontSize: typography.body, fontWeight: '800', lineHeight: 24, marginBottom: spacing.lg },
  optionsList: { gap: spacing.sm },
  option: { minHeight: 52, borderRadius: radius.sm, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionSelected: { backgroundColor: '#0C4A6E', borderColor: '#38BDF8' },
  optionLetter: { width: 28, height: 28, textAlign: 'center', textAlignVertical: 'center', color: '#94A3B8', backgroundColor: '#0F172A', borderRadius: 14, overflow: 'hidden', fontWeight: '900', paddingTop: 5 },
  optionLetterSelected: { color: '#082F49', backgroundColor: '#7DD3FC' },
  optionText: { flex: 1, color: '#CBD5E1', fontSize: typography.caption, lineHeight: 18 },
  optionTextSelected: { color: '#F0F9FF', fontWeight: '800' },
  questionNavigation: { marginTop: spacing.lg, flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  secondaryButton: { backgroundColor: '#334155', borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4 },
  secondaryButtonText: { color: colors.surface, fontSize: typography.micro, fontWeight: '900' },
  nextButton: { backgroundColor: '#38BDF8', borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4 },
  nextButtonText: { color: '#082F49', fontSize: typography.micro, fontWeight: '900' },
  disabledButton: { opacity: 0.45 },
  questionGridPanel: { backgroundColor: '#0E1420', borderColor: '#263244', gap: spacing.sm },
  gridHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gridHeadingText: { color: '#CBD5E1', fontSize: typography.caption, fontWeight: '900' },
  questionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  questionNumber: { minWidth: 42, height: 40, paddingHorizontal: spacing.sm, borderRadius: radius.sm, borderColor: '#334155', borderWidth: 1, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  questionNumberCurrent: { backgroundColor: '#0EA5E9', borderColor: '#7DD3FC' },
  questionNumberAnswered: { backgroundColor: '#065F46', borderColor: '#34D399' },
  questionNumberText: { color: '#94A3B8', fontSize: typography.micro, fontWeight: '800' },
  questionNumberTextActive: { color: colors.surface },
  gridLegend: { color: '#94A3B8', fontSize: typography.micro, fontWeight: '700' },
  submitButton: { minHeight: 44, backgroundColor: colors.brand, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { minHeight: 42, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, backgroundColor: colors.brand, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: colors.surface, fontSize: typography.micro, fontWeight: '900' },
  resultContent: { paddingBottom: spacing.xxl, gap: spacing.lg },
  resultCard: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl, backgroundColor: '#111827', borderColor: '#263244' },
  resultIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  resultPassed: { backgroundColor: '#064E3B' },
  resultFailed: { backgroundColor: '#7F1D1D' },
  resultTitle: { color: '#F8FAFC', fontSize: typography.heading, fontWeight: '900', textAlign: 'center' },
  resultScore: { fontSize: 46, lineHeight: 56, fontWeight: '900', marginTop: spacing.md },
  resultStatus: { fontSize: typography.micro, fontWeight: '900', letterSpacing: 1 },
  resultMetrics: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.md },
  resultMetric: { width: '48%', minHeight: 58, backgroundColor: '#1E293B', borderRadius: radius.sm, padding: spacing.sm },
  metricLabel: { color: '#94A3B8', fontSize: typography.micro, fontWeight: '700' },
  metricValue: { color: '#F8FAFC', fontSize: typography.micro, fontWeight: '900', marginTop: 4 },
  reviewList: { gap: spacing.sm },
  reviewCard: { backgroundColor: '#111827', borderColor: '#263244' },
  reviewAnswer: { color: '#CBD5E1', fontSize: typography.caption, marginBottom: 4 },
  reviewCorrect: { color: '#34D399', fontSize: typography.caption, fontWeight: '800', marginBottom: 4 },
});
