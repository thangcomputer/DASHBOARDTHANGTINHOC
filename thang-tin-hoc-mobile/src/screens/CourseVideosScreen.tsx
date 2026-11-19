import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, AppState, DeviceEventEmitter, Image, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ArrowLeft, Award, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, CircleHelp, Clapperboard, Clock3, Download, Eye, FileText, Gamepad2, GraduationCap, Layers3, Lightbulb, Lock, Menu, MessageSquare, Play, RotateCcw, ShieldCheck, Sparkles, Star, StickyNote, Trash2, Trophy, Volume2, VolumeX, WifiOff, X } from 'lucide-react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';
import { createAudioPlayer, useAudioPlayer } from 'expo-audio';
import RenderHtml from '@native-html/render';
import type { MixedStyleDeclaration } from '@native-html/render';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList, MainTabsParamList } from '../navigation/types';
import { dailyPracticeApi, type DpTopic } from '../services/dailyPracticeApi';
import { embeddedVideoUrl, isDirectVideoUrl, playableVideoUrl, vimeoIdFromUrl, youtubeIdFromUrl } from '../utils/videoSource';
import { saveLastStudySession } from '../utils/resumeLearning';
import { VideoPlayerFrame, type VideoPlayerApi, type VideoPlayerProgress } from './VideoPlayerFrame';
import { VideoLessonTabs } from './VideoLessonTabs';
import { DigitalCertificateModal } from '../components/DigitalCertificateModal';
import { ShareAchievementModal, ShareTriggerButton, type ShareAchievementData } from '../components/ShareAchievementModal';
import { buildCourseOrCertShareData } from '../../../shared/dailyPractice/shareAchievement.mjs';
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
import {
  cleanupTempDecryptedVideos,
  deleteOfflineVideo,
  downloadEncryptedOfflineVideo,
  formatOfflineBytes,
  getOfflineVideoRecord,
  listOfflineVideos,
  OFFLINE_VIDEOS_UPDATED_EVENT,
  prepareOfflinePlaybackUri,
  releaseOfflinePlaybackUri,
  type OfflineVideoRecord,
} from '../services/offlineVideos';
import { getMobileSoundEnabled, setMobileSoundEnabled, subscribeToMobileSoundPreference } from '../services/soundPreferences';
import { colors, radius, spacing, typography, theme, createThemedStyles } from '../theme/tokens';

type CourseFilter = 'all' | 'registered' | 'video' | 'instructor' | 'guide';
type CourseSection = { id: string; title: string; courses: LessonPracticeCourse[] };

