import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Cpu,
  Download,
  FileText,
  Gamepad2,
  Globe,
  Hourglass,
  Image as ImageIcon,
  Keyboard,
  Lightbulb,
  Lock,
  Mail,
  Monitor,
  NotebookPen,
  Play,
  PlayCircle,
  Presentation,
  RotateCcw,
  Sheet,
  ShieldCheck,
  Trash2,
  WifiOff,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import RenderHtml, { type MixedStyleDeclaration } from '@native-html/render';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { MainTabsParamList } from '../navigation/types';
import {
  DAILY_PRACTICE_STATS_EVENT,
  DP_TOPIC_COLORS,
  dailyPracticeApi,
  emitDailyPracticeStats,
} from '../services/dailyPracticeApi';
import { Mascot } from '../components/dailyPractice/Mascot';
import { useGameSounds } from '../components/dailyPractice/useGameSounds';
import { embeddedVideoUrl, isDirectVideoUrl, playableVideoUrl } from '../utils/videoSource';
import * as VideoPlayerMod from './VideoPlayerFrame';
import type { VideoPlayerApi, VideoPlayerFrameProps, VideoPlayerProgress } from './VideoPlayerFrame';
import { AppHeader, AppScreen, Card, EmptyState, ErrorState, LoadingSkeleton } from '../components/ui';
import { useAuth } from '../app/AuthContext';
import { useMockResource } from '../hooks/useMockResource';
import { getMobileApiBaseUrl, resolveMobilePublicUrl } from '../services/apiClient';
import {
  confirmCoursePracticeItem,
  getCourseSubjectUnits,
  getCourseVideoCatalog,
  markCourseUnitSection,
  openCourseVideoUnit,
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
import { colors, spacing, typography, createThemedStyles } from '../theme/tokens';

const VideoPlayerFrame = (VideoPlayerMod as unknown as {
  VideoPlayerFrame: React.ComponentType<VideoPlayerFrameProps>;
}).VideoPlayerFrame;

const QUESTION_TYPES = new Set(['hotspot', 'mcq', 'multi', 'match', 'drag', 'written']);

const TOPIC_ICONS: Record<string, LucideIcon> = {
  book: BookOpen,
  monitor: Monitor,
  'file-text': FileText,
  sheet: Sheet,
  presentation: Presentation,
  globe: Globe,
  keyboard: Keyboard,
  shield: ShieldCheck,
  cpu: Cpu,
  mail: Mail,
  image: ImageIcon,
  code: Code2,
};

function topicIconFor(key?: string): LucideIcon {
  return (key && TOPIC_ICONS[key]) || BookOpen;
}

function topicColorFor(key?: string) {
  const dict = DP_TOPIC_COLORS as Record<string, { from: string; to: string; soft: string; text: string }>;
  return (key && dict[key]) || dict.green || { from: '#4ADE80', to: '#15803D', soft: '#F0FDF4', text: '#15803D' };
}

function formatClock(secs: number) {
  const s = Math.max(0, Math.floor(Number(secs) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
}

function unitMetaLabel(unit: LessonPracticeUnit) {
  const parts: string[] = [];
  const v = unit.videos?.filter((row) => String(row?.url || '').trim()).length || 0;
  const q = Number(unit.questionCount ?? unit.items?.length) || 0;
  const c = unit.contents?.length || 0;
  if (v) parts.push(`${v} video`);
  if (q) parts.push(`${q} câu hỏi`);
  if (c) parts.push(`${c} nội dung`);
  return parts.length ? parts.join(' · ') : 'Đang cập nhật';
}

function resolveQuestionVideoKey(
  item: LessonPracticeItem,
  videos: Array<{ id: string; title: string; url: string; antiSeek?: boolean }> = [],
) {
  const raw = String(item.videoId || '').trim();
  if (!videos.length || raw === 'none') return 'none';
  if (raw && videos.some((v) => String(v.id) === raw)) return raw;
  return String(videos[0].id);
}

type TimedPracticeItem = LessonPracticeItem & {
  atSec: number;
  immediate: boolean;
};

type WrongState = {
  itemId: string;
  wrongChoiceId?: string;
  feedback: string;
} | null;

const lessonHtmlBaseStyle: MixedStyleDeclaration = { color: '#334155', fontSize: typography.body, lineHeight: 23 };
const lessonHtmlTags: Record<string, MixedStyleDeclaration> = {
  body: { margin: 0, color: '#334155', fontSize: typography.body, lineHeight: 23 },
  p: { marginTop: 0, marginBottom: 10 },
  h2: { marginTop: 8, marginBottom: 8, color: '#0F172A', fontSize: typography.subheading, fontWeight: '800' },
  h3: { marginTop: 8, marginBottom: 6, color: '#1E293B', fontSize: typography.heading, fontWeight: '800' },
  li: { marginBottom: 6 },
  a: { color: '#059669', textDecorationLine: 'underline' },
};

function previewCatalog(): Promise<{ subjects: LessonPracticeSubject[]; courses: LessonPracticeCourse[] }> {
  return learningService.courses().then((courses) => {
    const subjects: LessonPracticeSubject[] = courses.map((course, idx) => ({
      id: `${course._id}-subject-${idx}`,
      name: course.title,
      icon: 'book',
      color: 'green',
      opened: true,
      videoCount: course.units.length,
      contentCount: course.units.length,
      questionCount: 0,
      totalUnitCount: course.units.length,
      completedUnitCount: 0,
    }));
    return { subjects, courses: [] };
  });
}

function UnitStatusPill({ status }: { status?: LessonPracticeUnit['status'] }) {
  if (status === 'completed') {
    return (
      <View style={[styles.statusPill, styles.statusPillDone]}>
        <CheckCircle2 size={12} color="#047857" />
        <Text style={[styles.statusPillText, { color: '#047857' }]}>Hoàn thành</Text>
      </View>
    );
  }
  if (status === 'in_progress') {
    return (
      <View style={[styles.statusPill, styles.statusPillProgress]}>
        <Hourglass size={12} color="#B45309" />
        <Text style={[styles.statusPillText, { color: '#B45309' }]}>Đang học</Text>
      </View>
    );
  }
  return (
    <View style={[styles.statusPill, styles.statusPillIdle]}>
      <Hourglass size={12} color="#475569" />
      <Text style={[styles.statusPillText, { color: '#475569' }]}>Chưa hoàn thành</Text>
    </View>
  );
}

/** Shared interactive quiz question body used inline and in fullscreen checkpoint popup. */
function InlineQuizQuestionBody({
  question,
  busy,
  wrongState,
  onSubmitAnswer,
  compact = false,
  retryWaitSec = 0,
  wrongAttemptSeq = 0,
  retryDraftChoiceId = '',
  onPickRetryDraftChoice,
}: {
  question: TimedPracticeItem;
  busy: boolean;
  wrongState: WrongState;
  onSubmitAnswer: (itemId: string, body: Record<string, unknown>, clickedChoiceId?: string) => void;
  compact?: boolean;
  retryWaitSec?: number;
  wrongAttemptSeq?: number;
  retryDraftChoiceId?: string;
  onPickRetryDraftChoice?: (choiceId: string) => void;
}) {
  const [choiceIds, setChoiceIds] = useState<string[]>([]);
  const [written, setWritten] = useState('');
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [dragOrder, setDragOrder] = useState<string[]>([]);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const [dirtySinceWrong, setDirtySinceWrong] = useState(false);

  useEffect(() => {
    setChoiceIds(Array.isArray(question.answer?.choiceIds) ? (question.answer?.choiceIds as string[]) : []);
    setWritten(typeof question.answer?.text === 'string' ? question.answer.text : '');
    const rows = Array.isArray(question.answer?.matches)
      ? (question.answer.matches as Array<{ leftId: string; rightId: string }>)
      : [];
    setMatches(Object.fromEntries(rows.map((r) => [r.leftId, r.rightId])));
    setDragOrder((question.options || []).map((o) => o.id));
    setPoint(
      question.answer?.x != null && question.answer?.y != null
        ? { x: Number(question.answer.x), y: Number(question.answer.y) }
        : null,
    );
    setDirtySinceWrong(false);
  }, [question.id, question.confirmed]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (wrongAttemptSeq > 0) setDirtySinceWrong(false);
  }, [wrongAttemptSeq]);

  const confirmed = question.confirmed === true;
  const options = question.options || [];
  const hasWrongFeedback = wrongState?.itemId === question.id && !confirmed;
  const isWaiting = hasWrongFeedback && retryWaitSec > 0;
  const nonMcqActionDisabled = busy || isWaiting || (hasWrongFeedback && !dirtySinceWrong);
  const canRetryMcq = hasWrongFeedback && !isWaiting && Boolean(retryDraftChoiceId) && String(retryDraftChoiceId) !== String(wrongState?.wrongChoiceId || '');
  const nonMcqBtnLabel = hasWrongFeedback
    ? (isWaiting ? `Thử lại (${retryWaitSec}s)` : 'Thử lại')
    : 'Kiểm tra đáp án';

  return (
    <View style={styles.quizInnerWrap}>
      <Text style={compact ? styles.questionPromptCompact : styles.questionPrompt}>
        {question.prompt || 'Câu hỏi kiểm tra nhanh'}
      </Text>

      {question.imageUrl && question.type !== 'hotspot' ? (
        <Image
          source={{ uri: resolveMobilePublicUrl(question.imageUrl) }}
          style={styles.questionMediaImage}
          resizeMode="contain"
        />
      ) : null}

      {question.type === 'mcq' ? (
        <View style={[styles.optionList, isWaiting && styles.actionDisabled]}>
          {options.map((opt, idx) => {
            const isCorrectOpt = confirmed && String(question.correctOptionId) === String(opt.id);
            const isWrongOpt = hasWrongFeedback && String(wrongState?.wrongChoiceId) === String(opt.id) && String(retryDraftChoiceId) !== String(opt.id);
            const isDraftPicked = hasWrongFeedback && !isWaiting && String(retryDraftChoiceId) === String(opt.id);
            const optDisabled = confirmed || busy || isWaiting || (hasWrongFeedback && String(wrongState?.wrongChoiceId) === String(opt.id));
            return (
              <Pressable
                key={opt.id}
                disabled={optDisabled}
                onPress={() => {
                  if (hasWrongFeedback) {
                    if (!isWaiting && String(wrongState?.wrongChoiceId) !== String(opt.id)) {
                      onPickRetryDraftChoice?.(opt.id);
                    }
                    return;
                  }
                  onSubmitAnswer(question.id, { choiceId: opt.id }, opt.id);
                }}
                style={[
                  styles.optionRow,
                  (isCorrectOpt || isDraftPicked) && styles.optionRowCorrect,
                  isWrongOpt && styles.optionRowWrong,
                ]}
              >
                <Text style={[styles.optionLetter, (isCorrectOpt || isDraftPicked) && { color: '#047857' }]}>
                  {`${String.fromCharCode(65 + idx)}.`}
                </Text>
                <Text style={[styles.optionText, (isCorrectOpt || isDraftPicked) && styles.optionTextCorrect]}>
                  {opt.text}
                </Text>
                {isCorrectOpt ? (
                  <View style={styles.optionCheckCircle}>
                    <Check size={13} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {question.type === 'multi' ? (
        <View style={[styles.optionList, isWaiting && styles.actionDisabled]}>
          {options.map((opt, idx) => {
            const pickedSet = new Set(confirmed ? (question.correctOptionIds || []) : choiceIds);
            const chosen = pickedSet.has(opt.id);
            return (
              <Pressable
                key={opt.id}
                disabled={confirmed || busy || isWaiting}
                onPress={() => {
                  setDirtySinceWrong(true);
                  setChoiceIds((cur) => (cur.includes(opt.id) ? cur.filter((x) => x !== opt.id) : [...cur, opt.id]));
                }}
                style={[styles.optionRow, chosen && styles.optionRowSelected]}
              >
                <Text style={[styles.optionLetter, chosen && { color: '#047857' }]}>
                  {`${String.fromCharCode(65 + idx)}.`}
                </Text>
                <Text style={[styles.optionText, chosen && styles.optionTextSelected]}>{opt.text}</Text>
                {chosen ? (
                  <View style={styles.optionCheckCircle}>
                    <Check size={13} color="#FFFFFF" strokeWidth={3} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
          {!confirmed ? (
            <Pressable
              disabled={nonMcqActionDisabled || !choiceIds.length}
              onPress={() => onSubmitAnswer(question.id, { choiceIds })}
              style={[styles.checkBtn, (nonMcqActionDisabled || !choiceIds.length) && styles.actionDisabled]}
            >
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.checkBtnText}>{nonMcqBtnLabel}</Text>}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {question.type === 'written' ? (
        <View style={[styles.optionList, isWaiting && styles.actionDisabled]}>
          <TextInput
            value={confirmed ? String(question.answer?.text || '') : written}
            onChangeText={(v) => {
              setDirtySinceWrong(true);
              setWritten(v);
            }}
            multiline
            editable={!confirmed && !busy && !isWaiting}
            placeholder="Nhập câu trả lời của bạn..."
            style={styles.writtenInput}
          />
          {!confirmed ? (
            <Pressable
              disabled={nonMcqActionDisabled || !written.trim()}
              onPress={() => onSubmitAnswer(question.id, { text: written })}
              style={[styles.checkBtn, (nonMcqActionDisabled || !written.trim()) && styles.actionDisabled]}
            >
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.checkBtnText}>{nonMcqBtnLabel}</Text>}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {question.type === 'match' ? (
        <View style={[styles.optionList, isWaiting && styles.actionDisabled]}>
          {confirmed && question.pairs?.length ? (
            question.pairs.map((pair, pIdx) => (
              <View key={pair.id || pIdx} style={styles.matchConfirmedRow}>
                <Text style={styles.matchLeftLabel}>{pair.left}</Text>
                <Text style={styles.matchArrowText}>{`→ ${pair.right}`}</Text>
              </View>
            ))
          ) : (
            <>
              {(question.lefts || []).map((left) => (
                <View key={left.id} style={styles.matchBlock}>
                  <Text style={styles.matchLeftLabel}>{left.text}</Text>
                  {(question.rights || []).map((right) => {
                    const chosen = matches[left.id] === right.id;
                    return (
                      <Pressable
                        key={right.id}
                        disabled={confirmed || busy || isWaiting}
                        onPress={() => {
                          setDirtySinceWrong(true);
                          setMatches((cur) => ({ ...cur, [left.id]: right.id }));
                        }}
                        style={[styles.optionRow, chosen && styles.optionRowSelected]}
                      >
                        <Text style={[styles.optionText, chosen && styles.optionTextSelected]}>{right.text}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
              {!confirmed ? (
                <Pressable
                  disabled={nonMcqActionDisabled || !question.lefts?.length || question.lefts.some((l) => !matches[l.id])}
                  onPress={() => onSubmitAnswer(question.id, {
                    matches: (question.lefts || []).map((l) => ({ leftId: l.id, rightId: matches[l.id] || '' })),
                  })}
                  style={[
                    styles.checkBtn,
                    (nonMcqActionDisabled || !question.lefts?.length || question.lefts.some((l) => !matches[l.id])) && styles.actionDisabled,
                  ]}
                >
                  {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.checkBtnText}>{nonMcqBtnLabel}</Text>}
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {question.type === 'drag' ? (
        <View style={[styles.optionList, isWaiting && styles.actionDisabled]}>
          {(confirmed ? options.map((o) => o.id) : dragOrder).map((optId, idx) => {
            const opt = options.find((o) => o.id === optId);
            if (!opt) return null;
            return (
              <View key={opt.id} style={styles.dragRow}>
                <View style={styles.dragNumCircle}>
                  <Text style={styles.dragNumCircleText}>{idx + 1}</Text>
                </View>
                <Text style={styles.dragText}>{opt.text}</Text>
                {!confirmed ? (
                  <View style={styles.dragControls}>
                    <Pressable
                      disabled={idx === 0 || busy || isWaiting}
                      onPress={() => {
                        setDirtySinceWrong(true);
                        setDragOrder((cur) => {
                          const next = [...cur];
                          [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                          return next;
                        });
                      }}
                    >
                      <ChevronUp size={18} color={idx === 0 ? '#CBD5E1' : '#059669'} />
                    </Pressable>
                    <Pressable
                      disabled={idx === dragOrder.length - 1 || busy || isWaiting}
                      onPress={() => {
                        setDirtySinceWrong(true);
                        setDragOrder((cur) => {
                          const next = [...cur];
                          [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                          return next;
                        });
                      }}
                    >
                      <ChevronDown size={18} color={idx === dragOrder.length - 1 ? '#CBD5E1' : '#059669'} />
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          })}
          {!confirmed ? (
            <Pressable
              disabled={nonMcqActionDisabled}
              onPress={() => onSubmitAnswer(question.id, { order: dragOrder })}
              style={[styles.checkBtn, nonMcqActionDisabled && styles.actionDisabled]}
            >
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.checkBtnText}>{nonMcqBtnLabel}</Text>}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {question.type === 'hotspot' ? (
        <View style={[styles.optionList, isWaiting && styles.actionDisabled]}>
          {question.imageUrl ? (
            <Pressable
              onLayout={(e) => setImageSize({
                width: Math.max(1, e.nativeEvent.layout.width),
                height: Math.max(1, e.nativeEvent.layout.height),
              })}
              onPress={(e) => {
                if (confirmed || busy || isWaiting) return;
                const { locationX, locationY } = e.nativeEvent;
                setDirtySinceWrong(true);
                setPoint({
                  x: Math.min(100, Math.max(0, (locationX / imageSize.width) * 100)),
                  y: Math.min(100, Math.max(0, (locationY / imageSize.height) * 100)),
                });
              }}
              style={styles.questionImageWrap}
            >
              <Image source={{ uri: resolveMobilePublicUrl(question.imageUrl) }} style={styles.questionImage} resizeMode="contain" />
              {confirmed && question.region ? (
                <View
                  style={[
                    styles.hotspotRegionBox,
                    {
                      left: `${question.region.x}%`,
                      top: `${question.region.y}%`,
                      width: `${question.region.w}%`,
                      height: `${question.region.h}%`,
                    },
                  ]}
                />
              ) : null}
              {(confirmed && question.region
                ? { x: question.region.x + question.region.w / 2, y: question.region.y + question.region.h / 2 }
                : point) ? (
                <View
                  style={[
                    styles.hotspotDot,
                    {
                      left: `${(confirmed && question.region
                        ? question.region.x + question.region.w / 2
                        : point!.x)}%`,
                      top: `${(confirmed && question.region
                        ? question.region.y + question.region.h / 2
                        : point!.y)}%`,
                    },
                  ]}
                />
              ) : null}
            </Pressable>
          ) : null}
          {!confirmed ? (
            <Pressable
              disabled={nonMcqActionDisabled || !point}
              onPress={() => { if (point) onSubmitAnswer(question.id, point); }}
              style={[styles.checkBtn, (nonMcqActionDisabled || !point) && styles.actionDisabled]}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.checkBtnText}>
                  {hasWrongFeedback ? nonMcqBtnLabel : 'Kiểm tra vị trí đã chọn'}
                </Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {confirmed ? (
        <View style={styles.mascotFeedbackGood}>
          <Mascot mood="happy" size={40} />
          <Text style={styles.mascotFeedbackGoodText}>
            {question.explanation || (compact ? 'Chính xác! Đang tiếp tục phát video...' : 'Chính xác! Bạn đã trả lời đúng câu hỏi ở mốc này.')}
          </Text>
        </View>
      ) : null}

      {hasWrongFeedback ? (
        <View style={styles.mascotFeedbackBad}>
          <Mascot mood="thinking" size={38} />
          <View style={styles.flex}>
            <Text style={styles.mascotFeedbackBadText}>
              {isWaiting ? `${wrongState?.feedback} (Đợi ${retryWaitSec}s để chọn lại)` : wrongState?.feedback}
            </Text>
            {question.hint ? <Text style={styles.hintInlineText}>{`Gợi ý: ${question.hint}`}</Text> : null}
          </View>
        </View>
      ) : null}

      {hasWrongFeedback && question.type === 'mcq' ? (
        <Pressable
          disabled={!canRetryMcq || busy}
          onPress={() => {
            if (canRetryMcq) {
              onSubmitAnswer(question.id, { choiceId: retryDraftChoiceId }, retryDraftChoiceId);
            }
          }}
          style={[styles.continueCtaBtn, (!canRetryMcq || busy) && styles.actionDisabled]}
        >
          <RotateCcw size={15} color="#FFFFFF" />
          <Text style={styles.continueCtaText}>
            {busy ? 'Đang kiểm tra...' : isWaiting ? `Thử lại (${retryWaitSec}s)` : 'Thử lại'}
          </Text>
        </Pressable>
      ) : null}

      {!confirmed && !hasWrongFeedback && question.hint ? (
        <View style={styles.hintWrap}>
          <Lightbulb size={13} color="#B45309" />
          <Text style={styles.hintInlineText}>{`Gợi ý: ${question.hint}`}</Text>
        </View>
      ) : null}
    </View>
  );
}

type CenterFreePracticePanelProps = {
  showBanner?: boolean;
  resumeSubjectId?: string;
  onConsumeResume?: () => void;
  onSummaryChange?: (summary: { activeSubjectName: string; completedUnits: number; totalUnits: number }) => void;
  onLessonOpenChange?: (open: boolean) => void;
};

export function CourseVideosScreen() {
  const route = useRoute<RouteProp<MainTabsParamList, 'CourseVideos'>>();
  const tabNavigation = useNavigation();
  return (
    <AppScreen safeAreaStyle={{ backgroundColor: '#F8FAFC' }} contentStyle={styles.screenContent}>
      <AppHeader title="Luyện tập tự do" icon={BookOpen} />
      <CenterFreePracticePanel
        showBanner
        resumeSubjectId={route.params?.resumeSubjectId}
        onConsumeResume={() => tabNavigation.setParams({ resumeKey: undefined } as never)}
      />
    </AppScreen>
  );
}

export function CenterFreePracticePanel({
  showBanner = true,
  resumeSubjectId,
  onConsumeResume,
  onSummaryChange,
  onLessonOpenChange,
}: CenterFreePracticePanelProps) {
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();
  const isPreview = Boolean(user?.previewMode);
  const loader = useCallback(
    () => (isPreview ? previewCatalog() : getCourseVideoCatalog()),
    [isPreview],
  );
  const resource = useMockResource(loader);
  const playSound = useGameSounds();

  const [activeSubjectId, setActiveSubjectId] = useState('');
  const [units, setUnits] = useState<LessonPracticeUnit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [unitsError, setUnitsError] = useState('');
  const [activeUnit, setActiveUnit] = useState<LessonPracticeUnit | null>(null);
  const [unitLoading, setUnitLoading] = useState(false);

  const [selectedVideoId, setSelectedVideoId] = useState('');
  const [selectedContentId, setSelectedContentId] = useState('');
  const [videoStarted, setVideoStarted] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxWatchedSec, setMaxWatchedSec] = useState(0);
  const [gatedQuestionId, setGatedQuestionId] = useState('');
  const [justAnsweredId, setJustAnsweredId] = useState('');
  const [activeQuestionId, setActiveQuestionId] = useState('');
  const [submittingId, setSubmittingId] = useState('');
  const [wrongState, setWrongState] = useState<WrongState>(null);
  const [retryWaitSec, setRetryWaitSec] = useState(0);
  const [retryDraftChoiceId, setRetryDraftChoiceId] = useState('');
  const [wrongAttemptSeq, setWrongAttemptSeq] = useState(0);
  const [isVideoFullscreen, setIsVideoFullscreen] = useState(false);

  const [walletXp, setWalletXp] = useState<number | null>(null);
  const [lastXpDelta, setLastXpDelta] = useState(0);
  const [outOfXpModalOpen, setOutOfXpModalOpen] = useState(false);

  const playerApiRef = useRef<VideoPlayerApi | null>(null);
  const autoMarkedNotesRef = useRef(new Set<string>());
  const autoMarkedVideosRef = useRef(new Set<string>());
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [offlineVideos, setOfflineVideos] = useState<OfflineVideoRecord[]>([]);
  const [offlineRecord, setOfflineRecord] = useState<OfflineVideoRecord | null>(null);
  const [offlineDownloadPct, setOfflineDownloadPct] = useState<number | null>(null);
  const [offlineUri, setOfflineUri] = useState('');
  const [usingOfflineUri, setUsingOfflineUri] = useState(false);
  const [offlinePlayer, setOfflinePlayer] = useState<{ record: OfflineVideoRecord; uri: string } | null>(null);

  const subjects = useMemo(() => resource.data?.subjects || [], [resource.data?.subjects]);

  // Keep XP balance synced with DailyPractice stats + event emitter.
  useEffect(() => {
    let alive = true;
    dailyPracticeApi.overview()
      .then((res) => {
        if (alive && typeof res?.stats?.xpTotal === 'number') {
          setWalletXp(res.stats.xpTotal);
        }
      })
      .catch(() => { });
    const sub = DeviceEventEmitter.addListener(DAILY_PRACTICE_STATS_EVENT, (detail?: { xpTotal?: number }) => {
      if (typeof detail?.xpTotal === 'number') {
        setWalletXp(detail.xpTotal);
      }
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  }, []);

  useEffect(() => {
    if (retryWaitSec <= 0) return undefined;
    const t = setTimeout(() => setRetryWaitSec((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [retryWaitSec]);

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

  useEffect(() => {
    if (resumeSubjectId && subjects.some((s) => s.id === resumeSubjectId)) {
      setActiveSubjectId(resumeSubjectId);
      onConsumeResume?.();
      return;
    }
    if (!activeSubjectId && subjects.length > 0) {
      setActiveSubjectId(subjects[0].id);
    } else if (activeSubjectId && subjects.length > 0 && !subjects.some((s) => s.id === activeSubjectId)) {
      setActiveSubjectId(subjects[0].id);
    }
  }, [subjects, activeSubjectId, resumeSubjectId, onConsumeResume]);

  const activeSubject = useMemo(
    () => subjects.find((s) => s.id === activeSubjectId) || null,
    [subjects, activeSubjectId],
  );

  useEffect(() => {
    onLessonOpenChange?.(Boolean(activeUnit));
  }, [activeUnit, onLessonOpenChange]);

  useEffect(() => () => {
    onLessonOpenChange?.(false);
  }, [onLessonOpenChange]);

  useEffect(() => {
    if (!onSummaryChange) return;
    onSummaryChange({
      activeSubjectName: activeSubject?.name || '',
      completedUnits: units.filter((u) => u.status === 'completed').length,
      totalUnits: units.length,
    });
  }, [onSummaryChange, activeSubject?.name, units]);

  const loadUnitsList = useCallback(async (subjectId: string) => {
    if (!subjectId || isPreview) return [];
    const list = await getCourseSubjectUnits(subjectId, '');
    setUnits(list);
    return list;
  }, [isPreview]);

  useEffect(() => {
    if (!activeSubjectId || isPreview) return;
    let alive = true;
    setUnitsLoading(true);
    setUnitsError('');
    setActiveUnit(null);
    getCourseSubjectUnits(activeSubjectId, '')
      .then((list) => {
        if (!alive) return;
        setUnits(list);
      })
      .catch((err) => {
        if (alive) setUnitsError(err instanceof Error ? err.message : 'Không tải được danh sách bài học.');
      })
      .finally(() => {
        if (alive) setUnitsLoading(false);
      });
    return () => { alive = false; };
  }, [activeSubjectId, isPreview]);

  useFocusEffect(useCallback(() => {
    resource.reload();
  }, [resource.reload])); // eslint-disable-line react-hooks/exhaustive-deps

  const openUnitDetail = useCallback(async (unit: LessonPracticeUnit) => {
    if (isPreview) {
      setActiveUnit(unit);
      return;
    }
    setUnitLoading(true);
    setVideoStarted(false);
    setMaxWatchedSec(0);
    setCurrentTime(0);
    setGatedQuestionId('');
    setJustAnsweredId('');
    setWrongState(null);
    setRetryWaitSec(0);
    setRetryDraftChoiceId('');
    setLastXpDelta(0);
    setActiveQuestionId('');
    try {
      const detail = await openCourseVideoUnit(unit.id);
      const merged: LessonPracticeUnit = { ...unit, ...detail };
      setActiveUnit(merged);
      setUnits((prev) => prev.map((u) => (u.id === unit.id ? merged : u)));
      const videos = merged.videos || [];
      const contents = merged.contents || [];
      setSelectedVideoId(videos[0]?.id || '');
      setSelectedContentId(contents[0]?.id || '');
      setVideoDuration(Number(merged.videoDurationSeconds) || 0);
    } catch (err) {
      Alert.alert('Không tải được bài học', err instanceof Error ? err.message : 'Vui lòng thử lại.');
    } finally {
      setUnitLoading(false);
    }
  }, [isPreview]);

  const closeLessonToList = useCallback(() => {
    setActiveUnit(null);
    setVideoStarted(false);
    setIsVideoFullscreen(false);
    setOutOfXpModalOpen(false);
    if (activeSubjectId) {
      void loadUnitsList(activeSubjectId).catch(() => { });
    }
  }, [activeSubjectId, loadUnitsList]);

  const unitVideos = useMemo(() => activeUnit?.videos || [], [activeUnit]);
  const unitContents = useMemo(() => activeUnit?.contents || [], [activeUnit]);
  const unitItems = useMemo(
    () => (activeUnit?.items || []).filter((item) => QUESTION_TYPES.has(item.type)),
    [activeUnit],
  );
  const selectedVideo = unitVideos.find((v) => v.id === selectedVideoId) || unitVideos[0] || null;
  const selectedContent = unitContents.find((c) => c.id === selectedContentId) || unitContents[0] || null;

  const anyVideoHasUrl = useMemo(
    () => unitVideos.some((v) => Boolean(String(v?.url || '').trim())),
    [unitVideos],
  );
  const selectedVideoHasUrl = Boolean(String(selectedVideo?.url || '').trim());

  const rawVideoUrl = selectedVideo?.url || '';
  const playableUrl = playableVideoUrl(rawVideoUrl);
  const embeddedUrl = embeddedVideoUrl(playableUrl);
  const directVideo = isDirectVideoUrl(playableUrl);
  const resolvedVideoUrl = playableUrl ? resolveMobilePublicUrl(playableUrl) : '';
  const videoDone = Boolean(selectedVideo?.id && activeUnit?.videoDoneIds?.includes(selectedVideo.id));
  const isReviewUnit = activeUnit?.status === 'completed';

  // Reset checkpoint tracking when switching between multiple videos in the same unit.
  useEffect(() => {
    setMaxWatchedSec(0);
    setCurrentTime(0);
    setVideoDuration(Number(activeUnit?.videoDurationSeconds) || 0);
    setGatedQuestionId('');
    setJustAnsweredId('');
    setWrongState(null);
    setRetryWaitSec(0);
    setRetryDraftChoiceId('');
    setVideoStarted(false);
  }, [selectedVideo?.id, activeUnit?.videoDurationSeconds]);

  const offlineLessonKey = `${user?.id || 'anon'}_${activeUnit?.id || 'u'}_${selectedVideo?.id || 'v'}`;
  useEffect(() => {
    let alive = true;
    setUsingOfflineUri(false);
    setOfflineUri('');
    if (Platform.OS === 'web' || !activeUnit?.id || !selectedVideo?.id) {
      setOfflineRecord(null);
      return undefined;
    }
    void getOfflineVideoRecord(offlineLessonKey).then((rec) => {
      if (alive) setOfflineRecord(rec);
    });
    return () => { alive = false; };
  }, [offlineLessonKey, activeUnit?.id, selectedVideo?.id]);

  useEffect(() => () => {
    if (offlineUri) void releaseOfflinePlaybackUri(offlineUri);
  }, [offlineUri]);

  const handleMarkSection = useCallback(async (kind: 'video' | 'note', itemId: string) => {
    if (!activeUnit || !itemId) return false;
    try {
      await markCourseUnitSection(activeUnit.id, kind, itemId);
      const detail = await openCourseVideoUnit(activeUnit.id);
      setActiveUnit((cur) => (cur?.id === activeUnit.id ? { ...cur, ...detail } : cur));
      return true;
    } catch {
      return false;
    }
  }, [activeUnit]);

  // Auto-mark opened summary note as read.
  useEffect(() => {
    if (!activeUnit?.id || !selectedContent?.id) return;
    if (activeUnit.noteDoneIds?.includes(selectedContent.id)) return;
    const key = `${activeUnit.id}:${selectedContent.id}`;
    if (autoMarkedNotesRef.current.has(key)) return;
    autoMarkedNotesRef.current.add(key);
    void handleMarkSection('note', selectedContent.id);
  }, [activeUnit?.id, activeUnit?.noteDoneIds, selectedContent?.id, handleMarkSection]);

  const rawQuestions = useMemo(() => {
    if (!anyVideoHasUrl || unitVideos.length <= 1 || !selectedVideo?.id) return unitItems;
    const firstId = unitVideos[0]?.id;
    return unitItems.filter((item) => {
      const key = resolveQuestionVideoKey(item, unitVideos);
      if (key === 'none') return selectedVideo.id === firstId;
      return key === selectedVideo.id;
    });
  }, [unitItems, anyVideoHasUrl, unitVideos, selectedVideo?.id]);

  const questionsWithCheckpoints = useMemo<TimedPracticeItem[]>(() => {
    const sorted = [...rawQuestions].sort((a, b) => {
      const isNoneA = !selectedVideoHasUrl || resolveQuestionVideoKey(a, unitVideos) === 'none';
      const isNoneB = !selectedVideoHasUrl || resolveQuestionVideoKey(b, unitVideos) === 'none';
      if (isNoneA !== isNoneB) return isNoneA ? 1 : -1;
      const ca = Number(a.checkpointSec) || 0;
      const cb = Number(b.checkpointSec) || 0;
      if (ca > 0 && cb > 0 && ca !== cb) return ca - cb;
      if (ca > 0 && cb <= 0) return -1;
      if (cb > 0 && ca <= 0) return 1;
      return (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0);
    });
    const timed = sorted.filter(
      (q) => selectedVideoHasUrl && resolveQuestionVideoKey(q, unitVideos) !== 'none',
    );
    const totalTimed = timed.length;
    const dur = Number(videoDuration) || 0;
    let timedIdx = 0;
    return sorted.map((q) => {
      const qVideoKey = resolveQuestionVideoKey(q, unitVideos);
      const immediate = !selectedVideoHasUrl || qVideoKey === 'none';
      let atSec = 0;
      if (!immediate) {
        if (Number(q.checkpointSec) > 0) {
          atSec = Number(q.checkpointSec);
        } else if (dur > 0) {
          const usable = Math.min(dur, Math.max(12, dur - 2));
          atSec = Math.max(3, Math.floor(((timedIdx + 1) / (totalTimed + 1)) * usable));
        } else {
          atSec = (timedIdx + 1) * 10;
        }
        timedIdx += 1;
      }
      return { ...q, atSec, immediate };
    });
  }, [rawQuestions, selectedVideoHasUrl, unitVideos, videoDuration]);

  const firstUnanswered = useMemo(
    () => questionsWithCheckpoints.find((q) => !q.confirmed && !q.immediate && q.atSec > 0) || null,
    [questionsWithCheckpoints],
  );
  const firstUnconfirmedAny = useMemo(
    () => questionsWithCheckpoints.find((q) => !q.confirmed) || null,
    [questionsWithCheckpoints],
  );

  const isQuestionUnlocked = useCallback((q: TimedPracticeItem | null, idx = -1) => {
    if (!q) return false;
    if (q.confirmed === true) return true;
    const index = idx >= 0 ? idx : questionsWithCheckpoints.findIndex((row) => row.id === q.id);
    if (index > 0 && questionsWithCheckpoints.slice(0, index).some((prev) => prev.confirmed !== true)) {
      return false;
    }
    if (q.immediate) return true;
    return maxWatchedSec >= q.atSec - 0.15 || gatedQuestionId === q.id;
  }, [questionsWithCheckpoints, maxWatchedSec, gatedQuestionId]);

  useEffect(() => {
    if (!questionsWithCheckpoints.length) {
      setActiveQuestionId('');
      return;
    }
    setActiveQuestionId((cur) => {
      const curIdx = cur ? questionsWithCheckpoints.findIndex((q) => q.id === cur) : -1;
      if (curIdx >= 0 && isQuestionUnlocked(questionsWithCheckpoints[curIdx], curIdx)) return cur;
      return firstUnconfirmedAny?.id || questionsWithCheckpoints[0].id;
    });
  }, [questionsWithCheckpoints, firstUnconfirmedAny?.id, isQuestionUnlocked]);

  // Auto-mark video completed once all checkpoint questions for the active video have been confirmed.
  useEffect(() => {
    if (!activeUnit?.id || !selectedVideoHasUrl || !selectedVideo?.id || !questionsWithCheckpoints.length) return;
    if (videoDone || activeUnit.status === 'completed') return;
    if (!questionsWithCheckpoints.every((q) => q.confirmed === true)) return;
    const key = `${activeUnit.id}:${selectedVideo.id}`;
    if (autoMarkedVideosRef.current.has(key)) return;
    autoMarkedVideosRef.current.add(key);
    void handleMarkSection('video', selectedVideo.id);
  }, [activeUnit?.id, activeUnit?.status, selectedVideoHasUrl, selectedVideo?.id, questionsWithCheckpoints, videoDone, handleMarkSection]);

  const questionsRefLive = useRef<TimedPracticeItem[]>([]);
  questionsRefLive.current = questionsWithCheckpoints;
  const firstUnansweredRef = useRef<TimedPracticeItem | null>(null);
  firstUnansweredRef.current = firstUnanswered;

  const handleVideoProgress = useCallback((p: VideoPlayerProgress) => {
    const nextDur = Number(p.duration) || 0;
    const curT = Number(p.currentTime) || 0;
    const gate = firstUnansweredRef.current;
    const maxCap = gate ? gate.atSec : Number.POSITIVE_INFINITY;
    const clampedMax = Math.min(curT, maxCap);
    if (nextDur > 0) setVideoDuration((prev) => (prev === nextDur ? prev : nextDur));
    if (curT >= 0) setCurrentTime(Math.min(curT, maxCap));
    setMaxWatchedSec((prev) => (clampedMax > prev ? clampedMax : prev));

    // Pause immediately at unanswered checkpoint gate so student must answer before watching past it.
    if (gate && gate.atSec > 0 && curT >= gate.atSec - 0.15) {
      playerApiRef.current?.pause?.();
      if (curT > gate.atSec + 0.6) {
        playerApiRef.current?.seekTo?.(gate.atSec, { allowAdvance: true });
      }
      setGatedQuestionId((cur) => (cur === gate.id ? cur : gate.id));
      setActiveQuestionId(gate.id);
    }
  }, []);

  const submitAnswer = useCallback(async (itemId: string, body: Record<string, unknown>, clickedChoiceId = '') => {
    if (!activeUnit || !itemId || submittingId) return;
    if (wrongState?.itemId === itemId && retryWaitSec > 0) return;
    const targetQ = questionsRefLive.current.find((row) => row.id === itemId);
    if (!isReviewUnit && !targetQ?.confirmed && typeof walletXp === 'number' && walletXp <= 0) {
      setOutOfXpModalOpen(true);
      return;
    }
    setSubmittingId(itemId);
    try {
      const res = await confirmCoursePracticeItem(itemId, body);
      const data = res?.data || {};
      if (typeof data.xpTotal === 'number') {
        setWalletXp(data.xpTotal);
        emitDailyPracticeStats({
          xpTotal: data.xpTotal,
          ...(typeof data.xpDelta === 'number' && data.xpDelta < 0 ? { spendXp: Math.abs(data.xpDelta) } : {}),
        });
      }
      if (typeof data.xpDelta === 'number' && data.xpDelta !== 0) {
        setLastXpDelta(data.xpDelta);
      }
      if (data.xpExhausted) {
        setOutOfXpModalOpen(true);
        if (!data.retry) return;
      }
      if (data.retry) {
        playSound('wrong');
        setWrongState({
          itemId,
          wrongChoiceId: clickedChoiceId,
          feedback: data.item?.feedback || 'Chưa chính xác. Bạn thử chọn đáp án khác nhé!',
        });
        setRetryDraftChoiceId('');
        setWrongAttemptSeq((n) => n + 1);
        setRetryWaitSec(5);
        return;
      }
      setWrongState(null);
      setRetryDraftChoiceId('');
      setRetryWaitSec(0);
      playSound('correct');
      if (data.item) {
        setActiveUnit((cur) => {
          if (!cur || cur.id !== activeUnit.id) return cur;
          return {
            ...cur,
            status: data.unitStatus || cur.status,
            items: (cur.items || []).map((row) => (row.id === itemId ? { ...row, ...data.item } : row)),
          };
        });
      }
      if (data.unitStatus === 'completed' && activeSubjectId) {
        void loadUnitsList(activeSubjectId).catch(() => { });
      }
      const wasGated = gatedQuestionId === itemId || firstUnansweredRef.current?.id === itemId;
      if (wasGated && selectedVideoHasUrl && !data.xpExhausted) {
        setJustAnsweredId(itemId);
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = setTimeout(() => {
          setGatedQuestionId('');
          setJustAnsweredId('');
          const curIdx = questionsRefLive.current.findIndex((q) => q.id === itemId);
          const nextQ = curIdx >= 0 ? questionsRefLive.current[curIdx + 1] : null;
          if (nextQ) setActiveQuestionId(nextQ.id);
          playerApiRef.current?.play?.();
        }, 650);
      } else {
        setGatedQuestionId('');
      }
    } catch (err) {
      setWrongState({
        itemId,
        wrongChoiceId: clickedChoiceId,
        feedback: err instanceof Error ? err.message : 'Chưa kiểm tra được đáp án, vui lòng thử lại.',
      });
    } finally {
      setSubmittingId('');
    }
  }, [activeUnit, submittingId, wrongState, retryWaitSec, isReviewUnit, walletXp, activeSubjectId, loadUnitsList, gatedQuestionId, selectedVideoHasUrl]);

  const handleDownloadOffline = async () => {
    if (!directVideo || !resolvedVideoUrl || offlineDownloadPct !== null || !activeUnit || !selectedVideo) return;
    setOfflineDownloadPct(1);
    try {
      const rec = await downloadEncryptedOfflineVideo({
        lessonKey: offlineLessonKey,
        url: resolvedVideoUrl,
        title: selectedVideo.title || activeUnit.title,
        courseTitle: activeSubject?.name || 'Luyện tập tự do',
        subjectName: activeSubject?.name || '',
        antiSeekEnabled: selectedVideo.antiSeek === true,
        onProgress: setOfflineDownloadPct,
      });
      setOfflineRecord(rec);
      Alert.alert('Đã tải offline', 'Video đã được mã hóa trong ứng dụng.');
    } catch (err) {
      Alert.alert('Không thể tải offline', err instanceof Error ? err.message : 'Lỗi tải video.');
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
      if (!decrypted) return;
      setOfflineUri(decrypted);
      setUsingOfflineUri(true);
      setVideoStarted(true);
    } catch (err) {
      Alert.alert('Không mở được bản offline', err instanceof Error ? err.message : 'Lỗi giải mã.');
    }
  };

  const activeQuestionIndex = Math.max(0, questionsWithCheckpoints.findIndex((q) => q.id === activeQuestionId));
  const activeQuestion = questionsWithCheckpoints[activeQuestionIndex] || null;
  const activeUnlocked = isQuestionUnlocked(activeQuestion, activeQuestionIndex);

  const checkpointPins = useMemo(() => questionsWithCheckpoints
    .filter((q) => !q.immediate && q.atSec > 0)
    .map((q, idx) => ({
      id: q.id,
      atSec: q.atSec,
      label: String(idx + 1),
      unlocked: isQuestionUnlocked(q),
      completed: q.confirmed === true,
      active: activeQuestion?.id === q.id || gatedQuestionId === q.id,
    })), [questionsWithCheckpoints, isQuestionUnlocked, activeQuestion?.id, gatedQuestionId]);

  const handleSelectCheckpoint = useCallback((cp: { id: string; atSec: number; unlocked?: boolean }) => {
    setActiveQuestionId(cp.id);
    setWrongState(null);
    setRetryWaitSec(0);
    setRetryDraftChoiceId('');
    if (cp.unlocked && (!firstUnanswered || cp.atSec <= firstUnanswered.atSec)) {
      setVideoStarted(true);
      playerApiRef.current?.seekTo?.(cp.atSec, { allowAdvance: !firstUnanswered });
    }
  }, [firstUnanswered]);

  const popupQuestionId = justAnsweredId || gatedQuestionId;
  const popupQuestion = popupQuestionId
    ? questionsWithCheckpoints.find((q) => q.id === popupQuestionId) || null
    : null;

  const activeUnitIndex = activeUnit ? Math.max(0, units.findIndex((u) => u.id === activeUnit.id)) : 0;
  const prevUnit = activeUnitIndex > 0 ? units[activeUnitIndex - 1] : null;
  const nextUnit = activeUnitIndex < units.length - 1 ? units[activeUnitIndex + 1] : null;

  const totalUnitQuestions = unitItems.length;
  const totalUnitConfirmed = unitItems.filter((q) => q.confirmed === true).length;
  const confirmedCount = questionsWithCheckpoints.filter((q) => q.confirmed === true).length;
  const totalCount = questionsWithCheckpoints.length;
  const progressPct = totalUnitQuestions ? Math.round((totalUnitConfirmed / totalUnitQuestions) * 100) : 0;

  const nextUnlockedUnconfirmed = questionsWithCheckpoints.find(
    (q, i) => q.id !== activeQuestion?.id && !q.confirmed && isQuestionUnlocked(q, i),
  );
  const allConfirmedCurrent = totalCount > 0 && confirmedCount === totalCount;
  const nextVideoWithWork = unitVideos.length > 1 && anyVideoHasUrl
    ? unitVideos.find((v) => v.id !== selectedVideo?.id && (
      unitItems.some((item) => resolveQuestionVideoKey(item, unitVideos) === v.id && !item.confirmed)
    )) || null
    : null;

  const handleContinueAction = () => {
    if (nextUnlockedUnconfirmed) {
      setActiveQuestionId(nextUnlockedUnconfirmed.id);
      setWrongState(null);
      setRetryWaitSec(0);
      setRetryDraftChoiceId('');
      return;
    }
    if (selectedVideoHasUrl && !allConfirmedCurrent && (!activeUnlocked || activeQuestion?.confirmed)) {
      setVideoStarted(true);
      playerApiRef.current?.play?.();
      return;
    }
    if (allConfirmedCurrent && nextVideoWithWork) {
      setSelectedVideoId(nextVideoWithWork.id);
      return;
    }
    if (nextUnit) void openUnitDetail(nextUnit);
    else closeLessonToList();
  };

  let continueLabel = nextUnit ? 'Tiếp tục bài học' : 'Về danh sách bài';
  if (nextUnlockedUnconfirmed) {
    continueLabel = 'Câu hỏi tiếp theo';
  } else if (selectedVideoHasUrl && !allConfirmedCurrent && (!activeUnlocked || activeQuestion?.confirmed)) {
    continueLabel = 'Tiếp tục xem video';
  } else if (allConfirmedCurrent && nextVideoWithWork) {
    continueLabel = `Chuyển sang ${nextVideoWithWork.title || 'video tiếp theo'}`;
  }

  const contentWidth = Math.max(260, screenWidth - spacing.xl * 2 - spacing.md * 2);
  const completedUnitsCount = units.filter((u) => u.status === 'completed').length;

  const renderOutOfXpBody = () => (
    <View style={styles.outOfXpCard}>
      <Mascot mood="sad" size={64} />
      <Text style={styles.outOfXpTitle}>Đã dùng hết XP hôm nay</Text>
      <Text style={styles.outOfXpDesc}>
        Hôm nay bạn đã sử dụng hết XP, bạn có thể ôn bài cũ hoặc đợi ngày mai.
      </Text>
      <View style={styles.outOfXpActions}>
        <Pressable
          onPress={() => {
            setOutOfXpModalOpen(false);
            if (Platform.OS === 'web' && typeof document !== 'undefined' && document.fullscreenElement) {
              void document.exitFullscreen?.().catch(() => { });
            }
            closeLessonToList();
          }}
          style={styles.outOfXpPrimaryBtn}
        >
          <RotateCcw size={15} color="#FFFFFF" />
          <Text style={styles.outOfXpPrimaryText}>Ôn bài cũ</Text>
        </Pressable>
        <Pressable
          onPress={() => setOutOfXpModalOpen(false)}
          style={styles.outOfXpSecondaryBtn}
        >
          <Text style={styles.outOfXpSecondaryText}>Đóng</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderFullscreenQuizPopup = ({ isFullscreen }: { isFullscreen: boolean }) => {
    if (!isFullscreen) return null;
    if (outOfXpModalOpen) {
      return (
        <View style={styles.fullscreenOverlay}>
          {renderOutOfXpBody()}
        </View>
      );
    }
    if (!popupQuestion) return null;
    return (
      <View style={styles.fullscreenOverlay}>
        <View style={styles.fullscreenQuizModalCard}>
          <View style={styles.fullscreenQuizModalHeader}>
            <View style={styles.inline}>
              <Gamepad2 size={17} color="#059669" />
              <Text style={styles.fullscreenQuizModalTitle}>
                {`Câu ${Math.max(0, questionsWithCheckpoints.findIndex((q) => q.id === popupQuestion.id)) + 1}/${questionsWithCheckpoints.length} · Kiểm tra nhanh`}
              </Text>
            </View>
            <View style={styles.inline}>
              {typeof walletXp === 'number' ? (
                <View style={[styles.xpMiniBadge, walletXp > 0 ? styles.xpMiniBadgeAmber : styles.xpMiniBadgeRose]}>
                  <Zap size={11} color={walletXp > 0 ? '#92400E' : '#B91C1C'} />
                  <Text style={[styles.xpMiniBadgeText, { color: walletXp > 0 ? '#92400E' : '#B91C1C' }]}>
                    {`${walletXp} XP`}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
            <InlineQuizQuestionBody
              compact
              question={popupQuestion}
              busy={submittingId === popupQuestion.id}
              wrongState={wrongState}
              retryWaitSec={retryWaitSec}
              wrongAttemptSeq={wrongAttemptSeq}
              retryDraftChoiceId={retryDraftChoiceId}
              onPickRetryDraftChoice={setRetryDraftChoiceId}
              onSubmitAnswer={(itemId, body, clickedChoiceId) => {
                void submitAnswer(itemId, body, clickedChoiceId);
              }}
            />
          </ScrollView>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.embeddedWrap}>
      {!activeUnit ? (
        <>
          {showBanner ? (
            <Card style={styles.bannerCard}>
              <Text style={styles.bannerTitle}>Học và luyện tập theo môn</Text>
              <Text style={styles.bannerSub}>
                Chọn môn học bên dưới để xem video, làm trắc nghiệm theo mốc và tích lũy XP (+5 XP đúng · −5 XP sai).
              </Text>
            </Card>
          ) : null}

          {!resource.loading && Platform.OS !== 'web' && offlineVideos.length > 0 ? (
            <Card style={styles.offlineCatalogCard}>
              <View style={styles.offlineCatalogHead}>
                <View style={styles.offlineCatalogTitleRow}>
                  <ShieldCheck size={17} color="#059669" />
                  <Text style={styles.cardTitle}>Kho video offline ({offlineVideos.length})</Text>
                </View>
                <View style={styles.offlineSandboxPill}>
                  <WifiOff size={11} color="#047857" />
                  <Text style={styles.offlineSandboxPillText}>Phát ngoại tuyến</Text>
                </View>
              </View>
              {offlineVideos.slice(0, 4).map((rec) => (
                <View key={rec.lessonKey} style={styles.offlineRow}>
                  <Pressable
                    onPress={() => {
                      void prepareOfflinePlaybackUri(rec.lessonKey).then((uri) => {
                        if (uri) setOfflinePlayer({ record: rec, uri });
                      });
                    }}
                    style={styles.offlineRowBody}
                  >
                    <Play size={14} color="#059669" />
                    <View style={styles.flex}>
                      <Text style={styles.offlineRowTitle} numberOfLines={1}>{rec.title}</Text>
                      <Text style={styles.offlineRowSub} numberOfLines={1}>{rec.courseTitle} • {formatOfflineBytes(rec.sizeBytes)}</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void deleteOfflineVideo(rec.lessonKey).then(refreshOfflineList);
                    }}
                    style={styles.offlineTrashButton}
                  >
                    <Trash2 size={14} color="#DC2626" />
                  </Pressable>
                </View>
              ))}
            </Card>
          ) : null}

          {resource.loading ? <LoadingSkeleton /> : null}
          {resource.error ? <ErrorState onRetry={resource.reload} /> : null}

          {!resource.loading && !resource.error && !subjects.length ? (
            <EmptyState title="Chưa có môn học thuộc khóa đăng ký" message="Các môn luyện tập tự do sẽ tự động hiển thị theo đúng môn trong khóa học bạn đã đăng ký." />
          ) : null}

          {!resource.loading && !resource.error && subjects.length > 0 ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subjectStrip}>
                {subjects.map((subj) => {
                  const Icon = topicIconFor(subj.icon);
                  const tone = topicColorFor(subj.color);
                  const active = subj.id === activeSubjectId;
                  const totalU = Number(subj.totalUnitCount) || 0;
                  const completedU = Number(subj.completedUnitCount) || 0;
                  const hasAny = totalU > 0 || (Number(subj.videoCount) || 0) + (Number(subj.questionCount) || 0) + (Number(subj.contentCount) || 0) > 0;
                  const metaText = completedU > 0 && totalU > 0
                    ? `${completedU}/${totalU} bài`
                    : hasAny
                      ? 'Chưa học'
                      : 'Đang cập nhật';
                  return (
                    <Pressable
                      key={subj.id}
                      onPress={() => setActiveSubjectId(subj.id)}
                      style={[
                        styles.subjectChip,
                        { borderColor: active ? tone.to : '#E2E8F0', backgroundColor: active ? tone.soft : '#FFFFFF' },
                      ]}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <View style={[styles.subjectChipIcon, { backgroundColor: tone.to }]}>
                        <Icon size={17} color="#FFFFFF" />
                      </View>
                      <View style={styles.subjectChipBody}>
                        <Text numberOfLines={1} style={styles.subjectChipName}>{subj.name}</Text>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.subjectChipMeta,
                            completedU > 0 ? { color: '#059669' } : hasAny ? { color: '#475569' } : null,
                          ]}
                        >
                          {metaText}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {unitLoading ? <LoadingSkeleton rows={3} /> : null}

              {activeSubject ? (
                <Card style={styles.unitListCard}>
                  <View style={styles.unitListHeader}>
                    <Text style={styles.unitListSubjectTitle}>{activeSubject.name}</Text>
                    {units.length > 0 ? (
                      <View style={styles.unitCountBadge}>
                        <Text style={styles.unitCountBadgeText}>
                          {`${completedUnitsCount}/${units.length} bài hoàn thành`}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {unitsLoading && !units.length ? (
                    <LoadingSkeleton rows={3} />
                  ) : unitsError ? (
                    <Text style={styles.errorText}>{unitsError}</Text>
                  ) : !units.length ? (
                    <EmptyState title={`Môn ${activeSubject.name}`} message="Chưa có bài học nào trong môn này." />
                  ) : (
                    <View style={styles.unitRowsWrap}>
                      {units.map((u, idx) => {
                        const done = u.status === 'completed';
                        const inProgress = u.status === 'in_progress';
                        return (
                          <Pressable
                            key={u.id}
                            onPress={() => { void openUnitDetail(u); }}
                            style={[styles.unitRow, idx > 0 && styles.unitRowBorder]}
                          >
                            <View style={styles.unitRowMain}>
                              <Text style={styles.unitRowTitle} numberOfLines={2}>
                                {`Bài ${idx + 1}: ${u.title}`}
                              </Text>
                              <View style={styles.unitRowMetaRow}>
                                <View style={styles.unitMetaBadge}>
                                  <Text style={styles.unitMetaBadgeText}>{unitMetaLabel(u)}</Text>
                                </View>
                                <UnitStatusPill status={u.status} />
                              </View>
                            </View>
                            <Pressable
                              onPress={() => { void openUnitDetail(u); }}
                              style={done ? styles.unitActionBtnOutline : styles.unitActionBtnPrimary}
                            >
                              {done ? (
                                <>
                                  <RotateCcw size={13} color="#334155" />
                                  <Text style={styles.unitActionBtnOutlineText}>Xem lại</Text>
                                </>
                              ) : (
                                <>
                                  <PlayCircle size={14} color="#FFFFFF" />
                                  <Text style={styles.unitActionBtnPrimaryText}>{inProgress ? 'Học tiếp' : 'Học ngay'}</Text>
                                </>
                              )}
                            </Pressable>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </Card>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <View style={styles.lessonWrap}>
          {/* Top Lesson Header Bar */}
          <Card style={styles.lessonHeaderCard}>
            <View style={styles.lessonHeaderTop}>
              <Pressable
                onPress={closeLessonToList}
                style={styles.lessonBackBtn}
                accessibilityRole="button"
                accessibilityLabel="Quay lại danh sách bài"
              >
                <ArrowLeft size={18} color="#334155" />
              </Pressable>
              <View style={styles.flex}>
                <Text numberOfLines={1} style={styles.lessonSubjectEyebrow}>
                  {activeSubject?.name || ''}
                </Text>
                <Text numberOfLines={2} style={styles.lessonUnitTitle}>
                  {`Bài ${activeUnitIndex + 1}: ${activeUnit.title}`}
                </Text>
              </View>
              <View style={styles.xpHeaderRow}>
                {lastXpDelta !== 0 && !isReviewUnit ? (
                  <View style={[styles.xpDeltaPill, lastXpDelta > 0 ? styles.xpDeltaPos : styles.xpDeltaNeg]}>
                    <Text style={[styles.xpDeltaText, lastXpDelta > 0 ? { color: '#065F46' } : { color: '#9F1239' }]}>
                      {lastXpDelta > 0 ? `+${lastXpDelta} XP` : `${lastXpDelta} XP`}
                    </Text>
                  </View>
                ) : null}
                <View
                  style={[
                    styles.xpWalletPill,
                    isReviewUnit ? styles.xpWalletReview : (typeof walletXp === 'number' && walletXp <= 0) ? styles.xpWalletEmpty : styles.xpWalletActive,
                  ]}
                >
                  <Zap size={12} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.xpWalletText}>
                    {isReviewUnit ? 'Ôn lại · 0 XP' : `${walletXp ?? '—'} XP`}
                  </Text>
                </View>
              </View>
            </View>

            {totalUnitQuestions > 0 ? (
              <View style={styles.lessonProgressRow}>
                <View style={styles.lessonProgressTrack}>
                  <View
                    style={[
                      styles.lessonProgressFill,
                      { width: `${Math.max(progressPct, totalUnitConfirmed ? 8 : 0)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.lessonProgressLabel}>
                  {`${totalUnitConfirmed}/${totalUnitQuestions} câu hỏi`}
                </Text>
              </View>
            ) : null}
          </Card>

          {/* Multi-video switcher */}
          {unitVideos.length > 1 && anyVideoHasUrl ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subPillRow}>
              {unitVideos.map((v, vIdx) => {
                const isSel = v.id === selectedVideo?.id;
                const firstId = unitVideos[0]?.id;
                const vQuestions = unitItems.filter((item) => {
                  const key = resolveQuestionVideoKey(item, unitVideos);
                  return key === 'none' ? v.id === firstId : key === v.id;
                });
                const vDone = vQuestions.filter((q) => q.confirmed).length;
                return (
                  <Pressable
                    key={v.id}
                    onPress={() => setSelectedVideoId(v.id)}
                    style={[styles.subPill, isSel && styles.subPillActive]}
                  >
                    <Text style={[styles.subPillText, isSel && styles.subPillTextActive]}>
                      {v.title || `Video ${vIdx + 1}`}
                    </Text>
                    {vQuestions.length > 0 ? (
                      <View style={[styles.videoCountChip, isSel && styles.videoCountChipActive]}>
                        <Text style={[styles.videoCountChipText, isSel && { color: '#FFFFFF' }]}>
                          {`${vDone}/${vQuestions.length}`}
                        </Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {/* Video Section (only when selected video has a valid link) */}
          {selectedVideo && selectedVideoHasUrl ? (
            <Card style={styles.videoCard}>
              <View style={styles.videoFrame}>
                {videoStarted && (usingOfflineUri ? Boolean(offlineUri) : (embeddedUrl || directVideo)) ? (
                  <VideoPlayerFrame
                    videoUrl={usingOfflineUri && offlineUri ? offlineUri : resolvedVideoUrl}
                    embeddedUrl={usingOfflineUri ? '' : embeddedUrl}
                    title={selectedVideo.title || activeUnit.title}
                    lessonId={`${user?.id || 'anon'}-${activeUnit.id}-${selectedVideo.id}`}
                    antiSeekEnabled={selectedVideo.antiSeek === true}
                    done={videoDone}
                    playerApiRef={playerApiRef}
                    checkpoints={checkpointPins}
                    onSelectCheckpoint={handleSelectCheckpoint}
                    maxCheckpointSec={firstUnanswered ? firstUnanswered.atSec : null}
                    checkpointGateModal={renderFullscreenQuizPopup}
                    pausedCheckpointSec={gatedQuestionId && !isVideoFullscreen ? (firstUnanswered?.atSec ?? null) : null}
                    onFullscreenChange={setIsVideoFullscreen}
                    onProgress={handleVideoProgress}
                    onWatched={() => handleMarkSection('video', selectedVideo.id)}
                  />
                ) : (
                  <View style={styles.videoStartOverlay}>
                    <Pressable
                      onPress={() => { if (playableUrl) setVideoStarted(true); }}
                      disabled={!playableUrl}
                      style={[styles.videoStartBtn, !playableUrl && styles.actionDisabled]}
                    >
                      <Play size={22} color="#FFFFFF" fill="#FFFFFF" />
                    </Pressable>
                    <Text numberOfLines={2} style={styles.videoOverlayTitle}>{selectedVideo.title || activeUnit.title}</Text>
                    <Text style={styles.videoOverlaySub}>
                      {playableUrl ? 'Nhấn để phát video' : 'Link video chưa hợp lệ'}
                    </Text>
                  </View>
                )}
              </View>

              {Platform.OS !== 'web' && directVideo ? (
                <View style={styles.offlineLessonCard}>
                  <Text style={styles.offlineLessonText} numberOfLines={1}>
                    {offlineDownloadPct !== null
                      ? `Đang tải offline: ${offlineDownloadPct}%`
                      : offlineRecord
                        ? `Đã lưu offline (${formatOfflineBytes(offlineRecord.sizeBytes)})`
                        : 'Hỗ trợ tải xem ngoại tuyến'}
                  </Text>
                  {offlineRecord ? (
                    <Pressable
                      onPress={() => { void handlePlayOfflineToggle(); }}
                      style={[styles.offlineActionBtn, usingOfflineUri && styles.offlineActionBtnActive]}
                    >
                      <Text style={[styles.offlineActionBtnText, usingOfflineUri && { color: '#FFFFFF' }]}>
                        {usingOfflineUri ? 'Đang phát Offline' : 'Phát Offline'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable onPress={() => { void handleDownloadOffline(); }} style={styles.offlineActionBtn}>
                      <Download size={13} color="#047857" />
                      <Text style={styles.offlineActionBtnText}>Tải Offline</Text>
                    </Pressable>
                  )}
                </View>
              ) : null}
            </Card>
          ) : unitVideos.length > 0 && anyVideoHasUrl ? (
            <View style={styles.noVideoBanner}>
              <Text style={styles.noVideoBannerText}>
                Video này chưa gắn link — toàn bộ câu hỏi trắc nghiệm bên dưới đã được mở để bạn làm ngay.
              </Text>
            </View>
          ) : null}

          {/* Quick Quiz Card */}
          <Card style={styles.quizCard}>
            <View style={styles.quizCardHeader}>
              <View style={styles.inline}>
                <Gamepad2 size={18} color="#059669" />
                <Text style={styles.quizCardTitle}>Câu hỏi kiểm tra nhanh</Text>
              </View>
            </View>

            {questionsWithCheckpoints.length > 1 ? (
              <View style={styles.questionSelectorWrap}>
                {questionsWithCheckpoints.map((q, idx) => {
                  const unlocked = isQuestionUnlocked(q, idx);
                  const selected = activeQuestion?.id === q.id;
                  return (
                    <Pressable
                      key={q.id}
                      disabled={!unlocked}
                      onPress={() => {
                        if (!unlocked) return;
                        setActiveQuestionId(q.id);
                        setWrongState(null);
                        setRetryWaitSec(0);
                        setRetryDraftChoiceId('');
                      }}
                      style={[
                        styles.questionPill,
                        selected
                          ? styles.questionPillActive
                          : q.confirmed
                            ? styles.questionPillDone
                            : unlocked
                              ? styles.questionPillOpen
                              : styles.questionPillLocked,
                      ]}
                    >
                      {q.confirmed ? (
                        <CheckCircle2 size={12} color={selected ? '#FFFFFF' : '#047857'} />
                      ) : !unlocked ? (
                        <Lock size={11} color={selected ? '#FFFFFF' : '#94A3B8'} />
                      ) : null}
                      <Text
                        style={[
                          styles.questionPillText,
                          selected && { color: '#FFFFFF' },
                          !selected && q.confirmed && { color: '#047857' },
                          !selected && !unlocked && { color: '#94A3B8' },
                        ]}
                      >
                        {`Câu ${idx + 1}`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {!activeQuestion ? (
              <View style={styles.emptyQuizBox}>
                <Text style={styles.emptyQuizText}>Bài này chưa có câu hỏi kiểm tra nhanh.</Text>
              </View>
            ) : !activeUnlocked ? (
              <View style={styles.lockedQuizBox}>
                <View style={styles.lockedIconCircle}>
                  <Lock size={22} color="#059669" />
                </View>
                <Text style={styles.lockedQuizTitle}>
                  {`Xem video đến mốc ${formatClock(activeQuestion.atSec)} để mở Câu ${activeQuestionIndex + 1}`}
                </Text>
                <Text style={styles.lockedQuizSub}>
                  {`Đã xem ${formatClock(Math.max(maxWatchedSec, currentTime))} / ${formatClock(activeQuestion.atSec)} — xem tới đâu câu trắc nghiệm mở tới đó.`}
                </Text>
                <Pressable
                  onPress={() => {
                    setVideoStarted(true);
                    playerApiRef.current?.play?.();
                  }}
                  style={styles.continueCtaBtn}
                >
                  <Play size={15} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.continueCtaText}>Tiếp tục xem video</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.quizBodyWrap}>
                <InlineQuizQuestionBody
                  question={activeQuestion}
                  busy={submittingId === activeQuestion.id}
                  wrongState={wrongState}
                  retryWaitSec={retryWaitSec}
                  wrongAttemptSeq={wrongAttemptSeq}
                  retryDraftChoiceId={retryDraftChoiceId}
                  onPickRetryDraftChoice={setRetryDraftChoiceId}
                  onSubmitAnswer={(itemId, body, clickedChoiceId) => {
                    void submitAnswer(itemId, body, clickedChoiceId);
                  }}
                />
                {!(wrongState?.itemId === activeQuestion.id && !activeQuestion.confirmed) ? (
                  <Pressable onPress={handleContinueAction} style={styles.continueCtaBtn}>
                    <Text style={styles.continueCtaText}>{continueLabel}</Text>
                    <ArrowRight size={16} color="#FFFFFF" />
                  </Pressable>
                ) : null}
              </View>
            )}
          </Card>

          {/* Summary Note Card */}
          {selectedContent ? (
            <Card style={styles.noteSectionCard}>
              <View style={styles.inline}>
                <NotebookPen size={17} color="#059669" />
                <Text style={styles.quizCardTitle}>
                  {selectedVideoHasUrl ? 'Tóm tắt thao tác nhanh' : 'Nội dung bài học'}
                </Text>
              </View>
              {unitContents.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.subPillRow}>
                  {unitContents.map((c, idx) => {
                    const selected = c.id === selectedContent.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() => setSelectedContentId(c.id)}
                        style={[styles.subPill, selected && styles.subPillActive]}
                      >
                        <Text style={[styles.subPillText, selected && styles.subPillTextActive]}>
                          {c.title || `Nội dung ${idx + 1}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
              <View style={styles.noteCard}>
                {selectedContent.title ? <Text style={styles.noteTitle}>{selectedContent.title}</Text> : null}
                <RenderHtml
                  contentWidth={contentWidth}
                  source={{ html: selectedContent.content || '', baseUrl: getMobileApiBaseUrl() }}
                  baseStyle={lessonHtmlBaseStyle}
                  tagsStyles={lessonHtmlTags}
                />
              </View>
            </Card>
          ) : null}

          {/* Lesson Footer Nav */}
          <View style={styles.lessonFooterNav}>
            <Pressable
              disabled={!prevUnit}
              onPress={() => { if (prevUnit) void openUnitDetail(prevUnit); }}
              style={[styles.footerPrevBtn, !prevUnit && styles.actionDisabled]}
            >
              <ArrowLeft size={15} color="#334155" />
              <Text style={styles.footerPrevText}>Bài trước</Text>
            </Pressable>
            <Pressable
              onPress={() => { if (nextUnit) void openUnitDetail(nextUnit); else closeLessonToList(); }}
              style={styles.footerNextBtn}
            >
              <Text style={styles.footerNextText}>{nextUnit ? 'Tiếp tục bài học' : 'Về danh sách bài'}</Text>
              <ArrowRight size={15} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}

      {/* Out-of-XP Popup (non-fullscreen) */}
      <Modal
        visible={outOfXpModalOpen && !isVideoFullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setOutOfXpModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          {renderOutOfXpBody()}
        </View>
      </Modal>

      {/* Offline Video Player Modal */}
      <Modal
        visible={Boolean(offlinePlayer)}
        transparent
        animationType="slide"
        onRequestClose={() => {
          const uri = offlinePlayer?.uri;
          setOfflinePlayer(null);
          if (uri) void releaseOfflinePlaybackUri(uri);
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.offlineModalCard}>
            <View style={styles.offlineModalHeader}>
              <Text style={styles.offlineModalTitle} numberOfLines={1}>{offlinePlayer?.record.title || 'Video offline'}</Text>
              <Pressable onPress={() => {
                const uri = offlinePlayer?.uri;
                setOfflinePlayer(null);
                if (uri) void releaseOfflinePlaybackUri(uri);
              }}>
                <X size={20} color="#0F172A" />
              </Pressable>
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
    </View>
  );
}

const styles = createThemedStyles(() => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  embeddedWrap: { gap: spacing.md },
  screenContent: { gap: spacing.md, backgroundColor: '#F8FAFC', paddingBottom: spacing.xl },
  bannerCard: { gap: 4, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5', padding: spacing.md, borderRadius: 18 },
  bannerTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  bannerSub: { color: '#065F46', fontSize: 12, fontWeight: '600', lineHeight: 17 },

  subjectStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 2 },
  subjectChip: {
    minWidth: 156,
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  subjectChipIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  subjectChipBody: { flex: 1, minWidth: 0 },
  subjectChipName: { color: '#0F172A', fontSize: 13, fontWeight: '900' },
  subjectChipMeta: { color: '#64748B', fontSize: 11, fontWeight: '700', marginTop: 1 },

  unitListCard: { borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', padding: 0, overflow: 'hidden' },
  unitListHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  unitListSubjectTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900' },
  unitCountBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#D1FAE5' },
  unitCountBadgeText: { color: '#065F46', fontSize: 11.5, fontWeight: '900' },
  unitRowsWrap: { width: '100%' },
  unitRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: spacing.md, paddingVertical: 14 },
  unitRowBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  unitRowMain: { flex: 1, minWidth: 0, gap: 6 },
  unitRowTitle: { color: '#0F172A', fontSize: 14.5, fontWeight: '900' },
  unitRowMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  unitMetaBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#F1F5F9' },
  unitMetaBadgeText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  statusPillDone: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  statusPillProgress: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  statusPillIdle: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  statusPillText: { fontSize: 11, fontWeight: '800' },
  unitActionBtnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#059669' },
  unitActionBtnPrimaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  unitActionBtnOutline: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  unitActionBtnOutlineText: { color: '#334155', fontSize: 12, fontWeight: '800' },

  lessonWrap: { gap: spacing.md },
  lessonHeaderCard: { gap: 10, padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  lessonHeaderTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lessonBackBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  lessonSubjectEyebrow: { color: '#047857', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  lessonUnitTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },
  xpHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  xpDeltaPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  xpDeltaPos: { backgroundColor: '#D1FAE5' },
  xpDeltaNeg: { backgroundColor: '#FFE4E6' },
  xpDeltaText: { fontSize: 11.5, fontWeight: '900' },
  xpWalletPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  xpWalletActive: { backgroundColor: '#059669' },
  xpWalletReview: { backgroundColor: '#0284C7' },
  xpWalletEmpty: { backgroundColor: '#E11D48' },
  xpWalletText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' },
  lessonProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lessonProgressTrack: { flex: 1, height: 8, borderRadius: 999, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  lessonProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#10B981' },
  lessonProgressLabel: { color: '#475569', fontSize: 12, fontWeight: '800' },

  subPillRow: { flexDirection: 'row', gap: 8 },
  subPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  subPillActive: { borderColor: '#059669', backgroundColor: '#059669' },
  subPillText: { color: '#334155', fontSize: 12, fontWeight: '800' },
  subPillTextActive: { color: '#FFFFFF' },
  videoCountChip: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: '#ECFDF5' },
  videoCountChipActive: { backgroundColor: 'rgba(255,255,255,0.22)' },
  videoCountChipText: { color: '#047857', fontSize: 10.5, fontWeight: '900' },

  videoCard: { gap: 12, padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  videoFrame: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden', borderRadius: 16, backgroundColor: '#0B1623' },
  videoStartOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, gap: 8, backgroundColor: '#0B1623' },
  videoStartBtn: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: '#10B981' },
  videoOverlayTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  videoOverlaySub: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },

  checkpointBarWrap: { gap: 6 },
  checkpointBarTitle: { color: '#334155', fontSize: 12, fontWeight: '800' },
  checkpointPinRow: { flexDirection: 'row', gap: 8 },
  checkpointPin: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  checkpointPinActive: { borderColor: '#059669', backgroundColor: '#059669' },
  checkpointPinDone: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  checkpointPinOpen: { borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  checkpointPinLocked: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  checkpointPinText: { color: '#334155', fontSize: 11.5, fontWeight: '800' },

  noVideoBanner: { padding: spacing.md, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  noVideoBannerText: { color: '#065F46', fontSize: 13, fontWeight: '700', lineHeight: 19 },

  quizCard: { gap: 12, padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  quizCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  quizCardTitle: { color: '#0F172A', fontSize: 15.5, fontWeight: '900' },
  milestoneChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  milestoneChipText: { color: '#047857', fontSize: 11, fontWeight: '900' },
  questionSelectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 12,
  },
  questionPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  questionPillActive: { borderColor: '#059669', backgroundColor: '#059669' },
  questionPillDone: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  questionPillOpen: { borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  questionPillLocked: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  questionPillText: { color: '#334155', fontSize: 11.5, fontWeight: '800' },

  emptyQuizBox: { padding: spacing.lg, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', alignItems: 'center' },
  emptyQuizText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  lockedQuizBox: { gap: 10, alignItems: 'center', padding: spacing.md, borderRadius: 16, borderWidth: 1, borderColor: '#D1FAE5', backgroundColor: '#F0FDF4' },
  lockedIconCircle: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
  lockedQuizTitle: { color: '#0F172A', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  lockedQuizSub: { color: '#64748B', fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 17 },
  quizBodyWrap: { gap: 14 },
  quizInnerWrap: { gap: 12 },
  questionPrompt: { color: '#0F172A', fontSize: 15, fontWeight: '800', lineHeight: 22 },
  questionPromptCompact: { color: '#0F172A', fontSize: 14.5, fontWeight: '800', lineHeight: 21 },
  questionMediaImage: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#F8FAFC' },
  questionImageWrap: { position: 'relative', width: '100%', height: 200, borderRadius: 12, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  questionImage: { width: '100%', height: '100%' },
  hotspotRegionBox: { position: 'absolute', borderWidth: 2, borderColor: '#10B981', backgroundColor: 'rgba(16,185,129,0.2)' },
  hotspotDot: { position: 'absolute', width: 14, height: 14, marginLeft: -7, marginTop: -7, borderRadius: 7, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#059669' },

  optionList: { gap: 8 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 11, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  optionRowSelected: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  optionRowWrong: { borderColor: '#FB7185', backgroundColor: '#FFF1F2' },
  optionRowCorrect: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  optionLetter: { color: '#334155', fontSize: 13.5, fontWeight: '900' },
  optionText: { flex: 1, color: '#1E293B', fontSize: 13.5, fontWeight: '700', lineHeight: 19 },
  optionTextSelected: { color: '#065F46' },
  optionTextCorrect: { color: '#065F46' },
  optionCheckCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center' },

  writtenInput: { minHeight: 84, padding: 11, borderRadius: 12, borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', color: '#0F172A', textAlignVertical: 'top' },
  matchConfirmedRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  matchBlock: { gap: 6 },
  matchLeftLabel: { color: '#0F172A', fontSize: 13, fontWeight: '800' },
  matchArrowText: { color: '#047857', fontSize: 13, fontWeight: '800' },
  dragRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  dragNumCircle: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  dragNumCircleText: { color: '#FFFFFF', fontSize: 11.5, fontWeight: '900' },
  dragText: { flex: 1, color: '#1E293B', fontSize: 13, fontWeight: '700' },
  dragControls: { flexDirection: 'row', gap: 8 },
  checkBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 12, backgroundColor: '#059669' },
  checkBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },

  mascotFeedbackGood: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  mascotFeedbackGoodText: { flex: 1, color: '#065F46', fontSize: 12.5, fontWeight: '800', lineHeight: 18 },
  mascotFeedbackBad: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 14, borderWidth: 1, borderColor: '#FECDD3', backgroundColor: '#FFF1F2' },
  mascotFeedbackBadText: { color: '#9F1239', fontSize: 12.5, fontWeight: '800', lineHeight: 18 },
  hintWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  hintInlineText: { flex: 1, color: '#92400E', fontSize: 11.5, fontWeight: '700', marginTop: 2 },

  continueCtaBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 999, backgroundColor: '#059669' },
  continueCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },

  noteSectionCard: { gap: 10, padding: spacing.md, borderRadius: 20, borderWidth: 1, borderColor: '#D1FAE5', backgroundColor: '#FFFFFF' },
  noteCard: { gap: spacing.sm, padding: spacing.sm, borderRadius: 14, backgroundColor: '#FFFFFF' },
  noteTitle: { color: '#0F172A', fontSize: 15, fontWeight: '900' },

  lessonFooterNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  footerPrevBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  footerPrevText: { color: '#334155', fontSize: 13, fontWeight: '800' },
  footerNextBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#059669' },
  footerNextText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },

  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 80,
    ...(Platform.OS === 'android' ? { elevation: 80 } : null),
    backgroundColor: 'rgba(15,23,42,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
  },
  fullscreenQuizModalCard: { width: '100%', maxWidth: 520, borderRadius: 24, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#FFFFFF', padding: spacing.md, gap: 12 },
  fullscreenQuizModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 },
  fullscreenQuizModalTitle: { color: '#0F172A', fontSize: 13.5, fontWeight: '900' },
  xpMiniBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  xpMiniBadgeAmber: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  xpMiniBadgeRose: { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' },
  xpMiniBadgeText: { fontSize: 11, fontWeight: '900' },

  outOfXpCard: { width: '100%', maxWidth: 400, alignItems: 'center', gap: 12, padding: spacing.lg, borderRadius: 24, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFFFF' },
  outOfXpTitle: { color: '#0F172A', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  outOfXpDesc: { color: '#475569', fontSize: 13.5, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  outOfXpActions: { flexDirection: 'row', gap: 10, width: '100%', marginTop: 4 },
  outOfXpPrimaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, backgroundColor: '#059669' },
  outOfXpPrimaryText: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '900' },
  outOfXpSecondaryBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  outOfXpSecondaryText: { color: '#334155', fontSize: 13.5, fontWeight: '800' },

  actionDisabled: { opacity: 0.45 },
  errorText: { color: colors.red, fontSize: typography.small },
  cardTitle: { color: colors.ink, fontSize: typography.body, fontWeight: '800' },
  offlineCatalogCard: { gap: spacing.xs, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#F0FDF4' },
  offlineCatalogHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  offlineCatalogTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  offlineSandboxPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#D1FAE5' },
  offlineSandboxPillText: { color: '#047857', fontSize: 10, fontWeight: '800' },
  offlineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#DCFCE7' },
  offlineRowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  offlineRowTitle: { color: '#065F46', fontSize: typography.small, fontWeight: '800' },
  offlineRowSub: { color: '#047857', fontSize: typography.micro, fontWeight: '600' },
  offlineTrashButton: { width: 28, height: 28, borderRadius: 999, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  offlineLessonCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  offlineLessonText: { flex: 1, color: '#065F46', fontSize: 12, fontWeight: '700' },
  offlineActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#A7F3D0', backgroundColor: '#FFFFFF' },
  offlineActionBtnActive: { backgroundColor: '#059669', borderColor: '#059669' },
  offlineActionBtnText: { color: '#047857', fontSize: 11.5, fontWeight: '800' },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.6)', padding: spacing.md },
  offlineModalCard: { width: '100%', maxWidth: 640, borderRadius: 18, backgroundColor: '#FFFFFF', padding: spacing.md, gap: spacing.sm },
  offlineModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  offlineModalTitle: { flex: 1, color: '#0F172A', fontSize: 15, fontWeight: '900' },
}));
