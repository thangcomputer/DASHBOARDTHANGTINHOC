import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleHelp, Clapperboard, Clock3, Eye, FileText, Gamepad2, GraduationCap, Layers3, Lightbulb, Lock, Menu, MessageSquare, Play, RotateCcw, Sparkles, Star, StickyNote, Trophy, Volume2, VolumeX } from 'lucide-react-native';
import { createAudioPlayer, useAudioPlayer } from 'expo-audio';
import RenderHtml from '@native-html/render';
import type { MixedStyleDeclaration } from '@native-html/render';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';
import { dailyPracticeApi, type DpTopic } from '../services/dailyPracticeApi';
import { embeddedVideoUrl, isDirectVideoUrl, playableVideoUrl, vimeoIdFromUrl, youtubeIdFromUrl } from '../utils/videoSource';
import { VideoPlayerFrame, type VideoPlayerApi, type VideoPlayerProgress } from './VideoPlayerFrame';
import { VideoLessonTabs } from './VideoLessonTabs';
import { AppHeader, AppScreen, Card, EmptyState, ErrorState, LoadingSkeleton } from '../components/ui';
import { useAuth } from '../app/AuthContext';
import { useMockResource } from '../hooks/useMockResource';
import { getMobileApiBaseUrl, resolveMobilePublicUrl } from '../services/apiClient';
import { CoursePaymentModal, type CoursePaymentCheckout } from '../components/CoursePaymentModal';
import {
  checkoutCourse,
  getCourseSubjectUnits,
  getCourseVideoCatalog,
  confirmCoursePracticeItem,
  markCourseUnitSection,
  openCourseVideoUnit,
  resetCoursePractice,
  saveStudyResumePoint,
  type LessonPracticeCourse,
  type LessonPracticeItem,
  type LessonPracticeSubject,
  type LessonPracticeUnit,
} from '../services/courseVideoApi';
import { learningService } from '../services/mockService';
import { getMobileSoundEnabled, setMobileSoundEnabled, subscribeToMobileSoundPreference } from '../services/soundPreferences';
import { colors, radius, spacing, typography } from '../theme/tokens';

type CourseFilter = 'all' | 'registered' | 'video' | 'instructor' | 'guide';
type CourseSection = { id: string; title: string; courses: LessonPracticeCourse[] };

const lessonHtmlBaseStyle: MixedStyleDeclaration = { color: '#475569', fontSize: typography.body, lineHeight: 23 };
const lessonHtmlTags: Record<string, MixedStyleDeclaration> = {
  body: { margin: 0, color: '#475569', fontSize: typography.body, lineHeight: 23 },
  p: { marginTop: 0, marginBottom: 10 },
  h2: { marginTop: 8, marginBottom: 8, color: '#0F172A', fontSize: typography.subheading, fontWeight: '800' },
  h3: { marginTop: 8, marginBottom: 6, color: '#1E293B', fontSize: typography.heading, fontWeight: '800' },
  li: { marginBottom: 6 },
  a: { color: '#E11D48', textDecorationLine: 'underline' },
};
const practiceFireworkRays: Array<[number, string, number]> = [
  [0, '#0F766E', 16], [30, '#C4A35A', 22], [60, '#0F766E', 16], [90, '#C4A35A', 22],
  [120, '#0F766E', 16], [150, '#C4A35A', 22], [180, '#0F766E', 16], [210, '#C4A35A', 22],
  [240, '#0F766E', 16], [270, '#C4A35A', 22], [300, '#0F766E', 16], [330, '#C4A35A', 22],
];
const sectionFireworkParticles: Array<[number, number, string, number, number]> = [
  [-20, -14, '#EF4444', 0, -32], [-12, -22, '#F59E0B', -4, -38],
  [-3, -26, '#10B981', 0, -42], [7, -22, '#3B82F6', 5, -38],
  [17, -14, '#A855F7', 9, -32], [22, -3, '#EC4899', 12, -24],
  [18, 9, '#FACC15', 10, 24], [8, 16, '#06B6D4', 5, 34],
  [-4, 17, '#22C55E', 0, 36], [-16, 11, '#F97316', -6, 28],
  [-23, 1, '#8B5CF6', -12, 16], [-19, -8, '#14B8A6', -9, -20],
];
type PracticePraise = { text: string; audio: number; icon: string; detail: string };
const practicePraises: PracticePraise[] = [
  { text: 'Bạn là chuyên gia!', audio: require('../assets/audio/lesson-practice/praise-expert-male.mp3'), icon: '🧠', detail: 'Kiến thức của bạn ngày càng vững vàng!' },
  { text: 'Bậc thầy tin học!', audio: require('../assets/audio/lesson-practice/praise-computer-master-female.mp3'), icon: '👑', detail: 'Bạn đang làm chủ từng kỹ năng!' },
  { text: 'Chính xác!', audio: require('../assets/audio/lesson-practice/praise-correct-male.mp3'), icon: '🎯', detail: 'Bạn đã chọn đúng đáp án!' },
  { text: 'Chính xác!', audio: require('../assets/audio/lesson-practice/praise-correct-female.mp3'), icon: '🎯', detail: 'Bạn đã chọn đúng đáp án!' },
  { text: 'Hoàn hảo!', audio: require('../assets/audio/lesson-practice/praise-perfect-male.mp3'), icon: '✨', detail: 'Câu trả lời thật chuẩn xác!' },
  { text: 'Hoàn hảo!', audio: require('../assets/audio/lesson-practice/praise-perfect-female.mp3'), icon: '✨', detail: 'Câu trả lời thật chuẩn xác!' },
  { text: 'Như chuyên gia!', audio: require('../assets/audio/lesson-practice/praise-like-an-expert-female.mp3'), icon: '💡', detail: 'Bạn xử lý câu hỏi thật chuyên nghiệp!' },
  { text: 'Quá chuyên nghiệp!', audio: require('../assets/audio/lesson-practice/praise-professional-female.mp3'), icon: '🏆', detail: 'Kỹ năng của bạn đang tiến bộ rõ rệt!' },
  { text: 'Trên cả tuyệt vời!', audio: require('../assets/audio/lesson-practice/praise-beyond-wonderful-male.mp3'), icon: '🚀', detail: 'Bạn đang tiến xa hơn mỗi ngày!' },
  { text: 'Tuyệt vời!', audio: require('../assets/audio/lesson-practice/praise-wonderful-male.mp3'), icon: '🌟', detail: 'Tiếp tục phát huy nhé!' },
  { text: 'Tuyệt vời!', audio: require('../assets/audio/lesson-practice/praise-wonderful-female.mp3'), icon: '🌟', detail: 'Tiếp tục phát huy nhé!' },
];
const practiceEncouragements = [
  'Không sao đâu, cố lên nhé!',
  'Mỗi lần thử là thêm một điều bạn hiểu!',
  'Bạn đang tiến bộ từng ngày!',
  'Thử lại nhé, bạn sắp hiểu rồi!',
  'Kiên trì là sẽ làm được!',
  'Học từng bước, giỏi từng ngày!',
  'Cùng bình tĩnh, rồi mình thử tiếp nhé!',
  'Xem lại kiến thức rồi thử tiếp nào!',
  'Mỗi lần thử là một lần tiến bộ!',
  'Bạn làm được mà, cố lên!',
];
let practiceAudioContext: AudioContext | null = null;

function unlockPracticeFeedbackAudio() {
  if (Platform.OS !== 'web') return;
  try {
    practiceAudioContext ||= new AudioContext();
    if (practiceAudioContext.state === 'suspended') {
      void practiceAudioContext.resume().catch((error: unknown) => {
        console.warn('Không thể bật âm thanh luyện tập.', error);
      });
    }
  } catch (error) {
    console.warn('Không thể khởi tạo âm thanh luyện tập.', error);
  }
}

function playWebPracticeFeedbackSound(correct: boolean) {
  const context = practiceAudioContext;
  if (!context) return;
  const play = () => {
    const notes = correct
      ? [{ frequency: 523.25, delay: 0 }, { frequency: 659.25, delay: 0.13 }, { frequency: 783.99, delay: 0.26 }, { frequency: 1046.5, delay: 0.42 }]
      : [{ frequency: 196, delay: 0 }, { frequency: 130.81, delay: 0.18 }];
    notes.forEach(({ frequency, delay }) => {
      const start = context.currentTime + delay;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, start);
      if (!correct) oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.7, start + 0.16);
      gain.gain.setValueAtTime(correct ? 0.16 : 0.22, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + (correct ? 0.2 : 0.18));
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + (correct ? 0.22 : 0.2));
    });
  };
  if (context.state === 'suspended') {
    void context.resume().then(play).catch((error: unknown) => {
      console.warn('Không thể phát âm thanh phản hồi luyện tập.', error);
    });
  } else {
    play();
  }
}

function getPracticePraise(previousText: string) {
  const choices = practicePraises.filter((praise) => praise.text !== previousText);
  return choices[Math.floor(Math.random() * choices.length)] || practicePraises[0];
}

const filterOptions: { id: CourseFilter; label: string; displayLabel: string; icon: typeof Layers3 }[] = [
  { id: 'all', label: 'Tất cả', displayLabel: 'Tất cả', icon: Layers3 },
  { id: 'registered', label: 'Khóa đã đăng ký', displayLabel: 'Khóa đã\nđăng ký', icon: CheckCircle2 },
  { id: 'video', label: 'Tự học qua video', displayLabel: 'Tự học\nqua video', icon: Clapperboard },
  { id: 'instructor', label: 'Học cùng giảng viên', displayLabel: 'Học cùng\ngiảng viên', icon: GraduationCap },
  { id: 'guide', label: 'Hướng dẫn học', displayLabel: 'Hướng dẫn\nhọc', icon: CircleHelp },
];

function previewCatalog(): Promise<{ subjects: LessonPracticeSubject[]; courses: LessonPracticeCourse[] }> {
  return learningService.courses().then((courses) => ({
    subjects: [],
    courses: courses.map((course) => {
      const subjectNames = course.software.split(',').map((name) => name.trim()).filter(Boolean);
      return {
        id: course._id,
        name: course.title,
        description: course.description,
        thumbnail: '',
        price: course.price || 0,
        totalSessions: course.totalSessions || 0,
        offerType: subjectNames.length === 1 ? 'single' : 'bundle',
        subjects: subjectNames.map((name, index) => ({
          id: `${course._id}-subject-${index}`,
          name,
          opened: Boolean(course.enrolled),
          totalUnitCount: course.units.length,
          previewUnits: course.units.map((unit) => ({
            id: unit._id,
            title: unit.title,
            locked: false,
            status: unit.sections.every((lesson) => lesson.completed) ? 'completed' : 'open',
          })),
        })),
        lessonCount: course.units.reduce((count, unit) => count + unit.sections.length, 0),
        enrolled: Boolean(course.enrolled),
        deliveryMode: course.deliveryMode || 'video',
      };
    }),
  }));
}

const RELATED_STRIP_HEIGHT = 42;

function directSubject(course: LessonPracticeCourse) {
  if (!course.subjects.length || course.subjects.length >= 3) return undefined;
  if (!course.enrolled && course.deliveryMode === 'instructor') return undefined;
  if (!course.enrolled && course.offerType !== 'single') return undefined;
  return course.subjects.find((subject) => subject.opened && subject.id)
    || course.subjects.find((subject) => subject.id);
}

function courseProgress(course: LessonPracticeCourse) {
  const completed = course.subjects.reduce((sum, subject) => sum + (Number(subject.completedUnitCount) || 0), 0);
  const total = course.subjects.reduce((sum, subject) => sum + (Number(subject.totalUnitCount) || 0), 0);
  return total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
}

function buildSections(courses: LessonPracticeCourse[], filter: CourseFilter): CourseSection[] {
  const visible = courses.filter((course) => course.enrolled || !course.hiddenByEnrollment);
  const enrolled = visible.filter((course) => course.enrolled);
  const available = visible.filter((course) => !course.enrolled);
  const matching = (items: LessonPracticeCourse[], mode: 'video' | 'instructor') =>
    items.filter((course) => course.deliveryMode === mode);
  if (filter === 'registered') return [{ id: 'registered', title: 'Khóa đã đăng ký', courses: enrolled }];
  if (filter === 'video') return [
    { id: 'video-registered', title: 'Khóa tự học qua video · Đã đăng ký', courses: matching(enrolled, 'video') },
    { id: 'video-available', title: 'Khóa tự học qua video · Chưa đăng ký', courses: matching(available, 'video') },
  ];
  if (filter === 'instructor') return [
    { id: 'instructor-registered', title: 'Khóa học cùng giảng viên · Đã đăng ký', courses: matching(enrolled, 'instructor') },
    { id: 'instructor-available', title: 'Khóa học cùng giảng viên · Chưa đăng ký', courses: matching(available, 'instructor') },
  ];
  const groupedCourseIds = new Set<string>();
  const groupedBundles: LessonPracticeCourse[] = [];
  courses.filter((course) => !course.enrolled && course.offerType === 'bundle' && course.hiddenByEnrollment).forEach((bundle) => {
    const subjectIds = new Set(bundle.subjects.map((subject) => subject.id).filter(Boolean));
    if (!subjectIds.size || subjectIds.size !== bundle.subjects.length) return;
    const covered = enrolled.filter((course) =>
      course.offerType === 'single'
      && course.deliveryMode === bundle.deliveryMode
      && course.subjects.length === 1
      && subjectIds.has(course.subjects[0].id)
      && !groupedCourseIds.has(course.id));
    if (covered.length !== subjectIds.size || new Set(covered.map((course) => course.subjects[0].id)).size !== subjectIds.size) return;
    covered.forEach((course) => groupedCourseIds.add(course.id));
    groupedBundles.push({ ...bundle, enrolled: true, hiddenByEnrollment: false });
  });
  const visibleEnrolled = [...groupedBundles, ...enrolled.filter((course) => !groupedCourseIds.has(course.id))];
  return [
    { id: 'registered', title: 'Khóa đã đăng ký', courses: visibleEnrolled },
    { id: 'video', title: 'Khóa tự học qua video', courses: matching(available, 'video') },
    { id: 'instructor', title: 'Khóa học cùng với giảng viên', courses: matching(available, 'instructor') },
  ];
}

type UnitLearningSection =
  | { id: string; kind: 'note' | 'video'; itemId: string; title: string }
  | { id: string; kind: 'practice'; itemId: string; title: string };

function getUnitLearningSections(unit: LessonPracticeUnit): UnitLearningSection[] {
  const contents = unit.contents?.length
    ? unit.contents
    : unit.note ? [{ id: 'legacy-note', title: 'Nội dung 1', content: unit.note }] : [];
  const videos = unit.videos?.length
    ? unit.videos
    : unit.videoUrl ? [{ id: 'legacy-video', title: 'Video bài học', url: unit.videoUrl }] : [];
  const sections: UnitLearningSection[] = [];
  const add = (kind: UnitLearningSection['kind'], itemId: string, title: string) => {
    const id = `${kind}:${itemId}`;
    if (!sections.some((section) => section.id === id)) sections.push({ id, kind, itemId, title });
  };
  const addPractice = (id: string) => {
    const part = sections.filter((section) => section.kind === 'practice').length + 1;
    add('practice', id, `Luyện tập · Phần ${part}`);
  };
  (unit.contentOrder || []).forEach((entry) => {
    if (entry.startsWith('content:')) {
      const id = entry.slice('content:'.length);
      const content = contents.find((item) => item.id === id);
      if (content) add('note', id, content.title);
    } else if (entry.startsWith('video:')) {
      const id = entry.slice('video:'.length);
      const video = videos.find((item) => item.id === id);
      if (video) add('video', id, video.title);
    } else if (entry.startsWith('practice:')) {
      const id = entry.slice('practice:'.length);
      if ((unit.practiceGroupIds || []).includes(id) || id === unit.id) addPractice(id);
    } else if (entry.startsWith('quiz:') && unit.hasPractice) {
      addPractice(unit.id);
    }
  });
  contents.forEach((item, index) => add('note', item.id, item.title || `Nội dung ${index + 1}`));
  videos.forEach((item, index) => add('video', item.id, item.title || `Video ${index + 1}`));
  (unit.practiceGroupIds || []).forEach(addPractice);
  if (unit.hasPractice && !unit.practiceGroupIds?.length) addPractice(unit.id);
  return sections;
}

function isUnitSectionDone(unit: LessonPracticeUnit, section: UnitLearningSection) {
  if (section.kind === 'note') return unit.noteDoneIds?.includes(section.itemId) || (unit.noteDone && section.itemId === 'legacy-note');
  if (section.kind === 'video') return unit.videoDoneIds?.includes(section.itemId) || (unit.videoDone && section.itemId === 'legacy-video');
  return unit.practiceDoneGroupIds?.includes(section.itemId) || (unit.practiceDone && section.itemId === unit.id);
}

type PracticeAttemptStats = {
  key: string;
  streak: number;
  bestStreak: number;
  wrongAttempts: number;
  wrongIds: string[];
};

const emptyPracticeAttemptStats: PracticeAttemptStats = {
  key: '',
  streak: 0,
  bestStreak: 0,
  wrongAttempts: 0,
  wrongIds: [],
};

