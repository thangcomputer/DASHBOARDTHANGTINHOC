import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../app/AuthContext';
import { StudentExamScreen as MobileStudentExamScreen } from './StudentExamScreen';
import { CourseVideosScreen } from './CourseVideosScreen';
import {
  AlertCircle, BarChart3, BookOpen, Building2, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardList, Clock3, CreditCard, Download, FileSpreadsheet, FileText, Frown, Globe,
  EyeOff, GraduationCap, Grid2X2, Heart, ImagePlus, Laugh, List, MessageCircle, MoreVertical,
  Newspaper, Paperclip, Pencil, Play, Radio, Reply, Search, Send, Sparkles, Star, ThumbsUp, Trash2, TrendingUp, WalletCards, X,
  Users, Video, Link2, Plus,
} from 'lucide-react-native';
import {
  AppHeader, AppScreen, Avatar, Card, EmptyState, ErrorState, LoadingSkeleton, PrimaryButton,
  ProgressBar, SearchField, SectionHeading, StatusBadge,
} from '../components/ui';
import { useMockResource } from '../hooks/useMockResource';
import {
  commentFeedPost, createFeedPost, deleteFeedComment, deleteFeedPost, fetchFeedPosts, reactFeedPost, updateFeedPost, uploadFeedImages,
} from '../services/feedApi';
import {
  evaluationService, feedService, quizService,
  softwareService, studentPaymentService, studentProfileService, studentService, trainingService,
} from '../services/mockService';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { getMobileApiBaseUrl, getMobileImageSource, resolveMobilePublicUrl } from '../services/apiClient';
import { SOCKET_EVENTS } from '../services/socketService';
import { createTeacherQuizQuestionWorkbook, parseTeacherQuizQuestionsExcel } from '../services/teacherQuizExcel';
import { completeTeacherTrainingLesson, saveTeacherTrainingWatchProgress } from '../services/teacherApi';
import { VideoPlayerFrame, type VideoPlayerApi, type VideoPlayerProgress } from './VideoPlayerFrame';
import RenderHtml from '@native-html/render';
import { WebView } from 'react-native-webview';
import type { AppStackParamList } from '../navigation/types';
import type {
  DemoEvaluation, DemoFeedPost, DemoNewsItem, DemoQuiz, DemoStudent, DemoTrainingCourse, DemoUser,
} from '../types';

type Navigation = NativeStackNavigationProp<AppStackParamList>;

async function shareQuizWorkbook(base64: string, fileName: string) {
  const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (Platform.OS === 'web') {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener noreferrer';
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  if (!FileSystem.cacheDirectory) throw new Error('Không thể truy cập vùng lưu tệp trên thiết bị.');
  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
  if (!(await Sharing.isAvailableAsync())) throw new Error('Thiết bị không hỗ trợ chia sẻ hoặc lưu tệp Excel.');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Lưu tệp câu hỏi Excel' });
}

async function openExternalUrl(url: string | undefined, label: string) {
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

type MenuScreen = 'Assignments' | 'Materials' | 'StudentLearning' | 'Evaluations' | 'Feed' | 'News' | 'CenterInfo' | 'Tuition' | 'SoftwareLinks' | 'TeacherQuizzes' | 'TeacherTraining' | 'TeacherFinance' | 'CertPrepCatalog' | 'LessonPracticeCatalog';
type MenuItem = { label: string; screen?: MenuScreen; description: string };

const studentMenu: MenuItem[] = [
  { label: 'Bài học', screen: 'StudentLearning', description: 'Khóa học đã đăng ký và tự học qua video' },
  { label: 'Luyện bài theo bài học', screen: 'LessonPracticeCatalog', description: 'Học và làm bài tập theo từng chương bài' },
  { label: 'Ôn thi chứng chỉ MOS / IC3', screen: 'CertPrepCatalog', description: 'Luyện đề và thi thử chứng chỉ theo cấp độ' },
  { label: 'Bài tập về nhà', screen: 'Assignments', description: 'Bài tập, hạn nộp và trạng thái bài làm' },
  { label: 'Tài liệu học tập', screen: 'Materials', description: 'Tài liệu và video theo khóa học' },
  { label: 'Phần mềm', screen: 'SoftwareLinks', description: 'Phần mềm được cung cấp theo khóa học' },
  { label: 'Đánh giá giảng viên', screen: 'Evaluations', description: 'Phản hồi theo khóa học và giảng viên' },
  { label: 'Bảng tin', screen: 'Feed', description: 'Bài đăng dành cho lớp học' },
  { label: 'Tin tức', screen: 'News', description: 'Tin tức và thông báo của trung tâm' },
  { label: 'Liên hệ Trung tâm', screen: 'CenterInfo', description: 'Thông tin trung tâm và các mục liên quan' },
  { label: 'Thông tin học phí', screen: 'Tuition', description: 'Trạng thái học phí theo khóa học' },
];

const teacherMenu: MenuItem[] = [
  { label: 'Bảng tin', screen: 'Feed', description: 'Bài đăng dành cho lớp học' },
  { label: 'Bài tập & kiểm tra', screen: 'TeacherQuizzes', description: 'Bài tập, bài nộp và trắc nghiệm' },
  { label: 'Khóa đào tạo', screen: 'TeacherTraining', description: 'Nội dung đào tạo và tài liệu' },
  { label: 'Tài chính', screen: 'TeacherFinance', description: 'Tổng hợp buổi dạy và thanh toán' },
  { label: 'Phần mềm', screen: 'SoftwareLinks', description: 'Phần mềm được cung cấp theo khóa học' },
  { label: 'Tin tức', screen: 'News', description: 'Tin tức và thông báo của trung tâm' },
  { label: 'Thông tin Trung tâm', screen: 'CenterInfo', description: 'Thông tin và các mục của trung tâm' },
];

export function MobileMenuScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const items = user?.role === 'teacher' ? teacherMenu : studentMenu;
  return (
    <AppScreen contentStyle={styles.menuScreen}>
      <AppHeader
        title="Danh mục"
        subtitle="Các mục theo tài khoản hiện tại"
        containerStyle={styles.menuHeader}
      />
      <View style={styles.menuList}>
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
            style={({ pressed }) => pressed && styles.menuPressed}
            accessibilityRole="button"
          >
            <Card style={styles.menuRow}>
              <View style={styles.menuIcon}><MenuIcon label={item.label} /></View>
              <View style={styles.menuCopy}>
                <Text numberOfLines={1} style={styles.menuItemTitle}>{item.label}</Text>
                <Text numberOfLines={1} style={styles.menuItemDescription}>{item.description}</Text>
              </View>
              <View style={styles.menuArrow}><ChevronRight size={16} color="#64748B" /></View>
            </Card>
          </Pressable>
        ))}
      </View>
    </AppScreen>
  );
}

function MenuIcon({ label }: { label: string }) {
  const common = { size: 16, color: colors.brand };
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
  return <CourseVideosScreen />;
}

export function StudentExamScreen() {
  return <MobileStudentExamScreen />;
}

export function LearningLessonScreen() {
  return <CourseVideosScreen />;
}