const lessonHtmlBaseStyle: MixedStyleDeclaration = { color: '#475569', fontSize: typography.body, lineHeight: 23 };
const lessonHtmlTags: Record<string, MixedStyleDeclaration> = {
  body: { margin: 0, color: '#475569', fontSize: typography.body, lineHeight: 23 },
  p: { marginTop: 0, marginBottom: 10 },
  h2: { marginTop: 8, marginBottom: 8, color: '#0F172A', fontSize: typography.subheading, fontWeight: '800' },
  h3: { marginTop: 8, marginBottom: 6, color: '#1E293B', fontSize: typography.heading, fontWeight: '800' },
  li: { marginBottom: 6 },
  a: { color: '#059669', textDecorationLine: 'underline' },
};
const practiceFireworkRays: Array<[number, string, number]> = [
  [0, '#0F766E', 16], [30, '#C4A35A', 22], [60, '#0F766E', 16], [90, '#C4A35A', 22],
  [120, '#0F766E', 16], [150, '#C4A35A', 22], [180, '#0F766E', 16], [210, '#C4A35A', 22],
  [240, '#0F766E', 16], [270, '#C4A35A', 22], [300, '#0F766E', 16], [330, '#C4A35A', 22],
];
const sectionFireworkParticles: Array<[number, number, string, number, number]> = [
  [-20, -14, '#10B981', 0, -32], [-12, -22, '#F59E0B', -4, -38],
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
  { id: 'registered', label: 'Khóa đã đăng ký', displayLabel: 'Đã đăng ký', icon: CheckCircle2 },
  { id: 'video', label: 'Tự học qua video', displayLabel: 'Video', icon: Clapperboard },
  { id: 'instructor', label: 'Học cùng giảng viên', displayLabel: 'Cùng GV', icon: GraduationCap },
  { id: 'guide', label: 'Hướng dẫn học', displayLabel: 'Hướng dẫn', icon: CircleHelp },
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

function expandEnrolledCoursesBySubject(courses: LessonPracticeCourse[]): LessonPracticeCourse[] {
  const rows = Array.isArray(courses) ? courses : [];
  const seen = new Set<string>();
  const expanded: LessonPracticeCourse[] = [];

  rows.forEach((course) => {
    if (!course?.enrolled) return;
    const subjects = Array.isArray(course.subjects) ? course.subjects : [];
    if (subjects.length === 0) {
      expanded.push(course);
      return;
    }
    subjects.forEach((subject, idx) => {
      const subjectKey = String(subject?.id || subject?.name || idx);
      const dedupeKey = `${course.deliveryMode || 'default'}::${subjectKey}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);
      expanded.push({
        ...course,
        id: subjects.length > 1 ? `${course.id}::${subjectKey}` : course.id,
        sourceCourseId: course.id,
        name: subject?.name || course.name,
        parentCourseName: subjects.length > 1 ? course.name : '',
        subjects: [subject],
        lessonCount: Number(subject?.totalUnitCount) || 0,
      });
    });
  });

  return expanded;
}

function buildSections(courses: LessonPracticeCourse[], filter: CourseFilter): CourseSection[] {
  const enrolled = expandEnrolledCoursesBySubject(courses);
  const available = courses.filter((course) => !course.enrolled && !course.hiddenByEnrollment);
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
  return [
    { id: 'registered', title: 'Khóa đã đăng ký', courses: enrolled },
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

function pickDefaultLearningSectionIndex(unit: LessonPracticeUnit, sections: UnitLearningSection[]): number {
  const incompleteVideo = sections.findIndex((item) => item.kind === 'video' && !isUnitSectionDone(unit, item));
  if (incompleteVideo >= 0) return incompleteVideo;
  const anyVideo = sections.findIndex((item) => item.kind === 'video');
  if (anyVideo >= 0) return anyVideo;
  const incompleteAny = sections.findIndex((item) => !isUnitSectionDone(unit, item));
  if (incompleteAny >= 0) return incompleteAny;
  return sections.length - 1;
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
  const [offlineVideos, setOfflineVideos] = useState<OfflineVideoRecord[]>([]);
  const [offlinePlayer, setOfflinePlayer] = useState<{ record: OfflineVideoRecord; uri: string } | null>(null);
  const refreshOfflineList = useCallback(() => {
    if (Platform.OS === 'web') return;
    void listOfflineVideos().then(setOfflineVideos).catch(() => setOfflineVideos([]));
  }, []);
  useEffect(() => {
    if (Platform.OS === 'web') return undefined;
    void cleanupTempDecryptedVideos().then(refreshOfflineList);
    const sub = DeviceEventEmitter.addListener(OFFLINE_VIDEOS_UPDATED_EVENT, refreshOfflineList);
    return () => { sub.remove(); };
  }, [refreshOfflineList]);
  const openOfflineModalVideo = async (record: OfflineVideoRecord) => {
    try {
      const uri = await prepareOfflinePlaybackUri(record.lessonKey);
      if (!uri) {
        Alert.alert('Video ngoại tuyến', 'Không tìm thấy tệp video mã hóa trong bộ nhớ ứng dụng.');
        return;
      }
      setOfflinePlayer({ record, uri });
    } catch (err) {
      Alert.alert('Không thể mở video offline', err instanceof Error ? err.message : 'Lỗi giải mã nội bộ.');
    }
  };
  const closeOfflineModalVideo = () => {
    const uri = offlinePlayer?.uri;
    setOfflinePlayer(null);
    if (uri) void releaseOfflinePlaybackUri(uri);
  };
  const [selectedCourse, setSelectedCourse] = useState<LessonPracticeCourse | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<LessonPracticeSubject | null>(null);
  const [units, setUnits] = useState<LessonPracticeUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<LessonPracticeUnit | null>(null);
  const [activeUnitDetails, setActiveUnitDetails] = useState<LessonPracticeUnit[]>([]);
  const [selectedLearningSectionId, setSelectedLearningSectionId] = useState<string | null>(null);
  const [resumeVideoAt, setResumeVideoAt] = useState<{ unitId: string; sectionId: string; atSec: number } | null>(null);
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
    const enrolled = expandEnrolledCoursesBySubject(courses);
    const available = courses.filter((course) => !course.enrolled && !course.hiddenByEnrollment);
    const visible = [...enrolled, ...available];
    return {
      all: visible.length,
      registered: enrolled.length,
      video: visible.filter((course) => course.deliveryMode === 'video').length,
      instructor: visible.filter((course) => course.deliveryMode === 'instructor').length,
    };
  }, [courses]);
  const [registeringCourseId, setRegisteringCourseId] = useState('');
  const [checkout, setCheckout] = useState<CoursePaymentCheckout | null>(null);
  const [certificateCourse, setCertificateCourse] = useState<LessonPracticeCourse | null>(null);
  const [shareCourseData, setShareCourseData] = useState<ShareAchievementData | null>(null);
  const [shareListData, setShareListData] = useState<ShareAchievementData | null>(null);

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
    const realCourseId = course.sourceCourseId || course.id;
    setSelectedCourse(course.sourceCourseId ? { ...course, id: realCourseId } : course);
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
    resume?: { unitId: string; sectionId: string; atSec?: number },
  ) => {
    const realCourseId = course.sourceCourseId || course.id;
    setSelectedCourse(course.sourceCourseId ? { ...course, id: realCourseId } : course);
    setSelectedSubject(subject);
    setSelectedUnit(null);
    setActiveUnitDetails([]);
    setSelectedLearningSectionId(null);
    setResumeVideoAt(resume?.unitId && resume?.atSec ? { unitId: resume.unitId, sectionId: resume.sectionId, atSec: resume.atSec } : null);
    setUnitNavOpen(false);
    setUnits([]);
    setUnitsError('');
    if (isPreview) return;
    setUnitsLoading(true);
    try {
      const subjectUnits = await getCourseSubjectUnits(subject.id, realCourseId);
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

  const foregroundSyncRef = useRef(false);
  const resourceReloadRef = useRef(resource.reload);
  resourceReloadRef.current = resource.reload;
  const selectedCourseId = selectedCourse?.id || '';
  const selectedSubjectId = selectedSubject?.id || '';
  const selectedUnitId = selectedUnit?.id || '';
  const activeUnitDetailIdsKey = activeUnitDetails.map((unit) => unit.id).join(',');

  const syncForegroundProgress = useCallback(async () => {
    if (foregroundSyncRef.current) return;
    foregroundSyncRef.current = true;
    try {
      resourceReloadRef.current();
      if (!selectedSubjectId || !selectedCourseId || isPreview) return;
      const refreshedUnits = await getCourseSubjectUnits(selectedSubjectId, selectedCourseId);
      const detailIds = Array.from(
        new Set([
          ...(selectedUnitId ? [selectedUnitId] : []),
          ...(activeUnitDetailIdsKey ? activeUnitDetailIdsKey.split(',').filter(Boolean) : []),
        ]),
      );
      if (!detailIds.length) {
        setUnits(refreshedUnits);
        return;
      }
      const details = await Promise.all(
        detailIds.map((id) => openCourseVideoUnit(id).catch(() => null)),
      );
      const detailMap = new Map<string, LessonPracticeUnit>();
      detailIds.forEach((id, idx) => {
        const detail = details[idx];
        if (!detail) return;
        const base = refreshedUnits.find((unit) => unit.id === id);
        detailMap.set(id, { ...base, ...detail });
      });
      setUnits(refreshedUnits.map((unit) => detailMap.get(unit.id) || unit));
      if (selectedUnitId) {
        const updatedSelected = detailMap.get(selectedUnitId);
        if (updatedSelected) {
          setSelectedUnit((current) => current?.id === selectedUnitId ? updatedSelected : current);
        }
      }
      if (activeUnitDetailIdsKey) {
        setActiveUnitDetails((current) => current.map((unit) => detailMap.get(unit.id) || unit));
      }
    } catch {
      // Keep active UI state intact during silent background refresh.
    } finally {
      foregroundSyncRef.current = false;
    }
  }, [activeUnitDetailIdsKey, isPreview, selectedCourseId, selectedSubjectId, selectedUnitId]);

  const didInitialFocusRef = useRef(false);
  useFocusEffect(useCallback(() => {
    if (!didInitialFocusRef.current) {
      didInitialFocusRef.current = true;
      return;
    }
    void syncForegroundProgress();
  }, [syncForegroundProgress]));

  useEffect(() => {
    const appSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void syncForegroundProgress();
      }
    });
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
      const onForeground = () => {
        if (document.visibilityState !== 'hidden') {
          void syncForegroundProgress();
        }
      };
      window.addEventListener('focus', onForeground);
      document.addEventListener('visibilitychange', onForeground);
      return () => {
        appSub.remove();
        window.removeEventListener('focus', onForeground);
        document.removeEventListener('visibilitychange', onForeground);
      };
    }
    return () => {
      appSub.remove();
    };
  }, [syncForegroundProgress]);

  const completeUnitSection = async (
    unitId: string,
    section: 'video' | 'note',
    itemId: string,
    keepSection = false,
  ): Promise<boolean> => {
    try {
      await markCourseUnitSection(unitId, section, itemId);
      await refreshUnitDetail(unitId);
      if (!keepSection) setSelectedLearningSectionId(`${section}:${itemId}`);
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
    keepSection = false,
  ): Promise<LessonPracticeItem | null> => {
    try {
      const result = await confirmCoursePracticeItem(itemId, answer);
      const confirmedItem = result.data?.item;
      if (!keepSection) {
        setSelectedLearningSectionId(`practice:${practiceGroupId || confirmedItem?.practiceGroupId || unitId}`);
      }
      if (result.data?.retry) return confirmedItem || null;
      if (!keepSection && !(confirmedItem?.correct === true && confirmedItem.confirmed === true)) {
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
  const displayedSectionIndex = selectedSectionIndex >= 0
    ? selectedSectionIndex
    : displayedUnit
      ? pickDefaultLearningSectionIndex(displayedUnit, displayedUnitSections)
      : -1;
  const displayedUnitIndex = displayedUnit ? units.findIndex((unit) => unit.id === displayedUnit.id) : -1;
  const completedUnitsCount = units.filter((unit) => unit.status === 'completed').length;

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
    tabNavigation.setParams({ resumeKey: undefined, resumeAtSec: undefined } as never);
    if (!course || !subject) return;
    void openSubject(course, subject, {
      unitId: resumeParams.resumeUnitId || '',
      sectionId: resumeParams.resumeSectionId || '',
      atSec: resumeParams.resumeAtSec || 0,
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
  // Đã ẩn dải "Luyện tập chủ đề liên quan" theo yêu cầu.
  const relatedStrip = null;
  const openRelatedTopic = (topicId: string) => {
    // Modal bài học nằm trên mọi màn hình - đóng trước khi chuyển sang luyện tập.
    setSelectedCourse(null);
    setSelectedSubject(null);
    setSelectedUnit(null);
    setActiveUnitDetails([]);
    setUnitNavOpen(false);
    stackNavigation.navigate('DailyPractice', { topicId });
  };

  const displayedSectionId = displayedSectionIndex >= 0 ? displayedUnitSections[displayedSectionIndex]?.id || '' : '';
  const displayedSectionObj = displayedSectionIndex >= 0 ? displayedUnitSections[displayedSectionIndex] : undefined;
  const lastSyncedPosition = useRef('');
  useEffect(() => {
    if (isPreview || !selectedSubject || !displayedUnit?.id || !displayedSectionId) return undefined;
    const courseId = selectedCourse?.id || '';
    const signature = `${displayedUnit.id}|${displayedSectionId}|${courseId}`;
    if (lastSyncedPosition.current === signature) return undefined;
    const doneUnitsCount = units.filter((u) => u.status === 'completed').length;
    const progressPct = units.length
      ? Math.round((doneUnitsCount / units.length) * 100)
      : (selectedCourse ? courseProgress(selectedCourse) : 0);
    const timer = setTimeout(() => {
      lastSyncedPosition.current = signature;
      saveStudyResumePoint({ unitId: displayedUnit.id, sectionId: displayedSectionId, courseId })
        .catch(() => { lastSyncedPosition.current = ''; });
      void saveLastStudySession({
        kind: displayedSectionObj?.kind === 'video' ? 'lms_video' : 'lesson_practice',
        studentId: String(user?.id || user?._id || ''),
        courseId,
        courseTitle: selectedCourse?.name || '',
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name || '',
        unitId: displayedUnit.id,
        unitTitle: displayedUnit.title || '',
        sectionId: displayedSectionId,
        sectionLabel: displayedSectionObj?.title || '',
        progressPct,
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [
    displayedSectionId,
    displayedSectionObj?.kind,
    displayedSectionObj?.title,
    displayedUnit?.id,
    displayedUnit?.title,
    isPreview,
    selectedCourse,
    selectedSubject,
    units,
    user?._id,
    user?.id,
  ]);
  const lessonNavigation = displayedUnit
    ? (
      <UnitNavigationBar
        previousUnit={displayedUnitIndex > 0 ? units[displayedUnitIndex - 1] : null}
        nextUnit={displayedUnitIndex >= 0 ? units[displayedUnitIndex + 1] || null : null}
        onNavigateUnit={(target) => void startUnit(target)}
      />
    )
    : null;

  return (
    <AppScreen safeAreaStyle={{ backgroundColor: '#FFFBF2' }} contentStyle={styles.screenContent}>
      <View style={styles.headerBand}>
        <View style={styles.headerGroup}>
          <AppHeader title="Bài giảng" icon={Clapperboard} />
        </View>
      </View>
      <View style={styles.filtersOuter}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters} accessibilityRole="tablist">
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
                <Icon size={15} color={active ? '#FFFFFF' : '#92400E'} />
                <Text numberOfLines={1} style={[styles.filterText, active && styles.filterTextActive]}>
                  {option.displayLabel}
                </Text>
                {count !== undefined ? (
                  <Text style={[styles.filterCount, active && styles.filterCountActive]}>{count}</Text>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {!resource.loading && Platform.OS !== 'web' && offlineVideos.length > 0 ? (
        <Card style={styles.offlineCatalogCard}>
          <View style={styles.offlineCatalogHead}>
            <View style={styles.offlineCatalogTitleRow}>
              <ShieldCheck size={17} color="#059669" />
              <Text style={styles.cardTitle}>Kho video offline (Mã hóa nội bộ · {offlineVideos.length})</Text>
            </View>
            <View style={styles.offlineSandboxPill}>
              <WifiOff size={11} color="#047857" />
              <Text style={styles.offlineSandboxPillText}>Chỉ phát trong app</Text>
            </View>
          </View>
          {offlineVideos.slice(0, 6).map((rec) => (
            <View key={rec.lessonKey} style={styles.offlineRow}>
              <Pressable onPress={() => { void openOfflineModalVideo(rec); }} style={styles.offlineRowBody} accessibilityRole="button">
                <Play size={14} color="#059669" />
                <View style={styles.flex}>
                  <Text style={styles.offlineRowTitle} numberOfLines={1}>{rec.title}</Text>
                  <Text style={styles.offlineRowSub} numberOfLines={1}>
                    {rec.courseTitle} • {formatOfflineBytes(rec.sizeBytes)}
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => {
                  Alert.alert('Xóa video offline?', `Xóa bản mã hóa "${rec.title}" khỏi thiết bị?`, [
                    { text: 'Hủy', style: 'cancel' },
                    {
                      text: 'Xóa',
                      style: 'destructive',
                      onPress: () => {
                        void deleteOfflineVideo(rec.lessonKey).then(refreshOfflineList);
                      },
                    },
                  ]);
                }}
                style={styles.offlineTrashButton}
                accessibilityRole="button"
                accessibilityLabel="Xóa video offline"
              >
                <Trash2 size={14} color="#DC2626" />
              </Pressable>
            </View>
          ))}
        </Card>
      ) : null}
      {resource.loading ? <LoadingSkeleton /> : null}
      {resource.error ? <ErrorState onRetry={resource.reload} /> : null}
      {!resource.loading && !resource.error && filter === 'guide' ? (
        <Card>
          <View style={styles.guideHeader}><CircleHelp size={20} color={theme.brand} /><Text style={styles.cardTitle}>Hướng dẫn học</Text></View>
          <Text style={styles.body}>Chọn khóa học, mở môn học và hoàn thành lần lượt từng buổi để theo dõi tiến độ.</Text>
        </Card>
      ) : null}
      {!resource.loading && !resource.error && filter !== 'guide' && !courses.length ? (
        <EmptyState title="Chưa có khóa học được mở" message="Các khóa học sẽ hiển thị tại đây." />
      ) : null}
      {!resource.loading && !resource.error && filter !== 'guide' && sections.map((section) => (
        section.courses.length ? (
          <View key={section.id} style={styles.courseSection}>
            <View style={styles.sectionHeaderWrap}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIcon, section.id.startsWith('registered') ? styles.registeredIcon : section.id.startsWith('video') ? styles.videoIcon : styles.instructorIcon]}>
                  {section.id.startsWith('registered') ? <CheckCircle2 size={21} color="#059669" /> : section.id.startsWith('video') ? <Clapperboard size={21} color="#B45309" /> : <GraduationCap size={21} color="#0369A1" />}
                </View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.eyebrow}>{section.id.startsWith('registered') ? 'LỘ TRÌNH CỦA BẠN' : section.id.startsWith('video') ? 'CHỦ ĐỘNG HỌC TẬP' : 'HỌC CÙNG GIẢNG VIÊN'}</Text>
                  <View style={styles.sectionTitleRow}>
                    <Text style={styles.sectionTitle}>{section.title}</Text>
                    <Text style={[styles.sectionCount, section.id.startsWith('registered') ? styles.registeredCount : section.id.startsWith('video') ? styles.videoCount : styles.instructorCount]}>{section.courses.length}</Text>
                  </View>
                </View>
              </View>
              <View
                style={[
                  styles.sectionDivider,
                  section.id.startsWith('registered')
                    ? styles.registeredDivider
                    : section.id.startsWith('video')
                      ? styles.videoDivider
                      : styles.instructorDivider,
                ]}
              />
            </View>
            <CourseList
              courses={section.courses}
              onOpen={openCourse}
              onRegister={requestCourseRegistration}
              onOpenCertificate={setCertificateCourse}
              onShareCourse={(course) => setShareListData(buildCourseOrCertShareData({
                title: course.name || 'Khóa học Thắng Tin Học',
                studentName: user?.name || '',
                completionRate: courseProgress(course),
              }) as ShareAchievementData)}
              registeringCourseId={registeringCourseId}
            />
          </View>
        ) : null
      ))}
      {filter !== 'guide' && sections.every((section) => !section.courses.length) && !resource.loading && !resource.error ? (
        <EmptyState title="Không có khóa học trong bộ lọc" message="Thử chọn một bộ lọc khác." />
      ) : null}
      <CoursePaymentModal checkout={checkout} onClose={() => setCheckout(null)} onPaid={handleCoursePaid} />
      <Modal visible={Boolean(offlinePlayer)} transparent animationType="slide" onRequestClose={closeOfflineModalVideo}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={closeOfflineModalVideo} />
          <View style={styles.offlinePlayerModalCard}>
            <View style={styles.modalHeader}>
              <Pressable onPress={closeOfflineModalVideo} style={styles.modalBack} accessibilityRole="button" accessibilityLabel="Đóng video offline">
                <X size={18} color={theme.brand} />
              </Pressable>
              <View style={styles.flex}>
                <Text style={styles.modalTitle} numberOfLines={1}>{offlinePlayer?.record.title || 'Video offline'}</Text>
                <Text style={styles.muted} numberOfLines={1}>Phát ngoại tuyến từ kho mã hóa nội bộ</Text>
              </View>
            </View>
            {offlinePlayer ? (
              <View style={styles.videoFrame}>
                <VideoPlayerFrame
                  videoUrl={offlinePlayer.uri}
                  embeddedUrl=""
                  title={offlinePlayer.record.title}
                  lessonId={`offline-${offlinePlayer.record.lessonKey}`}
                  antiSeekEnabled={offlinePlayer.record.antiSeekEnabled}
                  done
                  onProgress={() => { }}
                  onWatched={async () => true}
                />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
      <DigitalCertificateModal
        visible={Boolean(certificateCourse)}
        onClose={() => setCertificateCourse(null)}
        studentName={user?.name || 'Học viên'}
        studentCode={user?.code || ''}
        studentId={String(user?.id || user?._id || '')}
        courseId={certificateCourse?.sourceCourseId || certificateCourse?.id || ''}
        courseTitle={certificateCourse?.name || ''}
        completionRate={certificateCourse ? courseProgress(certificateCourse) : 100}
      />
      <ShareAchievementModal
        visible={Boolean(shareListData)}
        onClose={() => setShareListData(null)}
        data={shareListData}
      />
      <Modal visible={Boolean(selectedCourse)} transparent animationType="slide" onRequestClose={() => { setSelectedCourse(null); setSelectedSubject(null); }}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { setSelectedCourse(null); setSelectedSubject(null); }} accessibilityRole="button" accessibilityLabel="Đóng nội dung khóa học" />
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Pressable
                onPress={() => {
                  const closeDirectly = !selectedSubject || Boolean(selectedCourse?.enrolled) || (selectedCourse?.subjects.length || 0) <= 1;
                  if (closeDirectly) {
                    setSelectedCourse(null);
                  }
                  setSelectedSubject(null);
                  setSelectedUnit(null);
                  setUnits([]);
                  setActiveUnitDetails([]);
                  setUnitNavOpen(false);
                }}
                style={styles.modalBack}
                accessibilityRole="button"
                accessibilityLabel={(!selectedSubject || Boolean(selectedCourse?.enrolled) || (selectedCourse?.subjects.length || 0) <= 1) ? 'Quay lại danh sách khóa học' : 'Quay lại danh sách môn học'}
              >
                <ArrowLeft size={19} color={theme.brand} />
              </Pressable>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.modalTitle}>{selectedSubject?.name || selectedCourse?.name}</Text>
                <Text numberOfLines={1} style={styles.muted}>
                  {selectedSubject
                    ? (selectedCourse?.parentCourseName
                      || (selectedCourse?.name && selectedCourse.name !== selectedSubject.name ? selectedCourse.name : '')
                      || `${units.length} buổi học`)
                    : `${selectedCourse?.subjects.length || 0} môn học`}
                </Text>
              </View>
              {selectedCourse?.enrolled && courseProgress(selectedCourse) >= 100 ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Pressable
                    onPress={() => setCertificateCourse(selectedCourse)}
                    style={styles.headerCertButton}
                    accessibilityRole="button"
                    accessibilityLabel="Xem chứng nhận số có mã QR"
                  >
                    <Award size={15} color="#047857" />
                    <Text style={styles.headerCertButtonText}>Chứng chỉ QR</Text>
                  </Pressable>
                  <ShareTriggerButton
                    onPress={() => setShareCourseData(buildCourseOrCertShareData({
                      title: selectedCourse.name || 'Khóa học Thắng Tin Học',
                      studentName: user?.name || '',
                      completionRate: 100,
                    }) as ShareAchievementData)}
                    label="SHARE"
                    size="sm"
                  />
                </View>
              ) : null}
              {selectedSubject && units.length > 0 ? (
                <View style={styles.headerProgressPill}>
                  <CheckCircle2 size={14} color="#047857" />
                  <Text style={styles.headerProgressPillText}>{`${completedUnitsCount}/${units.length} buổi`}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.modalContent}>
              {selectedSubject ? (
                <View style={styles.lessonPage}>
                  {(unitsLoading || openingUnit) && !selectedUnit && !activeUnitDetails.length ? <LoadingSkeleton rows={3} /> : null}
                  {unitsError ? <Text style={styles.errorText}>{unitsError}</Text> : null}
                  {!unitsLoading && !unitsError && !selectedUnit && !activeUnitDetails.length ? (
                    <EmptyState title="Chưa có bài học đang mở" message="Chọn bài học trong Mục lục để bắt đầu." />
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
                          units={units}
                          unitIndex={Math.max(0, units.findIndex((entry) => entry.id === unit.id))}
                          subjectId={selectedSubject?.id || ''}
                          subjectName={selectedSubject?.name || ''}
                          courseId={selectedCourse?.id || ''}
                          courseTitle={selectedCourse?.name || ''}
                          progressPct={
                            units.length
                              ? Math.round((units.filter((u) => u.status === 'completed').length / units.length) * 100)
                              : selectedCourse
                                ? courseProgress(selectedCourse)
                                : 0
                          }
                          userId={user?.id || ''}
                          enabled={!isPreview && Boolean(user?.id)}
                          resources={selectedCourse?.files || []}
                          selectedSectionId={selectedLearningSectionId}
                          resumeVideoAt={resumeVideoAt?.unitId === unit.id ? resumeVideoAt : null}
                          contentWidth={lessonContentWidth}
                          onSelectUnit={(targetUnit) => { void startUnit(targetUnit); }}
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
                          onShareUnit={() => setShareCourseData(buildCourseOrCertShareData({
                            title: unit.title || selectedSubject?.name || selectedCourse?.name || 'Bài học',
                            studentName: user?.name || '',
                            completionRate: 100,
                          }) as ShareAchievementData)}
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
                                    {done ? <CheckCircle2 size={14} color="#059669" /> : <ChevronRight size={14} color={theme.brand} />}
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
                    borderTop: '2px solid #E2E8F0',
                    backgroundColor: '#FFFBF2',
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
          <ShareAchievementModal
            visible={Boolean(shareCourseData)}
            onClose={() => setShareCourseData(null)}
            data={shareCourseData}
            inlineOverlay
          />
        </View>
      </Modal>
    </AppScreen>
  );
}

function ZaloBadgeIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Rect x={1} y={1} width={22} height={22} rx={6} fill="#0068FF" />
      <Path
        d="M12 4.5c-4.4 0-8 3.1-8 6.9 0 2.1 1.1 4 2.9 5.3l-.7 2.8 3-1.4c.9.2 1.8.4 2.8.4 4.4 0 8-3.1 8-6.9S16.4 4.5 12 4.5z"
        fill="#FFFFFF"
      />
      <SvgText
        x={12}
        y={13.5}
        fontSize={6.2}
        fontWeight="900"
        fill="#0068FF"
        textAnchor="middle"
      >
        Zalo
      </SvgText>
    </Svg>
  );
}

function CourseCard({
  course,
  onOpen,
  onRegister,
  onOpenCertificate,
  onShareCourse,
  registering = false,
}: {
  course: LessonPracticeCourse;
  onOpen: () => void;
  onRegister: () => void;
  onOpenCertificate?: () => void;
  onShareCourse?: () => void;
  registering?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const isVideo = course.deliveryMode === 'video';
  const blockUnregisteredInstructorPreview = !isVideo && !course.enrolled;
  const progress = courseProgress(course);
  const showTooltip = !course.enrolled && (isHovered || infoOpen);
  const now = Date.now();
  const cSale = course as LessonPracticeCourse & { discountStartsAt?: string; discountEndsAt?: string };
  const startsAt = cSale.discountStartsAt ? new Date(cSale.discountStartsAt).getTime() : null;
  const endsAt = cSale.discountEndsAt ? new Date(cSale.discountEndsAt).getTime() : null;
  const saleActive = Boolean(course.originalPrice)
    && (startsAt === null || now >= startsAt)
    && (endsAt === null || now < endsAt);
  const displayPrice = course.originalPrice && !saleActive ? course.originalPrice : course.price;
  return (
    <Pressable
      style={[styles.courseCardWrap, showTooltip ? styles.courseCardWrapActive : undefined]}
      onHoverIn={() => setIsHovered(true)}
      onHoverOut={() => setIsHovered(false)}
    >
      <Card style={{ ...styles.courseCard, ...(course.enrolled ? styles.courseCardEnrolled : {}), ...(isHovered ? styles.courseCardHovered : {}) }}>
        <Pressable
          style={styles.courseCardContent}
          onPress={blockUnregisteredInstructorPreview ? () => setInfoOpen((current) => !current) : onOpen}
          accessibilityRole="button"
          accessibilityLabel={blockUnregisteredInstructorPreview ? `Xem thông tin khóa học ${course.name}` : `Mở khóa học ${course.name}`}
        >
          <View style={[styles.courseBanner, { backgroundColor: course.bannerColorStart || '#059669' }]}>
            {course.thumbnail ? <Image source={{ uri: course.thumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[styles.bannerRing, { borderColor: 'rgba(255,255,255,0.13)' }]} />}
            {!course.enrolled ? (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation?.();
                  setInfoOpen((current) => !current);
                }}
                style={styles.lockBadge}
                accessibilityRole="button"
                accessibilityLabel={infoOpen ? 'Ẩn thông tin khóa học' : 'Xem thông tin khóa học'}
              >
                <Lock size={14} color="#854D0E" />
              </Pressable>
            ) : null}
            <View style={styles.courseMode}>
              <View style={[styles.courseModeIcon, !isVideo ? styles.courseModeIconInstructor : styles.courseModeIconVideo]}>
                {!isVideo ? (
                  <GraduationCap size={15} color="#047857" strokeWidth={2.3} />
                ) : (
                  <Clapperboard size={14} color="#B45309" strokeWidth={2.3} />
                )}
              </View>
              <Text style={styles.courseModeText}>{isVideo ? 'Tự học qua video' : 'Học cùng giảng viên'}</Text>
            </View>
            <View style={styles.offerBadge}><Text style={styles.offerText}>{course.offerType === 'single' ? 'Khóa lẻ' : 'Trọn gói'}</Text></View>
          </View>
          <View style={styles.courseInfo}>
            <Text numberOfLines={2} style={styles.courseTitle}>{course.name}</Text>
            {course.parentCourseName ? (
              <Text numberOfLines={1} style={styles.parentCourseName}>
                {`Khóa: ${course.parentCourseName}`}
              </Text>
            ) : null}
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
              {course.enrolled ? (
                <Text style={styles.enrolledBadge}><CheckCircle2 size={13} color="#059669" /> Đã đăng ký</Text>
              ) : (
                <View style={[styles.priceBox, saleActive && styles.priceBoxSale]}>
                  {saleActive ? (
                    <View style={styles.saleMetaRow}>
                      <Text style={styles.originalPriceText}>{`${Number(course.originalPrice).toLocaleString('vi-VN')}đ`}</Text>
                      {Number(course.discountPercent) > 0 ? (
                        <Text style={styles.discountPctText}>{`-${course.discountPercent}%`}</Text>
                      ) : null}
                    </View>
                  ) : null}
                  <Text style={[styles.priceText, saleActive && styles.priceTextSale]}>
                    {`${Number(displayPrice || 0).toLocaleString('vi-VN')}đ`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </Pressable>
        <View style={[styles.courseActions, blockUnregisteredInstructorPreview && styles.courseActionsCentered]}>
          {!course.enrolled && isVideo ? (
            <Pressable onPress={onRegister} disabled={registering} style={[styles.registerButton, registering && { opacity: 0.6 }]} accessibilityRole="button">
              <Text style={styles.registerText}>{registering ? 'Đang tạo thanh toán…' : 'Đăng ký học'}</Text>
            </Pressable>
          ) : !course.enrolled && !isVideo ? (
            <Pressable onPress={onRegister} style={styles.zaloButton} accessibilityRole="button" accessibilityLabel={`Tư vấn Zalo khóa học ${course.name}`}>
              <ZaloBadgeIcon />
              <Text style={styles.zaloButtonText}>Zalo tư vấn</Text>
            </Pressable>
          ) : course.enrolled && progress >= 100 && onOpenCertificate ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Pressable onPress={onOpenCertificate} style={styles.certButton} accessibilityRole="button" accessibilityLabel={`Xem chứng nhận QR khóa học ${course.name}`}>
                <Award size={14} color="#047857" />
                <Text style={styles.certButtonText}>Chứng chỉ QR</Text>
              </Pressable>
              {onShareCourse ? (
                <ShareTriggerButton
                  onPress={onShareCourse}
                  label="SHARE"
                  size="sm"
                />
              ) : null}
            </View>
          ) : (
            <View />
          )}
          {!blockUnregisteredInstructorPreview ? (
            <Pressable onPress={onOpen} style={[styles.openButton, course.enrolled ? styles.openButtonActive : null]} accessibilityRole="button">
              <Text style={[styles.openButtonText, course.enrolled && styles.openButtonTextActive]}>{course.enrolled ? progress > 0 && progress < 100 ? 'Tiếp tục học' : progress >= 100 ? 'Xem lại khóa học' : 'Vào học' : directSubject(course) ? 'Học thử' : 'Xem thêm'}</Text>
              <ChevronRight size={16} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
      </Card>
      {showTooltip ? <CourseTooltip isVideo={isVideo} /> : null}
    </Pressable>
  );
}

function CourseList({
  courses,
  onOpen,
  onRegister,
  onOpenCertificate,
  onShareCourse,
  registeringCourseId = '',
}: {
  courses: LessonPracticeCourse[];
  onOpen: (course: LessonPracticeCourse) => void;
  onRegister: (course: LessonPracticeCourse) => void;
  onOpenCertificate?: (course: LessonPracticeCourse) => void;
  onShareCourse?: (course: LessonPracticeCourse) => void;
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
            onOpenCertificate={onOpenCertificate ? () => onOpenCertificate(course) : undefined}
            onShareCourse={onShareCourse ? () => onShareCourse(course) : undefined}
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

function formatMinuteSecond(seconds: number) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function UnitDetails({
  unit,
  units = [],
  unitIndex = 0,
  subjectId = '',
  subjectName,
  courseId,
  courseTitle,
  progressPct = 0,
  userId,
  enabled,
  resources,
  selectedSectionId,
  resumeVideoAt = null,
  contentWidth,
  onSelectUnit,
  onOpenVideo,
  onCompleteSection,
  onSubmitPractice,
  onAdvancePractice,
  onResetPractice,
  onContinuePractice,
  onShareUnit,
}: {
  unit: LessonPracticeUnit;
  units?: LessonPracticeUnit[];
  unitIndex?: number;
  subjectId?: string;
  subjectName: string;
  courseId: string;
  courseTitle: string;
  progressPct?: number;
  userId: string;
  enabled: boolean;
  resources: NonNullable<LessonPracticeCourse['files']>;
  selectedSectionId: string | null;
  resumeVideoAt?: { unitId: string; sectionId: string; atSec: number } | null;
  contentWidth: number;
  onSelectUnit?: (unit: LessonPracticeUnit) => void;
  onOpenVideo: (url: string) => void;
  onCompleteSection: (unitId: string, section: 'video' | 'note', itemId: string, keepSection?: boolean) => Promise<boolean>;
  onSubmitPractice: (
    unitId: string,
    itemId: string,
    practiceGroupId: string | undefined,
    answer: Record<string, unknown>,
    keepSection?: boolean,
  ) => Promise<LessonPracticeItem | null>;
  onAdvancePractice: (unitId: string) => Promise<void>;
  onResetPractice: (unitId: string, practiceGroupId: string) => Promise<boolean>;
  onContinuePractice: () => void;
  onShareUnit?: () => void;
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
    || sections[pickDefaultLearningSectionIndex(unit, sections)];
  const activeVideo = (section?.kind === 'video'
    ? [...videos, ...legacyVideo].find((item) => item.id === section.itemId)
    : undefined) || videos[0] || legacyVideo[0];
  const videoSectionId = activeVideo ? `video:${activeVideo.id}` : section?.id || '';
  const videoSectionLabel = activeVideo?.title || section?.title || unit.title;
  const activeVideoDone = activeVideo
    ? Boolean(unit.videoDoneIds?.includes(activeVideo.id) || (unit.videoDone && activeVideo.id === 'legacy-video'))
    : Boolean(unit.status === 'completed');
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
      <VideoLessonPane
        key={`${unit.id}-${activeVideo?.id || 'lesson'}`}
        unit={unit}
        units={units}
        unitIndex={unitIndex}
        subjectId={subjectId}
        subjectName={subjectName}
        sectionId={videoSectionId}
        sectionLabel={videoSectionLabel}
        video={activeVideo}
        initialAtSec={resumeVideoAt && (!resumeVideoAt.sectionId || resumeVideoAt.sectionId === videoSectionId) ? resumeVideoAt.atSec : 0}
        done={Boolean(activeVideoDone)}
        antiSeekEnabled={activeVideo?.antiSeek ?? unit.antiSeek !== false}
        courseId={courseId}
        courseTitle={courseTitle}
        progressPct={progressPct}
        userId={userId}
        enabled={enabled}
        resources={resources}
        contentWidth={contentWidth}
        soundEnabled={practiceSoundEnabled}
        onSelectUnit={onSelectUnit}
        onOpenVideo={onOpenVideo}
        onCompleteSection={(secKind, itemId) => onCompleteSection(unit.id, secKind, itemId, true).then((saved) => {
          if (saved) celebrateSectionCompletion();
          return saved;
        })}
        onSubmitQuizItem={(itemId, grpId, answer) => onSubmitPractice(unit.id, itemId, grpId, answer, true)}
        onAdvancePractice={() => onAdvancePractice(unit.id)}
        onChoosePraise={choosePracticePraise}
        onPlayPraise={playPracticePraise}
        onShareUnit={onShareUnit}
        onComplete={() => {
          if (!activeVideo) return Promise.resolve(true);
          return onCompleteSection(unit.id, 'video', activeVideo.id, true).then((saved) => {
            if (saved) celebrateSectionCompletion();
            return saved;
          });
        }}
      />
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
        <ArrowLeft size={17} color={previousUnit && !previousUnit.locked ? theme.brand : colors.muted} />
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
        <ArrowLeft size={15} color={previousSection ? theme.brand : colors.muted} />
        <Text numberOfLines={1} style={[styles.sectionNavigationLabel, !previousSection && styles.sectionNavigationLabelDisabled]}>{previousSection?.title || 'Mục trước'}</Text>
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
        <Text numberOfLines={1} style={[styles.sectionNavigationLabel, (!nextSection || !currentDone) && styles.sectionNavigationLabelDisabled]}>{nextSection?.title || 'Mục tiếp theo'}</Text>
        <ChevronRight size={15} color={nextSection && currentDone ? theme.brand : colors.muted} />
      </Pressable>
    </View>
  );
}

type VideoMainTab = 'lesson' | 'curriculum' | 'resources';
type VideoResourceSubTab = 'resources' | 'notes' | 'qa' | 'reviews';
const QUIZ_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const getEmbeddedVideoUrl = embeddedVideoUrl;

function VideoLessonPane({
  unit,
  units = [],
  unitIndex = 0,
  subjectId = '',
  subjectName,
  sectionId = '',
  sectionLabel = '',
  video,
  initialAtSec = 0,
  done,
  antiSeekEnabled,
  courseId,
  courseTitle,
  progressPct = 0,
  userId,
  enabled,
  resources,
  contentWidth = 340,
  soundEnabled = true,
  onSelectUnit,
  onOpenVideo,
  onCompleteSection,
  onSubmitQuizItem,
  onAdvancePractice,
  onChoosePraise,
  onPlayPraise,
  onShareUnit,
  onComplete,
}: {
  unit: LessonPracticeUnit;
  units?: LessonPracticeUnit[];
  unitIndex?: number;
  subjectId?: string;
  subjectName: string;
  sectionId?: string;
  sectionLabel?: string;
  video: { id: string; title: string; url: string } | undefined;
  initialAtSec?: number;
  done: boolean;
  antiSeekEnabled: boolean;
  courseId: string;
  courseTitle: string;
  progressPct?: number;
  userId: string;
  enabled: boolean;
  resources: NonNullable<LessonPracticeCourse['files']>;
  contentWidth?: number;
  soundEnabled?: boolean;
  onSelectUnit?: (unit: LessonPracticeUnit) => void;
  onOpenVideo: (url: string) => void;
  onCompleteSection?: (section: 'video' | 'note', itemId: string) => Promise<boolean>;
  onSubmitQuizItem?: (
    itemId: string,
    practiceGroupId: string | undefined,
    answer: Record<string, unknown>,
  ) => Promise<LessonPracticeItem | null>;
  onAdvancePractice?: () => Promise<void>;
  onChoosePraise?: () => PracticePraise;
  onPlayPraise?: (audio: number) => void;
  onShareUnit?: () => void;
  onComplete: () => Promise<boolean>;
}) {
  const [activeTab, setActiveTab] = useState<VideoMainTab>('lesson');
  const [resourceSubTab, setResourceSubTab] = useState<VideoResourceSubTab>('resources');
  const [started, setStarted] = useState(() => Boolean(initialAtSec > 0 && playableVideoUrl(video?.url || '')));
  useEffect(() => {
    if (initialAtSec > 0 && playableVideoUrl(video?.url || '')) {
      setStarted(true);
    }
  }, [initialAtSec, video?.url]);
  const [videoProgress, setVideoProgress] = useState<VideoPlayerProgress>({
    currentTime: 0,
    duration: 0,
    watchedSeconds: 0,
    completed: done,
    playing: false,
  });
  const playerApiRef = useRef<VideoPlayerApi | null>(null);
  const lastSyncedAtSecRef = useRef(-1);
  const rawUrl = video?.url || '';
  const url = playableVideoUrl(rawUrl);
  const embeddedUrl = getEmbeddedVideoUrl(url);
  const directVideo = isDirectVideoUrl(url);
  const resolvedUrl = url ? resolveMobilePublicUrl(url) : '';
  const offlineLessonKey = `${userId || 'anon'}_${unit.id}_${video?.id || 'video'}`;
  const [offlineRecord, setOfflineRecord] = useState<OfflineVideoRecord | null>(null);
  const [offlineDownloadPct, setOfflineDownloadPct] = useState<number | null>(null);
  const [offlineUri, setOfflineUri] = useState<string>('');
  const [usingOfflineUri, setUsingOfflineUri] = useState(false);

  const wrongSoundPlayer = useAudioPlayer(require('../assets/audio/practice-wrong.wav'));
  const unitQuizItems = useMemo(
    () => (unit.items || []).filter((item) => item.type === 'mcq' || item.type === 'multi'),
    [unit.items],
  );
  const isLocalFallbackQuiz = unitQuizItems.length === 0;
  const quizItems = useMemo<LessonPracticeItem[]>(() => {
    if (unitQuizItems.length) return unitQuizItems;
    return [{
      id: `quick-check-${unit.id}`,
      type: 'mcq',
      prompt: `Nội dung trọng tâm của "${video?.title || unit.title}" là gì?`,
      options: [
        { id: 'a', text: 'Nắm vững thao tác và quy tắc thực hành chuẩn trong video bài giảng' },
        { id: 'b', text: 'Bỏ qua bước thực hành và không cần kiểm tra lại kết quả' },
        { id: 'c', text: 'Chỉ xem lướt tiêu đề mà không theo dõi hướng dẫn' },
      ],
      hint: `Hãy xem lại phần hướng dẫn chính trong "${video?.title || unit.title}" để chọn đáp án đúng nhất.`,
      explanation: 'Chính xác! Kết hợp xem video và thực hành giúp bạn làm chủ bài học nhanh chóng.',
      answer: { choiceId: 'a' },
    }];
  }, [unit.id, unit.title, unitQuizItems, video?.title]);

  const getQuizMilestoneSecFor = (qIdx: number, durSec: number): number => {
    if (qIdx <= 0) return 0;
    const explicit = Number(quizItems[qIdx]?.milestoneSec ?? quizItems[qIdx]?.atSec ?? 0);
    if (Number.isFinite(explicit) && explicit > 0) return Math.floor(explicit);
    if (durSec > 0) {
      return Math.max(qIdx * 5, Math.min(Math.max(1, durSec - 2), Math.floor((durSec * qIdx) / quizItems.length)));
    }
    return qIdx * 30;
  };

  const resolveInitialQuizIdx = () => {
    const startSec = done ? 999999 : Math.max(0, Math.floor(initialAtSec || 0));
    const idx = quizItems.findIndex((item) => !(item.confirmed === true && item.correct === true));
    if (idx < 0) return 0;
    if (idx === 0 || !url || done || startSec >= getQuizMilestoneSecFor(idx, 0)) return idx;
    return idx - 1;
  };

  const [activeQuizIdx, setActiveQuizIdx] = useState(resolveInitialQuizIdx);
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);
  const [showQuizHint, setShowQuizHint] = useState(false);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizStatus, setQuizStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [quizFeedback, setQuizFeedback] = useState('');
  const [localDoneQuizIds, setLocalDoneQuizIds] = useState<Record<string, boolean>>({});
  const [localAnsweredChoices, setLocalAnsweredChoices] = useState<Record<string, string[]>>({});
  const [maxReachedSec, setMaxReachedSec] = useState<number>(() => (done ? 999999 : Math.max(0, Math.floor(initialAtSec || 0))));
  const maxReachedSecRef = useRef(maxReachedSec);
  maxReachedSecRef.current = maxReachedSec;
  const videoDurationRef = useRef(0);
  videoDurationRef.current = Math.floor(videoProgress.duration || 0);
  const pausedMilestoneQuizIdRef = useRef('');
  const gateHoldPlaybackRef = useRef(false);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isQuizItemDone = (item: LessonPracticeItem | undefined) =>
    Boolean(item && ((item.confirmed === true && item.correct === true) || localDoneQuizIds[item.id]));

  const getSavedQuizChoices = (item: LessonPracticeItem | undefined): string[] => {
    if (!item) return [];
    const local = localAnsweredChoices[item.id];
    if (local && local.length) return local;
    if (item.type === 'multi') {
      if (Array.isArray(item.answer?.choiceIds) && item.answer.choiceIds.length) {
        return (item.answer.choiceIds as unknown[]).map(String);
      }
      if (Array.isArray(item.correctOptionIds) && item.correctOptionIds.length) {
        return item.correctOptionIds.map(String);
      }
    } else {
      if (typeof item.answer?.choiceId === 'string' && item.answer.choiceId) {
        return [item.answer.choiceId];
      }
      if (typeof item.correctOptionId === 'string' && item.correctOptionId) {
        return [item.correctOptionId];
      }
    }
    if (item.confirmed === true && item.correct === true && item.options?.length) {
      return [item.options[0].id];
    }
    return [];
  };

  const getQuizMilestoneSec = (qIdx: number): number =>
    getQuizMilestoneSecFor(qIdx, Math.floor(videoProgress.duration || 0));

  const isQuizUnlocked = (qIdx: number): boolean => {
    if (qIdx <= 0) return true;
    if (isQuizItemDone(quizItems[qIdx])) return true;
    for (let i = 0; i < qIdx; i += 1) {
      if (!isQuizItemDone(quizItems[i])) return false;
    }
    if (!url || done) return true;
    return maxReachedSec >= getQuizMilestoneSec(qIdx);
  };

  const hydratedUnitIdRef = useRef('');

  useEffect(() => {
    setActiveTab('lesson');
    hydratedUnitIdRef.current = unitQuizItems.length ? unit.id : '';
    setLocalDoneQuizIds({});
    setLocalAnsweredChoices({});
    pausedMilestoneQuizIdRef.current = '';
    gateHoldPlaybackRef.current = false;
    setMaxReachedSec(done ? 999999 : Math.max(0, Math.floor(initialAtSec || 0)));
    const initIdx = resolveInitialQuizIdx();
    setActiveQuizIdx(initIdx);
    const initItem = quizItems[initIdx];
    setSelectedChoiceIds(isQuizItemDone(initItem) ? getSavedQuizChoices(initItem) : []);
    setShowQuizHint(false);
    setQuizStatus('idle');
    setQuizFeedback('');
  }, [unit.id]); // eslint-disable-line react-hooks/exhaustive-deps -- reset state only when changing unit

  useEffect(() => {
    if (!unitQuizItems.length || hydratedUnitIdRef.current === unit.id) return;
    hydratedUnitIdRef.current = unit.id;
    const initIdx = resolveInitialQuizIdx();
    setActiveQuizIdx(initIdx);
    const initItem = quizItems[initIdx];
    if (isQuizItemDone(initItem)) {
      setSelectedChoiceIds(getSavedQuizChoices(initItem));
    }
  }, [unit.id, unitQuizItems]); // eslint-disable-line react-hooks/exhaustive-deps -- jump to first unlocked pending question when async unit items load

  useEffect(() => {
    const minSec = done ? 999999 : Math.max(0, Math.floor(initialAtSec || 0));
    if (minSec > maxReachedSec) setMaxReachedSec(minSec);
  }, [done, initialAtSec, maxReachedSec]);

  useEffect(() => () => {
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
  }, []);

  const safeQuizIdx = Math.min(Math.max(0, activeQuizIdx), Math.max(0, quizItems.length - 1));
  const activeQuizItem = quizItems[safeQuizIdx];
  const activeQuizDone = isQuizItemDone(activeQuizItem);

  useEffect(() => {
    if (isQuizItemDone(activeQuizItem)) {
      setSelectedChoiceIds(getSavedQuizChoices(activeQuizItem));
    } else {
      setSelectedChoiceIds([]);
    }
    setShowQuizHint(false);
    setQuizStatus('idle');
    setQuizFeedback('');
  }, [activeQuizItem?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- sync choices when switching active question

  useEffect(() => {
    if (!url || done) {
      gateHoldPlaybackRef.current = false;
      return;
    }
    const firstUnansweredIdx = quizItems.findIndex((item) => !isQuizItemDone(item));
    if (firstUnansweredIdx < 0) {
      gateHoldPlaybackRef.current = false;
      return;
    }
    const reachedCurrentMilestone = firstUnansweredIdx > 0 && maxReachedSec >= getQuizMilestoneSec(firstUnansweredIdx);
    const blockedAtNextMilestone =
      firstUnansweredIdx + 1 < quizItems.length && maxReachedSec >= getQuizMilestoneSec(firstUnansweredIdx + 1);

    if (reachedCurrentMilestone) {
      const targetItem = quizItems[firstUnansweredIdx];
      if (pausedMilestoneQuizIdRef.current !== targetItem.id) {
        pausedMilestoneQuizIdRef.current = targetItem.id;
        setActiveQuizIdx(firstUnansweredIdx);
        playerApiRef.current?.pause?.();
      }
      gateHoldPlaybackRef.current = true;
      return;
    }

    if (blockedAtNextMilestone) {
      setActiveQuizIdx(firstUnansweredIdx);
      playerApiRef.current?.pause?.();
      gateHoldPlaybackRef.current = true;
      return;
    }

    gateHoldPlaybackRef.current = false;
  }, [maxReachedSec, localDoneQuizIds, unit.items, url, done, videoProgress.duration]); // eslint-disable-line react-hooks/exhaustive-deps -- evaluate milestone unlock & hold state cleanly

  useEffect(() => {
    let alive = true;
    setUsingOfflineUri(false);
    setOfflineUri('');
    if (Platform.OS === 'web') return undefined;
    void getOfflineVideoRecord(offlineLessonKey).then((rec) => {
      if (alive) setOfflineRecord(rec);
    });
    return () => { alive = false; };
  }, [offlineLessonKey]);

  useEffect(() => {
    return () => {
      if (offlineUri) void releaseOfflinePlaybackUri(offlineUri);
    };
  }, [offlineUri]);

  const handleDownloadOffline = async () => {
    if (!directVideo || !resolvedUrl || offlineDownloadPct !== null) return;
    setOfflineDownloadPct(1);
    try {
      const rec = await downloadEncryptedOfflineVideo({
        lessonKey: offlineLessonKey,
        url: resolvedUrl,
        title: video?.title || unit.title,
        courseTitle,
        subjectName,
        antiSeekEnabled,
        onProgress: setOfflineDownloadPct,
      });
      setOfflineRecord(rec);
      Alert.alert('Đã tải offline', 'Video đã được mã hóa khóa thiết bị trong bộ nhớ nội bộ của ứng dụng.');
    } catch (err) {
      Alert.alert('Không thể tải offline', err instanceof Error ? err.message : 'Lỗi tải hoặc mã hóa tệp video.');
    } finally {
      setOfflineDownloadPct(null);
    }
  };

  const handlePlayOfflineToggle = async () => {
    if (usingOfflineUri && offlineUri) {
      setUsingOfflineUri(false);
      void releaseOfflinePlaybackUri(offlineUri);
      setOfflineUri('');
      return;
    }
    try {
      const decrypted = await prepareOfflinePlaybackUri(offlineLessonKey);
      if (!decrypted) {
        Alert.alert('Chưa có bản offline', 'Vui lòng tải video trước.');
        return;
      }
      setOfflineUri(decrypted);
      setUsingOfflineUri(true);
      setStarted(true);
    } catch (err) {
      Alert.alert('Không thể mở bản offline', err instanceof Error ? err.message : 'Lỗi giải mã nội bộ.');
    }
  };

  const handleDeleteOffline = () => {
    Alert.alert('Xóa bản tải offline?', 'Xóa tệp video đã mã hóa khỏi máy?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa',
        style: 'destructive',
        onPress: () => {
          void deleteOfflineVideo(offlineLessonKey).then(() => {
            setOfflineRecord(null);
            if (usingOfflineUri) {
              setUsingOfflineUri(false);
              if (offlineUri) void releaseOfflinePlaybackUri(offlineUri);
              setOfflineUri('');
            }
          });
        },
      },
    ]);
  };
  const invalidLink = Boolean(rawUrl) && !url;

  // Luôn phát ngay trong khung; link không phát được thì báo tại chỗ, không mở sang tab/ứng dụng khác.
  const startVideo = () => {
    if (url) setStarted(true);
  };

  const handleVideoProgress = (p: VideoPlayerProgress) => {
    setVideoProgress(p);
    const currentSec = Math.floor(p.currentTime || 0);
    const reachedSec = Math.max(currentSec, Math.floor(p.watchedSeconds || 0));
    if (reachedSec > 0) {
      setMaxReachedSec((prev) => (reachedSec > prev ? reachedSec : prev));
    }
    if (p.playing && gateHoldPlaybackRef.current) {
      playerApiRef.current?.pause?.();
    }
    if (
      p.playing &&
      userId &&
      courseId &&
      Math.abs(currentSec - lastSyncedAtSecRef.current) >= 5
    ) {
      lastSyncedAtSecRef.current = currentSec;
      void saveLastStudySession({
        kind: 'lms_video',
        studentId: userId,
        courseId,
        courseTitle,
        subjectId,
        subjectName,
        unitId: unit.id,
        unitTitle: unit.title,
        sectionId,
        sectionLabel: sectionLabel || video?.title || unit.title,
        atSec: currentSec,
        durationSec: Math.floor(p.duration || 0),
        progressPct,
      });
    }
  };

  const handleSeekTo = (sec: number) => {
    if (!url) return;
    const safe = Math.max(0, Math.floor(Number(sec) || 0));
    if (!started) {
      setStarted(true);
      setTimeout(() => playerApiRef.current?.seekTo?.(safe), 450);
    } else {
      playerApiRef.current?.seekTo?.(safe);
    }
  };

  const toggleQuizOption = (optionId: string) => {
    if (quizSubmitting || quizStatus === 'correct' || isQuizItemDone(activeQuizItem)) return;
    setQuizStatus('idle');
    setQuizFeedback('');
    if (activeQuizItem?.type === 'multi') {
      setSelectedChoiceIds((cur) => (cur.includes(optionId) ? cur.filter((id) => id !== optionId) : [...cur, optionId]));
    } else {
      setSelectedChoiceIds([optionId]);
    }
  };

  const playInteractiveSound = (isCorrect: boolean) => {
    if (!soundEnabled) return;
    if (isCorrect) {
      const praise = onChoosePraise?.();
      if (praise && onPlayPraise) {
        onPlayPraise(praise.audio);
      } else if (Platform.OS === 'web') {
        playWebPracticeFeedbackSound(true);
      }
      return;
    }
    if (Platform.OS === 'web') {
      playWebPracticeFeedbackSound(false);
    } else {
      void wrongSoundPlayer.seekTo(0)
        .then(() => wrongSoundPlayer.play())
        .catch(() => undefined);
    }
  };

  const submitInteractiveQuiz = async () => {
    if (!activeQuizItem || !selectedChoiceIds.length || quizSubmitting || quizStatus === 'correct' || isQuizItemDone(activeQuizItem)) return;
    if (soundEnabled) unlockPracticeFeedbackAudio();
    setQuizSubmitting(true);
    setQuizStatus('idle');
    setQuizFeedback('');
    try {
      let isCorrect = false;
      let feedbackMsg = '';
      if (isLocalFallbackQuiz) {
        isCorrect = selectedChoiceIds[0] === 'a';
        feedbackMsg = isCorrect
          ? (activeQuizItem.explanation || 'Chính xác!')
          : 'Chưa đúng. Bạn thử chọn đáp án khác nhé!';
      } else if (activeQuizItem.confirmed === true && activeQuizItem.correct === true) {
        if (activeQuizItem.type === 'multi') {
          const expected = Array.isArray(activeQuizItem.answer?.choiceIds)
            ? (activeQuizItem.answer.choiceIds as unknown[]).map(String).sort()
            : [];
          const pickedSorted = [...selectedChoiceIds].map(String).sort();
          isCorrect = expected.length ? (pickedSorted.length === expected.length && pickedSorted.every((v, i) => v === expected[i])) : true;
        } else {
          const expectedId = typeof activeQuizItem.answer?.choiceId === 'string' ? activeQuizItem.answer.choiceId : '';
          isCorrect = expectedId ? selectedChoiceIds[0] === expectedId : true;
        }
        feedbackMsg = isCorrect ? 'Chính xác!' : 'Chưa đúng. Bạn thử chọn lại nhé!';
      } else if (onSubmitQuizItem) {
        const answerPayload: Record<string, unknown> = activeQuizItem.type === 'multi'
          ? { choiceIds: selectedChoiceIds }
          : { choiceId: selectedChoiceIds[0] || '' };
        const result = await onSubmitQuizItem(activeQuizItem.id, activeQuizItem.practiceGroupId, answerPayload);
        if (!result) return;
        isCorrect = result.confirmed === true && result.correct === true;
        const rawFeedback = String(result.feedback || result.explanation || '').trim();
        feedbackMsg = !isCorrect && rawFeedback === 'Bạn sai rồi, vui lòng chọn lại đáp án'
          ? 'Chưa đúng. Hãy chọn lại đáp án!'
          : rawFeedback;
      }

      playInteractiveSound(isCorrect);
      if (isCorrect) {
        gateHoldPlaybackRef.current = false;
        setLocalDoneQuizIds((prev) => ({ ...prev, [activeQuizItem.id]: true }));
        setLocalAnsweredChoices((prev) => ({ ...prev, [activeQuizItem.id]: [...selectedChoiceIds] }));
        setQuizStatus('correct');
        setQuizFeedback(feedbackMsg || 'Chính xác! Đang tiếp tục video...');
        if (url) {
          if (!started) setStarted(true);
          playerApiRef.current?.play?.();
        }
        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = setTimeout(() => {
          if (!isLocalFallbackQuiz && !(activeQuizItem.confirmed === true && activeQuizItem.correct === true)) {
            void onAdvancePractice?.();
          }
          const nextIdx = safeQuizIdx + 1;
          if (nextIdx < quizItems.length) {
            const nextMilestone = getQuizMilestoneSecFor(nextIdx, videoDurationRef.current);
            if (!url || done || maxReachedSecRef.current >= nextMilestone || isQuizItemDone(quizItems[nextIdx])) {
              setActiveQuizIdx(nextIdx);
            } else {
              setQuizFeedback(
                `Chính xác! Tiếp tục xem video đến mốc ${formatMinuteSecond(nextMilestone)} để mở Câu ${nextIdx + 1}.`,
              );
            }
          } else {
            setQuizFeedback('Chính xác! Bạn đã hoàn thành tất cả câu hỏi tương tác.');
          }
        }, 700);
      } else {
        setQuizStatus('wrong');
        setQuizFeedback(feedbackMsg || 'Chưa đúng. Hãy thử chọn đáp án khác nhé!');
      }
    } finally {
      setQuizSubmitting(false);
    }
  };

  const watchedPct = done
    ? 100
    : videoProgress.duration > 0
      ? Math.min(100, Math.round((videoProgress.watchedSeconds / videoProgress.duration) * 100))
      : 0;
  const unitContents = unit.contents || [];
  const mainTabs: Array<{ id: VideoMainTab; label: string }> = [
    { id: 'lesson', label: 'Bài học hiện tại' },
    { id: 'curriculum', label: `Mục lục (${units.length || 1} buổi)` },
    { id: 'resources', label: 'Tài liệu (.xlsx)' },
  ];

  return (
    <View style={styles.videoPaneWrap}>
      <View style={styles.videoStageBox}>
        <View style={styles.videoStageHeader}>
          <View style={styles.videoStageUnitPill}>
            <Text numberOfLines={1} style={styles.videoStageUnitPillText}>
              {`Buổi ${Math.max(1, unitIndex + 1)} · ${done ? 'Đã hoàn thành ✓' : `Đã xem ${watchedPct}%`}`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            {done ? (
              <ShareTriggerButton
                onPress={() => onShareUnit?.()}
                label="SHARE"
                size="sm"
                variant="white"
                style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }}
              />
            ) : null}
            <View style={styles.videoStageCheckPill}>
              <Text numberOfLines={1} style={styles.videoStageCheckPillText}>
                {`${Math.min(safeQuizIdx + 1, quizItems.length)}/${quizItems.length} mốc câu hỏi`}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.videoFrame, styles.videoStageFrame]}>
          {started && (usingOfflineUri ? Boolean(offlineUri) : (embeddedUrl || directVideo)) ? (
            <VideoPlayerFrame
              videoUrl={usingOfflineUri && offlineUri ? offlineUri : resolveMobilePublicUrl(url)}
              embeddedUrl={usingOfflineUri ? '' : embeddedUrl}
              title={video?.title || unit.title}
              lessonId={`${userId || 'anon'}-${unit.id}-${video?.id || 'video'}`}
              antiSeekEnabled={antiSeekEnabled}
              done={done}
              initialAtSec={initialAtSec}
              playerApiRef={playerApiRef}
              onProgress={handleVideoProgress}
              onWatched={onComplete}
            />
          ) : (
            <View style={styles.videoStartOverlay}>
              <Pressable
                onPress={startVideo}
                disabled={!url}
                style={[styles.videoStartButton, !url && styles.actionDisabled]}
                accessibilityRole="button"
                accessibilityLabel="Bắt đầu phát video"
              >
                <Play size={22} color="#FFFFFF" fill="#FFFFFF" />
              </Pressable>
              <Text numberOfLines={2} style={styles.videoStageTitle}>{video?.title || unit.title}</Text>
              <Text numberOfLines={2} style={styles.videoStartLabel}>
                {url
                  ? (done ? 'Đã hoàn thành video · Nhấn để xem lại' : 'Nhấn để phát video · Trả lời mốc câu hỏi bên dưới')
                  : invalidLink
                    ? 'Liên kết video chưa đúng - trung tâm sẽ cập nhật sớm'
                    : 'Video chưa có liên kết · Đọc lý thuyết ở tab Tài liệu'}
              </Text>
            </View>
          )}
        </View>
      </View>

      {!url && unitContents.length ? (
        <View style={styles.contentCard}>
          <Text style={styles.contentTitle}>{unitContents[0].title || unit.title}</Text>
          <RenderHtml
            contentWidth={Math.max(1, contentWidth)}
            source={{ html: unitContents[0].content, baseUrl: getMobileApiBaseUrl() }}
            baseStyle={lessonHtmlBaseStyle}
            tagsStyles={lessonHtmlTags}
          />
        </View>
      ) : null}

      {Platform.OS !== 'web' && url ? (
        <View style={styles.offlineLessonCard}>
          <View style={styles.offlineLessonLeft}>
            <ShieldCheck size={14} color={offlineRecord ? '#059669' : '#64748B'} />
            <Text style={styles.offlineLessonText} numberOfLines={1}>
              {offlineDownloadPct !== null
                ? `Đang tải & mã hóa: ${offlineDownloadPct}%`
                : offlineRecord
                  ? `Đã tải offline (Mã hóa • ${formatOfflineBytes(offlineRecord.sizeBytes)})`
                  : directVideo
                    ? 'Hỗ trợ tải offline (Mã hóa nội bộ)'
                    : 'Link nhúng YouTube (chỉ tải offline MP4/WebM nội bộ)'}
            </Text>
          </View>
          {directVideo ? (
            <View style={styles.offlineLessonActions}>
              {offlineRecord ? (
                <>
                  <Pressable
                    onPress={() => { void handlePlayOfflineToggle(); }}
                    style={[styles.offlineActionBtn, usingOfflineUri && styles.offlineActionBtnActive]}
                    accessibilityRole="button"
                  >
                    <Text style={[styles.offlineActionBtnText, usingOfflineUri && styles.offlineActionBtnTextActive]}>
                      {usingOfflineUri ? 'Đang phát Offline' : 'Phát Offline'}
                    </Text>
                  </Pressable>
                  <Pressable onPress={handleDeleteOffline} style={styles.offlineTrashButton} accessibilityRole="button">
                    <Trash2 size={14} color="#DC2626" />
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => { void handleDownloadOffline(); }}
                  disabled={offlineDownloadPct !== null}
                  style={styles.offlineActionBtn}
                  accessibilityRole="button"
                >
                  <Download size={13} color="#047857" />
                  <Text style={styles.offlineActionBtnText}>
                    {offlineDownloadPct !== null ? `${offlineDownloadPct}%` : 'Tải Offline'}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.videoTopTabBar} accessibilityRole="tablist">
        {mainTabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.videoTopTabBtn, active && styles.videoTopTabBtnActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text numberOfLines={1} style={[styles.videoTopTabText, active && styles.videoTopTabTextActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {activeTab === 'lesson' ? (
        <View style={styles.videoLessonBody}>
          {activeQuizItem ? (() => {
            const effectiveChoiceIds = activeQuizDone
              ? (selectedChoiceIds.length ? selectedChoiceIds : getSavedQuizChoices(activeQuizItem))
              : selectedChoiceIds;
            const nextIdx = safeQuizIdx + 1;
            const nextLocked = nextIdx < quizItems.length && !isQuizUnlocked(nextIdx);
            const submitDisabled = !effectiveChoiceIds.length || quizSubmitting || quizStatus === 'correct' || quizStatus === 'wrong' || activeQuizDone;
            return (
              <View style={styles.videoQuizSheet}>
                {quizItems.length > 1 ? (
                  <View style={styles.videoQuizSwitcherRow}>
                    {quizItems.map((qItem, qIdx) => {
                      const qActive = qIdx === safeQuizIdx;
                      const qDone = isQuizItemDone(qItem);
                      const qUnlocked = isQuizUnlocked(qIdx);
                      const qMilestoneSec = getQuizMilestoneSec(qIdx);
                      return (
                        <Pressable
                          key={qItem.id}
                          onPress={() => { if (qUnlocked) setActiveQuizIdx(qIdx); }}
                          disabled={!qUnlocked}
                          style={[
                            styles.videoQuizSwitchPill,
                            qDone && styles.videoQuizSwitchPillDone,
                            !qUnlocked && styles.videoQuizSwitchPillLocked,
                            qActive && styles.videoQuizSwitchPillActive,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: qActive, disabled: !qUnlocked }}
                        >
                          <Text
                            numberOfLines={1}
                            style={[
                              styles.videoQuizSwitchText,
                              qDone && styles.videoQuizSwitchTextDone,
                              !qUnlocked && styles.videoQuizSwitchTextLocked,
                              qActive && styles.videoQuizSwitchTextActive,
                            ]}
                          >
                            {qDone
                              ? `Câu ${qIdx + 1} ✓`
                              : qUnlocked
                                ? `Câu ${qIdx + 1}`
                                : `🔒 Câu ${qIdx + 1} · ${formatMinuteSecond(qMilestoneSec)}`}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}

                <Text style={styles.videoQuizPrompt}>{activeQuizItem.prompt || 'Chọn đáp án đúng nhất:'}</Text>

                {activeQuizItem.imageUrl ? (
                  <Image
                    source={{ uri: resolveMobilePublicUrl(activeQuizItem.imageUrl) }}
                    style={styles.videoQuizImage}
                    resizeMode="contain"
                  />
                ) : null}

                <View style={styles.videoQuizOptions}>
                  {(activeQuizItem.options || []).map((option, optIdx) => {
                    const chosen = effectiveChoiceIds.includes(option.id);
                    const letter = QUIZ_LETTERS[optIdx] || String(optIdx + 1);
                    const isWrongChoice = chosen && quizStatus === 'wrong';
                    return (
                      <Pressable
                        key={option.id}
                        onPress={() => toggleQuizOption(option.id)}
                        disabled={quizSubmitting || quizStatus === 'correct' || activeQuizDone}
                        style={[
                          styles.videoQuizOption,
                          chosen && styles.videoQuizOptionSelected,
                          isWrongChoice && styles.videoQuizOptionWrong,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: chosen, disabled: activeQuizDone }}
                      >
                        <Text
                          style={[
                            styles.videoQuizOptionText,
                            chosen && styles.videoQuizOptionTextSelected,
                            isWrongChoice && styles.videoQuizOptionTextWrong,
                          ]}
                        >
                          {`${letter}. ${option.text}`}
                        </Text>
                        {chosen ? (
                          activeQuizDone
                            ? <CheckCircle2 size={16} color="#059669" />
                            : <View style={[styles.videoQuizDot, isWrongChoice && styles.videoQuizDotWrong]} />
                        ) : null}
                      </Pressable>
                    );
                  })}
                </View>

                {showQuizHint ? (
                  <View style={styles.videoQuizHintBox}>
                    <Lightbulb size={15} color="#B45309" />
                    <Text style={styles.videoQuizHintText}>
                      {activeQuizItem.hint || 'Hãy xem kỹ thao tác hướng dẫn trong video bài giảng để chọn đáp án chính xác.'}
                    </Text>
                  </View>
                ) : null}

                {quizFeedback ? (
                  <View style={[styles.videoQuizFeedbackBox, quizStatus === 'wrong' ? styles.videoQuizFeedbackBad : styles.videoQuizFeedbackGood]}>
                    <Text style={[styles.videoQuizFeedbackText, quizStatus === 'wrong' ? styles.videoQuizFeedbackTextBad : styles.videoQuizFeedbackTextGood]}>
                      {quizFeedback}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.videoQuizActions}>
                  <Pressable
                    onPress={() => setShowQuizHint((prev) => !prev)}
                    style={styles.videoQuizHintBtn}
                    accessibilityRole="button"
                  >
                    <Lightbulb size={15} color="#B45309" />
                    <Text style={styles.videoQuizHintBtnText}>Gợi ý</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { void submitInteractiveQuiz(); }}
                    disabled={submitDisabled}
                    style={[
                      styles.videoQuizSubmitBtn,
                      submitDisabled && styles.videoQuizSubmitBtnDisabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: submitDisabled }}
                  >
                    {quizSubmitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : activeQuizDone ? (
                      <Text numberOfLines={2} style={[styles.videoQuizSubmitText, { textAlign: 'center' }]}>
                        {nextLocked
                          ? `Xem đến mốc ${formatMinuteSecond(getQuizMilestoneSec(nextIdx))} để mở Câu ${nextIdx + 1}`
                          : 'Đã trả lời đúng ✓'}
                      </Text>
                    ) : (
                      <>
                        <Text numberOfLines={1} style={styles.videoQuizSubmitText}>Xác nhận & Xem tiếp</Text>
                        <Play size={13} color="#FFFFFF" fill="#FFFFFF" />
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })() : null}
        </View>
      ) : activeTab === 'curriculum' ? (
        <View style={styles.curriculumTabWrap}>
          {(units.length ? units : [unit]).map((item, idx) => {
              const active = item.id === unit.id;
              const locked = Boolean(item.locked);
              const completed = item.status === 'completed';
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    if (locked) {
                      Alert.alert('Bài học đang khóa', 'Hoàn thành buổi học trước để mở nội dung này.');
                      return;
                    }
                    if (item.id !== unit.id && onSelectUnit) {
                      onSelectUnit(item);
                    }
                    setActiveTab('lesson');
                  }}
                  style={[
                    styles.curriculumItemCard,
                    active && styles.curriculumItemCardActive,
                    completed && !active && styles.curriculumItemCardDone,
                    locked && styles.curriculumItemCardLocked,
                  ]}
                  accessibilityRole="button"
                >
                  <View style={[
                    styles.curriculumIdxBox,
                    completed && styles.curriculumIdxBoxDone,
                    active && styles.curriculumIdxBoxActive,
                    locked && styles.curriculumIdxBoxLocked,
                  ]}>
                    {completed && !active
                      ? <CheckCircle2 size={16} color="#059669" />
                      : locked
                        ? <Lock size={14} color="#94A3B8" />
                        : (
                          <Text style={[styles.curriculumIdxText, active && styles.curriculumIdxTextActive]}>
                            {String(idx + 1).padStart(2, '0')}
                          </Text>
                        )}
                  </View>
                  <View style={styles.flex}>
                    <Text numberOfLines={2} style={[styles.unitTitle, locked && styles.unitTitleLocked]}>
                      {item.title}
                    </Text>
                    <View style={styles.curriculumChipRow}>
                      <View style={[styles.curriculumCompChip, item.videoDone && styles.curriculumCompChipDone]}>
                        <Text style={[styles.curriculumCompText, item.videoDone && styles.curriculumCompTextDone]}>
                          {`🎬 Video`}
                        </Text>
                      </View>
                      <View style={[styles.curriculumCompChip, item.noteDone && styles.curriculumCompChipDone]}>
                        <Text style={[styles.curriculumCompText, item.noteDone && styles.curriculumCompTextDone]}>
                          {`📝 Lý thuyết`}
                        </Text>
                      </View>
                      {item.hasPractice !== false ? (
                        <View style={[styles.curriculumCompChip, item.practiceDone && styles.curriculumCompChipDone]}>
                          <Text style={[styles.curriculumCompText, item.practiceDone && styles.curriculumCompTextDone]}>
                            {`🎯 Bài tập`}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={[
                    styles.unitAction,
                    locked && styles.unitActionLocked,
                    completed && !active && styles.unitActionCompleted,
                  ]}>
                    <Text style={[
                      styles.unitActionText,
                      locked && styles.unitActionTextLocked,
                      completed && !active && styles.unitActionTextCompleted,
                    ]}>
                      {locked ? 'Khóa' : active ? 'Đang học' : completed ? 'Xem lại' : 'Học ngay'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
        </View>
      ) : (
        <View style={styles.resourcesTabWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.resourcesSubTabBar} accessibilityRole="tablist">
            {([
              { id: 'resources', label: 'Tài liệu', icon: FileText },
              { id: 'notes', label: 'Ghi chú', icon: StickyNote },
              { id: 'qa', label: 'Hỏi đáp', icon: MessageSquare },
              { id: 'reviews', label: 'Đánh giá', icon: Star },
            ] as const).map((sub) => {
              const SubIcon = sub.icon;
              const isSubActive = resourceSubTab === sub.id;
              return (
                <Pressable
                  key={sub.id}
                  onPress={() => setResourceSubTab(sub.id)}
                  style={[styles.videoTab, styles.resourcesSubTab, isSubActive && styles.videoTabActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isSubActive }}
                >
                  <SubIcon size={12} color={isSubActive ? '#FFFFFF' : '#92400E'} />
                  <Text numberOfLines={1} style={[styles.videoTabText, styles.resourcesSubTabText, isSubActive && styles.videoTabTextActive]}>{sub.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {resourceSubTab === 'resources' && unitContents.length ? (
            <View style={styles.contentCard}>
              {unitContents.map((entry) => {
                const noteDone = Boolean(unit.noteDoneIds?.includes(entry.id) || (unit.noteDone && entry.id === 'legacy-note'));
                return (
                  <View key={entry.id} style={styles.resourceNoteBlock}>
                    <Text style={styles.contentTitle}>{entry.title || 'Nội dung trọng tâm'}</Text>
                    <RenderHtml
                      contentWidth={Math.max(1, contentWidth)}
                      source={{ html: entry.content, baseUrl: getMobileApiBaseUrl() }}
                      baseStyle={lessonHtmlBaseStyle}
                      tagsStyles={lessonHtmlTags}
                    />
                    {noteDone ? (
                      <Text style={styles.practiceSuccess}>Đã đọc xong lý thuyết bài học.</Text>
                    ) : onCompleteSection ? (
                      <Pressable
                        onPress={() => { void onCompleteSection('note', entry.id); }}
                        style={styles.completeSectionButton}
                        accessibilityRole="button"
                      >
                        <CheckCircle2 size={16} color="#FFFFFF" />
                        <Text style={styles.completeSectionButtonText}>Đã đọc xong · Tiếp tục</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.resourcesTabsCard}>
            <VideoLessonTabs
              activeTab={resourceSubTab}
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
              onSeekTo={handleSeekTo}
            />
          </View>
        </View>
      )}
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
          }} accessibilityRole="button" accessibilityLabel="Di chuyển lên"><ChevronUp size={18} color={theme.brand} /></Pressable>
          <Pressable disabled={answerState === 'correct' || cooldown > 0} onPress={() => {
            setAnswerState('idle'); setFeedback('');
            setSelected((current) => {
              const next = current.length ? [...current] : options.map((entry) => entry.id);
              if (optionIndex < next.length - 1) [next[optionIndex + 1], next[optionIndex]] = [next[optionIndex], next[optionIndex + 1]];
              return next;
            });
          }} accessibilityRole="button" accessibilityLabel="Di chuyển xuống"><ChevronDown size={18} color={theme.brand} /></Pressable>
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

const styles = createThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  screenContent: { gap: spacing.md, backgroundColor: '#FFFBF2', paddingBottom: spacing.xl },
  relatedTopics: {
    height: RELATED_STRIP_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.xs,
    paddingHorizontal: spacing.sm, borderRadius: radius.md, borderWidth: 1.5, borderColor: '#FDE68A', backgroundColor: '#FFFBEB',
  },
  relatedTopicsTitle: { color: '#92400E', fontSize: 12, fontWeight: '900' },
  relatedTopicsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  relatedTopicChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%', paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, borderWidth: 1.5, borderColor: '#FCD34D', backgroundColor: '#FFFFFF',
  },
  relatedTopicText: { color: colors.ink, fontSize: 12, fontWeight: '800', flexShrink: 1 },
  headerBand: { marginHorizontal: -spacing.xl, marginTop: -spacing.md, marginBottom: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, backgroundColor: '#FFFBF2' },
  headerGroup: { marginBottom: spacing.xs },
  courseCardWrap: { width: '100%', position: 'relative' },
  courseCardWrapActive: { zIndex: 20 },
  filtersOuter: {
    alignSelf: 'stretch',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
    padding: 4,
    marginBottom: spacing.xs,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  filterChip: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  filterChipActive: {
    borderColor: '#10B981',
    borderBottomWidth: 3,
    borderBottomColor: '#047857',
    backgroundColor: '#10B981',
  },
  filterText: { color: '#92400E', fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: '#FFFFFF', fontWeight: '900' },
  filterCount: {
    minWidth: 19,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
    borderRadius: radius.pill,
    backgroundColor: '#FDE68A',
    color: '#92400E',
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '900',
  },
  filterCountActive: { backgroundColor: '#047857', color: '#FFFFFF' },
  courseSection: { width: '100%', alignSelf: 'stretch', marginTop: spacing.xs, gap: spacing.md },
  courseList: { width: '100%', gap: spacing.md },
  registeredCourseCard: { width: '100%', alignSelf: 'stretch' },
  sectionHeaderWrap: { gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sectionDivider: { height: 2, marginLeft: 54, borderRadius: 2 },
  registeredDivider: { backgroundColor: '#A7F3D0' },
  videoDivider: { backgroundColor: '#FDE68A' },
  instructorDivider: { backgroundColor: '#BAE6FD' },
  sectionIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(15,23,42,0.08)' },
  registeredIcon: { backgroundColor: '#D1FAE5', borderColor: '#A7F3D0' },
  videoIcon: { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
  instructorIcon: { backgroundColor: '#E0F2FE', borderColor: '#BAE6FD' },
  sectionCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#94A3B8', fontSize: 10, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  sectionTitle: { flexShrink: 1, color: '#0F172A', fontSize: 16, fontWeight: '900' },
  sectionCount: { minWidth: 22, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  registeredCount: { backgroundColor: '#D1FAE5', color: '#047857' },
  videoCount: { backgroundColor: '#FEF3C7', color: '#92400E' },
  instructorCount: { backgroundColor: '#E0F2FE', color: '#075985' },
  sectionDescription: { marginTop: 3, color: colors.muted, fontSize: typography.micro, lineHeight: 15 },
  courseCard: {
    flex: 1,
    gap: 0,
    overflow: 'hidden',
    padding: 0,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 5,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  courseCardEnrolled: {
    borderColor: '#6EE7B7',
    borderBottomColor: '#10B981',
  },
  courseCardContent: { flex: 1 },
  courseCardHovered: { borderColor: '#10B981', shadowColor: '#0F172A', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  courseBanner: { height: 98, position: 'relative', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  bannerRing: { position: 'absolute', width: 142, height: 142, right: -38, top: -49, borderWidth: 18, borderRadius: 80 },
  lockBadge: { position: 'absolute', left: 12, top: 12, width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FEF3C7' },
  courseMode: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingLeft: 6, paddingRight: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)', borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.96)' },
  courseModeIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  courseModeIconInstructor: { backgroundColor: '#D1FAE5' },
  courseModeIconVideo: { backgroundColor: '#FEF3C7' },
  courseModeText: { color: '#1E293B', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
  offerBadge: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.95)' },
  offerText: { color: '#334155', fontSize: 10, fontWeight: '800' },
  courseInfo: { minHeight: 118, padding: spacing.md, paddingBottom: spacing.sm },
  courseTitle: { minHeight: 34, color: colors.ink, fontSize: 14, lineHeight: 18, fontWeight: '900' },
  parentCourseName: { marginTop: 2, color: '#64748B', fontSize: 11, fontWeight: '700' },
  subjectChips: { minHeight: 35, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 4, marginTop: 6 },
  subjectLabel: { paddingTop: 4, color: colors.muted, fontSize: typography.micro },
  subjectChip: { maxWidth: 140, paddingHorizontal: 6, paddingVertical: 3, overflow: 'hidden', borderRadius: 5, backgroundColor: '#EFF6FF', color: '#2563EB', fontSize: typography.micro },
  subjectChipRose: { backgroundColor: '#FFF1F2', color: '#E11D48' },
  subjectChipViolet: { backgroundColor: '#F5F3FF', color: '#7C3AED' },
  subjectChipAmber: { backgroundColor: '#FFFBEB', color: '#D97706' },
  courseFooter: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginTop: 'auto', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  progressCircle: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#D1DCE7', borderRadius: 13 },
  progressText: { color: colors.ink, fontSize: typography.micro, fontWeight: '900' },
  lessonCount: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  enrolledBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: '#ECFDF5', color: '#047857', fontSize: typography.micro, fontWeight: '900' },
  priceBox: { alignItems: 'flex-end', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', paddingHorizontal: 9, paddingVertical: 5 },
  priceBoxSale: { borderColor: '#FFE4E6', backgroundColor: '#FFF1F2' },
  saleMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  originalPriceText: { fontSize: 9, fontWeight: '600', color: '#94A3B8', textDecorationLine: 'line-through' },
  discountPctText: { fontSize: 8, fontWeight: '900', color: '#BE123C', backgroundColor: '#FFE4E6', borderRadius: 999, paddingHorizontal: 4, paddingVertical: 1 },
  priceText: { color: '#1E293B', fontSize: 14, fontWeight: '900' },
  priceTextSale: { color: '#BE123C' },
  courseActions: { minHeight: 54, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: 10, paddingBottom: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFFDF5' },
  courseActionsCentered: { justifyContent: 'center' },
  zaloButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#BAE6FD', borderBottomWidth: 3, borderBottomColor: '#38BDF8', backgroundColor: '#E0F2FE' },
  zaloButtonText: { color: '#075985', fontSize: 12, fontWeight: '900' },
  courseTooltip: { position: 'absolute', top: 76, left: 10, right: 10, zIndex: 30, gap: 7, padding: spacing.md, borderWidth: 2, borderColor: '#FDE68A', borderRadius: 18, backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.2, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  tooltipTitle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  tooltipHeading: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  tooltipLine: { color: '#475569', fontSize: typography.caption, lineHeight: 16 },
  tooltipWarning: { marginTop: 2, paddingTop: spacing.xs, borderTopWidth: 1, borderTopColor: '#D1FAE5', color: colors.ink, fontSize: typography.micro, lineHeight: 15, fontWeight: '700' },
  registerButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#FDE68A', borderBottomWidth: 3, borderBottomColor: '#F59E0B', backgroundColor: '#FEF3C7' },
  registerText: { color: '#92400E', fontSize: 12, fontWeight: '900' },
  openButton: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 15, borderRadius: 14, borderBottomWidth: 3, borderBottomColor: '#047857', backgroundColor: '#10B981' },
  openButtonActive: { backgroundColor: '#10B981' },
  openButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  openButtonTextActive: { color: '#FFFFFF' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-start', backgroundColor: 'rgba(15,23,42,0.55)' },
  modalCard: { width: '100%', height: '100%', maxHeight: '100%', paddingTop: spacing.md, borderRadius: 0, backgroundColor: '#FFFBF2' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 2, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  modalBack: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#A7F3D0', borderBottomWidth: 3, borderBottomColor: '#34D399', borderRadius: 13, backgroundColor: '#ECFDF5' },
  headerLessonNav: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: spacing.sm, borderWidth: 2, borderColor: '#E2E8F0', borderBottomWidth: 3, borderBottomColor: '#CBD5E1', borderRadius: 13, backgroundColor: '#FFFFFF' },
  headerLessonNavOpen: { borderColor: '#10B981', borderBottomColor: '#047857', backgroundColor: '#ECFDF5' },
  headerLessonNavText: { color: colors.brandDark, fontSize: typography.micro, fontWeight: '900' },
  headerProgressPill: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: '#A7F3D0',
    borderBottomWidth: 3,
    borderBottomColor: '#34D399',
    backgroundColor: '#ECFDF5',
  },
  headerProgressPillText: { color: '#047857', fontSize: 11.5, fontWeight: '900' },
  modalTitle: { marginTop: 3, color: colors.ink, fontSize: typography.heading, fontWeight: '900' },
  muted: { color: colors.muted, fontSize: typography.micro },
  backText: { paddingTop: spacing.md, color: colors.brand, fontSize: typography.caption, fontWeight: '800' },
  modalClose: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, borderWidth: 1, borderColor: colors.line },
  closeText: { color: colors.muted, fontSize: typography.title, lineHeight: 25 },
  modalContent: { flex: 1, minHeight: 0, backgroundColor: '#FFFBF2' },
  modalContentScroll: { flex: 1 },
  modalContentInner: { gap: spacing.sm, padding: spacing.lg },
  subjectCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 2, borderColor: '#E2E8F0', borderBottomWidth: 5, borderBottomColor: '#CBD5E1', borderRadius: 18, backgroundColor: '#FFFFFF' },
  unitNumber: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#FEF3C7', borderWidth: 1.5, borderColor: '#FDE68A' },
  unitNumberDone: { backgroundColor: '#D1FAE5', borderColor: '#6EE7B7' },
  unitNumberText: { color: '#92400E', fontSize: typography.caption, fontWeight: '900' },
  unitTitle: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  progressTrack: { height: 7, marginTop: 7, overflow: 'hidden', borderRadius: 999, backgroundColor: '#E2E8F0' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#10B981' },
  unitsIntro: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: 16, borderWidth: 1.5, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  unitsIntroIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: '#D1FAE5' },
  unitsIntroTitle: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  unitRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderWidth: 2, borderColor: '#E2E8F0', borderBottomWidth: 5, borderBottomColor: '#CBD5E1', borderRadius: 18, backgroundColor: '#FFFFFF' },
  unitRowLocked: { borderColor: '#E2E8F0', borderBottomColor: '#CBD5E1', backgroundColor: '#F8FAFC' },
  unitRowCompleted: { borderColor: '#6EE7B7', borderBottomColor: '#34D399', backgroundColor: '#ECFDF5' },
  unitRowBusy: { opacity: 0.65 },
  unitNumberLocked: { backgroundColor: '#E2E8F0', borderColor: '#CBD5E1' },
  unitTitleLocked: { color: '#64748B' },
  unitStatus: { marginTop: 4, color: colors.muted, fontSize: typography.micro, lineHeight: 16 },
  unitStatusLocked: { color: '#94A3B8' },
  unitAction: { minHeight: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 12, borderBottomWidth: 3, borderBottomColor: '#047857', backgroundColor: '#10B981' },
  unitActionLocked: { backgroundColor: '#E2E8F0', borderBottomWidth: 0 },
  unitActionCompleted: { backgroundColor: '#D1FAE5', borderWidth: 1.5, borderColor: '#6EE7B7', borderBottomWidth: 3, borderBottomColor: '#34D399' },
  unitActionText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '900' },
  unitActionTextLocked: { color: '#64748B' },
  unitActionTextCompleted: { color: '#047857' },
  lessonPage: { position: 'relative', flex: 1, minHeight: 0, gap: spacing.sm, padding: spacing.sm, backgroundColor: '#FFFBF2' },
  lessonMainColumn: { zIndex: 0, flex: 1, minWidth: 0 },
  lessonMainContent: { gap: spacing.md, padding: spacing.sm, paddingBottom: spacing.xl },
  lessonNavigationFooter: { flexShrink: 0, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, borderTopWidth: 2, borderTopColor: '#E2E8F0', backgroundColor: '#FFFBF2' },
  lessonDrawerOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
  lessonDrawerBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.35)' },
  lessonDrawer: { height: '100%', marginLeft: 'auto', padding: spacing.md, borderLeftWidth: 1, borderLeftColor: '#E2E8F0', backgroundColor: '#FFFFFF', shadowColor: '#0F172A', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: -6, height: 0 }, elevation: 12 },
  lessonDrawerTitle: { marginBottom: spacing.sm, color: colors.ink, fontSize: typography.body, fontWeight: '900' },
  unitNavTopScroll: { flexGrow: 0, flexShrink: 1, maxHeight: '42%' },
  unitNavToggle: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: '#CBD5E1', borderRadius: radius.md, backgroundColor: '#FFFFFF' },
  unitNavToggleOpen: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  unitNavToggleIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: '#ECFDF5' },
  unitNavToggleTitle: { color: colors.ink, fontSize: typography.caption, fontWeight: '900' },
  unitNavToggleSubtitle: { marginTop: 2, color: colors.muted, fontSize: typography.micro },
  unitNavList: { gap: spacing.xs, padding: spacing.sm, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: radius.md, backgroundColor: '#F8FAFC' },
  unitNavItem: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 11, backgroundColor: '#FFFFFF' },
  unitNavItemActive: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  unitNavItemLocked: { backgroundColor: '#F1F5F9' },
  unitNavNumber: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: '#F1F5F9' },
  unitNavNumberActive: { backgroundColor: colors.brand },
  unitNavNumberLocked: { backgroundColor: '#E2E8F0' },
  unitNavNumberText: { color: '#475569', fontSize: typography.micro, fontWeight: '900' },
  unitNavNumberTextActive: { color: '#FFFFFF' },
  unitNavItemTitle: { flex: 1, color: colors.ink, fontSize: typography.caption, fontWeight: '800' },
  unitNavItemTitleActive: { color: '#047857' },
  unitNavItemTitleLocked: { color: '#94A3B8' },
  unitNavCurrent: { color: '#047857', fontSize: typography.micro, fontWeight: '900' },
  lessonNavGroup: { gap: 2 },
  unitNavSubItem: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginLeft: 26, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 9, backgroundColor: '#FFFFFF' },
  unitNavSubItemActive: { borderColor: colors.brand, backgroundColor: '#ECFDF5' },
  unitNavSubItemLocked: { backgroundColor: '#F1F5F9' },
  unitNavSubItemText: { flex: 1, color: '#334155', fontSize: typography.micro, fontWeight: '700' },
  unitNavSubItemTextActive: { color: colors.brandDark },
  unitNavReplay: { color: '#047857', fontSize: typography.micro, fontWeight: '900' },
  unitDetails: { position: 'relative', gap: spacing.md },
  sectionCelebration: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 5, overflow: 'visible' },
  sectionFireworkParticle: { position: 'absolute', width: 6, height: 9, borderRadius: 2 },
  videoPlay: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.blueSoft },
  videoPaneWrap: { gap: spacing.sm },
  videoTopTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 4,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
  },
  videoTopTabBtn: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 12,
  },
  videoTopTabBtnActive: {
    backgroundColor: '#10B981',
    borderBottomWidth: 3,
    borderBottomColor: '#047857',
  },
  videoTopTabText: { color: '#92400E', fontSize: 11.5, fontWeight: '800', textAlign: 'center' },
  videoTopTabTextActive: { color: '#FFFFFF', fontWeight: '900' },
  videoLessonBody: { gap: spacing.sm },
  videoStageBox: {
    overflow: 'hidden',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#1E293B',
    borderBottomWidth: 5,
    borderBottomColor: '#0F172A',
    backgroundColor: '#0B1623',
  },
  videoStageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#0F1F2E',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  videoStageUnitPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  videoStageUnitPillText: { color: '#F8FAFC', fontSize: 10.5, fontWeight: '800' },
  videoStageCheckPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  videoStageCheckPillText: { color: '#92400E', fontSize: 10.5, fontWeight: '900' },
  videoStageFrame: { marginTop: 0, borderRadius: 0 },
  videoStageTitle: {
    marginTop: 8,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '900',
    textAlign: 'center',
  },
  offlineLessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    flexWrap: 'wrap',
  },
  videoQuizSheet: {
    gap: 10,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#6EE7B7',
    borderBottomWidth: 5,
    borderBottomColor: '#34D399',
    backgroundColor: '#FFFFFF',
  },
  videoQuizMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  videoQuizCheckPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  videoQuizCheckPillText: { color: '#047857', fontSize: 10.5, fontWeight: '900' },
  videoQuizXpPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  videoQuizXpPillText: { color: '#92400E', fontSize: 10.5, fontWeight: '900' },
  videoQuizDoneStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  videoQuizDoneText: { color: '#047857', fontSize: 11.5, fontWeight: '800' },
  videoQuizSwitcherRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, paddingVertical: 2 },
  videoQuizSwitchPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  videoQuizSwitchPillDone: {
    borderColor: '#10B981',
    backgroundColor: '#D1FAE5',
  },
  videoQuizSwitchPillLocked: {
    borderColor: '#E2E8F0',
    backgroundColor: '#F1F5F9',
    opacity: 0.65,
  },
  videoQuizSwitchPillActive: {
    borderColor: '#047857',
    backgroundColor: '#10B981',
  },
  videoQuizSwitchText: { color: '#92400E', fontSize: 11, fontWeight: '800' },
  videoQuizSwitchTextDone: { color: '#047857', fontWeight: '900' },
  videoQuizSwitchTextLocked: { color: '#94A3B8', fontWeight: '700' },
  videoQuizSwitchTextActive: { color: '#FFFFFF', fontWeight: '900' },
  videoQuizPrompt: { color: '#0F172A', fontSize: 14, lineHeight: 20, fontWeight: '900' },
  videoQuizImage: { width: '100%', height: 150, borderRadius: 12, backgroundColor: '#F8FAFC' },
  videoQuizOptions: { gap: 8 },
  videoQuizOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderBottomWidth: 3,
    borderBottomColor: '#FCD34D',
    backgroundColor: '#FFFDF5',
  },
  videoQuizOptionSelected: {
    borderColor: '#10B981',
    borderBottomColor: '#059669',
    backgroundColor: '#D1FAE5',
  },
  videoQuizOptionWrong: {
    borderColor: '#EF4444',
    borderBottomColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  videoQuizOptionText: { flex: 1, color: '#1E293B', fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
  videoQuizOptionTextSelected: { color: '#065F46', fontWeight: '900' },
  videoQuizOptionTextWrong: { color: '#B91C1C', fontWeight: '800' },
  videoQuizDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#059669' },
  videoQuizDotWrong: { backgroundColor: '#DC2626' },
  videoQuizHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  videoQuizHintText: { flex: 1, color: '#92400E', fontSize: 12, lineHeight: 17, fontWeight: '700' },
  videoQuizFeedbackBox: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  videoQuizFeedbackGood: { borderColor: '#6EE7B7', backgroundColor: '#ECFDF5' },
  videoQuizFeedbackBad: { borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' },
  videoQuizFeedbackText: { fontSize: 12, fontWeight: '800', lineHeight: 17 },
  videoQuizFeedbackTextGood: { color: '#047857' },
  videoQuizFeedbackTextBad: { color: '#B91C1C' },
  videoQuizActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  videoQuizHintBtn: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FDE68A',
    borderBottomWidth: 4,
    borderBottomColor: '#F59E0B',
    backgroundColor: '#FFFDF5',
  },
  videoQuizHintBtnText: { color: '#92400E', fontSize: 12.5, fontWeight: '900' },
  videoQuizSubmitBtn: {
    flex: 1,
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#10B981',
    borderBottomWidth: 4,
    borderBottomColor: '#047857',
    backgroundColor: '#10B981',
  },
  videoQuizSubmitBtnDisabled: { opacity: 0.5 },
  videoQuizSubmitText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '900' },
  curriculumTabWrap: { gap: spacing.sm },
  curriculumSummaryCard: {
    gap: 8,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#A7F3D0',
    borderBottomWidth: 4,
    borderBottomColor: '#34D399',
    backgroundColor: '#FFFFFF',
  },
  curriculumSummaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  curriculumEyebrow: { color: '#059669', fontSize: 10.5, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  curriculumHeading: { marginTop: 2, color: '#0F172A', fontSize: 14.5, fontWeight: '900' },
  curriculumCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: '#FEF3C7',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
  },
  curriculumCountBadgeText: { color: '#92400E', fontSize: 11, fontWeight: '900' },
  curriculumSubNote: { color: '#64748B', fontSize: 11.5, fontWeight: '700' },
  curriculumItemCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  curriculumItemCardActive: { borderColor: '#10B981', borderBottomColor: '#059669', backgroundColor: '#ECFDF5' },
  curriculumItemCardDone: { borderColor: '#A7F3D0', borderBottomColor: '#34D399', backgroundColor: '#FFFFFF' },
  curriculumItemCardLocked: { borderColor: '#E2E8F0', borderBottomColor: '#CBD5E1', backgroundColor: '#F8FAFC', opacity: 0.78 },
  curriculumIdxBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    backgroundColor: '#FEF3C7',
  },
  curriculumIdxBoxDone: { borderColor: '#6EE7B7', backgroundColor: '#D1FAE5' },
  curriculumIdxBoxActive: { borderColor: '#047857', backgroundColor: '#10B981' },
  curriculumIdxBoxLocked: { borderColor: '#CBD5E1', backgroundColor: '#E2E8F0' },
  curriculumIdxText: { color: '#92400E', fontSize: 12, fontWeight: '900' },
  curriculumIdxTextActive: { color: '#FFFFFF' },
  curriculumChipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 6 },
  curriculumCompChip: {
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  curriculumCompChipDone: {
    borderColor: '#A7F3D0',
    backgroundColor: '#D1FAE5',
  },
  curriculumCompText: { color: '#64748B', fontSize: 10, fontWeight: '800' },
  curriculumCompTextDone: { color: '#047857', fontWeight: '900' },
  resourcesTabWrap: { gap: spacing.sm },
  resourcesSubTabBar: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 2 },
  resourcesSubTab: { minHeight: 34, gap: 4, paddingHorizontal: 9, paddingVertical: 5 },
  resourcesSubTabText: { fontSize: 11.5 },
  resourceNoteBlock: { gap: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  resourcesTabsCard: {
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderBottomWidth: 5,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  videoFrame: { position: 'relative', width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', marginTop: spacing.sm, borderRadius: 16, backgroundColor: '#080D19' },
  videoStartOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, backgroundColor: '#0B1623' },
  videoBrandBadge: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6, backgroundColor: colors.brand },
  videoBrandText: { color: '#FFFFFF', fontSize: typography.micro, fontWeight: '900', letterSpacing: 0.6 },
  videoStartButton: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, borderWidth: 2, borderColor: '#6EE7B7', borderBottomWidth: 4, borderBottomColor: '#047857', backgroundColor: '#10B981', shadowColor: '#10B981', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 5 },
  videoStartLabel: { marginTop: 4, color: 'rgba(226,232,240,0.82)', fontSize: 11.5, fontWeight: '700', textAlign: 'center' },
  videoTab: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    backgroundColor: '#FFFDF5',
  },
  videoTabActive: {
    borderColor: '#10B981',
    borderBottomWidth: 3,
    borderBottomColor: '#047857',
    backgroundColor: '#10B981',
  },
  videoTabText: { color: '#92400E', fontSize: 12, fontWeight: '800' },
  videoTabTextActive: { color: '#FFFFFF', fontWeight: '900' },
  videoWatchProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  videoWatchProgressLabel: { color: '#065F46', fontSize: 12, fontWeight: '800' },
  videoWatchProgressValue: { color: '#059669', fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  videoWatchProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#D1FAE5',
    overflow: 'hidden',
  },
  videoWatchProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  videoTabContent: { gap: spacing.xs, padding: spacing.sm, borderRadius: radius.sm, backgroundColor: colors.canvas },
  videoTabEmpty: { minHeight: 60, justifyContent: 'center', paddingVertical: spacing.xs },
  contentCard: { gap: spacing.xs, padding: spacing.md, borderWidth: 2, borderColor: '#E2E8F0', borderBottomWidth: 5, borderBottomColor: '#CBD5E1', borderRadius: 20, backgroundColor: '#FFFFFF' },
  contentTitle: { color: colors.ink, fontSize: typography.small, fontWeight: '800' },
  unitNavigation: { flexDirection: 'row', gap: spacing.sm },
  sectionNavigation: { flexDirection: 'row', gap: spacing.sm },
  sectionNavigationButton: { minHeight: 42, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, paddingHorizontal: spacing.sm, borderWidth: 2, borderColor: '#CBD5E1', borderBottomWidth: 4, borderBottomColor: '#94A3B8', borderRadius: 14, backgroundColor: '#FFFFFF' },
  previousSectionButton: { justifyContent: 'flex-start' },
  nextSectionButton: { justifyContent: 'flex-end', borderColor: '#6EE7B7', borderBottomColor: '#10B981', backgroundColor: '#ECFDF5' },
  sectionNavigationLabel: { flexShrink: 1, color: colors.ink, fontSize: typography.micro, fontWeight: '900' },
  sectionNavigationLabelDisabled: { color: '#94A3B8' },
  unitNavigationButton: { minHeight: 58, flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderWidth: 2, borderColor: '#CBD5E1', borderBottomWidth: 4, borderBottomColor: '#94A3B8', borderRadius: 16, backgroundColor: '#FFFFFF' },
  previousUnitButton: { justifyContent: 'flex-start' },
  nextUnitButton: { justifyContent: 'flex-end', borderColor: '#10B981', borderBottomColor: '#047857', backgroundColor: '#10B981' },
  unitNavigationButtonDisabled: { borderColor: '#E2E8F0', borderBottomWidth: 2, borderBottomColor: '#E2E8F0', backgroundColor: '#F1F5F9' },
  unitNavigationCopy: { flex: 1, minWidth: 0 },
  unitNavigationLabel: { color: colors.muted, fontSize: typography.micro, fontWeight: '700' },
  unitNavigationTitle: { marginTop: 2, color: colors.ink, fontSize: typography.micro, fontWeight: '900' },
  nextUnitNavigationLabel: { color: '#D1FAE5' },
  nextUnitNavigationTitle: { color: '#FFFFFF' },
  completeSectionButton: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 15, borderBottomWidth: 4, borderBottomColor: '#047857', backgroundColor: '#10B981' },
  completeSectionButtonText: { color: '#FFFFFF', fontSize: typography.caption, fontWeight: '900' },
  actionDisabled: { opacity: 0.55 },
  practiceCard: { position: 'relative', gap: spacing.sm, padding: spacing.md, borderWidth: 2, borderColor: '#FDE68A', borderBottomWidth: 5, borderBottomColor: '#F59E0B', borderRadius: 20, backgroundColor: '#FFFFFF' },
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
  practiceClockWarning: { borderColor: '#34D399', backgroundColor: '#ECFDF5' },
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
  practiceChoiceSelected: { borderColor: colors.brand, backgroundColor: '#ECFDF5' },
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
  practiceStartIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm, borderWidth: 3, borderColor: '#A7F3D0', borderRadius: 18, backgroundColor: '#10B981', shadowColor: '#10B981', shadowOpacity: 0.22, shadowRadius: 10, elevation: 3 },
  practiceTimeoutIcon: { borderColor: '#A7F3D0', backgroundColor: '#059669' },
  practiceStartTitle: { color: '#0F172A', fontSize: typography.body, fontWeight: '900', textAlign: 'center' },
  practiceStartCopy: { marginTop: spacing.xs, color: '#475569', fontSize: typography.caption, lineHeight: 18, textAlign: 'center' },
  practiceStartTime: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.sm },
  practiceStartTimeText: { color: '#334155', fontSize: typography.caption, fontWeight: '800' },
  practiceStartButton: { width: '100%', minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginTop: spacing.md, paddingHorizontal: spacing.md, borderRadius: 11, backgroundColor: '#059669' },
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
  certButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  certButtonText: { color: '#047857', fontSize: typography.micro, fontWeight: '800' },
  headerCertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  headerCertButtonText: { color: '#047857', fontSize: typography.micro, fontWeight: '800' },
  offlineCatalogCard: { gap: spacing.xs, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
  offlineCatalogHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs, flexWrap: 'wrap' },
  offlineCatalogTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offlineSandboxPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#D1FAE5' },
  offlineSandboxPillText: { color: '#047857', fontSize: 10, fontWeight: '800' },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#DCFCE7' },
  offlineRowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  offlineRowTitle: { color: '#065F46', fontSize: typography.small, fontWeight: '800' },
  offlineRowSub: { color: '#047857', fontSize: typography.micro, fontWeight: '600' },
  offlinePlayerModalCard: { width: '94%', maxWidth: 640, borderRadius: 20, backgroundColor: '#FFFFFF', overflow: 'hidden' },
  offlineLessonBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    flexWrap: 'wrap',
  },
  offlineLessonLeft: { flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 6 },
  offlineLessonText: { flex: 1, color: '#475569', fontSize: 11, fontWeight: '700' },
  offlineLessonActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  offlineActionBtnActive: { backgroundColor: '#059669', borderColor: '#059669' },
  offlineActionBtnText: { color: '#047857', fontSize: 11, fontWeight: '800' },
  offlineActionBtnTextActive: { color: '#FFFFFF' },
  offlineTrashButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
}));