function practiceAnswerSummary(item: LessonPracticeItem) {
  const answer = item.answer || {};
  if (item.type === 'mcq') {
    const choiceId = typeof answer.choiceId === 'string' ? answer.choiceId : '';
    return item.options?.find((option) => option.id === choiceId)?.text || '';
  }
  if (item.type === 'multi') {
    const choiceIds = Array.isArray(answer.choiceIds) ? answer.choiceIds.filter((id): id is string => typeof id === 'string') : [];
    return item.options?.filter((option) => choiceIds.includes(option.id)).map((option) => option.text).join(', ') || '';
  }
  if (item.type === 'written') return typeof answer.text === 'string' ? answer.text : '';
  if (item.type === 'drag') {
    const order = Array.isArray(answer.order) ? answer.order.filter((id): id is string => typeof id === 'string') : [];
    return order.map((id) => item.options?.find((option) => option.id === id)?.text || '').filter(Boolean).join(' → ');
  }
  if (item.type === 'match') {
    const matches = Array.isArray(answer.matches) ? answer.matches : [];
    return matches.map((entry) => {
      if (!entry || typeof entry !== 'object') return '';
      const { leftId, rightId } = entry as { leftId?: unknown; rightId?: unknown };
      const left = item.lefts?.find((option) => option.id === leftId)?.text;
      const right = item.rights?.find((option) => option.id === rightId)?.text;
      return left && right ? `${left} → ${right}` : '';
    }).filter(Boolean).join(' · ');
  }
  if (item.type === 'hotspot' && typeof answer.x === 'number' && typeof answer.y === 'number') {
    return `Vị trí đã chọn (${Math.round(answer.x)}%, ${Math.round(answer.y)}%)`;
  }
  return '';
}

const COURSE_CONSULTATION_ZALO_PHONE = '0984623486';