export function EvaluationsScreen() {
  const { user } = useAuth();
  const isPreview = !!user?.previewMode || (__DEV__ && Boolean(process.env.EXPO_PUBLIC_MOBILE_UI_QA_STATE));
  const loader = useCallback(() => evaluationService.list(user), [user]);
  const resource = useMockResource(loader);
  const [active, setActive] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'center' | 'teacher'>('center');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [submittedIds, setSubmittedIds] = useState<string[]>([]);
  const [submittedStars, setSubmittedStars] = useState<Record<string, number>>({});
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  useEffect(() => {
    const existing = resource.data?.filter((evaluation) => evaluation.completed && evaluation.existingRating) || [];
    if (!existing.length) return;
    setSubmittedIds((current) => [...new Set([...current, ...existing.map((evaluation) => evaluation.id)])]);
    setSubmittedStars((current) => ({
      ...current,
      ...Object.fromEntries(existing.filter((evaluation) => evaluation.public).map((evaluation) => [evaluation.id, evaluation.existingRating!.stars])),
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
  const submit = async (evaluation: DemoEvaluation) => {
    if (!isPreview && !user) {
      setValidationMessage('Vui lòng đăng nhập để gửi đánh giá.');
      return;
    }
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
      setIsSubmitting(true);
      try {
        if (!isPreview && user) {
          await evaluationService.submitTeacher(user, evaluation, Object.fromEntries(criteria.map((key) => [key, answers[`${evaluation.id}-${key}`]])), Math.round(score * 10) / 10, comments[evaluation.id] || '');
          resource.reload();
        }
        setSubmittedIds((current) => current.includes(evaluation.id) ? current : [...current, evaluation.id]);
        setValidationMessage('');
        setFeedbackMessage(isPreview ? 'Phản hồi chỉ được lưu trong bản xem trước.' : 'Đã gửi đánh giá tới hệ thống.');
        setActive(null);
      } catch (error) {
        setValidationMessage(error instanceof Error ? error.message : 'Không thể gửi đánh giá. Vui lòng thử lại.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }
    setIsSubmitting(true);
    try {
      if (!isPreview && user) {
        await evaluationService.submitPrivate(user, evaluation, {
          satisfied: answers[`${evaluation.id}-satisfied`] || 'yes',
          lessonClear: answers[`${evaluation.id}-lessonClear`] || 'yes',
        }, comments[evaluation.id] || '');
        resource.reload();
      }
      setSubmittedIds((current) => current.includes(evaluation.id) ? current : [...current, evaluation.id]);
      setValidationMessage('');
      setFeedbackMessage(isPreview ? 'Phản hồi chỉ được lưu trong bản xem trước.' : 'Đã gửi phản hồi riêng cho Trung tâm.');
      setActive(null);
    } catch (error) {
      setValidationMessage(error instanceof Error ? error.message : 'Không thể gửi phản hồi. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
    }
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
      <AppHeader title="Đánh giá" subtitle="Phản hồi khóa học và giảng viên" showBackButton={false} centered />
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
                title={isSubmitting ? 'Đang gửi…' : evaluation.public && ['teaching', 'voice', 'guidance', 'support'].some((key) => !answers[`${evaluation.id}-${key}`]) ? 'Chọn đủ tiêu chí để gửi' : evaluation.public ? submittedIds.includes(evaluation.id) ? 'Cập nhật đánh giá' : 'Gửi đánh giá công khai' : 'Gửi phản hồi cho trung tâm'}
                disabled={isSubmitting || (evaluation.public && ['teaching', 'voice', 'guidance', 'support'].some((key) => !answers[`${evaluation.id}-${key}`]))}
                onPress={() => { void submit(evaluation); }}
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
  const [posts, setPosts] = useState<DemoFeedPost[] | null>(null);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);
  const [postMenuId, setPostMenuId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshError, setRefreshError] = useState('');
  const [feedActionError, setFeedActionError] = useState('');
  const live = !!user && !user.previewMode;
  const loader = useCallback(() => (live ? fetchFeedPosts() : feedService.posts()), [live]);
  const resource = useMockResource(loader);
  const hiddenPostsStorageKey = `mobile-feed-hidden:${user?.id || 'preview'}`;
  useEffect(() => {
    if (!postMenuId || Platform.OS !== 'web' || typeof document === 'undefined') return undefined;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('#feed-post-menu')) return;
      setPostMenuId(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPostMenuId(null);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer, true);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer, true);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [postMenuId]);
  useEffect(() => {
    let active = true;
    const loadHiddenPosts = async () => {
      try {
        const stored = Platform.OS === 'web'
          ? globalThis.localStorage.getItem(hiddenPostsStorageKey)
          : await AsyncStorage.getItem(hiddenPostsStorageKey);
        const ids: unknown = stored ? JSON.parse(stored) : [];
        if (active) setHiddenPostIds(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : []);
      } catch (error) {
        if (active) Alert.alert('Bảng tin', error instanceof Error ? `Không thể tải danh sách bài đã ẩn: ${error.message}` : 'Không thể tải danh sách bài đã ẩn.');
      }
    };
    void loadHiddenPosts();
    return () => { active = false; };
  }, [hiddenPostsStorageKey]);
  useEffect(() => {
    if (!live) return undefined;
    const timer = setInterval(() => {
      if (editingPostId || busy) return;
      fetchFeedPosts()
        .then((latest) => {
          setPosts(latest);
          setRefreshError('');
        })
        .catch((error: unknown) => {
          setRefreshError(error instanceof Error ? error.message : 'Không thể cập nhật bảng tin.');
        });
    }, 8000);
    return () => clearInterval(timer);
  }, [live, busy, editingPostId]);
  const apiRun = async (fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    try {
      await fn();
      setPosts(await fetchFeedPosts());
      setRefreshError('');
      setFeedActionError('');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Thao tác thất bại, vui lòng thử lại.';
      setFeedActionError(message);
      if (Platform.OS !== 'web') Alert.alert('Bảng tin', message);
      return false;
    } finally {
      setBusy(false);
    }
  };
  const selectFeedImages = async () => {
    if (busy) return;
    try {
      if (Platform.OS !== 'web') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Cần quyền truy cập ảnh', 'Cho phép ứng dụng truy cập thư viện ảnh để đính kèm ảnh.');
          return;
        }
      }
      const remaining = 6 - selectedImages.length;
      if (remaining <= 0) {
        Alert.alert('Đã đủ ảnh', 'Mỗi bài đăng tối đa 6 ảnh.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.85,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;
      const accepted = result.assets.filter((asset) => (
        (!asset.mimeType || asset.mimeType.toLowerCase().startsWith('image/'))
        && (asset.fileSize == null || asset.fileSize <= 5 * 1024 * 1024)
      ));
      if (accepted.length !== result.assets.length) {
        Alert.alert('Một số ảnh không hợp lệ', 'Chỉ nhận ảnh tối đa 5MB mỗi ảnh.');
      }
      setSelectedImages((current) => [...current, ...accepted].slice(0, 6));
    } catch (error) {
      Alert.alert('Không thể chọn ảnh', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  };
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState('');
  const [audience, setAudience] = useState('Công khai');
  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [visiblePostCount, setVisiblePostCount] = useState(3);
  const [replyTarget, setReplyTarget] = useState<{ postId: string; parentId: string; author: string } | null>(null);
  const [commentsOpen, setCommentsOpen] = useState<Record<string, boolean>>({});
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Record<string, boolean>>({});
  const [reactionPickerPostId, setReactionPickerPostId] = useState<string | null>(null);
  const reactionPickerCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showAudienceMenu, setShowAudienceMenu] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  useEffect(() => () => {
    if (reactionPickerCloseTimer.current) clearTimeout(reactionPickerCloseTimer.current);
  }, []);
  const items = posts || resource.data || [];
  const visibleItems = items.filter((post) => !hiddenPostIds.includes(post.id));
  const visiblePosts = visibleItems.slice(0, visiblePostCount);
  const roleLabel = isTeacher ? 'Giảng viên' : 'Học viên';
  const audienceOptions = [
    { value: 'Công khai', title: 'Công khai', description: 'Tất cả mọi người đều xem được', icon: Globe },
    ...(isTeacher ? [{ value: 'Chỉ Giảng viên & Admin', title: 'Chỉ Giảng viên & Admin', description: 'Học viên không xem được', icon: GraduationCap }] : []),
    { value: 'Chỉ Học viên & Admin', title: 'Chỉ Học viên & Admin', description: 'Giảng viên không xem được', icon: Users },
  ];
  const ownPost = (post: DemoFeedPost) => post.authorId === user?.id;
  const updatePost = (postId: string, update: (post: DemoFeedPost) => DemoFeedPost) => {
    setPosts(items.map((post) => post.id === postId ? update(post) : post));
  };
  const setLocalReaction = (postId: string, type: NonNullable<DemoFeedPost['myReaction']>) => {
    updatePost(postId, (post) => {
      const wasSelected = post.myReaction === type;
      return {
        ...post,
        myReaction: wasSelected ? null : type,
        reactionCount: Math.max(0, post.reactionCount + (wasSelected ? -1 : post.myReaction ? 0 : 1)),
        reactions: {
          heart: Math.max(0, (post.reactions?.heart || 0) - (post.myReaction === 'heart' ? 1 : 0) + (!wasSelected && type === 'heart' ? 1 : 0)),
          like: Math.max(0, (post.reactions?.like || 0) - (post.myReaction === 'like' ? 1 : 0) + (!wasSelected && type === 'like' ? 1 : 0)),
          haha: Math.max(0, (post.reactions?.haha || 0) - (post.myReaction === 'haha' ? 1 : 0) + (!wasSelected && type === 'haha' ? 1 : 0)),
          wow: Math.max(0, (post.reactions?.wow || 0) - (post.myReaction === 'wow' ? 1 : 0) + (!wasSelected && type === 'wow' ? 1 : 0)),
          sad: Math.max(0, (post.reactions?.sad || 0) - (post.myReaction === 'sad' ? 1 : 0) + (!wasSelected && type === 'sad' ? 1 : 0)),
        },
      };
    });
  };
  const toggleComments = (postId: string) => {
    const opening = !commentsOpen[postId];
    setCommentsOpen((current) => ({ ...current, [postId]: opening }));
    if (!opening && replyTarget?.postId === postId) setReplyTarget(null);
    setReactionPickerPostId(null);
  };
  const openReactionPicker = (postId: string) => {
    if (reactionPickerCloseTimer.current) clearTimeout(reactionPickerCloseTimer.current);
    setReactionPickerPostId(postId);
  };
  const scheduleReactionPickerClose = () => {
    if (reactionPickerCloseTimer.current) clearTimeout(reactionPickerCloseTimer.current);
    reactionPickerCloseTimer.current = setTimeout(() => {
      setReactionPickerPostId(null);
      reactionPickerCloseTimer.current = null;
    }, 250);
  };
  const selectReaction = (postId: string, type: NonNullable<DemoFeedPost['myReaction']>) => {
    if (reactionPickerCloseTimer.current) clearTimeout(reactionPickerCloseTimer.current);
    if (live) void apiRun(() => reactFeedPost(postId, type));
    else setLocalReaction(postId, type);
    setReactionPickerPostId(null);
  };
  const handleDeleteComment = (post: DemoFeedPost, commentId: string) => {
    const removeComment = () => {
      if (live) {
        void apiRun(() => deleteFeedComment(post.id, commentId));
        return;
      }
      updatePost(post.id, (current) => ({
        ...current,
        comments: current.comments.filter((entry) => entry.id !== commentId),
        replies: (current.replies || []).filter((entry) => entry.parentId !== commentId),
      }));
    };
    if (Platform.OS === 'web') {
      removeComment();
      return;
    }
    Alert.alert('Xóa bình luận?', 'Bình luận và các phản hồi sẽ bị xóa.', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Xóa', style: 'destructive', onPress: removeComment },
    ]);
  };
  const persistHiddenPostIds = async (ids: string[]) => {
    const serialized = JSON.stringify(ids);
    if (Platform.OS === 'web') globalThis.localStorage.setItem(hiddenPostsStorageKey, serialized);
    else await AsyncStorage.setItem(hiddenPostsStorageKey, serialized);
  };
  const hidePost = (postId: string) => {
    const next = [...new Set([...hiddenPostIds, postId])];
    setHiddenPostIds(next);
    setPostMenuId(null);
    void persistHiddenPostIds(next).then(() => {
      Alert.alert('Bài viết đã được ẩn', 'Bài viết sẽ không còn hiển thị trong bảng tin của bạn trên thiết bị này.', [
        { text: 'Đóng' },
        {
          text: 'Hoàn tác', onPress: () => {
            const restored = next.filter((id) => id !== postId);
            setHiddenPostIds(restored);
            void persistHiddenPostIds(restored).catch((error: unknown) => {
              Alert.alert('Không thể hoàn tác', error instanceof Error ? error.message : 'Vui lòng thử lại.');
            });
          }
        },
      ]);
    }).catch((error: unknown) => {
      setHiddenPostIds(hiddenPostIds);
      Alert.alert('Không thể ẩn bài viết', error instanceof Error ? error.message : 'Không lưu được thay đổi trên thiết bị.');
    });
  };
  const renderCommentComposer = (post: DemoFeedPost) => (
    <View style={styles.commentComposer}>
      {replyTarget?.postId === post.id ? (
        <View style={styles.feedReplyingTo}>
          <Text style={styles.feedReplyingText}>Đang trả lời {replyTarget.author}</Text>
          <Pressable onPress={() => setReplyTarget(null)} accessibilityRole="button" accessibilityLabel="Hủy trả lời"><Text style={styles.feedReplyCancel}>×</Text></Pressable>
        </View>
      ) : null}
      <View style={styles.commentComposerInputRow}>
        <TextInput
          value={commentDrafts[post.id] || ''}
          onChangeText={(text) => setCommentDrafts((current) => ({ ...current, [post.id]: text }))}
          placeholder={replyTarget?.postId === post.id ? `Trả lời ${replyTarget.author}...` : 'Viết bình luận thảo luận...'}
          style={styles.commentInput}
          onFocus={() => setCommentsOpen((current) => ({ ...current, [post.id]: true }))}
          accessibilityLabel="Nội dung bình luận"
        />
        <Pressable onPress={() => {
          const text = (commentDrafts[post.id] || '').trim();
          if (!text || busy) return;
          const parentId = replyTarget?.postId === post.id ? replyTarget.parentId : undefined;
          if (live) {
            void apiRun(() => commentFeedPost(post.id, text, parentId)).then((success) => {
              if (success) {
                setCommentDrafts((current) => ({ ...current, [post.id]: '' }));
                setReplyTarget(null);
                setCommentsOpen((current) => ({ ...current, [post.id]: true }));
              }
            });
            return;
          }
          updatePost(post.id, (current) => {
            if (parentId) return {
              ...current,
              commentsCount: (current.commentsCount ?? current.comments.length + (current.replies || []).length) + 1,
              replies: [...(current.replies || []), { id: `reply-${Date.now()}`, parentId, author: user?.name || 'Bạn', authorId: user?.id, text }],
            };
            return {
              ...current,
              commentsCount: (current.commentsCount ?? current.comments.length + (current.replies || []).length) + 1,
              comments: [...current.comments, { id: `comment-${Date.now()}`, author: user?.name || 'Bạn', authorId: user?.id, text }],
            };
          });
          setCommentDrafts((current) => ({ ...current, [post.id]: '' }));
          setReplyTarget(null);
        }} accessibilityRole="button" accessibilityLabel="Gửi bình luận">
          <Send size={18} color={colors.red} />
        </Pressable>
      </View>
    </View>
  );
  return (
    <AppScreen>
      <AppHeader title={isTeacher ? 'Bảng tin trao đổi & Hỏi bài' : 'Bảng tin'} subtitle="Bài đăng dành cho lớp học" icon={Newspaper} />
      <Card style={styles.feedComposer}>
        <View style={styles.feedAuthorRow}>
          <Avatar name={user?.name || roleLabel} color={user?.avatarColor} size={42} />
          <View style={styles.flex}>
            <Text style={styles.cardTitle}>{user?.name || roleLabel}</Text>
            <Text style={styles.caption}>{roleLabel}</Text>
          </View>
          <View style={styles.privacyMenuAnchor}>
            <Pressable
              onPress={() => setShowAudienceMenu((visible) => !visible)}
              style={styles.privacyButton}
              accessibilityRole="button"
              accessibilityLabel="Chọn quyền riêng tư bài đăng"
              accessibilityState={{ expanded: showAudienceMenu }}
            >
              <Globe size={13} color={colors.green} />
              <Text numberOfLines={1} style={styles.privacyText}>{audience}</Text>
              <ChevronDown size={12} color={colors.green} />
            </Pressable>
            {showAudienceMenu ? (
              <View style={styles.privacyMenu}>
                <Text style={styles.privacyMenuTitle}>Ai có thể xem bài viết?</Text>
                {audienceOptions.map((option) => {
                  const OptionIcon = option.icon;
                  const selected = audience === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        setAudience(option.value);
                        setShowAudienceMenu(false);
                      }}
                      style={[styles.privacyOption, selected && styles.privacyOptionSelected]}
                      accessibilityRole="button"
                      accessibilityLabel={`${option.title}. ${option.description}`}
                      accessibilityState={{ selected }}
                    >
                      <OptionIcon size={15} color={selected ? colors.brand : colors.muted} />
                      <View style={styles.privacyOptionCopy}>
                        <View style={styles.privacyOptionTitleRow}>
                          <Text numberOfLines={1} style={styles.privacyOptionTitle}>{option.title}</Text>
                          {selected ? <Check size={14} color={colors.brand} /> : null}
                        </View>
                        <Text style={styles.privacyOptionDescription}>{option.description}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>
        <TextInput value={draft} onChangeText={setDraft} placeholder="Bạn muốn chia sẻ điều gì?" multiline style={styles.feedDraft} accessibilityLabel="Nội dung bài đăng" />
        {selectedImages.length ? (
          <View style={styles.feedImagePreviewList}>
            {selectedImages.map((asset, index) => (
              <View key={`${asset.uri}-${index}`} style={styles.feedImagePreview}>
                <Image source={{ uri: asset.uri }} style={styles.feedImagePreviewImage} />
                <Pressable onPress={() => setSelectedImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={styles.feedImageRemove} accessibilityRole="button" accessibilityLabel={`Bỏ ảnh ${index + 1}`}>
                  <Text style={styles.feedImageRemoveText}>×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.feedComposerActions}>
          <Pressable onPress={() => { void selectFeedImages(); }} style={styles.feedImageAction} accessibilityRole="button" accessibilityLabel="Thêm ảnh">
            <ImagePlus size={19} color={colors.green} /><Text style={styles.actionText}>Thêm ảnh ({selectedImages.length}/6)</Text>
          </Pressable>
          <PrimaryButton title="Đăng bài" disabled={(!draft.trim() && !selectedImages.length) || busy} onPress={() => {
            const content = draft.trim();
            if (!content && !selectedImages.length) return;
            if (live) {
              void apiRun(async () => {
                const images = await uploadFeedImages(selectedImages.map((asset, index) => ({
                  uri: asset.uri,
                  name: asset.fileName || `feed-${Date.now()}-${index + 1}.jpg`,
                  mimeType: asset.mimeType || 'image/jpeg',
                  file: asset.file || undefined,
                })));
                await createFeedPost(content, audience, images);
              }).then((success) => {
                if (success) {
                  setDraft('');
                  setSelectedImages([]);
                }
              });
              return;
            }
            setPosts([{
              id: `feed-${Date.now()}`, authorId: user?.id, author: user?.name || roleLabel, role: roleLabel,
              time: 'Vừa xong', content, audience, images: selectedImages.map((asset) => asset.uri),
              mediaType: selectedImages.length ? 'image' : undefined,
              comments: [], replies: [], reactionCount: 0,
            }, ...items]);
            setDraft('');
            setSelectedImages([]);
          }} />
        </View>
        {!live ? <Text style={styles.note}>Bài đăng và ảnh chỉ được giữ cục bộ trong bản xem trước.</Text> : null}
      </Card>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {refreshError ? <Text style={styles.note}>Không thể cập nhật bảng tin: {refreshError}</Text> : null}
      {feedActionError ? <Text style={styles.note}>Không thể hoàn tất thao tác: {feedActionError}</Text> : null}
      {visiblePosts.map((post) => (
        <Card key={post.id}>
          <View style={styles.feedAuthorRow}><Avatar name={post.author} color={colors.brandSoft} size={42} imageSource={post.authorAvatar ? getMobileImageSource(post.authorAvatar) : undefined} /><View style={styles.flex}><Text style={styles.cardTitle}>{post.author}</Text><Text style={styles.caption}>{post.role} · {post.time}</Text></View>
            <View nativeID="feed-post-menu" style={styles.feedPostMenuAnchor}>
              <Pressable
                onPress={() => setPostMenuId((current) => current === post.id ? null : post.id)}
                style={styles.feedPostMenuButton}
                accessibilityRole="button"
                accessibilityLabel="Tùy chọn bài viết"
                accessibilityState={{ expanded: postMenuId === post.id }}
              >
                <MoreVertical size={18} color={colors.muted} />
              </Pressable>
              {postMenuId === post.id ? (
                <View style={styles.feedPostMenu}>
                  {ownPost(post) ? (
                    <>
                      <Pressable onPress={() => {
                        setEditingPostId(post.id);
                        setEditDraft(post.content);
                        setPostMenuId(null);
                      }} style={styles.feedPostMenuItem} accessibilityRole="button">
                        <Pencil size={15} color={colors.brand} /><Text style={styles.feedPostMenuText}>Chỉnh sửa</Text>
                      </Pressable>
                      <Pressable onPress={() => {
                        setPostMenuId(null);
                        Alert.alert('Xóa bài viết?', live ? 'Bài viết sẽ bị xóa khỏi bảng tin.' : 'Bài viết sẽ bị xóa khỏi bản xem trước.', [
                          { text: 'Hủy', style: 'cancel' },
                          { text: 'Xóa', style: 'destructive', onPress: () => (live ? void apiRun(() => deleteFeedPost(post.id)) : setPosts(items.filter((item) => item.id !== post.id))) },
                        ]);
                      }} style={styles.feedPostMenuItem} accessibilityRole="button">
                        <Trash2 size={15} color={colors.red} /><Text style={[styles.feedPostMenuText, styles.feedPostMenuDelete]}>Xóa</Text>
                      </Pressable>
                    </>
                  ) : null}
                  <Pressable onPress={() => hidePost(post.id)} style={styles.feedPostMenuItem} accessibilityRole="button">
                    <EyeOff size={15} color={colors.muted} /><Text style={styles.feedPostMenuText}>Ẩn bài viết</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
          {isTeacher ? <Text style={styles.feedAudience}>{post.audience}</Text> : null}
          {editingPostId === post.id ? (
            <View style={styles.feedEditBox}>
              <TextInput value={editDraft} onChangeText={setEditDraft} multiline style={styles.feedDraft} accessibilityLabel="Chỉnh sửa bài đăng demo" />
              <View style={styles.rowBetween}>
                <Pressable onPress={() => setEditingPostId(null)} style={styles.feedInlineAction}><Text style={styles.feedInlineActionText}>Hủy</Text></Pressable>
                <Pressable onPress={() => {
                  const content = editDraft.trim();
                  if (!content) { Alert.alert('Nội dung trống', 'Nhập nội dung trước khi lưu.'); return; }
                  if (live) { setEditingPostId(null); void apiRun(() => updateFeedPost(post.id, content)); return; }
                  updatePost(post.id, (item) => ({ ...item, content }));
                  setEditingPostId(null);
                }} style={styles.feedInlineAction}><Text style={styles.feedInlineActionText}>Lưu thay đổi</Text></Pressable>
              </View>
            </View>
          ) : <Text style={styles.body}>{post.content}</Text>}
          {post.images?.length ? (
            <View style={styles.feedPostImages}>
              {post.images.map((image, index) => (
                <Pressable key={`${image}-${index}`} onPress={() => { void openExternalUrl(resolveMobilePublicUrl(image), 'Ảnh bài đăng'); }} style={[styles.feedPostImageFrame, post.images?.length === 1 && styles.feedPostImageSingle]} accessibilityRole="button" accessibilityLabel={`Mở ảnh ${index + 1} trong bài đăng`}>
                  <Image source={getMobileImageSource(image)} style={styles.feedPostImage} resizeMode="cover" />
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.feedActionBar}>
            <View style={styles.feedReactionActionWrap}>
              {reactionPickerPostId === post.id ? (
                <View style={styles.feedReactionPicker}>
                  {([
                    ['heart', '❤️'], ['like', '👍'], ['haha', '😄'], ['wow', '😮'], ['sad', '😢'],
                  ] as const).map(([type, emoji]) => (
                    <Pressable key={type} onHoverIn={() => openReactionPicker(post.id)} onPress={() => selectReaction(post.id, type)} style={styles.feedReactionOption} accessibilityRole="button" accessibilityLabel={`Cảm xúc ${type}`}>
                      <Text style={styles.feedReactionEmoji}>{emoji}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <Pressable
                onHoverIn={() => openReactionPicker(post.id)}
                onHoverOut={scheduleReactionPickerClose}
                onPress={() => setReactionPickerPostId((current) => {
                  if (current === post.id) return Platform.OS === 'web' ? current : null;
                  return post.id;
                })}
                style={[styles.feedActionButton, post.myReaction ? styles.feedActionButtonActive : null]}
                accessibilityRole="button"
                accessibilityLabel={post.myReaction ? 'Đổi cảm xúc' : 'Thả cảm xúc'}
              >
                {post.myReaction === 'heart' ? <Heart size={15} color={colors.red} fill={colors.red} />
                  : post.myReaction === 'like' ? <ThumbsUp size={15} color={colors.brand} fill={colors.brand} />
                    : post.myReaction === 'haha' ? <Laugh size={15} color={colors.gold} />
                      : post.myReaction === 'wow' ? <Sparkles size={15} color={colors.brand} />
                        : post.myReaction === 'sad' ? <Frown size={15} color={colors.muted} />
                          : <Heart size={15} color={colors.muted} />}
                <Text numberOfLines={1} style={styles.feedActionButtonText}>{post.myReaction ? ({ heart: 'Tim', like: 'Like', haha: 'Haha', wow: 'Wow', sad: 'Buồn' })[post.myReaction] : 'Thích'}</Text>
                {post.reactionCount > 0 ? <Text style={styles.feedActionCount}>{post.reactionCount}</Text> : null}
              </Pressable>
            </View>
            <Pressable
              onPress={() => toggleComments(post.id)}
              style={[styles.feedActionButton, commentsOpen[post.id] ? styles.feedActionButtonActive : null]}
              accessibilityRole="button"
              accessibilityLabel={commentsOpen[post.id] ? 'Ẩn bình luận' : 'Viết bình luận'}
            >
              <MessageCircle size={15} color={commentsOpen[post.id] ? colors.brand : colors.muted} />
              <Text numberOfLines={1} style={styles.feedActionButtonText}>{commentsOpen[post.id]
                ? `Ẩn bình luận${(post.commentsCount ?? post.comments.length + (post.replies || []).length) ? ` (${post.commentsCount ?? post.comments.length + (post.replies || []).length})` : ''}`
                : (post.commentsCount ?? post.comments.length + (post.replies || []).length) > 0
                  ? `Bình luận (${post.commentsCount ?? post.comments.length + (post.replies || []).length})`
                  : 'Viết bình luận'}</Text>
            </Pressable>
          </View>
          {commentsOpen[post.id] ? (
            <View style={styles.feedCommentsSection}>
              {(post.comments || []).map((item) => (
                <View key={item.id} style={styles.feedCommentThread}>
                  <View style={styles.feedCommentRow}>
                    <Avatar name={item.author} size={30} color={colors.brandSoft} imageSource={item.avatar ? getMobileImageSource(item.avatar) : undefined} />
                    <View style={styles.feedCommentHeader}>
                      <View style={styles.feedCommentContent}>
                        <View style={styles.feedCommentTitleLine}>
                          <Text style={styles.feedCommentAuthor}>{item.author}</Text>
                          {item.role ? <Text style={styles.feedCommentRole}>{item.role}</Text> : null}
                          <Text style={styles.feedCommentDot}>·</Text>
                          <Text style={styles.feedCommentTime}>{item.time || ''}</Text>
                        </View>
                        <Text style={styles.feedCommentText}>{item.text}</Text>
                        <View style={styles.feedCommentActions}>
                          <Pressable onPress={() => {
                            setReplyTarget({ postId: post.id, parentId: item.id, author: item.author });
                            setCommentDrafts((current) => ({ ...current, [post.id]: '' }));
                          }} style={styles.feedReplyAction} accessibilityRole="button">
                            <Text style={styles.feedCommentActionText}>Trả lời</Text>
                          </Pressable>
                        </View>
                      </View>
                      {(item.authorId === user?.id || ownPost(post)) ? (
                        <Pressable onPress={() => handleDeleteComment(post, item.id)} style={styles.feedCommentDelete} accessibilityRole="button" accessibilityLabel="Xóa bình luận">
                          <Trash2 size={13} color={colors.muted} />
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                  {(() => {
                    const replies = (post.replies || []).filter((reply) => reply.parentId === item.id);
                    if (!replies.length) {
                      return replyTarget?.postId === post.id && replyTarget.parentId === item.id
                        ? <View style={styles.feedReplyBranch}>{renderCommentComposer(post)}</View>
                        : null;
                    }
                    const expanded = expandedReplyThreads[item.id] === true;
                    const visibleReplies = expanded ? replies : replies.slice(0, 2);
                    return (
                      <>
                        <View style={styles.feedReplyBranch}>
                          {visibleReplies.map((reply) => (
                            <View key={reply.id} style={styles.feedReplyRow}>
                              <Avatar name={reply.author} size={26} color={colors.brandSoft} imageSource={reply.avatar ? getMobileImageSource(reply.avatar) : undefined} />
                              <View style={styles.feedReplyContent}>
                                <View style={styles.feedCommentTitleLine}>
                                  <Text style={styles.feedCommentAuthor}>{reply.author}</Text>
                                  {reply.role ? <Text style={styles.feedCommentRole}>{reply.role}</Text> : null}
                                  <Text style={styles.feedCommentDot}>·</Text>
                                  <Text style={styles.feedCommentTime}>{reply.time || ''}</Text>
                                </View>
                                <Text style={styles.feedCommentText}>{reply.text}</Text>
                                <View style={styles.feedCommentActions}>
                                  <Pressable onPress={() => {
                                    setReplyTarget({ postId: post.id, parentId: item.id, author: reply.author });
                                    setCommentDrafts((current) => ({ ...current, [post.id]: '' }));
                                  }} style={styles.feedReplyAction} accessibilityRole="button">
                                    <Text style={styles.feedCommentActionText}>Trả lời</Text>
                                  </Pressable>
                                </View>
                              </View>
                            </View>
                          ))}
                          {replies.length > 2 ? (
                            <Pressable onPress={() => setExpandedReplyThreads((current) => ({ ...current, [item.id]: !expanded }))} style={styles.feedExpandReplies} accessibilityRole="button">
                              <Text style={styles.feedExpandRepliesText}>{expanded ? 'Ẩn câu trả lời' : `Xem ${replies.length - visibleReplies.length} câu trả lời`}</Text>
                            </Pressable>
                          ) : null}
                          {replyTarget?.postId === post.id && replyTarget.parentId === item.id ? renderCommentComposer(post) : null}
                        </View>
                      </>
                    );
                  })()}
                </View>
              ))}
              {!replyTarget ? renderCommentComposer(post) : null}
            </View>
          ) : null}
        </Card>
      ))}
      {visibleItems.length > visiblePostCount ? <PrimaryButton title="Xem thêm bài cũ hơn" variant="secondary" onPress={() => setVisiblePostCount((count) => count + 3)} /> : null}
      {!resource.loading && !resource.error && !visibleItems.length ? <EmptyState title={items.length ? 'Bạn đã ẩn tất cả bài viết' : 'Chưa có bài đăng'} message={items.length ? 'Bài viết mới sẽ hiển thị tại đây.' : 'Bài đăng mới sẽ hiển thị tại đây.'} /> : null}
    </AppScreen>
  );
}

export function NewsScreen() {
  const navigation = useNavigation<Navigation>();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [topic, setTopic] = useState('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'views'>('newest');
  const [period, setPeriod] = useState<'today' | 'this_month' | 'last_month' | 'oldest_month' | ''>('');
  const [layout, setLayout] = useState<'list' | 'grid'>('grid');
  const [openNewsFilter, setOpenNewsFilter] = useState<'topic' | 'sort' | 'period' | null>(null);
  const loader = useCallback(() => feedService.news({
    query,
    topicId: topic,
    sort,
    period: period || undefined,
  }), [period, query, sort, topic]);
  const resource = useMockResource(loader);
  const topicsLoader = useCallback(() => feedService.newsTopics(), []);
  const topicsResource = useMockResource(topicsLoader);
  const topics = [{ id: 'all', name: 'Chủ đề: Tất cả' }, ...(topicsResource.data || [])];
  const selectedTopic = topic === 'all' ? 'Chủ đề: Tất cả' : topics.find((item) => item.id === topic)?.name || 'Chủ đề: Tất cả';
  const sortLabel = sort === 'oldest' ? 'Tin cũ nhất' : sort === 'views' ? 'Xem nhiều' : 'Tin mới nhất';
  const periodLabel = period === 'today' ? 'Hôm nay'
    : period === 'this_month' ? 'Tháng này'
      : period === 'last_month' ? 'Tháng trước'
        : period === 'oldest_month' ? 'Tháng cũ nhất'
          : 'Thời gian: Mọi lúc';
  const renderNewsFilter = (
    filter: 'topic' | 'sort' | 'period',
    label: string,
    options: { label: string; selected: boolean; onSelect: () => void }[],
  ) => (
    <View style={[styles.newsControlWrap, openNewsFilter === filter && styles.newsControlWrapOpen]}>
      <Pressable
        onPress={() => setOpenNewsFilter((current) => current === filter ? null : filter)}
        style={[styles.newsControl, openNewsFilter === filter && styles.newsControlOpen]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: openNewsFilter === filter }}
      >
        <Text numberOfLines={1} style={styles.newsControlText}>{label}</Text>
        <ChevronDown size={14} color={colors.muted} />
      </Pressable>
      {openNewsFilter === filter ? (
        <View style={[styles.newsDropdown, filter === 'period' && styles.newsDropdownAlignRight]}>
          {options.map((option) => (
            <Pressable
              key={option.label}
              onPress={() => {
                option.onSelect();
                setOpenNewsFilter(null);
              }}
              style={[styles.newsDropdownOption, option.selected && styles.newsDropdownOptionSelected]}
              accessibilityRole="button"
            >
              <Text numberOfLines={1} style={[styles.newsDropdownOptionText, option.selected && styles.newsDropdownOptionTextSelected]}>{option.label}</Text>
              {option.selected ? <Check size={14} color="#FFFFFF" /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
  const articles = resource.data || [];
  const visibleArticles = user?.previewMode
    ? articles.filter((news) => `${news.title} ${news.topic} ${news.excerpt}`.toLocaleLowerCase('vi-VN').includes(query.toLocaleLowerCase('vi-VN')))
    : articles;
  return (
    <AppScreen contentStyle={styles.newsScreen}>
      <AppHeader title="Tin tức" showBackButton={false} centered />
      <View style={styles.newsToolbar}>
        <View style={styles.newsSearch}>
          <Search size={17} color={colors.muted} />
          <TextInput value={draft} onChangeText={setDraft} onSubmitEditing={() => setQuery(draft.trim())} returnKeyType="search" placeholder="Tìm bài viết..." placeholderTextColor={colors.muted} style={styles.newsSearchInput} />
          {draft ? <Pressable onPress={() => { setDraft(''); setQuery(''); }} accessibilityRole="button" accessibilityLabel="Xóa từ khóa tìm kiếm"><Text style={styles.newsSearchClear}>×</Text></Pressable> : null}
          <Pressable onPress={() => setQuery(draft.trim())} style={styles.newsSearchButton} accessibilityRole="button" accessibilityLabel="Tìm tin tức"><Text style={styles.newsSearchButtonText}>Tìm</Text></Pressable>
        </View>
        <Pressable onPress={() => setLayout((current) => current === 'list' ? 'grid' : 'list')} style={styles.newsLayoutButton} accessibilityRole="button" accessibilityLabel={`Chuyển sang chế độ ${layout === 'list' ? 'lưới' : 'danh sách'}`}>
          {layout === 'list' ? <Grid2X2 size={17} color={colors.brand} /> : <List size={17} color={colors.brand} />}
        </Pressable>
      </View>
      <View style={styles.newsFilters}>
        {renderNewsFilter('topic', selectedTopic, [
          { label: 'Chủ đề: Tất cả', selected: topic === 'all', onSelect: () => setTopic('all') },
          ...(topicsResource.data || []).map((item) => ({
            label: item.name,
            selected: topic === item.id,
            onSelect: () => setTopic(item.id),
          })),
        ])}
        {renderNewsFilter('sort', sortLabel, [
          { label: 'Tin mới nhất', selected: sort === 'newest', onSelect: () => setSort('newest') },
          { label: 'Tin cũ nhất', selected: sort === 'oldest', onSelect: () => setSort('oldest') },
          { label: 'Xem nhiều', selected: sort === 'views', onSelect: () => setSort('views') },
        ])}
        {renderNewsFilter('period', periodLabel, [
          { label: 'Mọi lúc', selected: period === '', onSelect: () => setPeriod('') },
          { label: 'Hôm nay', selected: period === 'today', onSelect: () => setPeriod('today') },
          { label: 'Tháng này', selected: period === 'this_month', onSelect: () => setPeriod('this_month') },
          { label: 'Tháng trước', selected: period === 'last_month', onSelect: () => setPeriod('last_month') },
          { label: 'Tháng cũ nhất', selected: period === 'oldest_month', onSelect: () => setPeriod('oldest_month') },
        ])}
      </View>
      {topicsResource.error ? <ErrorState onRetry={topicsResource.reload} /> : null}
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      <View style={layout === 'grid' ? styles.newsGrid : undefined}>
        {visibleArticles.map((news) => (
          <Pressable key={news.id} onPress={() => navigation.navigate('NewsDetail', { newsId: news.id })} style={layout === 'grid' ? styles.newsGridItem : undefined} accessibilityRole="button">
            <Card style={{ ...styles.newsCard, ...(layout === 'grid' ? styles.newsGridCard : styles.newsListCard) }}>
              <View style={[styles.newsThumbnail, layout === 'list' && styles.newsThumbnailList]}>
                {news.thumbnailUrl ? (
                  <Image source={getMobileImageSource(news.thumbnailUrl)} style={styles.newsThumbnailImage} resizeMode="cover" />
                ) : <Newspaper size={22} color={colors.brand} />}
                <View style={styles.newsAudienceBadge}>
                  <Text style={styles.newsAudienceBadgeText}>{news.targetAudience === 'teacher' ? 'Giảng viên' : news.targetAudience === 'student' ? 'Học viên' : 'Tất cả'}</Text>
                </View>
                {news.isNew ? <View style={styles.newsNewBadge}><Text style={styles.newsNewBadgeText}>Mới</Text></View> : null}
              </View>
              <View style={styles.newsCardContent}>
                <Text style={styles.newsTitle} numberOfLines={2}>{news.title}</Text>
                {layout === 'list' && news.excerpt ? <Text style={styles.newsExcerpt} numberOfLines={3}>{news.excerpt}</Text> : null}
                <Text style={styles.newsMeta} numberOfLines={1}>{news.topic || 'Tin tức'}</Text>
                <View style={styles.newsBylineRow}>
                  <Text style={styles.newsByline} numberOfLines={1}>{news.author || 'Trung tâm Thắng Tin Học'}</Text>
                  <Text style={styles.newsViews}>◉ {news.views}</Text>
                  <Text style={styles.newsByline}>{news.publishedAt}</Text>
                </View>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
      {!resource.loading && !resource.error && !visibleArticles.length ? <EmptyState title="Không có tin phù hợp" message="Thử từ khóa hoặc bộ lọc khác." /> : null}
    </AppScreen>
  );
}

export function NewsDetailScreen() {
  const route = useRoute<NativeStackScreenProps<AppStackParamList, 'NewsDetail'>['route']>();
  const { width } = useWindowDimensions();
  const loader = useCallback(() => feedService.newsDetail(route.params.newsId), [route.params.newsId]);
  const resource = useMockResource(loader);
  const news = resource.data;
  return (
    <AppScreen>
      <AppHeader title="Chi tiết tin tức" subtitle={news?.topic} />
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {news ? <Card>
        <Text style={styles.title}>{news.title}</Text>
        <Text style={styles.caption}>{news.author || '—'} · {news.publishedAt} · {news.views} lượt xem</Text>
        {news.excerpt ? <Text style={styles.muted}>{news.excerpt}</Text> : null}
        {news.contentHtml ? (
          <RenderHtml
            contentWidth={Math.max(1, width - spacing.lg * 2 - spacing.md * 2)}
            source={{ html: news.contentHtml, baseUrl: getMobileApiBaseUrl() }}
          />
        ) : <Text style={styles.body}>{news.content}</Text>}
        {news.attachments.map((file) => (
          <Pressable key={file.id} onPress={() => { void openExternalUrl(file.url, file.name); }} style={styles.newsAttachment} accessibilityRole="button" accessibilityLabel={`Mở tệp đính kèm ${file.name}`}>
            <Paperclip size={17} color={colors.brand} />
            <Text style={styles.newsAttachmentText}>{file.name} · {file.type}</Text><Text style={styles.newsAttachmentAction}>{file.url ? 'Mở' : '—'}</Text>
          </Pressable>
        ))}
      </Card> : null}
    </AppScreen>
  );
}

export function CenterInfoScreen() {
  const loader = useCallback(() => feedService.centerInfo(), []);
  const resource = useMockResource(loader);
  const center = resource.data;
  const centerSections = (center?.sections || [
    { title: 'Nhân sự', items: [] }, { title: 'Chi nhánh', items: [] }, { title: 'Mạng xã hội', items: [] },
    { title: 'Dịch vụ đào tạo', items: [] }, { title: 'Địa điểm thi', items: [] }, { title: 'Chứng chỉ', items: [] },
  ]).filter((item: { title: string }) => item.title !== 'Tổng quan');
  const [section, setSection] = useState('Tổng quan');
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false);
  const { width } = useWindowDimensions();
  const sectionOptions = [{ title: 'Tổng quan' }, ...centerSections];
  const selectedSection = centerSections.find((item) => item.title === section);
  const renderCenterItems = () => selectedSection?.items.length ? (
    <>
      {section === 'Chi nhánh' ? <Text style={styles.centerBranchCount}>Tổng số chi nhánh: {selectedSection.items.length}</Text> : null}
      {selectedSection.items.map((item) => (
        <Card key={item.id} style={styles.centerItemCard}>
          <View style={styles.centerItemHeader}>
            {item.imageUrl ? <Image source={getMobileImageSource(item.imageUrl)} style={styles.centerItemImage} resizeMode="cover" /> : item.icon ? <View style={styles.centerItemIconBox}><Text style={styles.centerItemIcon}>{item.icon}</Text></View> : null}
            <View style={styles.flex}>
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.subtitle ? <Text style={styles.muted}>{item.subtitle}</Text> : null}
              {item.code ? <Text style={styles.centerItemCode}>Mã: {item.code}</Text> : null}
            </View>
          </View>
          {item.description ? <Text style={styles.centerItemDescription}>{item.description}</Text> : null}
          {item.detailHtml ? <RenderHtml contentWidth={Math.max(1, width - spacing.lg * 2 - spacing.md * 2)} source={{ html: item.detailHtml, baseUrl: getMobileApiBaseUrl() }} /> : null}
          <View style={styles.centerItemMetadata}>
            {[
              item.department && `Bộ phận: ${item.department}`,
              item.expertise && `Chuyên môn: ${item.expertise}`,
              item.experience && `Kinh nghiệm: ${item.experience}`,
              item.address && `📍 ${item.address}${item.city ? `, ${item.city}` : ''}`,
              item.phone && `☎ ${item.phone}`,
              item.showEmail && item.email && `✉ ${item.email}`,
              item.managerName && `Phụ trách: ${item.managerName}`,
              item.hours && `Giờ: ${item.hours}`,
              item.duration && `Thời lượng: ${item.duration}`,
              item.learningMode && `Hình thức: ${item.learningMode}`,
              item.priceInfo && `Học phí: ${item.priceInfo}`,
              item.examType && `Loại kỳ thi: ${item.examType}`,
              item.capacity && `Sức chứa: ${item.capacity}`,
              item.issuer && `Đơn vị cấp: ${item.issuer}`,
              item.validity && `Thời hạn: ${item.validity}`,
            ].filter((text): text is string => Boolean(text)).map((text) => <Text key={text} style={styles.centerItemMetadataText}>{text}</Text>)}
          </View>
          <View style={styles.centerItemActions}>
            {item.url ? <Pressable onPress={() => { void openExternalUrl(item.url, item.title); }} style={styles.centerItemPrimaryAction} accessibilityRole="button"><Text style={styles.centerItemPrimaryActionText}>{section === 'Mạng xã hội' ? 'Mở trang' : 'Mở link'}</Text></Pressable> : null}
            {item.mapsUrl ? <Pressable onPress={() => { void openExternalUrl(item.mapsUrl, 'Bản đồ'); }} style={styles.centerItemSecondaryAction} accessibilityRole="button"><Text style={styles.centerItemSecondaryText}>Xem bản đồ</Text></Pressable> : null}
            {item.verifyUrl ? <Pressable onPress={() => { void openExternalUrl(item.verifyUrl, 'Xác minh chứng chỉ'); }} style={styles.centerItemSecondaryAction} accessibilityRole="button"><Text style={styles.centerItemSecondaryText}>Xác minh chứng chỉ</Text></Pressable> : null}
          </View>
        </Card>
      ))}
    </>
  ) : <Text style={styles.muted}>Chưa có mục nào trong phần này.</Text>;
  return (
    <AppScreen>
      <AppHeader title="Thông tin trung tâm" showBackButton={false} centered />
      <View style={[styles.centerPickerWrap, sectionPickerOpen && styles.centerPickerWrapOpen]}>
        <Pressable
          onPress={() => setSectionPickerOpen((open) => !open)}
          style={[styles.centerDropdown, sectionPickerOpen && styles.centerDropdownOpen]}
          accessibilityRole="button"
          accessibilityLabel={`Mục đang chọn: ${section}`}
          accessibilityState={{ expanded: sectionPickerOpen }}
        >
          <Text style={styles.centerDropdownText}>{section}</Text>
          <ChevronDown size={16} color={colors.muted} />
        </Pressable>
        {sectionPickerOpen ? (
          <View style={styles.centerDropdownMenu}>
            {sectionOptions.map((option) => (
              <Pressable
                key={option.title}
                onPress={() => {
                  setSection(option.title);
                  setSectionPickerOpen(false);
                }}
                style={[styles.centerDropdownOption, section === option.title && styles.centerDropdownOptionSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: section === option.title }}
              >
                <Text style={[styles.centerDropdownOptionText, section === option.title && styles.centerDropdownOptionTextSelected]}>{option.title}</Text>
                {section === option.title ? <Check size={14} color="#FFFFFF" /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState message={resource.errorMessage} onRetry={resource.reload} /> : null}
      {center && !center.published ? <EmptyState title="Chưa có nội dung tổng quan đã xuất bản." message="Thông tin trung tâm sẽ hiển thị sau khi được công bố." /> : null}
      {center?.published ? (
        <>
          {center.bannerUrl ? <Image source={getMobileImageSource(center.bannerUrl)} style={styles.centerBannerImage} resizeMode="cover" /> : null}
          <View style={styles.centerOverview}>
            <View style={styles.centerOverviewHeader}>
              {center.logoUrl ? <Image source={getMobileImageSource(center.logoUrl)} style={styles.centerLogoImage} resizeMode="contain" /> : null}
              <View style={styles.flex}>
                <Text style={styles.title}>{center.name}</Text>
                {center.foundedYear ? <Text style={styles.centerFounded}>Thành lập {center.foundedYear}</Text> : null}
              </View>
            </View>
            {center.intro ? <Text style={styles.body}>{center.intro}</Text> : null}
          </View>
          {section === 'Tổng quan' ? (
            <>
              {[
                ['Sứ mệnh', center.mission],
                ['Tầm nhìn', center.vision],
                ['Giá trị cốt lõi', center.coreValues],
              ].filter(([, value]) => value).map(([label, value]) => (
                <Card key={label}>
                  <Text style={styles.centerPillarTitle}>{label}</Text>
                  <Text style={styles.body}>{value}</Text>
                </Card>
              ))}
              {center.headquartersAddress || center.contactPhone || center.contactEmail || center.website ? (
                <Card style={styles.centerContactCard}>
                  <Text style={styles.centerContactHeading}>Liên hệ</Text>
                  {center.headquartersAddress ? <Text style={styles.centerContactText}>📍 {center.headquartersAddress}</Text> : null}
                  {center.contactPhone ? <Pressable onPress={() => { void openExternalUrl(`tel:${center.contactPhone}`, 'Số điện thoại'); }} accessibilityRole="button"><Text style={styles.link}>☎ {center.contactPhone}</Text></Pressable> : null}
                  {center.contactEmail ? <Pressable onPress={() => { void openExternalUrl(`mailto:${center.contactEmail}`, 'Email'); }} accessibilityRole="button"><Text style={styles.link}>✉ {center.contactEmail}</Text></Pressable> : null}
                  {center.website ? <Pressable onPress={() => { void openExternalUrl(center.website, 'Website'); }} accessibilityRole="button"><Text style={styles.link}>↗ {center.website}</Text></Pressable> : null}
                </Card>
              ) : null}
              {center.detailHtml ? (
                <Card>
                  <RenderHtml contentWidth={Math.max(1, width - spacing.lg * 2 - spacing.md * 2)} source={{ html: center.detailHtml, baseUrl: getMobileApiBaseUrl() }} />
                </Card>
              ) : null}
              {center.galleryUrls.length ? (
                <View style={styles.centerGallery}>
                  {center.galleryUrls.map((url) => <Image key={url} source={getMobileImageSource(url)} style={styles.centerGalleryImage} resizeMode="cover" />)}
                </View>
              ) : null}
              {center.introVideoUrl ? (
                Platform.OS === 'web'
                  ? <Pressable onPress={() => { void openExternalUrl(center.introVideoUrl, 'Video giới thiệu'); }} style={styles.centerVideoButton} accessibilityRole="button"><Text style={styles.link}>Xem video giới thiệu</Text></Pressable>
                  : <View style={styles.centerVideoFrame}><WebView source={{ uri: center.introVideoUrl }} allowsFullscreenVideo style={styles.centerWebVideo} /></View>
              ) : null}
            </>
          ) : (
            <View style={styles.centerSectionContent}>
              {renderCenterItems()}
            </View>
          )}
        </>
      ) : null}
    </AppScreen>
  );
}

export function SoftwareLinksScreen() {
  const { user } = useAuth();
  const loader = useCallback(() => softwareService.list(user), [user]);
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
          <Pressable onPress={() => { void openExternalUrl(item.url, item.name); }} style={styles.newsAttachment} accessibilityRole="button" accessibilityLabel={item.url ? `Mở phần mềm ${item.name}` : `Liên kết phần mềm ${item.name} chưa có`}>
            <Text style={styles.newsAttachmentText}>{item.url ? 'Mở phần mềm' : 'Liên kết chưa có'}</Text><Text style={styles.newsAttachmentAction}>{item.url ? 'Mở' : '—'}</Text>
          </Pressable>
        </Card>
      ))}
      {!resource.loading && !resource.error && !resource.data?.length ? <EmptyState title="Chưa có phần mềm" message="Phần mềm sẽ hiển thị theo khóa học." /> : null}
    </AppScreen>
  );
}

export function TeacherQuizzesScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Navigation>();
  const loader = useCallback(() => quizService.list(user), [user]);
  const resource = useMockResource(loader);
  const studentsLoader = useCallback(() => studentService.assigned(user), [user]);
  const studentsResource = useMockResource(studentsLoader);
  const [quizzes, setQuizzes] = useState<DemoQuiz[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [questionExcelBusy, setQuestionExcelBusy] = useState(false);
  const [title, setTitle] = useState('');
  const [titlePromptError, setTitlePromptError] = useState(false);
  const [courseName, setCourseName] = useState('');
  const [targetAll, setTargetAll] = useState(true);
  const [targetStudentIds, setTargetStudentIds] = useState<string[]>([]);
  const [targetSearch, setTargetSearch] = useState('');
  const [timeLimit, setTimeLimit] = useState('20');
  const [startTime, setStartTime] = useState('');
  const [deadline, setDeadline] = useState('');
  const [aiQuestionCount, setAiQuestionCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState('trung bình');
  const [aiTopic, setAiTopic] = useState('');
  const [quizToolsMessage, setQuizToolsMessage] = useState('');
  const [questions, setQuestions] = useState<Array<{ text: string; options: string[]; correctOption: number; explanation: string }>>([
    { text: '', options: ['', '', '', ''], correctOption: 0, explanation: '' },
  ]);
  const isPreview = Boolean(user?.previewMode)
    || (__DEV__ && Boolean(process.env.EXPO_PUBLIC_MOBILE_UI_QA_STATE));
  const loadedItems = quizzes || resource.data || [];
  const students = studentsResource.data || [];
  const courses = [...new Set(students.flatMap((student) => student.courses?.length ? student.courses : [student.course]).filter(Boolean))];
  const items = loadedItems.map((quiz) => {
    const assignedStudents = quiz.targetStudentIds?.length
      ? students.filter((student) => quiz.targetStudentIds?.includes(student.id))
      : students.filter((student) => student.course === quiz.courseName || student.courses?.includes(quiz.courseName));
    return {
      ...quiz,
      studentCount: quiz.studentCount ?? assignedStudents.length,
      assignedStudentNames: quiz.assignedStudentNames?.length
        ? quiz.assignedStudentNames
        : quiz.targetStudentIds?.length ? assignedStudents.map((student) => student.name) : undefined,
    };
  });
  const courseStudents = students.filter((student) => !courseName || student.course === courseName || student.courses?.includes(courseName));
  const visibleTargetStudents = courseStudents.filter((student) => `${student.name} ${student.course}`.toLowerCase().includes(targetSearch.trim().toLowerCase()));
  useFocusEffect(useCallback(() => {
    resource.reload();
  }, [resource.reload]));
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.QUIZ_SUBMITTED, () => {
      resource.reload();
    });
    const changeSubscription = DeviceEventEmitter.addListener(SOCKET_EVENTS.QUIZ_CHANGED, () => {
      setQuizzes(null);
      resource.reload();
    });
    return () => {
      subscription.remove();
      changeSubscription.remove();
    };
  }, [resource.reload]);
  useEffect(() => {
    if (!courseName && courses.length) setCourseName(courses[0]);
  }, [courseName, courses]);
  const updateQuestion = (questionIndex: number, update: (question: typeof questions[number]) => typeof questions[number]) => {
    setQuestions((current) => current.map((question, index) => index === questionIndex ? update(question) : question));
  };
  const resetCreateForm = () => {
    setTitle('');
    setTitlePromptError(false);
    setTargetAll(true);
    setTargetStudentIds([]);
    setTargetSearch('');
    setTimeLimit('20');
    setStartTime('');
    setDeadline('');
    setAiQuestionCount(10);
    setAiTopic('');
    setQuizToolsMessage('');
    setQuestions([{ text: '', options: ['', '', '', ''], correctOption: 0, explanation: '' }]);
  };
  const handleGenerateQuestions = async () => {
    if (!user || user.role !== 'teacher') {
      Alert.alert('Không thể tạo câu hỏi', 'Tài khoản giảng viên không hợp lệ.');
      return;
    }
    if (isPreview) {
      Alert.alert('Chế độ xem trước', 'Tạo câu hỏi AI chỉ dùng được với tài khoản giảng viên thật.');
      return;
    }
    const prompt = title.trim();
    if (!prompt) {
      setTitlePromptError(true);
      Alert.alert('Thiếu prompt', 'Nhập tên bài kiểm tra trước khi tạo bằng AI.');
      return;
    }
    const topic = [prompt, aiTopic.trim()].filter(Boolean).join('\n');
    setGeneratingQuestions(true);
    setQuizToolsMessage('');
    try {
      const generated = await quizService.generateAI(user, {
        topic,
        courseName,
        count: aiQuestionCount,
        difficulty: aiDifficulty,
      });
      if (generated.source === 'fallback') {
        setQuizToolsMessage(generated.message || 'AI chưa sẵn sàng; vui lòng kiểm tra và thử lại trên website.');
        return;
      }
      setQuestions(generated.questions.map((question) => ({
        text: question.questionText,
        options: question.options,
        correctOption: question.correctAnswer,
        explanation: question.explanation,
      })));
      setQuizToolsMessage(generated.message || `Đã tạo ${generated.questions.length} câu. Hãy kiểm tra trước khi giao bài.`);
    } catch (error) {
      Alert.alert('Không tạo được câu hỏi', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setGeneratingQuestions(false);
    }
  };
  const handleImportQuestionExcel = async () => {
    setQuestionExcelBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const content = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const parsed = await parseTeacherQuizQuestionsExcel(content);
      if (!parsed.questions.length) {
        throw new Error(parsed.errors[0] || 'Không có câu trắc nghiệm hợp lệ trong tệp.');
      }
      setQuestions(parsed.questions.map((question) => ({
        text: question.questionText,
        options: question.options,
        correctOption: question.correctAnswer,
        explanation: question.explanation,
      })));
      Alert.alert(
        'Đã nhập câu hỏi',
        `Đã thêm ${parsed.questions.length} câu${parsed.errors.length ? `. Bỏ qua ${parsed.errors.length} dòng không hợp lệ.` : '.'}`,
      );
    } catch (error) {
      Alert.alert('Không thể nhập Excel', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setQuestionExcelBusy(false);
    }
  };
  const handleDownloadQuestionTemplate = async () => {
    setQuestionExcelBusy(true);
    try {
      const base64 = await createTeacherQuizQuestionWorkbook([], courseName || 'Khóa học', true);
      await shareQuizWorkbook(base64, 'Mau_ngan_hang_cau_hoi_trac_nghiem.xlsx');
    } catch (error) {
      Alert.alert('Không thể tải mẫu Excel', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setQuestionExcelBusy(false);
    }
  };
  const handleExportQuestionExcel = async () => {
    if (!questions.length) {
      Alert.alert('Chưa có câu hỏi', 'Thêm hoặc nhập câu hỏi trước khi xuất Excel.');
      return;
    }
    setQuestionExcelBusy(true);
    try {
      const rows = questions.map((question) => ({
        questionText: question.text.trim(),
        options: question.options.map((option) => option.trim()),
        correctAnswer: question.correctOption,
        explanation: question.explanation.trim(),
      }));
      const base64 = await createTeacherQuizQuestionWorkbook(rows, courseName || 'Khóa học');
      const safeCourse = (courseName || 'Quiz').replace(/[^\w-]+/g, '_').slice(0, 30);
      await shareQuizWorkbook(base64, `Cau_hoi_trac_nghiem_${safeCourse}.xlsx`);
    } catch (error) {
      Alert.alert('Không thể xuất Excel', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setQuestionExcelBusy(false);
    }
  };
  const handleCreateQuiz = async () => {
    const value = title.trim();
    if (!value) {
      setTitlePromptError(true);
      Alert.alert('Thiếu tên bài', 'Nhập tên bài trắc nghiệm trước khi tạo.');
      return;
    }
    const validQuestions = questions.filter((question) => (
      question.text.trim() && question.options.every((option) => option.trim())
    ));
    if (!validQuestions.length || validQuestions.length !== questions.length) {
      Alert.alert('Thiếu nội dung', 'Nhập nội dung và đủ bốn phương án cho từng câu hỏi.');
      return;
    }
    if (courses.length && !courseName) {
      Alert.alert('Chưa chọn khóa học', 'Chọn khóa học trước khi tạo bài trắc nghiệm.');
      return;
    }
    const limit = Number(timeLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 180) {
      Alert.alert('Thời gian chưa hợp lệ', 'Nhập thời gian làm bài từ 1 đến 180 phút.');
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
      Alert.alert('Lịch bài không hợp lệ', 'Thời gian phải đúng định dạng YYYY-MM-DD HH:mm, nằm trong tương lai và hạn kết thúc sau giờ bắt đầu.');
      return;
    }
    if (!targetAll && !targetStudentIds.length) {
      Alert.alert('Chưa chọn học viên', 'Chọn ít nhất một học viên hoặc giao cho cả lớp.');
      return;
    }
    if (!isPreview && (!user || user.role !== 'teacher')) {
      Alert.alert('Không thể tạo bài', 'Tài khoản giảng viên không hợp lệ.');
      return;
    }
    const assignedStudents = targetAll
      ? courseStudents
      : courseStudents.filter((student) => targetStudentIds.includes(student.id));
    if (isPreview) {
      const localQuiz: DemoQuiz = {
        id: `quiz-${Date.now()}`,
        title: value,
        courseName: courseName || '—',
        timeLimitMinutes: limit,
        startTime: startTime.trim() || undefined,
        deadline: deadline.trim() || 'Không giới hạn',
        questions: validQuestions.length,
        studentCount: assignedStudents.length || undefined,
        targetStudentIds: targetAll ? [] : targetStudentIds,
        assignedStudentNames: assignedStudents.map((student) => student.name),
        submissions: [],
        sampleQuestions: validQuestions.map((question) => ({
          text: question.text.trim(),
          options: question.options.map((option) => option.trim()),
          correctOption: question.correctOption,
        })),
      };
      setQuizzes([localQuiz, ...items]);
      resetCreateForm();
      setShowCreate(false);
      return;
    }

    setSavingQuiz(true);
    try {
      const teacher = user;
      if (!teacher || teacher.role !== 'teacher') {
        Alert.alert('Không thể tạo bài', 'Tài khoản giảng viên không hợp lệ.');
        return;
      }
      const isoDate = (value: string) => value.trim()
        ? new Date(value.trim().replace(' ', 'T')).toISOString()
        : null;
      await quizService.create(teacher, {
        title: value,
        courseName,
        targetStudentIds: targetAll ? [] : targetStudentIds,
        timeLimitMinutes: limit,
        startTime: isoDate(startTime),
        deadline: isoDate(deadline),
        questions: validQuestions.map((question) => ({
          questionText: question.text.trim(),
          options: question.options.map((option) => option.trim()),
          correctAnswer: question.correctOption,
          explanation: question.explanation.trim(),
        })),
      });
      setQuizzes(null);
      resource.reload();
      resetCreateForm();
      setShowCreate(false);
      Alert.alert('Đã tạo bài trắc nghiệm', 'Bài đã được lưu và học viên được giao sẽ nhận thông báo.');
    } catch (error) {
      Alert.alert('Không thể tạo bài trắc nghiệm', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setSavingQuiz(false);
    }
  };
  const handleDeleteQuiz = (quiz: DemoQuiz) => {
    Alert.alert('Xóa bài trắc nghiệm?', `Bài "${quiz.title}" sẽ bị xóa khỏi danh sách.`, [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          if (isPreview) {
            setQuizzes(items.filter((item) => item.id !== quiz.id));
            return;
          }
          if (!user || user.role !== 'teacher') {
            Alert.alert('Không thể xóa bài', 'Tài khoản giảng viên không hợp lệ.');
            return;
          }
          void quizService.remove(user, quiz.id)
            .then(() => {
              setQuizzes(null);
              resource.reload();
            })
            .catch((error: unknown) => {
              Alert.alert('Không thể xóa bài trắc nghiệm', error instanceof Error ? error.message : 'Vui lòng thử lại.');
            });
        },
      },
    ]);
  };
  const handleRecreateQuiz = (quiz: DemoQuiz) => {
    setTitle(`${quiz.title} (Bản sao)`);
    setCourseName(quiz.courseName === 'Chưa chọn khóa học' ? '' : quiz.courseName);
    setTargetStudentIds(quiz.targetStudentIds || []);
    setTargetAll(!quiz.targetStudentIds?.length);
    setTimeLimit(String(quiz.timeLimitMinutes));
    const toInputDate = (value?: string) => {
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const pad = (part: number) => String(part).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    setStartTime(toInputDate(quiz.startTime));
    setDeadline(toInputDate(quiz.deadline));
    setQuestions((quiz.sampleQuestions || []).map((question) => ({
      text: question.text,
      options: [...question.options],
      correctOption: question.correctOption,
      explanation: '',
    })).concat(quiz.sampleQuestions?.length ? [] : [{ text: '', options: ['', '', '', ''], correctOption: 0, explanation: '' }]));
    setShowCreate(true);
  };
  return (
    <AppScreen>
      <AppHeader
        title="Giao bài tập & kiểm tra"
        subtitle="Quản lý trắc nghiệm mỗi buổi học"
        centered
        showBackButton={false}
      />
      <View style={styles.assessmentTabs} accessibilityRole="tablist">
        <View style={[styles.assessmentTab, styles.assessmentTabActive]} accessible accessibilityRole="tab" accessibilityState={{ selected: true }}>
          <Text style={[styles.assessmentTabText, styles.assessmentTabTextActive]}>Trắc nghiệm</Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Assignments')} style={styles.assessmentTab} accessibilityRole="tab" accessibilityState={{ selected: false }}>
          <Text style={styles.assessmentTabText}>Bài tập về nhà</Text>
        </Pressable>
      </View>
      <View style={styles.quizCreateRow}>
        <Pressable
          onPress={() => setShowCreate(!showCreate)}
          style={styles.quizCreateAction}
          accessibilityRole="button"
          accessibilityLabel={showCreate ? 'Đóng biểu mẫu tạo bài' : 'Tạo bài trắc nghiệm'}
          accessibilityState={{ expanded: showCreate }}
        >
          {showCreate ? <X size={18} color={colors.brand} /> : <Plus size={19} color={colors.brand} />}
          <Text style={styles.quizCreateActionText}>{showCreate ? 'Đóng' : 'Tạo bài'}</Text>
        </Pressable>
      </View>
      {showCreate ? (
        <Card style={styles.quizCreateCard}>
          <View>
            <TextInput
              value={title}
              onChangeText={(value) => {
                setTitle(value);
                if (value.trim()) setTitlePromptError(false);
              }}
              placeholder="Tên bài trắc nghiệm"
              style={[styles.input, styles.quizTitleInput, titlePromptError && { borderColor: colors.red }]}
              accessibilityLabel="Tên bài kiểm tra, cũng là prompt AI"
              accessibilityHint={titlePromptError ? 'Bắt buộc nhập trước khi tạo câu hỏi bằng AI.' : undefined}
            />
            {titlePromptError ? (
              <Text style={{ color: colors.red, fontSize: typography.caption, fontWeight: '700', marginTop: spacing.xs }}>
                Bắt buộc nhập prompt trước khi tạo bằng AI.
              </Text>
            ) : null}
          </View>
          <Text style={styles.fieldLabel}>Khóa học</Text>
          {studentsResource.loading ? <LoadingSkeleton rows={1} /> : null}
          {studentsResource.error ? <ErrorState onRetry={studentsResource.reload} /> : null}
          <View style={styles.chips}>
            {courses.map((course) => <Pressable key={course} onPress={() => { setCourseName(course); setTargetStudentIds([]); }} style={[styles.choice, courseName === course && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: courseName === course }}><Text style={[styles.choiceText, courseName === course && styles.choiceTextActive]}>{course}</Text></Pressable>)}
          </View>
          {!courses.length && !studentsResource.loading ? <Text style={styles.note}>Chưa có khóa học được phân công để giao trắc nghiệm.</Text> : null}
          <Text style={styles.fieldLabel}>Đối tượng</Text>
          <View style={styles.chips}>
            <Pressable onPress={() => setTargetAll(true)} style={[styles.choice, targetAll && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: targetAll }}><Text style={[styles.choiceText, targetAll && styles.choiceTextActive]}>Cả lớp ({courseStudents.length || '—'})</Text></Pressable>
            <Pressable onPress={() => setTargetAll(false)} style={[styles.choice, !targetAll && styles.choiceActive]} accessibilityRole="button" accessibilityState={{ selected: !targetAll }}><Text style={[styles.choiceText, !targetAll && styles.choiceTextActive]}>Chọn học viên</Text></Pressable>
          </View>
          {!targetAll ? (
            <View style={styles.studentTargetList}>
              <TextInput value={targetSearch} onChangeText={setTargetSearch} placeholder="Tìm học viên" style={[styles.input, styles.quizCompactInput]} accessibilityLabel="Tìm học viên để giao trắc nghiệm" />
              <View style={styles.quizActions}>
                <Pressable onPress={() => setTargetStudentIds((current) => [...new Set([...current, ...visibleTargetStudents.map((student) => student.id)])])} style={styles.quizAction} accessibilityRole="button"><Text style={styles.quizActionText}>Chọn tất cả đang hiển thị</Text></Pressable>
                <Pressable onPress={() => setTargetStudentIds([])} style={styles.quizAction} accessibilityRole="button"><Text style={styles.quizActionText}>Bỏ chọn</Text></Pressable>
              </View>
              {visibleTargetStudents.map((student) => {
                const selected = targetStudentIds.includes(student.id);
                return <Pressable key={student.id} onPress={() => setTargetStudentIds((current) => selected ? current.filter((id) => id !== student.id) : [...current, student.id])} style={[styles.studentTarget, selected && styles.studentTargetSelected]} accessibilityRole="checkbox" accessibilityState={{ checked: selected }}><Text style={styles.studentTargetText}>{selected ? '✓  ' : ''}{student.name} · {student.course}</Text></Pressable>;
              })}
              {!visibleTargetStudents.length ? <Text style={styles.note}>{courseStudents.length ? 'Không tìm thấy học viên phù hợp.' : 'Khóa học này chưa có học viên được phân công.'}</Text> : null}
            </View>
          ) : null}
          <View style={styles.quizScheduleFields}>
            <Text style={styles.fieldLabel}>Lịch làm bài</Text>
            <TextInput value={timeLimit} onChangeText={setTimeLimit} keyboardType="number-pad" placeholder="Thời lượng (phút)" style={[styles.input, styles.quizCompactInput]} />
            <TextInput value={startTime} onChangeText={setStartTime} placeholder="Bắt đầu · YYYY-MM-DD HH:mm" style={[styles.input, styles.quizCompactInput]} />
            <TextInput value={deadline} onChangeText={setDeadline} placeholder="Kết thúc · YYYY-MM-DD HH:mm" style={[styles.input, styles.quizCompactInput]} />
          </View>
          <View style={styles.quizTools}>
            <Text style={styles.fieldLabel}>Ngân hàng câu hỏi</Text>
            <View style={styles.quizActions}>
              <Pressable onPress={() => { void handleImportQuestionExcel(); }} style={styles.quizAction} accessibilityRole="button" disabled={questionExcelBusy}>
                <Text style={styles.quizActionText}>{questionExcelBusy ? 'Đang xử lý…' : 'Nhập Excel'}</Text>
              </Pressable>
              <Pressable onPress={() => { void handleDownloadQuestionTemplate(); }} style={styles.quizAction} accessibilityRole="button" disabled={questionExcelBusy}>
                <Text style={styles.quizActionText}>Tải mẫu</Text>
              </Pressable>
              <Pressable onPress={() => { void handleExportQuestionExcel(); }} style={styles.quizAction} accessibilityRole="button" disabled={questionExcelBusy}>
                <Text style={styles.quizActionText}>Xuất Excel</Text>
              </Pressable>
              <Text style={styles.note}>Câu hỏi Excel sẽ được thêm vào bài và lưu lên hệ thống khi bạn tạo bài trắc nghiệm.</Text>
            </View>
            <TextInput value={aiTopic} onChangeText={setAiTopic} placeholder="Chủ đề câu hỏi AI (tùy chọn)" style={[styles.input, styles.quizCompactInput]} />
            <Text style={styles.fieldLabel}>Số câu AI</Text>
            <View style={styles.radioChoices} accessibilityRole="radiogroup">
              {[5, 10, 15].map((count) => {
                const selected = aiQuestionCount === count;
                return (
                  <Pressable key={count} onPress={() => setAiQuestionCount(count)} style={styles.radioChoice} accessibilityRole="radio" accessibilityState={{ selected }}>
                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={styles.radioChoiceText}>{count} câu</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.fieldLabel}>Độ khó</Text>
            <View style={styles.radioChoices} accessibilityRole="radiogroup">
              {['dễ', 'trung bình', 'khó'].map((difficulty) => {
                const selected = aiDifficulty === difficulty;
                return (
                  <Pressable key={difficulty} onPress={() => setAiDifficulty(difficulty)} style={styles.radioChoice} accessibilityRole="radio" accessibilityState={{ selected }}>
                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={styles.radioChoiceText}>{difficulty}</Text>
                  </Pressable>
                );
              })}
            </View>
            <PrimaryButton title={generatingQuestions ? 'Đang tạo câu hỏi…' : 'Tạo câu hỏi bằng AI (Gemini)'} variant="secondary" loading={generatingQuestions} disabled={generatingQuestions} onPress={() => { void handleGenerateQuestions(); }} />
            {quizToolsMessage ? <Text style={styles.note}>{quizToolsMessage}</Text> : null}
          </View>
          <SectionHeading title={`Câu hỏi (${questions.length})`} action="Thêm câu" onPress={() => setQuestions((current) => [...current, { text: '', options: ['', '', '', ''], correctOption: 0, explanation: '' }])} />
          {questions.map((question, questionIndex) => (
            <View key={`question-${questionIndex}`} style={styles.questionEditor}>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>Câu {questionIndex + 1}</Text>
                {questions.length > 1 ? <Pressable onPress={() => setQuestions((current) => current.filter((_, index) => index !== questionIndex))} style={styles.questionRemove} accessibilityRole="button" accessibilityLabel={`Xóa câu hỏi ${questionIndex + 1}`}><Text style={styles.quizDeleteText}>Xóa câu</Text></Pressable> : null}
              </View>
              <TextInput value={question.text} onChangeText={(text) => updateQuestion(questionIndex, (current) => ({ ...current, text }))} placeholder="Nội dung câu hỏi" style={[styles.input, styles.textArea, styles.quizQuestionText]} />
              {question.options.map((option, optionIndex) => (
                <View key={`option-${questionIndex}-${optionIndex}`} style={styles.optionRow}>
                  <Pressable onPress={() => updateQuestion(questionIndex, (current) => ({ ...current, correctOption: optionIndex }))} accessibilityRole="radio" accessibilityLabel={`Đánh dấu phương án ${String.fromCharCode(65 + optionIndex)} câu ${questionIndex + 1} là đáp án đúng`} accessibilityState={{ selected: question.correctOption === optionIndex }}>
                    <Text style={[styles.optionToggle, question.correctOption === optionIndex && styles.optionToggleActive]}>{question.correctOption === optionIndex ? '✓' : String.fromCharCode(65 + optionIndex)}</Text>
                  </Pressable>
                  <TextInput value={option} onChangeText={(value) => updateQuestion(questionIndex, (current) => ({ ...current, options: current.options.map((item, index) => index === optionIndex ? value : item) }))} placeholder={`Phương án ${String.fromCharCode(65 + optionIndex)}`} style={[styles.input, styles.quizCompactInput, styles.flex]} />
                </View>
              ))}
              <TextInput value={question.explanation} onChangeText={(explanation) => updateQuestion(questionIndex, (current) => ({ ...current, explanation }))} placeholder="Giải thích đáp án (nếu có)" multiline style={[styles.input, styles.textArea, styles.quizQuestionText]} />
            </View>
          ))}
          {isPreview ? <Text style={styles.note}>Bản xem trước: bài tạo chỉ lưu cục bộ, không gửi cho học viên.</Text> : null}
          <PrimaryButton
            title={savingQuiz ? 'Đang tạo bài…' : isPreview ? 'Thêm vào danh sách xem trước' : 'Tạo bài trắc nghiệm'}
            loading={savingQuiz}
            disabled={savingQuiz}
            onPress={() => { void handleCreateQuiz(); }}
          />
        </Card>
      ) : null}
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {items.map((quiz) => (
        <QuizCard
          key={quiz.id}
          quiz={quiz}
          onDelete={() => handleDeleteQuiz(quiz)}
          onRecreate={() => handleRecreateQuiz(quiz)}
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
      {showResults ? quiz.submissions.map((submission, index) => (
        <View key={`${quiz.id}-${submission.studentName}-${index}`} style={styles.gradeHistoryRow}>
          <View style={styles.rowCopy}>
            <Text style={styles.cardTitle}>{submission.studentName}</Text>
            <Text style={styles.metaText}>
              {submission.submittedAt ? `${submission.submittedAt} · ` : ''}
              {submission.forfeit ? `Thoát giữa giờ${submission.exitReason ? ` · ${submission.exitReason}` : ''}` : `${submission.correctCount ?? '—'}/${submission.totalQuestions ?? quiz.questions} câu đúng`}
            </Text>
          </View>
          <View style={styles.gradeResult}>
            <Text style={styles.gradeScore}>{submission.score}%</Text>
            <StatusBadge label={submission.forfeit ? 'Chưa đạt' : submission.status === 'passed' ? 'Đạt' : 'Chưa đạt'} />
          </View>
        </View>
      )) : null}
      <View style={styles.quizActions}>
        <Pressable onPress={onRecreate} style={styles.quizAction} accessibilityRole="button"><Text style={styles.quizActionText}>Tạo lại</Text></Pressable>
        <Pressable onPress={() => setShowResults((value) => !value)} style={styles.quizAction} accessibilityRole="button"><Text style={styles.quizActionText}>{showResults ? 'Ẩn kết quả' : 'Xem kết quả'}</Text></Pressable>
        <Pressable onPress={onDelete} style={[styles.quizAction, styles.quizDelete]} accessibilityRole="button"><Text style={styles.quizDeleteText}>Xóa</Text></Pressable>
      </View>
    </Card>
  );
}

export function TeacherTrainingScreen() {
  const { user } = useAuth();
  const loader = useCallback(() => trainingService.list(user), [user]);
  const resource = useMockResource(loader);
  const softwareLoader = useCallback(() => softwareService.list(user), [user]);
  const software = useMockResource(softwareLoader);
  const courses = resource.data || [];
  const [expanded, setExpanded] = useState<string[]>([]);
  const [tab, setTab] = useState('Khóa học');
  const trainingTabs = [
    { label: 'Khóa học', count: courses.length, icon: Video, color: '#EF4056' },
    { label: 'Quy trình', count: courses.reduce((total, course) => total + course.lessons.length, 0), icon: FileText, color: '#3B82F6' },
    { label: 'Tài liệu', count: courses.reduce((total, course) => total + course.files.length, 0), icon: Download, color: '#F97316' },
    { label: 'Phần mềm', count: software.data?.length || 0, icon: Link2, color: '#14B8A6' },
  ];
  return (
    <AppScreen>
      <AppHeader title="Khóa đào tạo" subtitle="Nội dung học tập và tài liệu được giao" centered showBackButton={false} />
      <View style={styles.trainingTabs}>
        {trainingTabs.map(({ label, count, icon: Icon, color }) => (
          <Pressable key={label} onPress={() => setTab(label)} style={[styles.trainingTab, tab === label && styles.trainingTabActive]} accessibilityRole="button" accessibilityState={{ selected: tab === label }}>
            <View style={[styles.trainingTabIcon, { backgroundColor: color }]}>
              <Icon size={15} color="#FFFFFF" strokeWidth={2.5} />
            </View>
            <Text numberOfLines={1} style={[styles.trainingTabText, tab === label && styles.trainingTabTextActive]}>{label}</Text>
            <View style={[styles.trainingTabCount, tab === label && styles.trainingTabCountActive]}>
              <Text style={[styles.trainingTabCountText, tab === label && styles.trainingTabCountTextActive]}>{count}</Text>
            </View>
          </Pressable>
        ))}
      </View>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {tab === 'Phần mềm' ? (
        <>
          {software.loading ? <LoadingSkeleton /> : null}
          {software.error ? <ErrorState onRetry={software.reload} /> : null}
          {(software.data || []).map((item) => <Card key={item.id}>
            <Text style={styles.cardTitle}>{item.name}</Text><Text style={styles.metaText}>{item.category}</Text><Text style={styles.muted}>{item.description}</Text>
            <Pressable onPress={() => { void openExternalUrl(item.url, item.name); }} style={styles.newsAttachment} accessibilityRole="button" accessibilityLabel={item.url ? `Mở phần mềm ${item.name}` : `Liên kết phần mềm ${item.name} chưa có`}><Text style={styles.newsAttachmentText}>{item.url ? 'Mở phần mềm' : 'Liên kết chưa có'}</Text><Text style={styles.newsAttachmentAction}>{item.url ? 'Mở' : '—'}</Text></Pressable>
          </Card>)}
          {!software.loading && !software.error && !software.data?.length ? <EmptyState title="Chưa có phần mềm" message="Chưa có dữ liệu phần mềm trong bản demo." /> : null}
        </>
      ) : tab === 'Tài liệu' ? (
        courses.flatMap((course) => course.files.map((file, index) => {
          const resourceFile = course.fileLinks?.[index];
          return <Card key={`${course.id}-${file}`} style={styles.unitRow}>
            <BookOpen size={18} color={colors.brand} /><View style={styles.flex}><Text style={styles.cardTitle}>{file}</Text><Text style={styles.metaText}>{course.title}</Text></View>
            <Pressable onPress={() => { void openExternalUrl(resourceFile?.url, file); }} style={styles.feedInlineAction} accessibilityRole="button" accessibilityLabel={`Mở tài liệu ${file}`}><Text style={styles.feedInlineActionText}>Mở</Text></Pressable>
          </Card>;
        }))
      ) : (
        courses.map((course) => <TrainingCard
          key={course.id}
          course={course}
          user={user}
          expanded={expanded.includes(course.id)}
          tab={tab}
          onLessonCompleted={resource.reload}
          onToggle={() => setExpanded(expanded.includes(course.id) ? expanded.filter((id) => id !== course.id) : [...expanded, course.id])}
        />)
      )}
      {!resource.loading && !resource.error && !courses.length && tab !== 'Phần mềm' ? <EmptyState title="Chưa có khóa đào tạo" message="Nội dung sẽ xuất hiện khi được giao." /> : null}
    </AppScreen>
  );
}

function embeddedTrainingVideoUrl(url: string) {
  const youtubeId = url.match(/(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/)?.[1];
  if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&playsinline=1&rel=0`;
  const vimeoId = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)?.[1];
  return vimeoId ? `https://player.vimeo.com/video/${vimeoId}?autoplay=1` : '';
}

function isSupportedTrainingVideo(url: string) {
  return Boolean(embeddedTrainingVideoUrl(url) || /\.(mp4|webm|ogg)(?:$|[?#])/i.test(url));
}

function trainingDurationSeconds(duration: string) {
  const parts = duration.split(':').map(Number);
  if (!parts.length || parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  const numeric = Number(duration);
  return Number.isFinite(numeric) ? numeric : 0;
}

function TrainingCard({
  course,
  user,
  expanded,
  tab,
  onToggle,
  onLessonCompleted,
}: {
  course: DemoTrainingCourse;
  user: DemoUser | null | undefined;
  expanded: boolean;
  tab: string;
  onToggle: () => void;
  onLessonCompleted: () => void;
}) {
  const [activeLesson, setActiveLesson] = useState<DemoTrainingCourse['lessons'][number] | null>(null);
  return (
    <Card style={styles.trainingCard}>
      <View style={styles.trainingBanner}><GraduationCap size={22} color="#FFFFFF" /><Text style={styles.trainingBannerText}>Đào tạo giảng viên</Text></View>
      <Text style={styles.cardTitle}>{course.title}</Text>
      <View style={styles.rowBetween}><Text style={styles.metaText}>Tiến độ khóa học</Text><Text style={styles.cardTitle}>{course.progress}%</Text></View>
      <ProgressBar value={course.progress} />
      <Text style={styles.caption}>{course.lessons.length} bài học</Text>
      <Text style={styles.note}>Tiến độ được đồng bộ với máy chủ. Video hỗ trợ sẽ ghi nhận thời gian xem để cập nhật khi hoàn thành.</Text>
      <PrimaryButton title={expanded ? 'Thu gọn' : 'Vào học'} onPress={onToggle} variant="secondary" />
      {expanded ? (
        <>
          {tab !== 'Tài liệu' ? (
            <>
              <SectionHeading title="Quy trình" />
              {course.lessons.map((lesson) => (
                <Pressable key={lesson.id} onPress={() => {
                  if (lesson.url && isSupportedTrainingVideo(lesson.url)) setActiveLesson(lesson);
                  else void openExternalUrl(lesson.url, lesson.title);
                }} style={styles.trainingLesson} accessibilityRole="button" accessibilityLabel={`${lesson.completed ? 'Đã hoàn thành' : 'Phát'} bài học ${lesson.title}`}>
                  <Text style={styles.muted}>{lesson.completed ? '✓' : '○'} {lesson.title} · {lesson.duration}</Text>
                  <Text style={styles.newsAttachmentAction}>{lesson.completed ? 'Phát lại' : lesson.url ? 'Xem & ghi nhận' : 'Chưa có liên kết'}</Text>
                </Pressable>
              ))}
            </>
          ) : null}
          {tab !== 'Quy trình' ? (
            <>
              <SectionHeading title="Tài liệu" />
              {course.files.map((file, index) => <Pressable key={file} onPress={() => { void openExternalUrl(course.fileLinks?.[index]?.url, file); }} style={styles.newsAttachment} accessibilityRole="button"><Text style={styles.newsAttachmentText}>{file}</Text><Text style={styles.newsAttachmentAction}>Mở</Text></Pressable>)}
            </>
          ) : null}
          {course.notices.map((notice) => <Text key={notice} style={styles.note}>{notice}</Text>)}
        </>
      ) : null}
      {activeLesson && user ? (
        <TeacherTrainingPlayer
          user={user}
          courseId={course.id}
          lesson={activeLesson}
          onClose={() => setActiveLesson(null)}
          onCompleted={() => {
            setActiveLesson(null);
            onLessonCompleted();
          }}
        />
      ) : null}
    </Card>
  );
}

function TeacherTrainingPlayer({
  user,
  courseId,
  lesson,
  onClose,
  onCompleted,
}: {
  user: DemoUser;
  courseId: string;
  lesson: DemoTrainingCourse['lessons'][number];
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [progress, setProgress] = useState<VideoPlayerProgress>({
    currentTime: 0,
    duration: 0,
    watchedSeconds: lesson.watchedSeconds || 0,
    completed: lesson.completed,
    playing: false,
  });
  const [saveError, setSaveError] = useState('');
  const latestProgress = useRef(progress);
  const lastSavedWatchedSeconds = useRef(lesson.watchedSeconds || 0);
  const playerApiRef = useRef<VideoPlayerApi | null>(null);
  const url = resolveMobilePublicUrl(lesson.url || '');
  const embeddedUrl = embeddedTrainingVideoUrl(url);
  const saveProgress = useCallback(async (next: VideoPlayerProgress) => {
    if (!user || next.watchedSeconds <= lastSavedWatchedSeconds.current) return;
    await saveTeacherTrainingWatchProgress(user, {
      courseId,
      lessonId: lesson.id,
      watchedSeconds: next.watchedSeconds,
      videoDuration: next.duration || trainingDurationSeconds(lesson.duration),
    });
    lastSavedWatchedSeconds.current = next.watchedSeconds;
  }, [courseId, lesson.duration, lesson.id, user]);
  const onProgress = useCallback((next: VideoPlayerProgress) => {
    latestProgress.current = next;
    setProgress(next);
    if (next.playing && next.watchedSeconds - lastSavedWatchedSeconds.current >= 10) {
      void saveProgress(next).then(() => setSaveError('')).catch((error: unknown) => {
        setSaveError(error instanceof Error ? error.message : 'Không thể lưu tiến độ xem.');
      });
    }
  }, [saveProgress]);
  const onWatched = useCallback(async () => {
    const current = latestProgress.current;
    try {
      await saveProgress(current);
      await completeTeacherTrainingLesson(user, {
        courseId,
        lessonId: lesson.id,
        watchedSeconds: current.watchedSeconds,
        videoDuration: current.duration || trainingDurationSeconds(lesson.duration),
      });
      onCompleted();
      return true;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Không thể cập nhật tiến độ bài học.');
      return false;
    }
  }, [courseId, lesson.duration, lesson.id, onCompleted, saveProgress, user]);
  const isDirectVideo = /\.(mp4|webm|ogg)(?:$|[?#])/i.test(url);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.trainingPlayerBackdrop}>
        <View style={styles.trainingPlayer}>
          <View style={styles.trainingPlayerHeader}>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.cardTitle}>{lesson.title}</Text>
              <Text style={styles.metaText}>{progress.completed ? 'Đã hoàn thành' : `${Math.floor(progress.watchedSeconds)} giây đã xem`}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.trainingPlayerClose} accessibilityRole="button" accessibilityLabel="Đóng video">
              <X size={21} color={colors.ink} />
            </Pressable>
          </View>
          <View style={styles.trainingPlayerFrame}>
            <VideoPlayerFrame
              videoUrl={url}
              embeddedUrl={embeddedUrl}
              title={lesson.title}
              lessonId={`teacher-${user.id}-${lesson.id}`}
              antiSeekEnabled={lesson.antiSeek === true}
              done={progress.completed}
              playerApiRef={playerApiRef}
              onProgress={onProgress}
              onWatched={onWatched}
            />
          </View>
          {saveError ? <Text style={styles.trainingPlayerError}>{saveError}</Text> : null}
          {!embeddedUrl && !isDirectVideo ? <Text style={styles.note}>Định dạng này không hỗ trợ phát và ghi nhận tiến độ trong ứng dụng.</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

export function TuitionScreen() {
  const { user } = useAuth();
  const profileLoader = useCallback(() => studentProfileService.get(user), [user]);
  const paymentLoader = useCallback(() => studentPaymentService.get(user), [user]);
  const profileResource = useMockResource(profileLoader);
  const paymentResource = useMockResource(paymentLoader);
  const enrollments = profileResource.data?.enrollments || [];
  const paymentStatus = paymentResource.data;
  return (
    <AppScreen>
      <AppHeader title="Học phí theo khóa" subtitle="Thông tin học phí trên hồ sơ học viên" showBackButton={false} centered />
      {profileResource.data?.qaFixture ? <Text style={styles.note}>QA fixture — dữ liệu minh họa, không phải dữ liệu tài khoản thật.</Text> : null}
      {profileResource.loading ? <LoadingSkeleton /> : null}
      {profileResource.error ? <ErrorState onRetry={profileResource.reload} /> : null}
      {paymentResource.loading ? <LoadingSkeleton /> : null}
      {paymentResource.error ? <ErrorState onRetry={paymentResource.reload} /> : null}
      {paymentStatus ? (
        <Card>
          <Text style={styles.cardTitle}>Trạng thái thanh toán tổng thể</Text>
          <View style={styles.tuitionAmountRow}>
            <Text style={styles.metaText}>Học phí toàn tài khoản</Text>
            <StatusBadge label={paymentStatus.paid ? 'Đã thanh toán' : 'Chưa thanh toán'} />
          </View>
          <View style={styles.tuitionAmountRow}>
            <Text style={styles.metaText}>Số tiền đã thanh toán</Text>
            <Text style={styles.infoValue}>{formatCurrency(paymentStatus.paidAmount)}</Text>
          </View>
          {paymentStatus.paidAt ? (
            <View style={styles.tuitionAmountRow}>
              <Text style={styles.metaText}>Ngày ghi nhận</Text>
              <Text style={styles.infoValue}>{formatPaymentDate(paymentStatus.paidAt)}</Text>
            </View>
          ) : null}
          <Text style={styles.note}>Đây là trạng thái tổng thể của học viên, không phải số tiền phân bổ theo từng khóa.</Text>
        </Card>
      ) : null}
      {!profileResource.loading && !profileResource.error ? enrollments.map((enrollment) => {
        const amount = enrollment.tuitionAmount;
        const paidAmount = enrollment.paidAmount;
        const remaining = amount != null && paidAmount != null ? Math.max(amount - paidAmount, 0) : null;
        return <Card key={enrollment.id}>
          <Text style={styles.cardTitle}>{enrollment.courseName}</Text>
          <View style={styles.tuitionAmountRow}><Text style={styles.metaText}>Trạng thái khóa học</Text><StatusBadge label={enrollment.status} /></View>
          <View style={styles.tuitionAmountRow}><Text style={styles.metaText}>Học phí</Text><Text style={styles.infoValue}>{amount != null ? formatCurrency(amount) : '—'}</Text></View>
          <View style={styles.tuitionAmountRow}><Text style={styles.metaText}>Đã thanh toán</Text><Text style={styles.infoValue}>{paidAmount != null ? formatCurrency(paidAmount) : '—'}</Text></View>
          <View style={styles.tuitionAmountRow}><Text style={styles.metaText}>Còn lại</Text><Text style={styles.infoValue}>{remaining != null ? formatCurrency(remaining) : '—'}</Text></View>
        </Card>
      }) : null}
      {!profileResource.loading && !profileResource.error && !enrollments.length ? <EmptyState title="Chưa có khóa học" message="Thông tin học phí sẽ xuất hiện theo khóa học." /> : null}
      <Text style={styles.note}>Để thanh toán hoặc xác nhận giao dịch, vui lòng thực hiện trên website.</Text>
    </AppScreen>
  );
}

function formatCurrency(value: number) {
  return `${new Intl.NumberFormat('vi-VN').format(value)} đ`;
}

function formatPaymentDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  privacyMenuAnchor: { position: 'relative', zIndex: 30, alignItems: 'flex-end' },
  privacyButton: { maxWidth: 190, minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#86EFAC', borderRadius: radius.md, backgroundColor: '#ECFDF5' },
  privacyText: { flexShrink: 1, color: '#047857', fontSize: typography.micro, fontWeight: '700' },
  privacyMenu: { position: 'absolute', top: 42, right: 0, zIndex: 40, width: 252, maxWidth: 286, gap: 3, padding: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 8 },
  privacyMenuTitle: { color: colors.muted, fontSize: 9, fontWeight: '800', letterSpacing: 0.45, paddingHorizontal: spacing.xs, paddingVertical: 5 },
  privacyOption: { minHeight: 48, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.xs, paddingVertical: 7, borderRadius: radius.sm },
  privacyOptionSelected: { backgroundColor: '#EEF2FF' },
  privacyOptionCopy: { flex: 1, minWidth: 0 },
  privacyOptionTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  privacyOptionTitle: { flexShrink: 1, color: colors.ink, fontSize: typography.micro, fontWeight: '700' },
  privacyOptionDescription: { color: colors.muted, fontSize: 9, lineHeight: 13, marginTop: 2 },
  feedDraft: { minHeight: 92, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, color: colors.ink },
  feedImagePreviewList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  feedImagePreview: { position: 'relative', width: 76, height: 76, overflow: 'hidden', borderRadius: radius.sm, backgroundColor: colors.canvas },
  feedImagePreviewImage: { width: '100%', height: '100%' },
  feedImageRemove: { position: 'absolute', top: 3, right: 3, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: 'rgba(15, 23, 42, 0.75)' },
  feedImageRemoveText: { color: '#FFFFFF', fontSize: typography.body, lineHeight: 22, fontWeight: '800' },
  feedComposerActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  feedImageAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm },
  feedAuthorRow: { position: 'relative', zIndex: 10, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  feedPostImages: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  feedPostImageFrame: { width: '48%', aspectRatio: 1.35, overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.canvas },
  feedPostImageSingle: { width: '100%', aspectRatio: 1.6 },
  feedPostImage: { width: '100%', height: '100%' },
  feedPostMenuAnchor: { position: 'relative', zIndex: 20, alignItems: 'flex-end' },
  feedPostMenuButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  feedPostMenu: { position: 'absolute', top: 38, right: 0, zIndex: 30, width: 174, padding: 4, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 8 },
  feedPostMenuItem: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  feedPostMenuText: { color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  feedPostMenuDelete: { color: colors.red },
  feedInlineAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.xs },
  feedInlineActionText: { color: colors.brand, fontSize: typography.caption, fontWeight: '700' },
  feedDeleteText: { color: colors.red, fontSize: typography.caption, fontWeight: '700' },
  feedEditBox: { gap: spacing.xs },
  feedActionBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  feedReactionActionWrap: { position: 'relative', flex: 1, minWidth: 0 },
  feedReactionPicker: { position: 'absolute', zIndex: 5, bottom: 42, left: 0, flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: spacing.xs, paddingVertical: 4, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, backgroundColor: colors.surface, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 5 },
  feedReactionOption: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  feedReactionEmoji: { fontSize: 20 },
  feedActionButton: { minWidth: 0, minHeight: 36, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs, borderRadius: radius.md, backgroundColor: 'transparent' },
  feedActionButtonActive: { backgroundColor: '#EEF2FF' },
  feedActionButtonText: { flexShrink: 1, color: colors.muted, fontSize: 10, fontWeight: '700', textAlign: 'center' },
  feedActionCount: { color: colors.muted, fontSize: 10, fontWeight: '600' },
  feedCommentsSection: { gap: spacing.md, marginTop: spacing.sm, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  feedCommentThread: { gap: 0 },
  feedCommentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  feedCommentContent: { flex: 1, minWidth: 0 },
  feedCommentHeader: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  feedCommentTitleLine: { minHeight: 24, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  feedCommentDot: { color: colors.muted, fontSize: typography.micro },
  feedCommentAuthor: { flexShrink: 1, color: colors.ink, fontSize: typography.micro, fontWeight: '800' },
  feedCommentRole: { overflow: 'hidden', color: colors.brand, fontSize: 9, fontWeight: '700' },
  feedCommentTime: { color: colors.muted, fontSize: 9 },
  feedCommentDelete: { padding: 3 },
  feedCommentText: { color: colors.ink, fontSize: typography.caption, lineHeight: 18 },
  feedCommentActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 },
  feedReplyAction: { minHeight: 22, justifyContent: 'center', paddingHorizontal: 2 },
  feedCommentActionText: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  feedReplyBranch: { gap: spacing.xs, marginLeft: 15, marginTop: spacing.xs, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: '#DDE2E8' },
  feedReplyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  feedReplyContent: { flex: 1, minWidth: 0 },
  feedExpandReplies: { minHeight: 28, justifyContent: 'center', paddingLeft: 2 },
  feedExpandRepliesText: { color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  feedReplyingTo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  feedReplyingText: { color: colors.muted, fontSize: typography.micro, fontWeight: '600' },
  feedReplyCancel: { color: colors.muted, fontSize: typography.title, lineHeight: 24, paddingHorizontal: spacing.xs },
  newsAttachment: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.canvas },
  newsAttachmentText: { flex: 1, minWidth: 0, color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  newsAttachmentAction: { color: colors.brand, fontSize: typography.caption, fontWeight: '800' },
  infoValue: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  tuitionAmountRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  modalCard: { gap: spacing.md, padding: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.surface },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  feedAudience: { alignSelf: 'flex-start', color: colors.muted, fontSize: typography.caption, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.canvas },
  newsScreen: { gap: spacing.md },
  newsSearch: { flex: 1, minWidth: 0, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, paddingRight: 4, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.surface },
  newsSearchInput: { flex: 1, minWidth: 0, minHeight: 42, paddingVertical: 0, color: colors.ink, fontSize: typography.small },
  newsSearchClear: { color: colors.muted, fontSize: typography.title, lineHeight: 26, paddingHorizontal: spacing.xs },
  newsSearchButton: { minWidth: 40, height: 36, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  newsSearchButtonText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800' },
  newsToolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  newsFilters: { position: 'relative', zIndex: 30, elevation: 20, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  newsLayoutButton: { width: 40, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
  newsControlWrap: { position: 'relative', zIndex: 1, elevation: 1, flex: 1, minWidth: 88 },
  newsControlWrapOpen: { zIndex: 50, elevation: 30 },
  newsControl: { minWidth: 0, minHeight: 38, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface },
  newsControlOpen: { borderColor: colors.brand },
  newsControlText: { flexShrink: 1, color: colors.ink, fontSize: 10, fontWeight: '600' },
  newsDropdown: { position: 'absolute', top: 42, left: 0, minWidth: 170, zIndex: 60, padding: 3, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: colors.surface, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 32 },
  newsDropdownAlignRight: { left: undefined, right: 0 },
  newsDropdownOption: { minHeight: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: 4 },
  newsDropdownOptionSelected: { backgroundColor: colors.brand },
  newsDropdownOptionText: { flex: 1, color: colors.ink, fontSize: typography.caption, fontWeight: '500' },
  newsDropdownOptionTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  newsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  newsGridItem: { width: '48%' },
  newsCard: { padding: spacing.md, gap: spacing.md },
  newsGridCard: { height: '100%', padding: 0, gap: 0, overflow: 'hidden' },
  newsListCard: { flexDirection: 'row', alignItems: 'stretch', padding: 0, overflow: 'hidden' },
  newsThumbnail: { position: 'relative', aspectRatio: 1.65, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brandSoft },
  newsThumbnailList: { width: 112, aspectRatio: 1, alignSelf: 'stretch' },
  newsThumbnailImage: { position: 'absolute', width: '100%', height: '100%' },
  newsAudienceBadge: { position: 'absolute', top: spacing.xs, right: spacing.xs, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: 'rgba(15, 23, 42, 0.78)' },
  newsAudienceBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  newsNewBadge: { position: 'absolute', top: spacing.xs, left: spacing.xs, paddingHorizontal: 6, paddingVertical: 3, borderRadius: radius.sm, backgroundColor: colors.brand },
  newsNewBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  newsCardContent: { flex: 1, gap: spacing.xs, padding: spacing.sm },
  newsMeta: { color: colors.brand, fontSize: typography.caption, fontWeight: '700' },
  newsTitle: { color: colors.ink, fontSize: typography.body, lineHeight: 22, fontWeight: '800' },
  newsExcerpt: { color: colors.muted, fontSize: typography.small, lineHeight: 20 },
  newsByline: { flex: 1, minWidth: 0, color: colors.muted, fontSize: typography.caption, lineHeight: 17 },
  newsBylineRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 'auto', paddingTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  newsViews: { color: colors.muted, fontSize: 11 },
  centerPickerWrap: { position: 'relative', zIndex: 1, elevation: 1, marginBottom: spacing.sm },
  centerPickerWrapOpen: { zIndex: 50, elevation: 30 },
  centerDropdown: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, backgroundColor: '#FFFFFF' },
  centerDropdownOpen: { borderColor: colors.brand },
  centerDropdownText: { color: colors.ink, fontSize: typography.small, fontWeight: '700' },
  centerDropdownMenu: { position: 'absolute', top: 48, left: 0, right: 0, zIndex: 60, padding: 3, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 8, elevation: 32 },
  centerDropdownOption: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.sm, borderRadius: 4 },
  centerDropdownOptionSelected: { backgroundColor: '#1D65D1' },
  centerDropdownOptionText: { color: colors.ink, fontSize: typography.caption, fontWeight: '500' },
  centerDropdownOptionTextSelected: { color: '#FFFFFF', fontWeight: '700' },
  centerBannerImage: { width: '100%', aspectRatio: 2.3, borderRadius: radius.md, backgroundColor: colors.canvas },
  centerOverview: { gap: spacing.md },
  centerOverviewHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  centerFounded: { color: colors.muted, fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginTop: spacing.sm },
  centerLogoImage: { width: 80, height: 80, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFFFFF' },
  centerPillarTitle: { color: colors.brand, fontSize: 11, fontWeight: '900', letterSpacing: 0.6, marginBottom: spacing.xs },
  centerContactCard: { gap: spacing.xs },
  centerContactHeading: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.6 },
  centerContactText: { color: colors.ink, fontSize: typography.small, lineHeight: 20 },
  centerGallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  centerGalleryImage: { width: '48%', aspectRatio: 16 / 9, borderRadius: radius.md, backgroundColor: colors.canvas },
  centerVideoButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  centerVideoFrame: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#000000' },
  centerWebVideo: { flex: 1, backgroundColor: '#000000' },
  centerItemCard: { gap: spacing.md, marginBottom: spacing.sm },
  centerItemHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  centerItemImage: { width: 64, height: 64, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas },
  centerItemIconBox: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.canvas },
  centerItemIcon: { fontSize: 22 },
  centerItemCode: { color: '#0369A1', fontSize: 11, fontWeight: '800', marginTop: 2 },
  centerItemDescription: { color: colors.muted, fontSize: typography.small, lineHeight: 20 },
  centerItemMetadata: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs },
  centerItemMetadataText: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  centerItemActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingTop: spacing.xs },
  centerItemPrimaryAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.brand },
  centerItemPrimaryActionText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  centerItemSecondaryAction: { minHeight: 36, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  centerItemSecondaryText: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  centerBranchCount: { color: colors.ink, fontSize: typography.small, fontWeight: '700', marginBottom: spacing.sm },
  centerSectionContent: { gap: spacing.xs },
  assessmentTabs: { flexDirection: 'row', marginBottom: spacing.xs, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  assessmentTab: { flex: 1, minWidth: 0, minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.sm, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  assessmentTabActive: { borderBottomColor: colors.brand },
  assessmentTabText: { color: colors.muted, fontSize: typography.caption, fontWeight: '700', textAlign: 'center' },
  assessmentTabTextActive: { color: colors.brand, fontWeight: '800' },
  quizCreateRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: -spacing.sm },
  quizCreateAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, borderRadius: radius.md, backgroundColor: colors.redSoft },
  quizCreateActionText: { color: colors.brand, fontSize: typography.caption, fontWeight: '800' },
  quizCreateCard: { gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  quizTitleInput: { minHeight: 44, borderColor: '#DCE3EB', backgroundColor: '#FBFCFE', fontWeight: '700' },
  quizCompactInput: { minHeight: 42, paddingVertical: spacing.xs, borderColor: '#DCE3EB', backgroundColor: '#FFFFFF' },
  quizScheduleFields: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.canvas },
  quizMetricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  quizMetric: { width: '47%', minHeight: 58, justifyContent: 'center', padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.canvas },
  gradeHistoryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  gradeResult: { alignItems: 'flex-end', gap: spacing.xs },
  gradeScore: { color: colors.brandDark, fontSize: typography.body, fontWeight: '800' },
  quizActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  quizTools: { gap: spacing.xs, marginTop: spacing.xs, padding: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.canvas },
  quizAction: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  quizActionText: { color: colors.brand, fontSize: typography.caption, fontWeight: '700' },
  quizDelete: { borderColor: colors.redSoft, backgroundColor: colors.redSoft },
  quizDeleteText: { color: colors.red, fontSize: typography.caption, fontWeight: '700' },
  trainingTabs: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing.xs, paddingBottom: spacing.md, marginBottom: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  trainingTab: { flex: 1, minWidth: 0, minHeight: 63, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 2, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.line, borderRadius: 13, backgroundColor: colors.surface },
  trainingTabActive: { borderColor: '#FF4D5A', backgroundColor: '#FFF3F3', shadowColor: '#EF4056', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 2 },
  trainingTabIcon: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 7 },
  trainingTabText: { maxWidth: '100%', color: colors.ink, fontSize: typography.micro, fontWeight: '700' },
  trainingTabTextActive: { color: colors.ink },
  trainingTabCount: { position: 'absolute', top: 3, right: 3, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderRadius: radius.pill, backgroundColor: '#EEF2F7' },
  trainingTabCountActive: { backgroundColor: '#E11D2E' },
  trainingTabCountText: { color: '#64748B', fontSize: typography.micro, lineHeight: 16, fontWeight: '800' },
  trainingTabCountTextActive: { color: '#FFFFFF' },
  trainingCard: { overflow: 'hidden' },
  trainingBanner: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: -spacing.lg, marginHorizontal: -spacing.lg, marginBottom: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.brandDark },
  trainingLesson: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  trainingBannerText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '800', letterSpacing: 0.5 },
  trainingPlayerBackdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: 'rgba(15, 23, 42, 0.82)' },
  trainingPlayer: { gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surface },
  trainingPlayerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  trainingPlayerClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.canvas },
  trainingPlayerFrame: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', borderRadius: radius.md, backgroundColor: '#080D19' },
  trainingPlayerError: { color: colors.red, fontSize: typography.caption, fontWeight: '700' },
  menuScreen: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm },
  menuHeader: { minHeight: 66, paddingHorizontal: spacing.xs, paddingVertical: spacing.sm, marginBottom: spacing.xs },
  menuList: { gap: spacing.sm },
  menuPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  menuRow: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 14, borderColor: '#E5EBF0', backgroundColor: colors.surface },
  menuIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: colors.brandSoft, alignItems: 'center', justifyContent: 'center' },
  menuCopy: { flex: 1, minWidth: 0, gap: 2 },
  menuItemTitle: { color: colors.ink, fontSize: typography.small, lineHeight: 18, fontWeight: '800' },
  menuItemDescription: { color: colors.muted, fontSize: typography.micro, lineHeight: 15, fontWeight: '500' },
  menuArrow: { width: 22, height: 30, alignItems: 'center', justifyContent: 'center' },
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
  commentComposer: { gap: spacing.xs, marginTop: spacing.xs, paddingTop: spacing.xs },
  commentComposerInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  commentInput: { flex: 1, minHeight: 42, paddingHorizontal: spacing.md, backgroundColor: '#F0F2F5', borderRadius: radius.pill, color: colors.ink, fontSize: typography.caption },
  form: { gap: spacing.md, marginTop: spacing.md },
  fieldLabel: { color: colors.ink, fontSize: typography.small, fontWeight: '700', marginBottom: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  radioChoices: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs },
  radioChoice: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: 2 },
  radioOuter: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.muted, borderRadius: radius.pill, backgroundColor: colors.surface },
  radioOuterSelected: { borderColor: colors.brand },
  radioInner: { width: 9, height: 9, borderRadius: radius.pill, backgroundColor: colors.brand },
  radioChoiceText: { color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  choice: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 7, paddingHorizontal: 10 },
  choiceActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  choiceText: { color: colors.ink, fontSize: typography.caption, fontWeight: '600' },
  choiceTextActive: { color: '#FFFFFF' },
  studentTargetList: { gap: spacing.xs, marginTop: spacing.sm },
  studentTarget: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  studentTargetSelected: { borderColor: colors.brand, backgroundColor: colors.brandSoft },
  studentTargetText: { color: colors.ink, fontSize: typography.small },
  questionEditor: { gap: spacing.xs, padding: spacing.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  questionRemove: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.sm },
  textArea: { minHeight: 76, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, color: colors.ink },
  quizQuestionText: { minHeight: 68, paddingVertical: spacing.sm, backgroundColor: '#FBFCFE' },
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