export function CourseVideosScreen() {
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isPreview = Boolean(user?.previewMode);
  const loader = useCallback(
    () => isPreview ? previewCatalog() : getCourseVideoCatalog(),
    [isPreview],
  );
  const resource = useMockResource(loader);
  const [filter, setFilter] = useState<CourseFilter>('all');
  const [selectedCourse, setSelectedCourse] = useState<LessonPracticeCourse | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<LessonPracticeSubject | null>(null);
  const [units, setUnits] = useState<LessonPracticeUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<LessonPracticeUnit | null>(null);
  const [activeUnitDetails, setActiveUnitDetails] = useState<LessonPracticeUnit[]>([]);
  const [selectedLearningSectionId, setSelectedLearningSectionId] = useState<string | null>(null);
  const [openingUnit, setOpeningUnit] = useState(false);
  const [unitNavOpen, setUnitNavOpen] = useState(false);
  const [lessonDrawerMounted, setLessonDrawerMounted] = useState(false);
  const [lessonContentWidth, setLessonContentWidth] = useState(0);
  const lessonDrawerProgress = useRef(new Animated.Value(0)).current;
  const lessonDrawerWidth = Math.min(screenWidth * 0.82, 360);
  useEffect(() => {
    if (unitNavOpen) setLessonDrawerMounted(true);
    const animation = Animated.timing(lessonDrawerProgress, {
      toValue: unitNavOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => {
      if (finished && !unitNavOpen) setLessonDrawerMounted(false);
    });
    return () => animation.stop();
  }, [lessonDrawerProgress, unitNavOpen]);
  const courses = resource.data?.courses || [];
  const sections = useMemo(() => filter === 'guide' ? [] : buildSections(courses, filter), [courses, filter]);
  const counts = useMemo(() => {
    const visible = courses.filter((course) => course.enrolled || !course.hiddenByEnrollment);
    return {
      all: visible.length,
      registered: visible.filter((course) => course.enrolled).length,
      video: visible.filter((course) => course.deliveryMode === 'video').length,
      instructor: visible.filter((course) => course.deliveryMode === 'instructor').length,
    };
  }, [courses]);
  const [registeringCourseId, setRegisteringCourseId] = useState('');
  const [checkout, setCheckout] = useState<CoursePaymentCheckout | null>(null);

  const startCourseCheckout = async (course: LessonPracticeCourse) => {
    setRegisteringCourseId(course.id);
    try {
      const result = await checkoutCourse(course.id);
      if (result.owned || !result.sessionId) {
        resource.reload();
        Alert.alert('Đăng ký khóa học', 'Bạn đã sở hữu khóa học này.');
        return;
      }
      setCheckout({
        sessionId: result.sessionId,
        ref: result.ref || '',
        amount: result.amount,
        courseTitle: result.courseTitle || course.name,
      });
    } catch (error) {
      Alert.alert('Không tạo được thanh toán', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    } finally {
      setRegisteringCourseId('');
    }
  };

  const requestCourseRegistration = (course: LessonPracticeCourse) => {
    if (registeringCourseId) return;
    if (course.deliveryMode !== 'video') {
      const message = `[THẮNG TIN HỌC] Tôi muốn được tư vấn khóa học 1 kèm 1: ${course.name}`;
      void Linking.openURL(`https://zalo.me/${COURSE_CONSULTATION_ZALO_PHONE}?text=${encodeURIComponent(message)}`);
      return;
    }
    if (isPreview) {
      Alert.alert('Đăng ký khóa học', 'Chế độ xem thử không hỗ trợ thanh toán.');
      return;
    }
    Alert.alert(
      'Xác nhận đăng ký',
      `Đăng ký khóa "${course.name}" với giá ${Number(course.price || 0).toLocaleString('vi-VN')}đ?`,
      [
        { text: 'Hủy', style: 'cancel' },
        { text: 'Thanh toán', onPress: () => { void startCourseCheckout(course); } },
      ],
    );
  };

  const handleCoursePaid = () => {
    setCheckout(null);
    resource.reload();
    Alert.alert('Thanh toán thành công', 'Khóa học đã được mở.');
  };

  const openCourse = (course: LessonPracticeCourse) => {
    const subject = directSubject(course);
    if (subject) {
      void openSubject(course, subject);
      return;
    }
    setSelectedCourse(course);
    setSelectedSubject(null);
    setSelectedUnit(null);
    setActiveUnitDetails([]);
    setSelectedLearningSectionId(null);
    setUnitNavOpen(false);
    setUnits([]);
    setUnitsError('');
  };

  const openSubject = async (
    course: LessonPracticeCourse,
    subject: LessonPracticeSubject,
    resume?: { unitId: string; sectionId: string },
  ) => {
    setSelectedCourse(course);
    setSelectedSubject(subject);
    setSelectedUnit(null);
    setActiveUnitDetails([]);
    setSelectedLearningSectionId(null);
    setUnitNavOpen(false);
    setUnits([]);
    setUnitsError('');
    if (isPreview) return;
    setUnitsLoading(true);
    try {
      const subjectUnits = await getCourseSubjectUnits(subject.id, course.id);
      setUnits(subjectUnits);
      const availableUnits = subjectUnits.filter((unit) => !unit.locked && unit.status !== 'locked');
      const resumeUnit = resume ? availableUnits.find((unit) => unit.id === resume.unitId) : undefined;
      const currentUnit = resumeUnit
        || availableUnits.find((unit) => unit.status === 'in_progress')
        || availableUnits.find((unit) => unit.status === 'open')
        || [...availableUnits].reverse().find((unit) => unit.status === 'completed');
      if (!currentUnit) {
        setUnitNavOpen(true);
        return;
      }
      try {
        const detail = await openCourseVideoUnit(currentUnit.id);
        setActiveUnitDetails([{ ...currentUnit, ...detail }]);
        if (resumeUnit && resume?.sectionId) setSelectedLearningSectionId(resume.sectionId);
        setUnitNavOpen(false);
      } catch (error) {
        setUnitsError(error instanceof Error ? error.message : 'Không tải được nội dung bài học.');
        setUnitNavOpen(true);
      }
    } catch (error) {
      setUnitsError(error instanceof Error ? error.message : 'Không tải được danh sách bài học.');
    } finally {
      setUnitsLoading(false);
    }
  };

  const startUnit = async (unit: LessonPracticeUnit, learningSectionId: string | null = null) => {
    if (unit.locked) {
      Alert.alert('Bài học đang khóa', 'Hoàn thành buổi học trước để mở nội dung này.');
      return;
    }
    if (isPreview) {
      Alert.alert('Chế độ xem thử', 'Video bài học chỉ khả dụng khi đăng nhập bằng tài khoản học viên thật.');
      return;
    }
    setOpeningUnit(true);
    setSelectedUnit(null);
    setActiveUnitDetails([]);
    setSelectedLearningSectionId(learningSectionId);
    setUnitsError('');
    if (learningSectionId) setUnitNavOpen(false);
    try {
      const detail = await openCourseVideoUnit(unit.id);
      setSelectedUnit({ ...unit, ...detail });
      setUnitsError('');
    } catch (error) {
      setUnitsError(error instanceof Error ? error.message : 'Không tải được bài học.');
      setUnitNavOpen(true);
    } finally {
      setOpeningUnit(false);
    }
  };

  const refreshUnitDetail = async (unitId: string) => {
    if (!selectedSubject || !selectedCourse) return;
    const [detail, refreshedUnits] = await Promise.all([
      openCourseVideoUnit(unitId),
      getCourseSubjectUnits(selectedSubject.id, selectedCourse.id),
    ]);
    const progressUnit = refreshedUnits.find((unit) => unit.id === unitId);
    const updatedUnit = { ...progressUnit, ...detail };
    setSelectedUnit((current) => current?.id === unitId ? updatedUnit : current);
    setActiveUnitDetails((current) => current.some((unit) => unit.id === unitId)
      ? current.map((unit) => unit.id === unitId ? updatedUnit : unit)
      : current);
    setUnits(refreshedUnits.map((unit) => unit.id === unitId ? updatedUnit : unit));
  };

  const completeUnitSection = async (unitId: string, section: 'video' | 'note', itemId: string): Promise<boolean> => {
    try {
      await markCourseUnitSection(unitId, section, itemId);
      await refreshUnitDetail(unitId);
      setSelectedLearningSectionId(`${section}:${itemId}`);
      return true;
    } catch (error) {
      Alert.alert('Không lưu được tiến độ', error instanceof Error ? error.message : 'Vui lòng thử lại.');
      return false;
    }
  };

  const submitPracticeAnswer = async (
    unitId: string,
    itemId: string,
    practiceGroupId: string | undefined,
    answer: Record<string, unknown>,
  ): Promise<LessonPracticeItem | null> => {
    try {
      const result = await confirmCoursePracticeItem(itemId, answer);
      const confirmedItem = result.data?.item;
      setSelectedLearningSectionId(`practice:${practiceGroupId || confirmedItem?.practiceGroupId || unitId}`);
      if (result.data?.retry) return confirmedItem || null;
      if (!(confirmedItem?.correct === true && confirmedItem.confirmed === true)) {
        await refreshUnitDetail(unitId);
      }
      return confirmedItem || null;
    } catch (error) {
      Alert.alert('Không gửi được câu trả lời', error instanceof Error ? error.message : 'Vui lòng thử lại.');
      return null;
    }
  };

  const resetPracticeAttempt = async (unitId: string, practiceGroupId: string): Promise<boolean> => {
    try {
      await resetCoursePractice(unitId, practiceGroupId);
      await refreshUnitDetail(unitId);
      setSelectedLearningSectionId(`practice:${practiceGroupId || unitId}`);
      return true;
    } catch (error) {
      Alert.alert('Không thể làm lại bài', error instanceof Error ? error.message : 'Vui lòng thử lại.');
      return false;
    }
  };

  const openVideo = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Không mở được video', error instanceof Error ? error.message : 'Vui lòng thử lại.');
    }
  };

  const displayedUnit = selectedUnit || activeUnitDetails[0] || null;
  const displayedUnitSections = displayedUnit ? getUnitLearningSections(displayedUnit) : [];
  const allDisplayedSectionsDone = Boolean(displayedUnit
    && displayedUnitSections.length
    && displayedUnitSections.every((section) => isUnitSectionDone(displayedUnit, section)));
  const selectedSectionIndex = displayedUnitSections.findIndex((section) => section.id === selectedLearningSectionId);
  const firstIncompleteSectionIndex = displayedUnit
    ? displayedUnitSections.findIndex((section) => !isUnitSectionDone(displayedUnit, section))
    : -1;
  const displayedSectionIndex = selectedSectionIndex >= 0
    ? selectedSectionIndex
    : firstIncompleteSectionIndex >= 0
      ? firstIncompleteSectionIndex
      : displayedUnitSections.length - 1;
  const displayedUnitIndex = displayedUnit ? units.findIndex((unit) => unit.id === displayedUnit.id) : -1;

  const route = useRoute<RouteProp<MainTabsParamList, 'CourseVideos'>>();
  const tabNavigation = useNavigation();
  const resumeParams = route.params;
  const handledResumeKey = useRef(0);
  useEffect(() => {
    const key = resumeParams?.resumeKey || 0;
    if (!key || handledResumeKey.current === key || !courses.length || !resumeParams?.resumeSubjectId) return;
    handledResumeKey.current = key;
    const subjectId = resumeParams.resumeSubjectId;
    const hasSubject = (course: LessonPracticeCourse) => course.subjects.some((subject) => subject.id === subjectId);
    const course = courses.find((item) => item.id === resumeParams.resumeCourseId && hasSubject(item))
      || courses.find((item) => item.enrolled && hasSubject(item))
      || courses.find(hasSubject);
    const subject = course?.subjects.find((item) => item.id === subjectId);
    tabNavigation.setParams({ resumeKey: undefined } as never);
    if (!course || !subject) return;
    void openSubject(course, subject, {
      unitId: resumeParams.resumeUnitId || '',
      sectionId: resumeParams.resumeSectionId || '',
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openSubject đổi mỗi lần render
  }, [courses, resumeParams, tabNavigation]);

  const stackNavigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [relatedTopics, setRelatedTopics] = useState<{ key: string; rows: DpTopic[] }>({ key: '', rows: [] });
  const relatedKey = !isPreview && selectedSubject && displayedUnit?.id ? `${selectedSubject.id}|${displayedUnit.id}` : '';
  useEffect(() => {
    if (!relatedKey) return undefined;
    let alive = true;
    const [relatedSubjectId, relatedUnitId] = relatedKey.split('|');
    dailyPracticeApi.relatedTopics(relatedSubjectId, relatedUnitId)
      .then((rows) => { if (alive) setRelatedTopics({ key: relatedKey, rows: Array.isArray(rows) ? rows : [] }); })
      .catch(() => { if (alive) setRelatedTopics({ key: relatedKey, rows: [] }); });
    return () => { alive = false; };
  }, [relatedKey]);
  const unitRelatedTopics = relatedTopics.key === relatedKey ? relatedTopics.rows : [];
  // Cùng vị trí với web: dải gợi ý luôn nằm ngay trên thanh điều hướng đáy bài học.
  const relatedStrip = unitRelatedTopics.length ? (
    <View style={styles.relatedTopics}>
      <Gamepad2 size={15} color="#92400E" />
      <Text style={styles.relatedTopicsTitle}>Luyện tập chủ đề liên quan:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedTopicsRow}>
        {unitRelatedTopics.map((topic) => (
          <Pressable
            key={topic.id}
            onPress={() => openRelatedTopic(topic.id)}
            style={styles.relatedTopicChip}
            accessibilityRole="button"
            accessibilityLabel={`Luyện tập ${topic.name}`}
          >
            <Gamepad2 size={13} color={colors.brand} />
            <Text numberOfLines={1} style={styles.relatedTopicText}>{topic.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  ) : null;
  const openRelatedTopic = (topicId: string) => {
    // Modal bài học nằm trên mọi màn hình — đóng trước khi chuyển sang luyện tập.
    setSelectedCourse(null);
    setSelectedSubject(null);
    setSelectedUnit(null);
    setActiveUnitDetails([]);
    setUnitNavOpen(false);
    stackNavigation.navigate('DailyPractice', { topicId });
  };

  const displayedSectionId = displayedSectionIndex >= 0 ? displayedUnitSections[displayedSectionIndex]?.id || '' : '';
  const lastSyncedPosition = useRef('');
  useEffect(() => {
    if (isPreview || !selectedSubject || !displayedUnit?.id || !displayedSectionId) return undefined;
    const courseId = selectedCourse?.id || '';
    const signature = `${displayedUnit.id}|${displayedSectionId}|${courseId}`;
    if (lastSyncedPosition.current === signature) return undefined;
    const timer = setTimeout(() => {
      lastSyncedPosition.current = signature;
      saveStudyResumePoint({ unitId: displayedUnit.id, sectionId: displayedSectionId, courseId })
        .catch(() => { lastSyncedPosition.current = ''; });
    }, 1200);
    return () => clearTimeout(timer);
  }, [displayedSectionId, displayedUnit?.id, isPreview, selectedCourse?.id, selectedSubject]);
  const lessonNavigation = displayedUnit && (allDisplayedSectionsDone || !displayedUnitSections.length)
    ? (
      <UnitNavigationBar
        previousUnit={displayedUnitIndex > 0 ? units[displayedUnitIndex - 1] : null}
        nextUnit={displayedUnitIndex >= 0 ? units[displayedUnitIndex + 1] || null : null}
        onNavigateUnit={(target) => void startUnit(target)}
      />
    )
    : displayedUnit
      ? (
        <SectionNavigationBar
          sections={displayedUnitSections}
          currentIndex={displayedSectionIndex}
          currentDone={Boolean(displayedSectionIndex >= 0 && isUnitSectionDone(displayedUnit, displayedUnitSections[displayedSectionIndex]))}
          onNavigateSection={setSelectedLearningSectionId}
        />
      )
      : null;

  return (
    <AppScreen contentStyle={styles.screenContent}>
      <View style={styles.headerBand}>
        <View style={styles.headerGroup}>
          <AppHeader title="Bài giảng" icon={Clapperboard} />
        </View>
      </View>
      <View style={styles.filters}>
        {filterOptions.map((option) => {
          const Icon = option.icon;
          const count = option.id === 'all' ? counts.all
            : option.id === 'registered' ? counts.registered
              : option.id === 'video' ? counts.video
                : option.id === 'instructor' ? counts.instructor : undefined;
          const active = filter === option.id;
          return (
            <Pressable
              key={option.id}
              onPress={() => setFilter(option.id)}
              style={[styles.filterChip, active && styles.filterChipActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
            >
              <View style={styles.filterIconWrap}>
                <Icon size={17} color={active ? colors.brandDark : colors.muted} />
                {count !== undefined ? <Text style={[styles.filterCount, active && styles.filterCountActive]}>{count}</Text> : null}
              </View>
              <Text numberOfLines={2} style={[styles.filterText, active && styles.filterTextActive]}>{option.displayLabel}</Text>
            </Pressable>
          );
        })}
      </View>
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && filter === 'guide' ? (
        <Card>
          <View style={styles.guideHeader}><CircleHelp size={20} color={colors.brand} /><Text style={styles.cardTitle}>Hướng dẫn học</Text></View>
          <Text style={styles.body}>Chọn khóa học, mở môn học và hoàn thành lần lượt từng buổi để theo dõi tiến độ.</Text>
        </Card>
      ) : null}
      {!resource.loading && !resource.error && filter !== 'guide' && !courses.length ? (
        <EmptyState title="Chưa có khóa học được mở" message="Các khóa học sẽ hiển thị tại đây." />
      ) : null}
      {!resource.loading && !resource.error && filter !== 'guide' && sections.map((section) => (
        section.courses.length ? (
          <View key={section.id} style={styles.courseSection}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, section.id.startsWith('registered') ? styles.registeredIcon : section.id.startsWith('video') ? styles.videoIcon : styles.instructorIcon]}>
                {section.id.startsWith('registered') ? <CheckCircle2 size={21} color="#059669" /> : section.id.startsWith('video') ? <Clapperboard size={21} color="#B45309" /> : <GraduationCap size={21} color="#0369A1" />}
              </View>
              <View style={styles.sectionCopy}>
                <Text style={styles.eyebrow}>{section.id.startsWith('registered') ? 'Lộ trình của bạn' : section.id.startsWith('video') ? 'Chủ động học tập' : 'Học cùng giảng viên'}</Text>
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>{section.title}</Text>
                  <Text style={[styles.sectionCount, section.id.startsWith('registered') ? styles.registeredCount : section.id.startsWith('video') ? styles.videoCount : styles.instructorCount]}>{section.courses.length}</Text>
                </View>
              </View>
            </View>
            <CourseList
              courses={section.courses}
              onOpen={openCourse}
              onRegister={requestCourseRegistration}
              registeringCourseId={registeringCourseId}
            />
          </View>
        ) : null
      ))}
      {filter !== 'guide' && sections.every((section) => !section.courses.length) && !resource.loading && !resource.error ? (
        <EmptyState title="Không có khóa học trong bộ lọc" message="Thử chọn một bộ lọc khác." />
      ) : null}
      <CoursePaymentModal checkout={checkout} onClose={() => setCheckout(null)} onPaid={handleCoursePaid} />
      <Modal visible={Boolean(selectedCourse)} transparent animationType="slide" onRequestClose={() => { setSelectedCourse(null); setSelectedSubject(null); }}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setSelectedCourse(null); setSelectedSubject(null); }} accessibilityRole="button" accessibilityLabel="Đóng nội dung khóa học" />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => {
                  if (selectedSubject) {
                    setSelectedSubject(null);
                    setSelectedUnit(null);
                    setUnits([]);
                    setActiveUnitDetails([]);
                    setUnitNavOpen(false);
                  } else {
                    setSelectedCourse(null);
                  }
                }}
                style={styles.modalBack}
                accessibilityRole="button"
                accessibilityLabel={selectedSubject ? 'Quay lại danh sách môn học' : 'Quay lại danh sách khóa học'}
              >
                <ArrowLeft size={19} color={colors.brand} />
              </Pressable>
              <View style={styles.flex}>
                <Text style={styles.modalTitle}>{selectedSubject?.name || selectedCourse?.name}</Text>
                {!selectedSubject ? <Text style={styles.muted}>{`${selectedCourse?.subjects.length || 0} môn học`}</Text> : null}
              </View>
              {selectedSubject && units.length > 0 ? (
                <Pressable
                  onPress={() => setUnitNavOpen((open) => !open)}
                  style={[styles.headerLessonNav, unitNavOpen && styles.headerLessonNavOpen]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: unitNavOpen }}
                  accessibilityLabel={unitNavOpen ? 'Thu gọn danh sách bài học' : 'Mở danh sách bài học'}
                >
                  <Menu size={17} color={colors.brand} />
                  <Text style={styles.headerLessonNavText}>Danh sách bài học</Text>
                  {unitNavOpen ? <ChevronUp size={16} color={colors.brand} /> : <ChevronDown size={16} color={colors.brand} />}
                </Pressable>
              ) : null}
            </View>
            <View style={styles.modalContent}>
              {selectedSubject ? (
                <View style={styles.lessonPage}>
                  {(unitsLoading || openingUnit) && !selectedUnit && !activeUnitDetails.length ? <LoadingSkeleton rows={3} /> : null}
                  {unitsError ? <Text style={styles.errorText}>{unitsError}</Text> : null}
                  {!unitsLoading && !unitsError && !selectedUnit && !activeUnitDetails.length ? (
                    <EmptyState title="Chưa có bài học đang mở" message="Mở menu bài học để chọn bài có thể học." />
                  ) : null}
                  <ScrollView
                    style={styles.lessonMainColumn}
                    contentContainerStyle={[
                      styles.lessonMainContent,
                      displayedUnit && {
                        paddingBottom: 58 + Math.max(insets.bottom, spacing.sm) + spacing.sm + 1
                          + (unitRelatedTopics.length ? RELATED_STRIP_HEIGHT + spacing.xs : 0),
                      },
                    ]}
                    showsVerticalScrollIndicator={false}
                    onLayout={(event) => setLessonContentWidth(Math.max(0, event.nativeEvent.layout.width - spacing.md * 2))}
                  >
                    {(selectedUnit ? [selectedUnit] : activeUnitDetails).map((unit) => {
                      return (
                        <UnitDetails
                          key={unit.id}
                          unit={unit}
                          subjectName={selectedSubject?.name || ''}
                          courseId={selectedCourse?.id || ''}
                          courseTitle={selectedCourse?.name || ''}
                          userId={user?.id || ''}
                          enabled={!isPreview && Boolean(user?.id)}
                          resources={selectedCourse?.files || []}
                          selectedSectionId={selectedLearningSectionId}
                          contentWidth={lessonContentWidth}
                          onOpenVideo={(url) => void openVideo(url)}
                          onCompleteSection={completeUnitSection}
                          onSubmitPractice={submitPracticeAnswer}
                          onAdvancePractice={async (unitId) => {
                            try {
                              await refreshUnitDetail(unitId);
                            } catch (error) {
                              Alert.alert('Không tải được tiến độ', error instanceof Error ? error.message : 'Vui lòng thử lại.');
                            }
                          }}
                          onResetPractice={resetPracticeAttempt}
                          onContinuePractice={() => setSelectedLearningSectionId(null)}
                        />
                      );
                    })}
                  </ScrollView>
                  {lessonDrawerMounted ? <Animated.View
                    pointerEvents={unitNavOpen ? 'auto' : 'none'}
                    accessibilityElementsHidden={!unitNavOpen}
                    importantForAccessibility={unitNavOpen ? 'auto' : 'no-hide-descendants'}
                    aria-hidden={!unitNavOpen}
                    style={[
                      styles.lessonDrawerOverlay,
                      { opacity: lessonDrawerProgress },
                    ]}
                  >
                    <Pressable
                      style={styles.lessonDrawerBackdrop}
                      onPress={() => setUnitNavOpen(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Đóng danh sách bài học"
                    />
                    <Animated.View
                      style={[
                        styles.lessonDrawer,
                        {
                          width: lessonDrawerWidth,
                          transform: [{
                            translateX: lessonDrawerProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [lessonDrawerWidth, 0],
                            }),
                          }],
                        },
                      ]}
                    >
                      <Text style={styles.lessonDrawerTitle}>Danh sách bài học</Text>
                      <ScrollView contentContainerStyle={styles.unitNavList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                        {units.map((unit, index) => {
                          const active = unit.id === (selectedUnit?.id || activeUnitDetails[0]?.id);
                          return (
                            <View key={unit.id} style={styles.lessonNavGroup}>
                              <Pressable
                                onPress={() => void startUnit(unit)}
                                disabled={openingUnit}
                                style={[
                                  styles.unitNavItem,
                                  active && styles.unitNavItemActive,
                                  unit.locked && styles.unitNavItemLocked,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={`Bài ${index + 1}: ${unit.title}${unit.locked ? ', đang khóa' : ''}`}
                                accessibilityState={{ selected: active, expanded: active, disabled: openingUnit }}
                              >
                                <View style={[styles.unitNavNumber, active && styles.unitNavNumberActive, unit.locked && styles.unitNavNumberLocked]}>
                                  {unit.locked
                                    ? <Lock size={12} color="#94A3B8" />
                                    : unit.status === 'completed'
                                      ? <CheckCircle2 size={14} color={active ? '#FFFFFF' : '#059669'} />
                                      : <Text style={[styles.unitNavNumberText, active && styles.unitNavNumberTextActive]}>{index + 1}</Text>}
                                </View>
                                <Text numberOfLines={2} style={[styles.unitNavItemTitle, active && styles.unitNavItemTitleActive, unit.locked && styles.unitNavItemTitleLocked]}>{unit.title}</Text>
                                {active ? <Text style={styles.unitNavCurrent}>Đang học</Text> : null}
                              </Pressable>
                              {active ? getUnitLearningSections(unit).map((section) => {
                                const sectionActive = active && selectedLearningSectionId === section.id;
                                const done = isUnitSectionDone(unit, section);
                                const locked = Boolean(unit.locked);
                                return (
                                  <Pressable
                                    key={section.id}
                                    onPress={() => void startUnit(unit, section.id)}
                                    disabled={openingUnit || locked}
                                    style={[
                                      styles.unitNavSubItem,
                                      sectionActive && styles.unitNavSubItemActive,
                                      locked && styles.unitNavSubItemLocked,
                                    ]}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${section.title}${done ? ', đã hoàn thành, nhấn để học lại' : ''}${locked ? ', đang khóa' : ''}`}
                                    accessibilityState={{ selected: sectionActive, disabled: openingUnit || locked }}
                                  >
                                    {done ? <CheckCircle2 size={14} color="#059669" /> : <ChevronRight size={14} color={colors.brand} />}
                                    <Text numberOfLines={2} style={[styles.unitNavSubItemText, sectionActive && styles.unitNavSubItemTextActive, locked && styles.unitNavItemTitleLocked]}>{section.title}</Text>
                                    {done ? <Text style={styles.unitNavReplay}>Học lại</Text> : null}
                                  </Pressable>
                                );
                              }) : null}
                            </View>
                          );
                        })}
                      </ScrollView>
                    </Animated.View>
                  </Animated.View>
                    : null}
                </View>
              ) : (
                <ScrollView style={styles.modalContentScroll} contentContainerStyle={styles.modalContentInner} showsVerticalScrollIndicator={false}>
                  {selectedSubject ? (
                    <>
                      {unitsLoading ? <LoadingSkeleton rows={3} /> : null}
                      {unitsError ? <Text style={styles.errorText}>{unitsError}</Text> : null}
                      {!unitsLoading && !unitsError && !units.length ? <EmptyState title="Chưa có bài học" message="Nội dung sẽ hiển thị tại đây." /> : null}
                      {!unitsLoading && !unitsError && units.length ? (
                        unitNavOpen ? units.map((unit, index) => (
                          <Pressable
                            key={unit.id}
                            onPress={() => void startUnit(unit)}
                            disabled={openingUnit}
                            style={[
                              styles.unitRow,
                              unit.locked && styles.unitRowLocked,
                              unit.status === 'completed' && styles.unitRowCompleted,
                              openingUnit && styles.unitRowBusy,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`${unit.title}, ${unit.locked ? 'đang khóa' : unit.status === 'completed' ? 'đã hoàn thành, nhấn để xem lại' : unit.status === 'in_progress' ? 'đang học, nhấn để tiếp tục' : 'sẵn sàng học'}`}
                            accessibilityState={{ disabled: openingUnit }}
                          >
                            <View style={[
                              styles.unitNumber,
                              unit.status === 'completed' && styles.unitNumberDone,
                              unit.locked && styles.unitNumberLocked,
                            ]}>
                              {unit.status === 'completed'
                                ? <CheckCircle2 size={17} color="#059669" />
                                : unit.locked
                                  ? <Lock size={15} color="#94A3B8" />
                                  : <Text style={styles.unitNumberText}>{index + 1}</Text>}
                            </View>
                            <View style={styles.flex}>
                              <Text style={[styles.unitTitle, unit.locked && styles.unitTitleLocked]}>{unit.title}</Text>
                              <Text style={[styles.unitStatus, unit.locked && styles.unitStatusLocked]}>
                                {unit.locked ? 'Hoàn thành buổi trước để mở' : unit.status === 'completed' ? 'Đã hoàn thành · Có thể xem lại' : unit.status === 'in_progress' ? 'Đang học · Chạm để tiếp tục' : 'Video và nội dung bài học'}
                              </Text>
                            </View>
                            <View style={[
                              styles.unitAction,
                              unit.locked && styles.unitActionLocked,
                              unit.status === 'completed' && styles.unitActionCompleted,
                            ]}>
                              {unit.locked ? <Lock size={13} color="#64748B" /> : unit.status === 'completed' ? <CheckCircle2 size={14} color="#047857" /> : <Play size={13} color="#FFFFFF" fill="#FFFFFF" />}
                              <Text style={[
                                styles.unitActionText,
                                unit.locked && styles.unitActionTextLocked,
                                unit.status === 'completed' && styles.unitActionTextCompleted,
                              ]}>
                                {unit.locked ? 'Khóa' : unit.status === 'completed' ? 'Xem lại' : unit.status === 'in_progress' ? 'Tiếp tục' : 'Vào học'}
                              </Text>
                            </View>
                          </Pressable>
                        )) : null
                      ) : null}
                    </>
                  ) : (
                    (selectedCourse?.subjects || []).map((subject, index) => (
                      <Pressable key={subject.id || `${subject.name}-${index}`} onPress={() => selectedCourse && void openSubject(selectedCourse, subject)} style={styles.subjectCard} accessibilityRole="button">
                        <View style={styles.unitNumber}><Text style={styles.unitNumberText}>{String(index + 1).padStart(2, '0')}</Text></View>
                        <View style={styles.flex}>
                          <Text style={styles.unitTitle}>{subject.name}</Text>
                          <Text style={styles.muted}>{subject.opened ? `${subject.completedUnitCount || 0}/${subject.totalUnitCount || 0} bài đã hoàn thành` : selectedCourse?.enrolled ? 'Chưa đăng ký' : 'Có bài học thử'}</Text>
                          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${subject.totalUnitCount ? Math.min(100, Math.round(((subject.completedUnitCount || 0) / subject.totalUnitCount) * 100)) : 0}%` }]} /></View>
                        </View>
                        <ChevronRight size={18} color={colors.muted} />
                      </Pressable>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
            {selectedSubject && displayedUnit ? (
              Platform.OS === 'web' ? (
                <div
                  style={{
                    position: 'fixed',
                    right: 0,
                    bottom: 0,
                    left: 0,
                    zIndex: 1000,
                    paddingTop: spacing.sm,
                    paddingRight: spacing.sm,
                    paddingBottom: Math.max(insets.bottom, spacing.sm),
                    paddingLeft: spacing.sm,
                    borderTop: '1px solid #E2E8F0',
                    backgroundColor: '#FFFFFF',
                  }}
                >
                  {relatedStrip}
                  {lessonNavigation}
                </div>
              ) : (
                <View style={[styles.lessonNavigationFooter, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
                  {relatedStrip}
                  {lessonNavigation}
                </View>
              )
            ) : null}
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

function CourseCard({ course, onOpen, onRegister, registering = false }: { course: LessonPracticeCourse; onOpen: () => void; onRegister: () => void; registering?: boolean }) {
  const [isHovered, setIsHovered] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const isVideo = course.deliveryMode === 'video';
  const progress = courseProgress(course);
  const showTooltip = !course.enrolled && (isHovered || infoOpen);
  return (
    <Pressable
      style={[styles.courseCardWrap, showTooltip ? styles.courseCardWrapActive : undefined]}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
    >
      <Card style={{ ...styles.courseCard, ...(isHovered ? styles.courseCardHovered : {}) }}>
        <Pressable style={styles.courseCardContent} onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Mở khóa học ${course.name}`}>
          <View style={[styles.courseBanner, { backgroundColor: course.bannerColorStart || '#BE123C' }]}>
            {course.thumbnail ? <Image source={{ uri: course.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[styles.bannerRing, { borderColor: 'rgba(255,255,255,0.13)' }]} />}
            {!course.enrolled ? <View style={styles.lockBadge}><Lock size={14} color="#854D0E" /></View> : null}
            <View style={styles.courseMode}><Clapperboard size={16} color="#B45309" /><Text style={styles.courseModeText}>{isVideo ? 'Tự học qua video' : 'Học cùng giảng viên'}</Text></View>
            <View style={styles.offerBadge}><Text style={styles.offerText}>{course.offerType === 'single' ? 'Khóa lẻ' : 'Trọn gói'}</Text></View>
          </View>
          <View style={styles.courseInfo}>
            <Text numberOfLines={2} style={styles.courseTitle}>{course.name}</Text>
            {course.subjects.length ? (
              <View style={styles.subjectChips}>
                <Text style={styles.subjectLabel}>Môn:</Text>
                {course.subjects.slice(0, 3).map((subject, index) => (
                  <Text
                    key={subject.id || subject.name}
                    numberOfLines={1}
                    style={[
                      styles.subjectChip,
                      index % 4 === 1 ? styles.subjectChipRose
                        : index % 4 === 2 ? styles.subjectChipViolet
                          : index % 4 === 3 ? styles.subjectChipAmber
                            : null,
                    ]}
                  >
                    {subject.name}
                  </Text>
                ))}
                {course.subjects.length > 3 ? <Text style={styles.subjectChip}>+{course.subjects.length - 3} môn</Text> : null}
              </View>
            ) : null}
            <View style={styles.courseFooter}>
              {course.enrolled ? (
                <View style={styles.progressCircle}><Text style={styles.progressText}>{progress}%</Text></View>
              ) : (
                <View style={styles.lessonCount}><Clock3 size={13} color={colors.muted} /><Text style={styles.muted}>{isVideo ? course.lessonCount || 0 : course.totalSessions || 0} {isVideo ? 'bài học' : 'buổi'}</Text></View>
              )}
              {course.enrolled ? <Text style={styles.enrolledBadge}><CheckCircle2 size={13} color="#059669" /> Đã đăng ký</Text> : <Text style={styles.priceText}>{Number(course.price || 0).toLocaleString('vi-VN')}đ</Text>}
            </View>
          </View>
        </Pressable>
        <View style={styles.courseActions}>
          {!course.enrolled && isVideo ? <Pressable onPress={onRegister} disabled={registering} style={[styles.registerButton, registering && { opacity: 0.6 }]} accessibilityRole="button"><Text style={styles.registerText}>{registering ? 'Đang tạo thanh toán…' : 'Đăng ký học'}</Text></Pressable> : <View />}
          {!course.enrolled && !isVideo ? <Pressable onPress={onRegister} style={styles.registerButton} accessibilityRole="button"><Text style={styles.registerText}>Zalo tư vấn</Text></Pressable> : null}
          <Pressable onPress={onOpen} style={[styles.openButton, course.enrolled ? styles.openButtonActive : null]} accessibilityRole="button">
            <Text style={[styles.openButtonText, course.enrolled && styles.openButtonTextActive]}>{course.enrolled ? progress > 0 && progress < 100 ? 'Tiếp tục học' : progress >= 100 ? 'Xem lại khóa học' : 'Vào học' : directSubject(course) ? 'Học thử' : 'Xem thêm'}</Text>
            <ChevronRight size={16} color={course.enrolled ? '#047857' : colors.red} />
          </Pressable>
        </View>
      </Card>
      {!course.enrolled ? (
        <Pressable
          onPress={() => setInfoOpen((current) => !current)}
          style={styles.courseInfoButton}
          accessibilityRole="button"
          accessibilityLabel={infoOpen ? 'Ẩn thông tin khóa học' : 'Xem thông tin khóa học'}
          accessibilityState={{ expanded: showTooltip }}
        >
          <CircleHelp size={15} color="#475569" />
        </Pressable>
      ) : null}
      {showTooltip ? <CourseTooltip isVideo={isVideo} /> : null}
    </Pressable>
  );
}

function CourseList({
  courses,
  onOpen,
  onRegister,
  registeringCourseId = '',
}: {
  courses: LessonPracticeCourse[];
  onOpen: (course: LessonPracticeCourse) => void;
  onRegister: (course: LessonPracticeCourse) => void;
  registeringCourseId?: string;
}) {
  return (
    <View style={styles.courseList}>
      {courses.map((course) => (
        <View key={course.id} style={styles.registeredCourseCard}>
          <CourseCard
            course={course}
            onOpen={() => onOpen(course)}
            onRegister={() => onRegister(course)}
            registering={registeringCourseId === course.id}
          />
        </View>
      ))}
    </View>
  );
}

function CourseTooltip({ isVideo }: { isVideo: boolean }) {
  return (
    <View style={styles.courseTooltip} pointerEvents="none" accessibilityRole="text">
      <View style={styles.tooltipTitle}>
        <Sparkles size={14} color="#F59E0B" />
        <Text style={styles.tooltipHeading}>{isVideo ? 'Khóa tự học là gì?' : 'Học cùng giảng viên 1 kèm 1'}</Text>
      </View>
      {isVideo ? (
        <>
          <Text style={styles.tooltipLine}>•  Học theo lộ trình có sẵn, kèm video hướng dẫn.</Text>
          <Text style={styles.tooltipLine}>•  Có bài tập thực hành để củng cố kiến thức.</Text>
          <Text style={styles.tooltipLine}>•  Trắc nghiệm được hệ thống chấm tự động.</Text>
          <Text style={styles.tooltipLine}>•  Bài tự luận được AI đánh giá và phản hồi.</Text>
          <Text style={styles.tooltipLine}>•  Đăng ký một lần, học trọn đời.</Text>
          <Text style={styles.tooltipWarning}>Lưu ý: Khóa học này không phải là học 1 kèm 1; không hoàn phí nếu đã đăng ký.</Text>
        </>
      ) : (
        <>
          <Text style={styles.tooltipLine}>•  Học trực tiếp 1 kèm 1 với giảng viên qua UltraViewer hoặc TeamViewer; hỗ trợ Chrome Remote Desktop trên MacBook.</Text>
          <Text style={styles.tooltipLine}>•  Mỗi buổi học đều được ghi lại màn hình để bạn xem lại.</Text>
          <Text style={styles.tooltipLine}>•  Thời gian học linh động, sắp xếp phù hợp với lịch của bạn.</Text>
          <Text style={styles.tooltipLine}>•  Được hỗ trợ trọn đời trong quá trình học.</Text>
        </>
      )}
    </View>
  );
}

function UnitDetails({
  unit,
  subjectName,
  courseId,
  courseTitle,
  userId,
  enabled,
  resources,
  selectedSectionId,
  contentWidth,
  onOpenVideo,
  onCompleteSection,
  onSubmitPractice,
  onAdvancePractice,
  onResetPractice,
  onContinuePractice,
}: {
  unit: LessonPracticeUnit;
  subjectName: string;
  courseId: string;
  courseTitle: string;
  userId: string;
  enabled: boolean;
  resources: NonNullable<LessonPracticeCourse['files']>;
  selectedSectionId: string | null;
  contentWidth: number;
  onOpenVideo: (url: string) => void;
  onCompleteSection: (unitId: string, section: 'video' | 'note', itemId: string) => Promise<boolean>;
  onSubmitPractice: (
    unitId: string,
    itemId: string,
    practiceGroupId: string | undefined,
    answer: Record<string, unknown>,
  ) => Promise<LessonPracticeItem | null>;
  onAdvancePractice: (unitId: string) => Promise<void>;
  onResetPractice: (unitId: string, practiceGroupId: string) => Promise<boolean>;
  onContinuePractice: () => void;
}) {
  const [practiceSoundEnabled, setPracticeSoundEnabled] = useState(true);
  const [startedPracticeKey, setStartedPracticeKey] = useState('');
  const [practiceStats, setPracticeStats] = useState<PracticeAttemptStats>(emptyPracticeAttemptStats);
  const practiceStatsRef = useRef<PracticeAttemptStats>(emptyPracticeAttemptStats);
  const [showWrongQuestions, setShowWrongQuestions] = useState(false);
  const [practiceRemaining, setPracticeRemaining] = useState(0);
  const [practiceExpired, setPracticeExpired] = useState(false);
  const [resettingPractice, setResettingPractice] = useState(false);
  const [practiceProgressWidth, setPracticeProgressWidth] = useState(0);
  const [practiceFireworkIndex, setPracticeFireworkIndex] = useState(0);
  const practiceClockRef = useRef<{ key: string; deadline: number } | null>(null);
  const praiseSoundPlayersRef = useRef<Array<ReturnType<typeof createAudioPlayer>>>([]);
  const praiseStartRefs = useRef<Array<() => void>>([]);
  const praiseHasPlayedRef = useRef<boolean[]>([]);
  const praiseQueueRef = useRef<number[]>([]);
  const activePraiseRef = useRef<{
    player: ReturnType<typeof createAudioPlayer>;
    started: boolean;
    starting: boolean;
  } | null>(null);
  const playNextPracticePraiseRef = useRef<() => void>(() => { });
  const playNextPracticePraise = useCallback(() => {
    if (activePraiseRef.current) return;
    if (!praiseSoundPlayersRef.current.length) return;
    const queuedPraiseIndex = praiseQueueRef.current.shift();
    if (queuedPraiseIndex === undefined) return;
    const player = praiseSoundPlayersRef.current[queuedPraiseIndex];
    if (!player) {
      console.warn('Không tìm thấy âm thanh khen luyện tập đã chọn.');
      playNextPracticePraiseRef.current();
      return;
    }
    activePraiseRef.current = { player, started: false, starting: false };
    player.volume = 0.85;
    praiseStartRefs.current[queuedPraiseIndex]?.();
  }, []);
  playNextPracticePraiseRef.current = playNextPracticePraise;
  const playPracticePraise = useCallback((audio: number) => {
    const praiseIndex = practicePraises.findIndex((praise) => praise.audio === audio);
    if (praiseIndex < 0) {
      console.warn('Không tìm thấy âm thanh khen luyện tập đã chọn.');
      return;
    }
    praiseQueueRef.current.push(praiseIndex);
    playNextPracticePraiseRef.current();
  }, []);
  useEffect(() => {
    const players = practicePraises.map(({ audio }) => createAudioPlayer(audio, { updateInterval: 100 }));
    praiseSoundPlayersRef.current = players;
    praiseHasPlayedRef.current = players.map(() => false);
    const startPlayers = players.map((player, index) => () => {
      const activePraise = activePraiseRef.current;
      if (activePraise?.player !== player || activePraise.starting || !player.isLoaded) return;
      activePraise.starting = true;
      const handlePlaybackError = (error: unknown) => {
        if (activePraiseRef.current === activePraise) {
          activePraiseRef.current = null;
          playNextPracticePraiseRef.current();
        }
        console.warn('Không thể phát âm thanh khen luyện tập.', error);
      };
      const start = () => {
        if (activePraiseRef.current !== activePraise) return;
        try {
          player.play();
          praiseHasPlayedRef.current[index] = true;
        } catch (error) {
          handlePlaybackError(error);
        }
      };
      if (praiseHasPlayedRef.current[index]) {
        void player.seekTo(0).then(start).catch(handlePlaybackError);
      } else {
        start();
      }
    });
    praiseStartRefs.current = startPlayers;
    const subscriptions = players.map((player, index) => player.addListener('playbackStatusUpdate', (status) => {
      const activePraise = activePraiseRef.current;
      if (activePraise?.player !== player) return;
      if (status.isLoaded && !activePraise.starting) startPlayers[index]();
      if (status.playing) activePraise.started = true;
      if (!status.didJustFinish || !activePraise.started) return;
      activePraiseRef.current = null;
      playNextPracticePraiseRef.current();
    }));
    playNextPracticePraiseRef.current();
    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      players.forEach((player) => player.remove());
      praiseSoundPlayersRef.current = [];
      praiseStartRefs.current = [];
      praiseHasPlayedRef.current = [];
      praiseQueueRef.current = [];
      activePraiseRef.current = null;
    };
  }, []);
  useEffect(() => {
    let active = true;
    getMobileSoundEnabled()
      .then((enabled) => { if (active) setPracticeSoundEnabled(enabled); })
      .catch(() => undefined);
    const unsubscribe = subscribeToMobileSoundPreference(setPracticeSoundEnabled);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  const sectionCelebration = useRef(sectionFireworkParticles.map(() => new Animated.Value(0))).current;
  const practiceProgressCelebration = useRef(new Animated.Value(0)).current;
  const practiceCompletionRings = useRef([new Animated.Value(0), new Animated.Value(0)]).current;
  const practiceCompletionRays = useRef(practiceFireworkRays.map(() => new Animated.Value(0))).current;
  const celebratePracticeProgress = useCallback((index: number) => {
    setPracticeFireworkIndex(index);
    practiceProgressCelebration.setValue(0);
    Animated.timing(practiceProgressCelebration, { toValue: 1, duration: 1500, useNativeDriver: true }).start();
  }, [practiceProgressCelebration]);
  const celebratePracticeCompletion = useCallback(() => {
    [...practiceCompletionRings, ...practiceCompletionRays].forEach((progress) => {
      progress.stopAnimation();
      progress.setValue(0);
    });
    Animated.parallel([
      Animated.sequence([
        Animated.delay(140),
        Animated.timing(practiceCompletionRings[0], { toValue: 1, duration: 1500, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.delay(320),
        Animated.timing(practiceCompletionRings[1], { toValue: 1, duration: 1550, useNativeDriver: true }),
      ]),
      Animated.stagger(26, practiceCompletionRays.map((progress) => (
        Animated.sequence([
          Animated.delay(180),
          Animated.timing(progress, { toValue: 1, duration: 1550, useNativeDriver: true }),
        ])
      ))),
    ]).start();
  }, [practiceCompletionRays, practiceCompletionRings]);
  const lastPracticePraise = useRef('');
  const practiceWrongAttempts = useRef(0);
  const choosePracticePraise = () => {
    const praise = getPracticePraise(lastPracticePraise.current);
    lastPracticePraise.current = praise.text;
    return praise;
  };
  const choosePracticeEncouragement = () => {
    practiceWrongAttempts.current += 1;
    return practiceEncouragements[(practiceWrongAttempts.current - 1) % practiceEncouragements.length];
  };
  const celebrateSectionCompletion = () => {
    sectionCelebration.forEach((progress) => {
      progress.stopAnimation();
      progress.setValue(0);
    });
    Animated.stagger(35, sectionCelebration.map((progress) => (
      Animated.timing(progress, { toValue: 1, duration: 1200, useNativeDriver: true })
    ))).start();
  };
  const videos = unit.videos?.filter((video) => video.url) || [];
  const legacyVideo = unit.videoUrl && !videos.length
    ? [{ id: 'legacy-video', title: 'Video bài học', url: unit.videoUrl, antiSeek: unit.antiSeek !== false }]
    : [];
  const contents = unit.contents || [];
  const sections = getUnitLearningSections(unit);
  const section = sections.find((item) => item.id === selectedSectionId)
    || sections.find((item) => !isUnitSectionDone(unit, item))
    || sections[sections.length - 1];
  const sectionDone = section ? isUnitSectionDone(unit, section) : false;
  const sectionContent = section?.kind === 'note' ? contents.find((item) => item.id === section.itemId) : undefined;
  const sectionVideo = section?.kind === 'video' ? [...videos, ...legacyVideo].find((item) => item.id === section.itemId) : undefined;
  const practiceItems = section?.kind === 'practice'
    ? unit.items?.filter((item) => ['hotspot', 'mcq', 'multi', 'match', 'drag', 'written'].includes(item.type)
      && (item.practiceGroupId ? item.practiceGroupId === section.itemId : section.itemId === unit.id)) || []
    : [];
  const completedPracticeCount = practiceItems.filter((item) => item.confirmed === true && item.correct === true).length;
  const currentPracticeIndex = practiceItems.findIndex((item) => item.confirmed !== true || item.correct !== true);
  const currentPracticeItem = currentPracticeIndex >= 0 ? practiceItems[currentPracticeIndex] : null;
  const progressMarkerOffset = practiceItems.length > 1
    ? spacing.xs + 9 + (practiceFireworkIndex / (practiceItems.length - 1)) * Math.max(0, practiceProgressWidth - spacing.xs * 2 - 18)
    : practiceProgressWidth / 2;
  const practiceGroupId = section?.kind === 'practice' ? section.itemId : '';
  const practiceStatsKey = `${unit.id}:${practiceGroupId}`;
  const currentPracticeStats = practiceStats.key === practiceStatsKey ? practiceStats : emptyPracticeAttemptStats;
  const practiceComplete = practiceItems.length > 0 && !currentPracticeItem;
  const previousPracticeCompletion = useRef({ key: practiceStatsKey, complete: practiceComplete });
  useEffect(() => {
    if (previousPracticeCompletion.current.key !== practiceStatsKey) {
      previousPracticeCompletion.current = { key: practiceStatsKey, complete: practiceComplete };
      return;
    }
    if (!previousPracticeCompletion.current.complete && practiceComplete) celebratePracticeCompletion();
    previousPracticeCompletion.current.complete = practiceComplete;
  }, [celebratePracticeCompletion, practiceComplete, practiceStatsKey]);
  const configuredGroupLimit = unit.practiceTimeLimits?.find((entry) => entry.groupId === practiceGroupId);
  const groupTimeLimit = configuredGroupLimit ? configuredGroupLimit.timeLimitSec : unit.timeLimitSec || 0;
  const practiceTimeLimit = Math.max(0, groupTimeLimit || currentPracticeItem?.timeLimitSec || 0);
  const practiceClockKey = `${practiceStatsKey}:${groupTimeLimit > 0 ? 'group' : currentPracticeItem?.id || ''}`;
  const practiceStarted = startedPracticeKey === practiceStatsKey || completedPracticeCount > 0;

  useEffect(() => {
    if (practiceStats.key === practiceStatsKey) return;
    practiceStatsRef.current = { ...emptyPracticeAttemptStats, key: practiceStatsKey };
    setPracticeStats(practiceStatsRef.current);
    setShowWrongQuestions(false);
  }, [practiceStats.key, practiceStatsKey]);

  useEffect(() => {
    if (!practiceStarted || !currentPracticeItem || !practiceTimeLimit || practiceComplete || practiceExpired) return undefined;
    if (practiceClockRef.current?.key !== practiceClockKey) {
      practiceClockRef.current = {
        key: practiceClockKey,
        deadline: Date.now() + practiceTimeLimit * 1000,
      };
    }
    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil(((practiceClockRef.current?.deadline || Date.now()) - Date.now()) / 1000));
      setPracticeRemaining(remaining);
      if (remaining === 0) setPracticeExpired(true);
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [practiceStarted, currentPracticeItem?.id, practiceTimeLimit, practiceComplete, practiceExpired, practiceClockKey]);

  const submitPracticeQuestion = async (
    itemId: string,
    itemPracticeGroupId: string | undefined,
    answer: Record<string, unknown>,
  ) => {
    const result = await onSubmitPractice(unit.id, itemId, itemPracticeGroupId, answer);
    if (!result) return null;
    const previous = practiceStatsRef.current.key === practiceStatsKey
      ? practiceStatsRef.current
      : { ...emptyPracticeAttemptStats, key: practiceStatsKey };
    const next = result.confirmed === true && result.correct === true
      ? {
        ...previous,
        streak: previous.streak + 1,
        bestStreak: Math.max(previous.bestStreak, previous.streak + 1),
      }
      : {
        ...previous,
        streak: 0,
        wrongAttempts: previous.wrongAttempts + 1,
        wrongIds: previous.wrongIds.includes(itemId) ? previous.wrongIds : [...previous.wrongIds, itemId],
      };
    practiceStatsRef.current = next;
    setPracticeStats(next);
    return result;
  };

  const restartPractice = async (startImmediately: boolean) => {
    if (resettingPractice) return;
    setResettingPractice(true);
    try {
      if (!await onResetPractice(unit.id, practiceGroupId || unit.id)) return;
      const next = { ...emptyPracticeAttemptStats, key: practiceStatsKey };
      practiceStatsRef.current = next;
      setPracticeStats(next);
      setShowWrongQuestions(false);
      setPracticeExpired(false);
      setPracticeRemaining(practiceTimeLimit);
      practiceClockRef.current = null;
      setStartedPracticeKey(startImmediately ? practiceStatsKey : '');
    } finally {
      setResettingPractice(false);
    }
  };

  return (
    <View style={styles.unitDetails}>
      <View pointerEvents="none" style={styles.sectionCelebration}>
        {sectionFireworkParticles.map(([x, y, color, burstX, burstY], particleIndex) => (
          <Animated.View
            key={particleIndex}
            style={[
              styles.sectionFireworkParticle,
              {
                left: '50%',
                top: '42%',
                backgroundColor: color,
                opacity: sectionCelebration[particleIndex].interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: sectionCelebration[particleIndex].interpolate({ inputRange: [0, 1], outputRange: [0, (x + burstX) * 2] }) },
                  { translateY: sectionCelebration[particleIndex].interpolate({ inputRange: [0, 1], outputRange: [0, (y + burstY) * 2] }) },
                  { rotate: sectionCelebration[particleIndex].interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${particleIndex % 2 ? 360 : -360}deg`] }) },
                ],
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.unitTitle}>{unit.title}</Text>
      {section?.kind === 'note' ? (
        <View style={styles.contentCard}>
          <Text style={styles.contentTitle}>{sectionContent?.title || section.title}</Text>
          {sectionContent?.content ? (
            <RenderHtml
              contentWidth={Math.max(1, contentWidth)}
              source={{ html: sectionContent.content, baseUrl: getMobileApiBaseUrl() }}
              baseStyle={lessonHtmlBaseStyle}
              tagsStyles={lessonHtmlTags}
            />
          ) : <Text style={styles.muted}>Nội dung này hiện không có văn bản.</Text>}
          {sectionDone ? (
            <Text style={styles.practiceSuccess}>Đã hoàn thành · Có thể xem lại từ danh sách bài học.</Text>
          ) : (
            <Pressable
              onPress={() => {
                void onCompleteSection(unit.id, 'note', section.itemId).then((saved) => {
                  if (saved) celebrateSectionCompletion();
                });
              }}
              style={styles.completeSectionButton}
              accessibilityRole="button"
            >
              <CheckCircle2 size={17} color="#FFFFFF" />
              <Text style={styles.completeSectionButtonText}>Đã đọc xong · Tiếp tục</Text>
            </Pressable>
          )}
        </View>
      ) : null}
      {section?.kind === 'video' ? (
        <VideoLessonPane
          key={`${unit.id}-${section.itemId}`}
          unit={unit}
          subjectName={subjectName}
          video={sectionVideo}
          done={Boolean(sectionDone)}
          antiSeekEnabled={sectionVideo?.antiSeek ?? unit.antiSeek !== false}
          courseId={courseId}
          courseTitle={courseTitle}
          userId={userId}
          enabled={enabled}
          resources={resources}
          onOpenVideo={onOpenVideo}
          onComplete={() => {
            return onCompleteSection(unit.id, 'video', section.itemId).then((saved) => {
              if (saved) celebrateSectionCompletion();
              return saved;
            });
          }}
        />
      ) : null}
      {section?.kind === 'practice' ? (
        <View style={[styles.practiceCard, styles.practiceCardInteractive]}>
          <View style={styles.practiceHeader}>
            <View style={styles.flex}>
              <Text style={styles.contentTitle}>{section.title}</Text>
              <Text style={styles.practiceProgressText}>Tiến độ {completedPracticeCount}/{practiceItems.length} câu</Text>
            </View>
            <View style={styles.practiceHeaderActions}>
              <View style={styles.practiceStreak}>
                <Sparkles size={13} color="#D97706" />
                <Text style={styles.practiceStreakText}>Chuỗi đúng: {currentPracticeStats.streak}</Text>
              </View>
              <Pressable
                onPress={() => {
                  void setMobileSoundEnabled(!practiceSoundEnabled)
                    .then(() => setPracticeSoundEnabled(!practiceSoundEnabled))
                    .catch((error: unknown) => Alert.alert('Không thể đổi âm thanh', error instanceof Error ? error.message : 'Vui lòng thử lại.'));
                }}
                style={styles.practiceSoundButton}
                accessibilityRole="button"
                accessibilityLabel={practiceSoundEnabled ? 'Tắt âm thanh luyện tập' : 'Bật âm thanh luyện tập'}
                accessibilityState={{ checked: practiceSoundEnabled }}
              >
                {practiceSoundEnabled ? <Volume2 size={16} color={colors.brand} /> : <VolumeX size={16} color={colors.muted} />}
              </Pressable>
              {practiceTimeLimit > 0 ? (
                <View style={[styles.practiceClock, practiceRemaining > 0 && practiceRemaining <= 10 && styles.practiceClockWarning]}>
                  <Clock3 size={15} color={practiceRemaining > 0 && practiceRemaining <= 10 ? '#DC2626' : '#334155'} />
                  <Text style={styles.practiceClockText}>
                    {Math.floor((practiceStarted ? practiceRemaining : practiceTimeLimit) / 60)}:{String((practiceStarted ? practiceRemaining : practiceTimeLimit) % 60).padStart(2, '0')}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          {practiceItems.length ? (
            <View style={styles.practiceContent}>
              <View style={styles.practiceProgressArea}>
                <View style={styles.practiceProgressTrack}>
                  <View style={[styles.practiceProgressFill, { width: `${(completedPracticeCount / practiceItems.length) * 100}%` }]} />
                </View>
                <View
                  onLayout={(event) => setPracticeProgressWidth(event.nativeEvent.layout.width)}
                  style={styles.practiceSteps}
                  accessibilityLabel={`Tiến độ câu hỏi: ${completedPracticeCount} trên ${practiceItems.length} câu đúng`}
                >
                  {practiceItems.map((item, index) => {
                    const done = item.confirmed === true && item.correct === true;
                    const active = index === currentPracticeIndex;
                    return (
                      <View key={item.id} style={[styles.practiceStep, done && styles.practiceStepDone, currentPracticeStats.wrongIds.includes(item.id) && !done && styles.practiceStepRetry, active && styles.practiceStepActive]}>
                        <Text style={[styles.practiceStepText, done && styles.practiceStepTextDone, active && styles.practiceStepTextActive]}>{done ? '✓' : index + 1}</Text>
                      </View>
                    );
                  })}
                  {currentPracticeItem && !practiceComplete ? (
                    <View pointerEvents="none" style={styles.practiceProgressFireworkOverlay}>
                      {[0, 1].map((ringIndex) => {
                        const progress = practiceProgressCelebration.interpolate({
                          inputRange: [0, 0.12 + ringIndex * 0.08, 0.84, 1],
                          outputRange: [0, 0, 0.9, 0],
                        });
                        return (
                          <Animated.View
                            key={`ring-${ringIndex}`}
                            style={[
                              styles.practiceFireworkRing,
                              {
                                left: progressMarkerOffset,
                                borderColor: ringIndex === 0 ? '#0F766E' : '#C4A35A',
                                opacity: progress,
                                transform: [{ scale: progress.interpolate({ inputRange: [0, 0.9], outputRange: [0.2, 1.8 + ringIndex * 0.6] }) }],
                              },
                            ]}
                          />
                        );
                      })}
                      {practiceFireworkRays.map(([angle, color, size], particleIndex) => (
                        <Animated.View
                          key={particleIndex}
                          style={[
                            styles.practiceFireworkRay,
                            {
                              backgroundColor: color,
                              left: progressMarkerOffset,
                              top: '50%',
                              opacity: practiceProgressCelebration.interpolate({ inputRange: [0, 0.12, 0.84, 1], outputRange: [0, 1, 0.85, 0] }),
                            },
                            {
                              transform: [
                                { rotate: `${angle}deg` },
                                { translateY: practiceProgressCelebration.interpolate({ inputRange: [0, 1], outputRange: [0, -size] }) },
                                { scaleY: practiceProgressCelebration.interpolate({ inputRange: [0, 0.85], outputRange: [0.2, 1] }) },
                              ]
                            },
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
              {currentPracticeItem && !practiceComplete ? (
                <PracticeQuestion
                  key={currentPracticeItem.id}
                  item={currentPracticeItem}
                  index={currentPracticeIndex}
                  soundEnabled={practiceSoundEnabled}
                  onChoosePraise={choosePracticePraise}
                  onChooseEncouragement={choosePracticeEncouragement}
                  onPlayPraise={playPracticePraise}
                  onCelebrateCorrect={() => celebratePracticeProgress(currentPracticeIndex)}
                  onAdvancePractice={() => onAdvancePractice(unit.id)}
                  onSubmit={(answer) => submitPracticeQuestion(currentPracticeItem.id, currentPracticeItem.practiceGroupId, answer)}
                />
              ) : (
                <View style={styles.practiceResultCard}>
                  <View style={styles.practiceResultIcon}><Trophy size={30} color="#059669" /></View>
                  <Text style={styles.practiceResultEyebrow}>Đã hoàn thành bài luyện tập</Text>
                  <Text style={styles.practiceResultTitle}>Bạn đã hoàn thành rất tốt!</Text>
                  <Text style={styles.practiceResultSummary}>
                    Đúng {completedPracticeCount}/{practiceItems.length} câu{currentPracticeStats.wrongAttempts ? ` với ${currentPracticeStats.wrongAttempts} lượt trả lời sai.` : '.'}
                  </Text>
                  <View style={styles.practiceResultStats}>
                    <View style={styles.practiceResultStat}><Text style={styles.practiceResultValue}>{completedPracticeCount}/{practiceItems.length}</Text><Text style={styles.practiceResultLabel}>Câu đúng</Text></View>
                    <View style={styles.practiceResultStat}><Text style={styles.practiceResultValue}>{currentPracticeStats.wrongIds.length}</Text><Text style={styles.practiceResultLabel}>Câu từng trả lời sai</Text></View>
                    <View style={styles.practiceResultStat}><Text style={styles.practiceResultValue}>{Math.round((completedPracticeCount / practiceItems.length) * 100)}%</Text><Text style={styles.practiceResultLabel}>Độ chính xác</Text></View>
                    <View style={styles.practiceResultStat}><Text style={styles.practiceResultValue}>{currentPracticeStats.bestStreak}</Text><Text style={styles.practiceResultLabel}>Chuỗi đúng dài nhất</Text></View>
                  </View>
                  <View style={styles.practiceResultActions}>
                    {currentPracticeStats.wrongIds.length ? (
                      <Pressable onPress={() => setShowWrongQuestions((visible) => !visible)} style={styles.practiceSecondaryAction} accessibilityRole="button">
                        <Eye size={14} color="#334155" />
                        <Text style={styles.practiceSecondaryActionText}>{showWrongQuestions ? 'Ẩn câu đã sai' : `Xem lại câu sai (${currentPracticeStats.wrongIds.length})`}</Text>
                      </Pressable>
                    ) : null}
                    <Pressable onPress={() => void restartPractice(true)} disabled={resettingPractice} style={styles.practiceSecondaryAction} accessibilityRole="button">
                      <RotateCcw size={14} color="#334155" />
                      <Text style={styles.practiceSecondaryActionText}>{resettingPractice ? 'Đang làm lại...' : 'Làm lại bài'}</Text>
                    </Pressable>
                    <Pressable onPress={onContinuePractice} style={styles.practiceContinueAction} accessibilityRole="button">
                      <Text style={styles.practiceContinueText}>Học tiếp</Text>
                      <ChevronRight size={16} color="#FFFFFF" />
                    </Pressable>
                  </View>
                  {showWrongQuestions ? (
                    <View style={styles.practiceWrongList}>
                      {practiceItems.filter((item) => currentPracticeStats.wrongIds.includes(item.id)).map((item) => (
                        <View key={item.id} style={styles.practiceWrongItem}>
                          <Text style={styles.practiceWrongTitle}>{item.prompt || 'Câu hỏi luyện tập'}</Text>
                          {practiceAnswerSummary(item) ? <Text style={styles.practiceWrongAnswer}>Đáp án đúng: {practiceAnswerSummary(item)}</Text> : null}
                          <Text style={styles.practiceWrongCopy}>{item.explanation || 'Bạn đã trả lời sai câu này trước khi tìm được đáp án đúng.'}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.muted}>Phần luyện tập này chưa có câu hỏi.</Text>
          )}
          {practiceItems.length && currentPracticeItem && !practiceStarted ? (
            <View style={styles.practiceModalOverlay}>
              <View style={styles.practiceStartModal}>
                <View style={styles.practiceStartIcon}><Play size={24} color="#FFFFFF" fill="#FFFFFF" /></View>
                <Text style={styles.practiceStartTitle}>Sẵn sàng luyện tập?</Text>
                <Text style={styles.practiceStartCopy}>
                  Có {practiceItems.length} câu hỏi. Câu hỏi sẽ hiện và đồng hồ bắt đầu tính sau khi bạn bấm nút bên dưới.
                </Text>
                {practiceTimeLimit > 0 ? (
                  <View style={styles.practiceStartTime}><Clock3 size={14} color="#DC2626" /><Text style={styles.practiceStartTimeText}>Thời gian: {Math.floor(practiceTimeLimit / 60)}:{String(practiceTimeLimit % 60).padStart(2, '0')}</Text></View>
                ) : null}
                <Pressable
                  onPress={() => {
                    setPracticeExpired(false);
                    setStartedPracticeKey(practiceStatsKey);
                  }}
                  style={styles.practiceStartButton}
                  accessibilityRole="button"
                >
                  <Play size={15} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.practiceStartButtonText}>Bắt đầu luyện tập</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {practiceExpired ? (
            <View style={styles.practiceModalOverlay}>
              <View style={styles.practiceStartModal}>
                <View style={[styles.practiceStartIcon, styles.practiceTimeoutIcon]}><Clock3 size={24} color="#FFFFFF" /></View>
                <Text style={styles.practiceStartTitle}>Bạn đã hết thời gian</Text>
                <Pressable
                  onPress={() => void restartPractice(true)}
                  disabled={resettingPractice}
                  style={styles.practiceStartButton}
                  accessibilityRole="button"
                >
                  <RotateCcw size={15} color="#FFFFFF" />
                  <Text style={styles.practiceStartButtonText}>{resettingPractice ? 'Đang làm lại...' : 'Làm lại'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {practiceComplete ? (
            <View pointerEvents="none" style={styles.practiceCompletionFireworkOverlay}>
              {practiceCompletionRings.map((ring, index) => (
                <Animated.View
                  key={`completion-ring-${index}`}
                  style={[
                    styles.practiceFireworkRing,
                    styles.practiceCompletionFireworkRing,
                    {
                      left: '50%',
                      top: '50%',
                      borderColor: index === 0 ? '#0F766E' : '#C4A35A',
                      opacity: ring.interpolate({ inputRange: [0, 0.1, 0.82, 1], outputRange: [0, 0.9, 0.7, 0] }),
                      transform: [{ scale: ring.interpolate({ inputRange: [0, 0.9], outputRange: [0.2, 5 + index * 2] }) }],
                    },
                  ]}
                />
              ))}
              {practiceFireworkRays.map(([angle, color, size], index) => {
                const progress = practiceCompletionRays[index];
                return (
                  <Animated.View
                    key={`completion-ray-${index}`}
                    style={[
                      styles.practiceFireworkRay,
                      styles.practiceCompletionFireworkRay,
                      {
                        backgroundColor: color,
                        left: '50%',
                        top: '50%',
                        opacity: progress.interpolate({ inputRange: [0, 0.1, 0.84, 1], outputRange: [0, 1, 0.8, 0] }),
                      },
                      {
                        transform: [
                          { rotate: `${angle}deg` },
                          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 1.8] }) },
                          { scaleY: progress.interpolate({ inputRange: [0, 0.85], outputRange: [0.25, 1] }) },
                        ]
                      },
                    ]}
                  />
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}
      {!sections.length || !section ? (
        <View style={styles.contentCard}>
          <CheckCircle2 size={23} color="#059669" />
          <Text style={styles.contentTitle}>{sections.length ? 'Đã hoàn thành nội dung bài học' : 'Bài học chưa có nội dung'}</Text>
          <Text style={styles.muted}>{sections.length ? 'Bạn đã hoàn thành tất cả phần học có trong bài này.' : 'Bài học này chưa có nội dung hoặc luyện tập.'}</Text>
        </View>
      ) : null}
    </View>
  );
}

function UnitNavigationBar({
  previousUnit,
  nextUnit,
  onNavigateUnit,
}: {
  previousUnit: LessonPracticeUnit | null;
  nextUnit: LessonPracticeUnit | null;
  onNavigateUnit: (unit: LessonPracticeUnit) => void;
}) {
  return (
    <View style={styles.unitNavigation}>
      <Pressable
        onPress={() => previousUnit && onNavigateUnit(previousUnit)}
        disabled={!previousUnit || previousUnit.locked}
        style={[styles.unitNavigationButton, styles.previousUnitButton, (!previousUnit || previousUnit.locked) && styles.unitNavigationButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel={previousUnit ? `Bài trước: ${previousUnit.title}` : 'Không có bài học trước'}
      >
        <ArrowLeft size={17} color={previousUnit && !previousUnit.locked ? colors.brand : colors.muted} />
        <View style={styles.unitNavigationCopy}>
          <Text style={styles.unitNavigationLabel}>Bài trước</Text>
          <Text numberOfLines={1} style={styles.unitNavigationTitle}>{previousUnit?.title || 'Không có'}</Text>
        </View>
      </Pressable>
      <Pressable
        onPress={() => nextUnit && onNavigateUnit(nextUnit)}
        disabled={!nextUnit || nextUnit.locked}
        style={[styles.unitNavigationButton, styles.nextUnitButton, (!nextUnit || nextUnit.locked) && styles.unitNavigationButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel={nextUnit ? `Bài tiếp theo: ${nextUnit.title}${nextUnit.locked ? ', đang khóa' : ''}` : 'Đã đến bài học cuối cùng'}
      >
        <View style={styles.unitNavigationCopy}>
          <Text style={[styles.unitNavigationLabel, nextUnit && !nextUnit.locked && styles.nextUnitNavigationLabel]}>Bài tiếp theo</Text>
          <Text numberOfLines={1} style={[styles.unitNavigationTitle, nextUnit && !nextUnit.locked && styles.nextUnitNavigationTitle]}>{nextUnit?.title || 'Đã đến bài cuối'}</Text>
        </View>
        <ChevronRight size={17} color={nextUnit && !nextUnit.locked ? '#FFFFFF' : colors.muted} />
      </Pressable>
    </View>
  );
}

function SectionNavigationBar({
  sections,
  currentIndex,
  currentDone,
  onNavigateSection,
}: {
  sections: UnitLearningSection[];
  currentIndex: number;
  currentDone: boolean;
  onNavigateSection: (sectionId: string) => void;
}) {
  const previousSection = currentIndex > 0 ? sections[currentIndex - 1] : null;
  const nextSection = currentIndex >= 0 ? sections[currentIndex + 1] || null : null;
  return (
    <View style={styles.sectionNavigation}>
      <Pressable
        onPress={() => previousSection && onNavigateSection(previousSection.id)}
        disabled={!previousSection}
        style={[styles.sectionNavigationButton, styles.previousSectionButton, !previousSection && styles.unitNavigationButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel={previousSection ? `Mục trước: ${previousSection.title}` : 'Không có mục trước'}
      >
        <ArrowLeft size={15} color={previousSection ? colors.brand : colors.muted} />
        <Text numberOfLines={1} style={styles.sectionNavigationLabel}>{previousSection?.title || 'Mục trước'}</Text>
      </Pressable>
      <Pressable
        onPress={() => nextSection && onNavigateSection(nextSection.id)}
        disabled={!nextSection || !currentDone}
        style={[
          styles.sectionNavigationButton,
          styles.nextSectionButton,
          (!nextSection || !currentDone) && styles.unitNavigationButtonDisabled,
        ]}
        accessibilityRole="button"
        accessibilityLabel={nextSection ? `Mục tiếp theo: ${nextSection.title}${!currentDone ? ', hoàn thành mục hiện tại trước' : ''}` : 'Đã đến mục cuối cùng'}
      >
        <Text numberOfLines={1} style={styles.sectionNavigationLabel}>{nextSection?.title || 'Mục tiếp theo'}</Text>
        <ChevronRight size={15} color={nextSection && currentDone ? colors.brand : colors.muted} />
      </Pressable>
    </View>
  );
}

type VideoLessonTab = 'overview' | 'qa' | 'notes' | 'reviews' | 'resources';
const videoLessonTabs: Array<{ id: VideoLessonTab; label: string; icon: typeof Layers3 }> = [
  { id: 'overview', label: 'Tổng quan', icon: Layers3 },
  { id: 'qa', label: 'Hỏi đáp', icon: MessageSquare },
  { id: 'notes', label: 'Ghi chú', icon: StickyNote },
  { id: 'reviews', label: 'Đánh giá', icon: Star },
  { id: 'resources', label: 'Tài liệu', icon: FileText },
];

const getEmbeddedVideoUrl = embeddedVideoUrl;

function VideoLessonPane({
  unit,
  subjectName,
  video,
  done,
  antiSeekEnabled,
  courseId,
  courseTitle,
  userId,
  enabled,
  resources,
  onOpenVideo,
  onComplete,
}: {
  unit: LessonPracticeUnit;
  subjectName: string;
  video: { id: string; title: string; url: string } | undefined;
  done: boolean;
  antiSeekEnabled: boolean;
  courseId: string;
  courseTitle: string;
  userId: string;
  enabled: boolean;
  resources: NonNullable<LessonPracticeCourse['files']>;
  onOpenVideo: (url: string) => void;
  onComplete: () => Promise<boolean>;
}) {
  const [activeTab, setActiveTab] = useState<VideoLessonTab>('overview');
  const [started, setStarted] = useState(false);
  const [videoProgress, setVideoProgress] = useState<VideoPlayerProgress>({
    currentTime: 0,
    duration: 0,
    watchedSeconds: 0,
    completed: done,
    playing: false,
  });
  const playerApiRef = useRef<VideoPlayerApi | null>(null);
  const rawUrl = video?.url || '';
  const url = playableVideoUrl(rawUrl);
  const embeddedUrl = getEmbeddedVideoUrl(url);
  const directVideo = isDirectVideoUrl(url);
  const invalidLink = Boolean(rawUrl) && !url;

  // Luôn phát ngay trong khung; link không phát được thì báo tại chỗ, không mở sang tab/ứng dụng khác.
  const startVideo = () => {
    if (url) setStarted(true);
  };

  return (
    <View style={styles.videoLessonCard}>
      <View style={styles.videoLessonHeading}>
        <View style={styles.videoLessonTitleRow}>
          <Clapperboard size={17} color={colors.brand} />
          <Text style={styles.videoLessonTitle}>{video?.title || 'Video bài giảng'}</Text>
        </View>
        {done ? (
          <View style={styles.videoDoneBadge}>
            <CheckCircle2 size={13} color="#059669" />
            <Text style={styles.videoDoneBadgeText}>Đã xong</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.videoFrame}>
        {started && (embeddedUrl || directVideo) ? (
          <VideoPlayerFrame
            videoUrl={resolveMobilePublicUrl(url)}
            embeddedUrl={embeddedUrl}
            title={video?.title || unit.title}
            lessonId={`${userId || 'anon'}-${unit.id}-${video?.id || 'video'}`}
            antiSeekEnabled={antiSeekEnabled}
            done={done}
            playerApiRef={playerApiRef}
            onProgress={setVideoProgress}
            onWatched={onComplete}
          />
        ) : (
          <View style={styles.videoStartOverlay}>
            <View style={styles.videoBrandBadge}><Text style={styles.videoBrandText}>Thắng Tin Học</Text></View>
            <Pressable
              onPress={startVideo}
              disabled={!url}
              style={[styles.videoStartButton, !url && styles.actionDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Bắt đầu phát video"
            >
              <Play size={25} color="#FFFFFF" fill="#FFFFFF" />
            </Pressable>
            <Text style={styles.videoStartLabel}>
              {url ? 'Nhấn để bắt đầu học' : invalidLink ? 'Liên kết video chưa đúng — trung tâm sẽ cập nhật sớm' : 'Video chưa có liên kết'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.videoTabBar} accessibilityRole="tablist">
        {videoLessonTabs.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.videoTab, active && styles.videoTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Icon size={15} color={active ? colors.brand : '#64748B'} />
              <Text style={[styles.videoTabText, active && styles.videoTabTextActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.videoOverview}>
        {activeTab === 'overview' ? (
          <>
            <View style={styles.videoOverviewHeading}>
              <View style={styles.flex}>
                <Text style={styles.videoSubjectEyebrow}>{subjectName || unit.title}</Text>
                <Text style={styles.videoOverviewTitle}>{video?.title || unit.title}</Text>
              </View>
              {done ? (
                <View style={styles.videoDoneBadge}>
                  <CheckCircle2 size={13} color="#059669" />
                  <Text style={styles.videoDoneBadgeText}>Đã xong</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.videoDescriptionLabel}>Mô tả bài giảng</Text>
            <Text style={styles.videoDescription}>
              Theo dõi video để nắm kiến thức. Hệ thống ghi nhận tiến độ khi bạn xem đủ thời lượng yêu cầu.
            </Text>
            <Text style={styles.videoDescription}>
              {done
                ? 'Đã xem đủ thời lượng yêu cầu. Bạn có thể xem lại video.'
                : `Đã xem ${Math.floor(videoProgress.watchedSeconds)} giây${videoProgress.duration ? ` · ${Math.round((videoProgress.watchedSeconds / videoProgress.duration) * 100)}%` : ''}. Xem tối thiểu 70% video để hoàn thành mục này${antiSeekEnabled ? ' (không thể tua vượt phần đã xem)' : ''}.`}
            </Text>
          </>
        ) : (
          <VideoLessonTabs
            activeTab={activeTab}
            courseId={courseId}
            courseTitle={subjectName || courseTitle}
            lessonId={`${unit.id}-${video?.id || 'video'}`}
            lessonTitle={video?.title || unit.title}
            userId={userId}
            enabled={enabled}
            videoUrl={url}
            resources={resources}
            currentTime={videoProgress.currentTime || playerApiRef.current?.getCurrentTime() || 0}
            videoDuration={videoProgress.duration || playerApiRef.current?.getDuration() || 0}
          />
        )}
      </View>
    </View>
  );
}

function PracticeQuestion({
  item,
  index,
  soundEnabled,
  onChoosePraise,
  onChooseEncouragement,
  onPlayPraise,
  onCelebrateCorrect,
  onAdvancePractice,
  onSubmit,
}: {
  item: NonNullable<LessonPracticeUnit['items']>[number];
  index: number;
  soundEnabled: boolean;
  onChoosePraise: () => PracticePraise;
  onChooseEncouragement: () => string;
  onPlayPraise: (audio: number) => void;
  onCelebrateCorrect: () => void;
  onAdvancePractice: () => Promise<void>;
  onSubmit: (answer: Record<string, unknown>) => Promise<LessonPracticeItem | null>;
}) {
  const [selected, setSelected] = useState<string[]>(() => item.type === 'drag' ? item.options?.map((option) => option.id) || [] : []);
  const [written, setWritten] = useState('');
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [feedback, setFeedback] = useState(item.feedback || '');
  const [submitting, setSubmitting] = useState(false);
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showHint, setShowHint] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [praise, setPraise] = useState<PracticePraise | null>(null);
  const [encouragement, setEncouragement] = useState('');
  const wrongSoundPlayer = useAudioPlayer(require('../assets/audio/practice-wrong.wav'));
  const feedbackScale = useRef(new Animated.Value(0.8)).current;
  const feedbackEntry = useRef(new Animated.Value(0)).current;
  const feedbackShimmer = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const isConfirmed = item.confirmed && item.correct;
  const options = item.options || [];
  const readyToSubmit = item.type === 'mcq' ? selected.length > 0
    : item.type === 'multi' ? selected.length > 0
      : item.type === 'written' ? Boolean(written.trim())
        : item.type === 'hotspot' ? Boolean(point)
          : item.type === 'match' ? Boolean(item.lefts?.length && item.lefts.every((left) => matches[left.id]))
            : item.type === 'drag' ? selected.length === options.length : false;

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const submit = async () => {
    if (submitting || !readyToSubmit || answerState === 'correct' || cooldown > 0) return;
    let answer: Record<string, unknown>;
    if (item.type === 'mcq') answer = { choiceId: selected[0] || '' };
    else if (item.type === 'multi') answer = { choiceIds: selected };
    else if (item.type === 'written') answer = { text: written };
    else if (item.type === 'hotspot') answer = point || {};
    else if (item.type === 'match') {
      answer = { matches: (item.lefts || []).map((left) => ({ leftId: left.id, rightId: matches[left.id] || '' })) };
    } else if (item.type === 'drag') answer = { order: selected };
    else return;
    if (soundEnabled) unlockPracticeFeedbackAudio();
    setSubmitting(true);
    try {
      const result = await onSubmit(answer);
      if (!result) return;
      const correct = result.confirmed === true && result.correct === true;
      setAnswerState(correct ? 'correct' : 'wrong');
      const selectedPraise = correct ? onChoosePraise() : null;
      setPraise(selectedPraise);
      setEncouragement(correct ? '' : onChooseEncouragement());
      const resultFeedback = result.feedback || result.explanation || '';
      setFeedback(!correct && resultFeedback.trim() === 'Bạn sai rồi, vui lòng chọn lại đáp án'
        ? ''
        : resultFeedback || (correct ? 'Bạn đã chọn đúng đáp án!' : 'Mình cùng xem lại câu hỏi rồi thử tiếp nhé.'));
      if (correct) onCelebrateCorrect();
      if (soundEnabled) {
        if (correct && selectedPraise) {
          onPlayPraise(selectedPraise.audio);
        } else if (Platform.OS === 'web') {
          playWebPracticeFeedbackSound(false);
        } else {
          void wrongSoundPlayer.seekTo(0)
            .then(() => wrongSoundPlayer.play())
            .catch((error: unknown) => console.warn('Không thể phát âm thanh luyện tập.', error));
        }
      }
      feedbackScale.setValue(0.45);
      feedbackEntry.setValue(0);
      if (correct) {
        feedbackShimmer.setValue(0);
        Animated.parallel([
          Animated.spring(feedbackScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 12 }),
          Animated.timing(feedbackEntry, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(feedbackShimmer, { toValue: 1, duration: 1050, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.parallel([
          Animated.spring(feedbackScale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 10 }),
          Animated.timing(feedbackEntry, { toValue: 1, duration: 420, useNativeDriver: true }),
        ]).start();
        Animated.sequence([
          Animated.timing(shake, { toValue: 8, duration: 45, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -8, duration: 70, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 5, duration: 55, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
        ]).start();
        if (['mcq', 'multi', 'match', 'drag', 'hotspot'].includes(item.type)) setCooldown(10);
      }
      if (correct) {
        await onAdvancePractice();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleOption = (id: string) => {
    setAnswerState('idle');
    setFeedback('');
    if (item.type === 'mcq') setSelected([id]);
    else setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };

  return (
    <Animated.View style={[styles.practiceQuestion, { transform: [{ translateX: shake }] }]}>
      <Text style={styles.practiceQuestionEyebrow}>Câu {index + 1}</Text>
      <Text style={styles.practiceQuestionTitle}>{item.prompt || 'Bài luyện tập'}</Text>
      {item.imageUrl ? (
        <Pressable
          onLayout={(event) => setImageSize({
            width: Math.max(1, event.nativeEvent.layout.width),
            height: Math.max(1, event.nativeEvent.layout.height),
          })}
          onPress={(event) => {
            const { locationX, locationY } = event.nativeEvent;
            setPoint({ x: (locationX / imageSize.width) * 100, y: (locationY / imageSize.height) * 100 });
            setAnswerState('idle');
            setFeedback('');
          }}
          style={styles.practiceImageWrap}
        >
          <Image source={{ uri: resolveMobilePublicUrl(item.imageUrl) }} style={styles.practiceImage} resizeMode="contain" />
          {point ? <View style={[styles.practiceHotspot, { left: `${point.x}%`, top: `${point.y}%` }]} /> : null}
        </Pressable>
      ) : null}
      {item.caption ? <Text style={styles.muted}>{item.caption}</Text> : null}
      {(item.type === 'mcq' || item.type === 'multi') ? options.map((option, optionIndex) => (
        <Pressable
          key={option.id}
          onPress={() => toggleOption(option.id)}
          disabled={Boolean(isConfirmed) || answerState === 'correct' || cooldown > 0}
          style={[
            styles.practiceChoice,
            selected.includes(option.id) && styles.practiceChoiceSelected,
            selected.includes(option.id) && answerState === 'wrong' && styles.practiceChoiceWrong,
            selected.includes(option.id) && answerState === 'correct' && styles.practiceChoiceCorrect,
          ]}
        >
          <View style={[styles.practiceOptionNumber, selected.includes(option.id) && styles.practiceOptionNumberSelected]}>
            <Text style={[styles.practiceOptionNumberText, selected.includes(option.id) && styles.practiceOptionNumberTextSelected]}>{optionIndex + 1}</Text>
          </View>
          <Text style={[
            styles.practiceOption,
            selected.includes(option.id) && styles.practiceChoiceTextSelected,
            selected.includes(option.id) && answerState === 'wrong' && styles.practiceChoiceTextWrong,
            selected.includes(option.id) && answerState === 'correct' && styles.practiceChoiceTextCorrect,
          ]}>{option.text}</Text>
        </Pressable>
      )) : null}
      {item.type === 'written' ? (
        <TextInput value={written} onChangeText={(value) => { setWritten(value); setAnswerState('idle'); setFeedback(''); }} multiline placeholder="Nhập câu trả lời..." style={styles.practiceInput} editable={!isConfirmed && answerState !== 'correct' && cooldown === 0} />
      ) : null}
      {item.type === 'match' ? (item.lefts || []).map((left) => (
        <View key={left.id} style={styles.practiceMatchRow}>
          <Text style={styles.practiceOption}>{left.text}</Text>
          <View style={styles.practiceMatchOptions}>
            {(item.rights || []).map((right) => (
              <Pressable
                key={right.id}
                onPress={() => { setMatches((current) => ({ ...current, [left.id]: right.id })); setAnswerState('idle'); setFeedback(''); }}
                disabled={answerState === 'correct' || cooldown > 0}
                style={[styles.practiceChoice, matches[left.id] === right.id && styles.practiceChoiceSelected]}
              >
                <Text style={[styles.practiceOption, matches[left.id] === right.id && styles.practiceChoiceTextSelected]}>{right.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )) : null}
      {item.type === 'drag' ? options.map((option, optionIndex) => (
        <View key={option.id} style={styles.practiceDragRow}>
          <Text style={styles.practiceOption}>{options.find((entry) => entry.id === selected[optionIndex])?.text || option.text}</Text>
          <Pressable disabled={answerState === 'correct' || cooldown > 0} onPress={() => {
            setAnswerState('idle'); setFeedback('');
            setSelected((current) => {
              const next = current.length ? [...current] : options.map((entry) => entry.id);
              if (optionIndex > 0) [next[optionIndex - 1], next[optionIndex]] = [next[optionIndex], next[optionIndex - 1]];
              return next;
            });
          }} accessibilityRole="button" accessibilityLabel="Di chuyển lên"><ChevronUp size={18} color={colors.brand} /></Pressable>
          <Pressable disabled={answerState === 'correct' || cooldown > 0} onPress={() => {
            setAnswerState('idle'); setFeedback('');
            setSelected((current) => {
              const next = current.length ? [...current] : options.map((entry) => entry.id);
              if (optionIndex < next.length - 1) [next[optionIndex + 1], next[optionIndex]] = [next[optionIndex], next[optionIndex + 1]];
              return next;
            });
          }} accessibilityRole="button" accessibilityLabel="Di chuyển xuống"><ChevronDown size={18} color={colors.brand} /></Pressable>
        </View>
      )) : null}
      {item.hint ? (
        <View style={styles.practiceHintWrap}>
          <Pressable onPress={() => setShowHint((visible) => !visible)} style={styles.practiceHintButton} accessibilityRole="button">
            <Lightbulb size={14} color="#B45309" />
            <Text style={styles.practiceHintButtonText}>{showHint ? 'Ẩn gợi ý' : 'Gợi ý'}</Text>
          </Pressable>
          {showHint ? <Text style={styles.practiceHintText}>{item.hint}</Text> : null}
        </View>
      ) : null}
      {answerState !== 'idle' ? (
        <View style={styles.practiceFeedbackWrap}>
          <Animated.View style={[
            styles.practiceResultBanner,
            answerState === 'correct' ? styles.practiceResultCorrect : styles.practiceResultWrong,
            {
              opacity: feedbackEntry,
              transform: [{ translateY: feedbackEntry.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            },
          ]}>
            {answerState === 'correct' ? (
              <Animated.View style={[
                styles.practiceFeedbackIcon,
                styles.practiceFeedbackIconCorrect,
                { transform: [{ scale: feedbackScale }] },
              ]}>
                <Text style={styles.practiceFeedbackEmoji}>{praise?.icon || '🌟'}</Text>
              </Animated.View>
            ) : (
              <Animated.View style={[
                styles.practiceFeedbackIcon,
                styles.practiceFeedbackIconWrong,
                { transform: [{ scale: feedbackScale }] },
              ]}>
                <CircleHelp size={20} color="#B45309" />
              </Animated.View>
            )}
            <View style={styles.flex}>
              <Text style={answerState === 'correct' ? styles.practiceSuccess : styles.practiceFeedback}>
                {answerState === 'correct' ? praise?.text || 'Tuyệt vời!' : encouragement || 'Cố lên nhé!'}
              </Text>
              <Text style={answerState === 'correct' ? styles.practiceSuccess : styles.practiceFeedback}>
                {answerState === 'correct' ? praise?.detail || feedback : feedback || 'Mình cùng xem lại câu hỏi rồi thử tiếp nhé.'}
              </Text>
            </View>
            {answerState === 'correct' ? (
              <>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.practiceFeedbackShimmer,
                    { transform: [{ translateX: feedbackShimmer.interpolate({ inputRange: [0, 1], outputRange: [-240, 360] }) }] },
                  ]}
                />
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.practiceFeedbackSparkle,
                    styles.practiceFeedbackSparkleOne,
                    {
                      opacity: feedbackEntry,
                      transform: [{ scale: feedbackEntry.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1.15, 1] }) }],
                    },
                  ]}
                >
                  <Sparkles size={16} color="#10B981" />
                </Animated.View>
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.practiceFeedbackSparkle,
                    styles.practiceFeedbackSparkleTwo,
                    {
                      opacity: feedbackEntry,
                      transform: [{ scale: feedbackEntry.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1.15, 1] }) }],
                    },
                  ]}
                >
                  <Sparkles size={21} color="#F59E0B" />
                </Animated.View>
              </>
            ) : null}
          </Animated.View>
        </View>
      ) : null}
      {isConfirmed || answerState === 'correct' ? null : (
        <Pressable onPress={() => void submit()} disabled={submitting || !readyToSubmit || cooldown > 0} style={[styles.completeSectionButton, (submitting || !readyToSubmit || cooldown > 0) && styles.actionDisabled]}>
          <Text style={styles.completeSectionButtonText}>
            {submitting ? 'Đang kiểm tra...' : cooldown > 0 ? `Thử lại sau ${cooldown} giây` : 'Kiểm tra đáp án'}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screenContent: { gap: spacing.md },
  relatedTopics: {
    height: RELATED_STRIP_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB',
  },
  relatedTopicsTitle: { color: '#92400E', fontSize: 12, fontWeight: '900' },
  relatedTopicsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  relatedTopicChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1, borderColor: '#FCD34D', backgroundColor: colors.surface,
  },
  relatedTopicText: { color: colors.ink, fontSize: 12, fontWeight: '800', flexShrink: 1 },
  headerBand: { marginHorizontal: -spacing.xl, marginTop: -spacing.md, marginBottom: -spacing.sm, paddingHorizontal: spacing.xl, paddingTop: spacing.md, backgroundColor: '#F1F5F9' },
  headerGroup: { marginBottom: spacing.sm },
  courseCardWrap: { width: '100%', position: 'relative' },
  courseCardWrapActive: { zIndex: 20 },
  filters: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'nowrap', gap: 0, marginHorizontal: -spacing.xl, paddingHorizontal: spacing.lg, marginBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#E8EDF3', backgroundColor: colors.surface },
  filterChip: { minWidth: 0, minHeight: 68, flex: 1, flexBasis: 0, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2, paddingVertical: 4, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  filterChipActive: { borderBottomColor: colors.brand },
  filterIconWrap: { position: 'relative', width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  filterText: { minHeight: 24, color: '#64748B', fontSize: typography.micro, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  filterTextActive: { color: colors.brandDark, fontWeight: '900' },
  filterCount: { position: 'absolute', top: -5, right: -7, minWidth: 15, paddingHorizontal: 4, paddingVertical: 1, overflow: 'hidden', borderWidth: 1.5, borderColor: colors.surface, borderRadius: radius.pill, backgroundColor: '#E2E8F0', color: '#475569', textAlign: 'center', fontSize: typography.micro, fontWeight: '900' },
  filterCountActive: { backgroundColor: colors.brand, color: colors.surface },
  courseSection: { width: '100%', alignSelf: 'stretch', marginTop: spacing.xs, gap: spacing.md },
  courseList: { width: '100%', gap: spacing.md },
  registeredCourseCard: { width: '100%', alignSelf: 'stretch' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.line },
  sectionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  registeredIcon: { backgroundColor: '#D1FAE5' },
  videoIcon: { backgroundColor: '#FEF3C7' },
  instructorIcon: { backgroundColor: '#E0F2FE' },
  sectionCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#94A3B8', fontSize: typography.micro, fontWeight: '900', letterSpacing: 1.4 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionTitle: { flexShrink: 1, color: colors.ink, fontSize: typography.small, fontWeight: '900' },
  sectionCount: { minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, textAlign: 'center', fontSize: typography.micro, fontWeight: '800' },
  registeredCount: { backgroundColor: '#D1FAE5', color: '#047857' },
  videoCount: { backgroundColor: '#FEF3C7', color: '#92400E' },
  instructorCount: { backgroundColor: '#E0F2FE', color: '#075985' },
  sectionDescription: { marginTop: 3, color: colors.muted, fontSize: typography.micro, lineHeight: 15 },
  courseCard: { flex: 1, gap: 0, overflow: 'hidden', padding: 0 },
  courseCardContent: { flex: 1 },
  courseCardHovered: { borderColor: '#CBD5E1', shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  courseBanner: { height: 94, position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bannerRing: { position: 'absolute', width: 142, height: 142, right: -38, top: -49, borderWidth: 18, borderRadius: 80 },
  lockBadge: { position: 'absolute', left: 10, top: 10, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#FEF3C7' },
  courseMode: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 1, borderColor: '#FFFFFF', borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.96)' },
  courseModeText: { color: colors.ink, fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.4 },
  offerBadge: { position: 'absolute', top: 9, right: 9, paddingHorizontal: 9, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.95)' },
  offerText: { color: colors.ink, fontSize: typography.micro, fontWeight: '800' },
  courseInfo: { height: 180, padding: spacing.md, paddingBottom: spacing.sm },
  courseTitle: { minHeight: 34, color: colors.ink, fontSize: typography.caption, lineHeight: 16, fontWeight: '900' },
  subjectChips: { minHeight: 35, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 4, marginTop: 5 },
  subjectLabel: { paddingTop: 4, color: colors.muted, fontSize: typography.micro },
  subjectChip: { maxWidth: 140, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden', borderRadius: 5, backgroundColor: '#EFF6FF', color: '#2563EB', fontSize: typography.micro },
  subjectChipRose: { backgroundColor: '#FFF1F2', color: '#E11D48' },
  subjectChipViolet: { backgroundColor: '#F5F3FF', color: '#7C3AED' },
  subjectChipAmber: { backgroundColor: '#FFFBEB', color: '#D97706' },
  courseFooter: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 'auto', paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  progressCircle: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D1DCE7', borderRadius: 13 },
  progressText: { color: colors.ink, fontSize: typography.micro, fontWeight: '900' },
  lessonCount: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  enrolledBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: '#ECFDF5', color: '#047857', fontSize: typography.micro, fontWeight: '900' },
  priceText: { color: colors.ink, fontSize: typography.small, fontWeight: '900' },
  courseActions: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, borderTopWidth: 1, borderTopColor: colors.line },
  courseInfoButton: { position: 'absolute', top: 10, left: 42, width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.75)', backgroundColor: 'rgba(255,255,255,0.94)' },
  courseTooltip: { position: 'absolute', top: 76, left: 10, right: 10, zIndex: 30, gap: 7, padding: spacing.md, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.md, backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  tooltipTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  tooltipHeading: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  tooltipLine: { color: '#475569', fontSize: typography.caption, lineHeight: 16 },
  tooltipWarning: { marginTop: 2, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: '#FEE2E2', color: colors.ink, fontSize: typography.micro, lineHeight: 15, fontWeight: '700' },
  registerButton: { minHeight: 32, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.sm, backgroundColor: '#ECFDF5' },
  registerText: { color: '#047857', fontSize: typography.micro, fontWeight: '900' },
  openButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: '#FEF2F2' },
  openButtonActive: { backgroundColor: '#ECFDF5' },
  openButtonText: { color: '#B91C1C', fontSize: typography.micro, fontWeight: '900' },
  openButtonTextActive: { color: '#047857' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-start', backgroundColor: 'rgba(15,23,42,0.55)' },
  modalCard: { width: '100%', height: '100%', maxHeight: '100%', paddingTop: spacing.md, borderRadius: 0, backgroundColor: colors.surface },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.line },
  modalBack: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA', borderRadius: radius.md, backgroundColor: '#FFF7F7' },
  headerLessonNav: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  headerLessonNavOpen: { borderColor: '#FECACA', backgroundColor: '#FFF7F7' },
  headerLessonNavText: { color: colors.brandDark, fontSize: typography.micro, fontWeight: '900' },
  modalTitle: { marginTop: 3, color: colors.ink, fontSize: typography.heading, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: typography.micro },
  backText: { paddingTop: spacing.md, color: colors.brand, fontSize: typography.caption, fontWeight: '800' },
  modalClose: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: colors.line },
  closeText: { color: colors.muted, fontSize: typography.title, lineHeight: 25 },
  modalContent: { flex: 1, minHeight: 0 },
  modalContentScroll: { flex: 1 },
  modalContentInner: { gap: spacing.sm, padding: spacing.lg },
  subjectCard: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
  unitNumber: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.canvas },
  unitNumberDone: { backgroundColor: '#D1FAE5' },
  unitNumberText: { color: colors.muted, fontSize: typography.caption, fontWeight: '900' },
  unitTitle: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  progressTrack: { height: 5, marginTop: 7, overflow: 'hidden', borderRadius: 3, backgroundColor: colors.line },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#10B981' },
  unitsIntro: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  unitsIntroIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#FFF1F2' },
  unitsIntroTitle: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  unitRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.md, backgroundColor: colors.surface },
  unitRowLocked: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  unitRowCompleted: { borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
  unitRowBusy: { opacity: 0.65 },
  unitNumberLocked: { backgroundColor: '#E2E8F0' },
  unitTitleLocked: { color: '#64748B' },
  unitStatus: { marginTop: 4, color: colors.muted, fontSize: typography.micro, lineHeight: 16 },
  unitStatusLocked: { color: '#94A3B8' },
  unitAction: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 10, borderRadius: radius.sm, backgroundColor: colors.brand },
  unitActionLocked: { backgroundColor: '#E2E8F0' },
  unitActionCompleted: { backgroundColor: '#D1FAE5' },
  unitActionText: { color: colors.surface, fontSize: typography.micro, fontWeight: '900' },
  unitActionTextLocked: { color: '#64748B' },
  unitActionTextCompleted: { color: '#047857' },
  lessonPage: { position: 'relative', flex: 1, minHeight: 0, gap: spacing.sm, padding: spacing.sm },
  lessonMainColumn: { zIndex: 0, flex: 1, minWidth: 0 },
  lessonMainContent: { gap: spacing.md, padding: spacing.sm, paddingBottom: spacing.xl },
  lessonNavigationFooter: { flexShrink: 0, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  lessonDrawerOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
  lessonDrawerBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.35)' },
  lessonDrawer: { height: '100%', marginLeft: 'auto', padding: spacing.md, borderLeftWidth: 1, borderLeftColor: '#E2E8F0', backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: -6, height: 0 }, elevation: 12 },
  lessonDrawerTitle: { marginBottom: spacing.sm, color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  unitNavTopScroll: { flexGrow: 0, flexShrink: 1, maxHeight: '42%' },
  unitNavToggle: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  unitNavToggleOpen: { borderColor: '#FECACA', backgroundColor: '#FFF7F7' },
  unitNavToggleIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#FFF1F2' },
  unitNavToggleTitle: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  unitNavToggleSubtitle: { marginTop: 2, color: colors.muted, fontSize: typography.micro },
  unitNavList: { gap: spacing.xs, padding: spacing.sm, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  unitNavItem: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 11, backgroundColor: '#FFFFFF' },
  unitNavItemActive: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  unitNavItemLocked: { backgroundColor: '#F1F5F9' },
  unitNavNumber: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#F1F5F9' },
  unitNavNumberActive: { backgroundColor: colors.brand },
  unitNavNumberLocked: { backgroundColor: '#E2E8F0' },
  unitNavNumberText: { color: '#475569', fontSize: typography.micro, fontWeight: '900' },
  unitNavNumberTextActive: { color: '#FFFFFF' },
  unitNavItemTitle: { flex: 1, color: colors.ink, fontSize: typography.caption, fontWeight: '800' },
  unitNavItemTitleActive: { color: '#B91C1C' },
  unitNavItemTitleLocked: { color: '#94A3B8' },
  unitNavCurrent: { color: '#B91C1C', fontSize: typography.micro, fontWeight: '900' },
  lessonNavGroup: { gap: 2 },
  unitNavSubItem: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: 26, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 9, backgroundColor: '#FFFFFF' },
  unitNavSubItemActive: { borderColor: colors.brand, backgroundColor: '#FEF2F2' },
  unitNavSubItemLocked: { backgroundColor: '#F1F5F9' },
  unitNavSubItemText: { flex: 1, color: '#334155', fontSize: typography.micro, fontWeight: '700' },
  unitNavSubItemTextActive: { color: colors.brandDark },
  unitNavReplay: { color: '#047857', fontSize: typography.micro, fontWeight: '900' },
  unitDetails: { position: 'relative', gap: spacing.md },
  sectionCelebration: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 5, overflow: 'visible' },
  sectionFireworkParticle: { position: 'absolute', width: 6, height: 9, borderRadius: 2 },
  videoPlay: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.blueSoft },
  videoLessonCard: { overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, backgroundColor: '#FFFFFF' },
  videoLessonHeading: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  videoLessonTitleRow: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  videoLessonTitle: { flexShrink: 1, color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  videoDoneBadge: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderWidth: 1, borderColor: '#A7F3D0', borderRadius: radius.pill, backgroundColor: '#ECFDF5' },
  videoDoneBadgeText: { color: '#047857', fontSize: typography.micro, fontWeight: '900' },
  videoFrame: { position: 'relative', width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', marginTop: spacing.sm, borderRadius: 16, backgroundColor: '#080D19' },
  videoStartOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#080D19' },
  videoBrandBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, backgroundColor: colors.brand },
  videoBrandText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.6 },
  videoStartButton: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: '#EF4444', shadowColor: '#EF4444', shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  videoStartLabel: { marginTop: spacing.sm, color: '#E2E8F0', fontSize: typography.caption, fontWeight: '800' },
  videoTabBar: { flexDirection: 'row', flexWrap: 'nowrap', marginTop: spacing.xs, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  videoTab: { flex: 1, minWidth: 0, minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 3, paddingHorizontal: 1, paddingVertical: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  videoTabActive: { borderBottomColor: colors.brand, backgroundColor: '#FEF2F2' },
  videoTabText: { color: '#64748B', fontSize: typography.micro, lineHeight: 14, fontWeight: '700', textAlign: 'center' },
  videoTabTextActive: { color: colors.brandDark, fontWeight: '900' },
  videoOverview: { minHeight: 155, gap: spacing.sm, padding: spacing.md },
  videoOverviewHeading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm },
  videoSubjectEyebrow: { color: '#047857', fontSize: typography.micro, fontWeight: '900', letterSpacing: 1.1 },
  videoOverviewTitle: { marginTop: 5, color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  videoDescriptionLabel: { marginTop: spacing.xs, color: '#64748B', fontSize: typography.micro, fontWeight: '900', letterSpacing: 1.1 },
  videoDescription: { color: '#475569', fontSize: typography.caption, lineHeight: 21 },
  videoCompleteButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.brand },
  videoTabContent: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.canvas },
  videoTabEmpty: { minHeight: 60, justifyContent: 'center', paddingVertical: spacing.xs },
  contentCard: { gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.canvas },
  contentTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  unitNavigation: { flexDirection: 'row', gap: spacing.sm },
  sectionNavigation: { flexDirection: 'row', gap: spacing.sm },
  sectionNavigationButton: { minHeight: 38, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  previousSectionButton: { justifyContent: 'flex-start' },
  nextSectionButton: { justifyContent: 'flex-end' },
  sectionNavigationLabel: { flexShrink: 1, color: colors.ink, fontSize: typography.micro, fontWeight: '800' },
  unitNavigationButton: { minHeight: 58, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  previousUnitButton: { justifyContent: 'flex-start' },
  nextUnitButton: { justifyContent: 'flex-end', borderColor: colors.brand, backgroundColor: colors.brand },
  unitNavigationButtonDisabled: { borderColor: '#E2E8F0', backgroundColor: '#F1F5F9' },
  unitNavigationCopy: { flex: 1, minWidth: 0 },
  unitNavigationLabel: { color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  unitNavigationTitle: { marginTop: 2, color: colors.ink, fontSize: typography.micro, fontWeight: '900' },
  nextUnitNavigationLabel: { color: '#FEE2E2' },
  nextUnitNavigationTitle: { color: '#FFFFFF' },
  completeSectionButton: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.brand },
  completeSectionButtonText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '900' },
  actionDisabled: { opacity: 0.55 },
  practiceCard: { position: 'relative', gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderColor: '#DBEAFE', borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  practiceContent: { gap: spacing.sm },
  practiceProgressArea: { position: 'relative', gap: spacing.xs },
  practiceProgressFireworkOverlay: { ...StyleSheet.absoluteFill, zIndex: 4, overflow: 'visible' },
  practiceCompletionFireworkOverlay: { ...StyleSheet.absoluteFill, zIndex: 8, overflow: 'hidden', borderRadius: radius.md },
  practiceFireworkRing: { position: 'absolute', width: 18, height: 18, marginLeft: -9, marginTop: -9, borderWidth: 1.5, borderRadius: radius.pill },
  practiceCompletionFireworkRing: { width: 28, height: 28, marginLeft: -14, marginTop: -14, borderWidth: 2 },
  practiceFireworkRay: { position: 'absolute', width: 1.5, height: 5, marginLeft: -0.75, marginTop: -2.5, borderRadius: radius.pill },
  practiceCompletionFireworkRay: { width: 2, height: 9, marginLeft: -1, marginTop: -4.5 },
  practiceCardInteractive: { position: 'relative', overflow: 'hidden' },
  practiceHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  practiceHeaderActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  practiceStreak: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderRadius: radius.pill, backgroundColor: '#FFFBEB' },
  practiceStreakText: { color: '#92400E', fontSize: typography.micro, fontWeight: '800' },
  practiceClock: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.pill, backgroundColor: '#F8FAFC' },
  practiceClockWarning: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  practiceClockText: { color: '#334155', fontSize: typography.micro, fontWeight: '900', fontVariant: ['tabular-nums'] },
  practiceProgressText: { marginTop: 3, color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  practiceSoundButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.sm, backgroundColor: '#FFFFFF' },
  practiceProgressTrack: { height: 5, overflow: 'hidden', marginHorizontal: spacing.xs, borderRadius: radius.pill, backgroundColor: '#E2E8F0' },
  practiceProgressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: '#10B981' },
  practiceSteps: { position: 'relative', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.xs },
  practiceStep: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  practiceStepDone: { borderColor: '#059669', backgroundColor: '#10B981' },
  practiceStepRetry: { borderColor: '#F59E0B', backgroundColor: '#FDE68A' },
  practiceStepActive: { borderWidth: 2, borderColor: colors.brand },
  practiceStepText: { color: colors.muted, fontSize: typography.micro, fontWeight: '800' },
  practiceStepTextDone: { color: '#FFFFFF' },
  practiceStepTextActive: { color: colors.brandDark },
  practiceQuestion: { gap: spacing.xs, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  practiceQuestionEyebrow: { color: colors.brand, fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.8 },
  practiceQuestionTitle: { color: colors.ink, fontSize: typography.body, lineHeight: 22, fontWeight: '900' },
  practiceOption: { color: colors.muted, fontSize: typography.caption, lineHeight: 20 },
  practiceChoice: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.sm, backgroundColor: '#FFFFFF' },
  practiceChoiceSelected: { borderColor: colors.brand, backgroundColor: '#FEF2F2' },
  practiceChoiceWrong: { borderColor: '#EF4444', backgroundColor: '#FEF2F2' },
  practiceChoiceCorrect: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  practiceOptionNumber: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.pill, backgroundColor: '#FFFFFF' },
  practiceOptionNumberSelected: { borderColor: colors.brand, backgroundColor: colors.brand },
  practiceOptionNumberText: { color: colors.muted, fontSize: typography.micro, fontWeight: '800' },
  practiceOptionNumberTextSelected: { color: '#FFFFFF' },
  practiceChoiceTextSelected: { color: colors.brandDark, fontWeight: '800' },
  practiceChoiceTextWrong: { color: '#B91C1C' },
  practiceChoiceTextCorrect: { color: '#047857' },
  practiceHintWrap: { gap: spacing.xs, alignItems: 'flex-start' },
  practiceHintButton: { minHeight: 32, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#FCD34D', borderRadius: radius.sm, backgroundColor: '#FFFBEB' },
  practiceHintButtonText: { color: '#92400E', fontSize: typography.micro, fontWeight: '800' },
  practiceHintText: { color: '#92400E', fontSize: typography.caption, lineHeight: 18 },
  practiceInput: { minHeight: 90, padding: spacing.sm, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.sm, backgroundColor: '#FFFFFF', color: colors.ink, textAlignVertical: 'top' },
  practiceImageWrap: { position: 'relative', width: '100%', minHeight: 140, overflow: 'hidden', borderRadius: radius.sm, backgroundColor: '#FFFFFF' },
  practiceImage: { width: '100%', height: 240 },
  practiceHotspot: { position: 'absolute', width: 14, height: 14, marginLeft: -7, marginTop: -7, borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 7, backgroundColor: colors.brand },
  practiceMatchRow: { gap: spacing.xs, paddingVertical: spacing.xs },
  practiceMatchOptions: { gap: spacing.xs },
  practiceDragRow: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.sm, backgroundColor: '#FFFFFF' },
  practiceSuccess: { color: '#047857', fontSize: typography.caption, fontWeight: '800' },
  practiceFeedback: { color: '#92400E', fontSize: typography.caption, fontWeight: '700' },
  practiceFeedbackWrap: { position: 'relative', minHeight: 76, justifyContent: 'center' },
  practiceResultBanner: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, overflow: 'hidden', padding: spacing.sm, paddingRight: 30, borderWidth: 1, borderRadius: radius.md },
  practiceResultCorrect: { borderColor: '#86EFAC', backgroundColor: '#ECFDF5', shadowColor: '#059669', shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  practiceResultWrong: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  practiceFeedbackIcon: { width: 42, height: 42, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.9)' },
  practiceFeedbackIconCorrect: { borderWidth: 1, borderColor: '#A7F3D0', shadowColor: '#059669', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  practiceFeedbackIconWrong: { borderWidth: 1, borderColor: '#FDE68A' },
  practiceFeedbackEmoji: { fontSize: typography.title },
  practiceFeedbackShimmer: { position: 'absolute', top: -15, bottom: -15, left: 0, width: 140, backgroundColor: 'rgba(255,255,255,0.42)' },
  practiceFeedbackSparkle: { position: 'absolute' },
  practiceFeedbackSparkleOne: { top: 8, right: 12 },
  practiceFeedbackSparkleTwo: { right: 22, bottom: 7 },
  practiceModalOverlay: { ...StyleSheet.absoluteFill, zIndex: 30, alignItems: 'center', justifyContent: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(15,23,42,0.2)' },
  practiceStartModal: { width: '100%', maxWidth: 380, alignItems: 'center', padding: spacing.lg, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20, backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  practiceStartIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, borderWidth: 3, borderColor: '#FCA5A5', borderRadius: 18, backgroundColor: '#EF4444', shadowColor: '#EF4444', shadowOpacity: 0.22, shadowRadius: 10, elevation: 3 },
  practiceTimeoutIcon: { borderColor: '#FECACA', backgroundColor: '#DC2626' },
  practiceStartTitle: { color: '#0F172A', fontSize: typography.body, fontWeight: '900', textAlign: 'center' },
  practiceStartCopy: { marginTop: spacing.xs, color: '#475569', fontSize: typography.caption, lineHeight: 18, textAlign: 'center' },
  practiceStartTime: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  practiceStartTimeText: { color: '#334155', fontSize: typography.caption, fontWeight: '800' },
  practiceStartButton: { width: '100%', minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md, paddingHorizontal: spacing.md, borderRadius: 11, backgroundColor: '#DC2626' },
  practiceStartButtonText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '900' },
  practiceResultCard: { alignItems: 'center', gap: spacing.xs, padding: spacing.md, borderWidth: 1, borderColor: '#D1FAE5', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  practiceResultIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs, borderWidth: 1, borderColor: '#A7F3D0', borderRadius: 16, backgroundColor: '#D1FAE5' },
  practiceResultEyebrow: { color: '#64748B', fontSize: typography.micro, fontWeight: '900', letterSpacing: 1, textAlign: 'center' },
  practiceResultTitle: { color: '#0F172A', fontSize: typography.heading, fontWeight: '900', textAlign: 'center' },
  practiceResultSummary: { color: '#475569', fontSize: typography.caption, textAlign: 'center' },
  practiceResultStats: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.xs, marginTop: spacing.sm },
  practiceResultStat: { width: '48%', minHeight: 58, alignItems: 'center', justifyContent: 'center', gap: 2, padding: spacing.xs, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, backgroundColor: '#FFFFFF' },
  practiceResultValue: { color: '#059669', fontSize: typography.body, fontWeight: '900', fontVariant: ['tabular-nums'] },
  practiceResultLabel: { color: '#475569', fontSize: typography.micro, fontWeight: '700', textAlign: 'center' },
  practiceResultActions: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm },
  practiceSecondaryAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: spacing.sm, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 10, backgroundColor: '#FFFFFF' },
  practiceSecondaryActionText: { color: '#334155', fontSize: typography.micro, fontWeight: '800' },
  practiceContinueAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: spacing.md, borderRadius: 10, backgroundColor: '#059669' },
  practiceContinueText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '900' },
  practiceWrongList: { width: '100%', gap: spacing.xs, marginTop: spacing.sm },
  practiceWrongItem: { gap: 3, padding: spacing.sm, borderWidth: 1, borderColor: '#FDE68A', borderRadius: 11, backgroundColor: '#FFFBEB' },
  practiceWrongTitle: { color: '#334155', fontSize: typography.caption, fontWeight: '800' },
  practiceWrongAnswer: { color: '#047857', fontSize: typography.micro, fontWeight: '800', lineHeight: 16 },
  practiceWrongCopy: { color: '#92400E', fontSize: typography.micro, lineHeight: 16 },
  errorText: { color: colors.red, fontSize: typography.small },
  guideHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  cardTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '800' },
  body: { color: colors.muted, fontSize: typography.small, lineHeight: 20 },
});
