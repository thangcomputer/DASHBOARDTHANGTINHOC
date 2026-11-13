import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, DeviceEventEmitter, Easing, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft, ArrowRight, Award, BookOpen, Calendar, Check, CheckCircle2, ChevronDown, ChevronRight, ChevronUp, Code2, Cpu, Crown, Dumbbell, FastForward, FileText, Flame, Gamepad2, Gift, Globe,
  HelpCircle, Image as ImageIcon, Keyboard, Lightbulb, Lock, LogOut, Mail, Monitor, Play, PlayCircle, Presentation, QrCode, RefreshCw, RotateCcw, Route, Sheet, ShieldCheck,
  ShoppingBag, Shuffle, Sparkles, Star, Target, Trophy, Video as VideoIcon, X, XCircle, Zap,
  type LucideIcon,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle, Defs, Ellipse, LinearGradient, Path, Stop } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { AppScreen, ChromeScrollView } from '../components/ui';
import { Mascot, type MascotMood } from '../components/dailyPractice/Mascot';
import { DropletMark, PathITBackdrop } from '../components/dailyPractice/PathDecor';
import { pathNodeMapLabel, pathNodeStartBubbleLabel } from '../../../shared/dailyPractice/pathNodeNudge.mjs';
import {
  PATH_HUB_PROGRESS_RING,
  pathHubNodeProgress,
  pathHubProgressColor,
} from '../../../shared/dailyPractice/pathHubProgressRing.mjs';
import { PATH_HUB_DUO } from '../../../shared/dailyPractice/pathHubDuoVisual.mjs';
import { pathNodeColor } from '../../../shared/dailyPractice/pathNodeColors.mjs';
import {
  RETRY_BASELINE_EMPTY,
  canSubmitRetryAfterWrong,
  serializePracticeAnswer,
} from '../../../shared/dailyPractice/practiceAnswerCompare.mjs';
import { DragProvider } from '../components/dailyPractice/DragKit';
import { PracticeFinishOverlay } from '../components/dailyPractice/PracticeFinishOverlay';
import { MobileComboCelebrationOverlay } from '../components/dailyPractice/MobileComboCelebrationOverlay';
import { PathVideoModal } from '../components/dailyPractice/PathVideoModal';
import { UnitStageChest } from '../components/dailyPractice/UnitStageChest';
import { MobileAnswerFeedback } from '../components/dailyPractice/MobileAnswerFeedback';
import { VideoPlayerFrame, type VideoPlayerApi } from './VideoPlayerFrame';
import { resolveMobilePublicUrl } from '../services/apiClient';
import { embeddedVideoUrl, isDirectVideoUrl, playableVideoUrl } from '../utils/videoSource';
import { useAuth } from '../app/AuthContext';
import { isFreePortalMenu } from '../utils/freePortalHelper';
import { FillQuestion, MatchQuestion, McqQuestion, OrderQuestion, SortQuestion, TrueFalseQuestion } from '../components/dailyPractice/Questions';
import { useGameSounds, type GameSound } from '../components/dailyPractice/useGameSounds';
import { DuoButton } from '../components/duo/DuoButton';
import { getLearningGoal, periodLabel, LEARNING_GOAL_CHANGED_EVENT, OPEN_LEARNING_GOAL_EVENT, STUDY_MINUTE_EVENT, type LearningGoalData, type LearningGoalProgress } from '../services/learningGoalApi';
import { getMobileImageSource } from '../services/apiClient';
import {
  DAILY_PRACTICE_STATS_EVENT, DP_DIFFICULTIES, DP_PLAN_XP_CAP, DP_PLANS, DP_TOPIC_COLORS, DP_TYPES,
  QUESTION_STAKE_XP, SESSION_STAKE_XP, TEST_OUT_XP,
  dailyPracticeApi, dpIsPro, dpXpCapReached, inPlayWalletXp, playQuestionHeaderChips, practiceFinishXpDisplay, randomComfort, randomPraise, resultMessage, unitColor,
  type DpNodeState, type DpAnswer, type DpAnswerResult, type DpDifficulty, type DpNextStep, type DpPathNode, type DpPathResult, type DpPathStep, type DpPathUnit, type DpPathVideo, type DpPlanType, type DpStepKey,
  type DpRelatedLesson, type DpReveal, type DpSession, type DpStats, type DpSummary, type DpTopic, type DpTopicPath, type DpXpCheckout, type DpXpPack,
} from '../services/dailyPracticeApi';
import { colors, radius, spacing, theme, createThemedStyles } from '../theme/tokens';
import {
  persistLastPathTopicId,
  pickActivePathTopic,
  resolveSavedPathTopicId,
  syncLastPathTopicFromServer,
} from '../utils/lastPathTopic';
import { unitStageCtaLabel } from '../../../shared/dailyPractice/lastPathTopic.mjs';
import { shouldNudgeHintButton } from '../../../shared/dailyPractice/quizWrongEncouragement.mjs';
import { PLAY_QUESTION_CHROME } from '../../../shared/dailyPractice/playQuestionChrome.mjs';
import { VietnamJourneyStage } from '../components/dailyPractice/VietnamJourneyStage';
import { LevelUnlockBanner } from '../components/dailyPractice/LevelUnlockBanner';
import { useNewlyUnlockedUnit } from '../components/dailyPractice/useNewlyUnlockedUnit';

const TOPIC_ICONS: Record<string, LucideIcon> = {
  book: BookOpen, monitor: Monitor, 'file-text': FileText, sheet: Sheet, presentation: Presentation, globe: Globe,
  keyboard: Keyboard, shield: ShieldCheck, cpu: Cpu, mail: Mail, image: ImageIcon, code: Code2,
};
const CONFETTI_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#0EA5E9', '#A855F7', '#F97316'];
const USE_NATIVE_DRIVER = Platform.OS !== 'web';
const gradient = (from: string, to: string) => ({ backgroundColor: to, backgroundImage: `linear-gradient(180deg, ${from} 0%, ${to} 100%)` } as never);

function Confetti({ count = 18, spread = 150 }: { count?: number; spread?: number }) {
  const burst = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const distance = spread * (0.55 + ((i * 37) % 60) / 100);
    return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance - 30, rot: `${(i % 2 ? 1 : -1) * (200 + i * 20)}deg`, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] };
  }), [count, spread]);
  useEffect(() => {
    Animated.timing(burst, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [burst]);
  return (
    <View pointerEvents="none" style={styles.confettiLayer}>
      {pieces.map((piece, index) => (
        <Animated.View
          key={index}
          style={[styles.confetti, {
            backgroundColor: piece.color,
            opacity: burst.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.9, 0] }),
            transform: [
              { translateX: burst.interpolate({ inputRange: [0, 1], outputRange: [0, piece.dx] }) },
              { translateY: burst.interpolate({ inputRange: [0, 1], outputRange: [0, piece.dy] }) },
              { rotate: burst.interpolate({ inputRange: [0, 1], outputRange: ['0deg', piece.rot] }) },
            ],
          }]}
        />
      ))}
    </View>
  );
}

function useShake(trigger: unknown) {
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!trigger) return;
    shake.setValue(0);
    Animated.sequence([0, 1, -1, 1, -1, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: USE_NATIVE_DRIVER }))).start();
  }, [shake, trigger]);
  return shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] });
}

// ── Màn chọn ─────────────────────────────────────────────────────────────────
const MODES: Array<{ id: PracticeMode; label: string; icon: LucideIcon }> = [
  { id: 'path', label: 'Lộ trình', icon: Route },
  { id: 'free', label: 'Luyện tự do', icon: Shuffle },
  { id: 'goal', label: 'Mục tiêu', icon: Target },
];
type PracticeMode = 'path' | 'free' | 'goal';

const GOAL_KEY_PREFIX = 'daily_practice_goal_v1';
const WEEK_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function DailyPracticeGoalPanel({
  stats,
  userId,
  onWatchVideo,
  onGoPractice,
}: {
  stats: DpStats | null;
  userId?: string;
  onWatchVideo?: () => void;
  onGoPractice?: () => void;
}) {
  const storageKey = `${GOAL_KEY_PREFIX}:${userId || 'guest'} `;
  const [goal, setGoal] = useState<{ dailyTarget: number; pace: 'self' | 'guided' }>({ dailyTarget: 1, pace: 'self' });
  const [goalData, setGoalData] = useState<LearningGoalData | null>(null);

  useEffect(() => {
    getLearningGoal().then(setGoalData).catch(() => { });
    const sub1 = DeviceEventEmitter.addListener(LEARNING_GOAL_CHANGED_EVENT, (next: LearningGoalData) => {
      if (next) setGoalData(next);
      else getLearningGoal().then(setGoalData).catch(() => { });
    });
    const sub2 = DeviceEventEmitter.addListener(STUDY_MINUTE_EVENT, (res: { todayMinutes?: number }) => {
      const todayMinutes = Number(res?.todayMinutes);
      if (!Number.isFinite(todayMinutes)) return;
      setGoalData((prev) => {
        if (!prev) return prev;
        const delta = Math.max(0, todayMinutes - (prev.progress.todayMinutes || 0));
        return {
          ...prev,
          progress: { ...prev.progress, todayMinutes, periodMinutes: (prev.progress.periodMinutes || 0) + delta },
        };
      });
    });
    return () => { sub1.remove(); sub2.remove(); };
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.dailyTarget === 'number') {
          setGoal({
            dailyTarget: Math.min(5, Math.max(1, Number(parsed.dailyTarget) || 1)),
            pace: parsed.pace === 'guided' ? 'guided' : 'self',
          });
        }
      })
      .catch(() => undefined);
  }, [storageKey]);

  const updateGoal = (patch: Partial<{ dailyTarget: number; pace: 'self' | 'guided' }>) => {
    setGoal((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  };

  const todaySessions = stats?.todaySessions || (stats?.playedToday ? 1 : 0);
  const streak = stats?.streak || 0;
  const bestStreak = stats?.bestStreak || 0;
  const playedToday = Boolean(stats?.playedToday);
  const todayProgress = Math.min(100, Math.round((todaySessions / Math.max(1, goal.dailyTarget)) * 100));

  const progress: Partial<LearningGoalProgress> = goalData?.progress || {};
  const todayQuestions = progress.todayQuestions ?? (stats?.playedToday ? 10 : 0);
  const todayVideos = progress.todayVideos ?? 0;
  const qDone = todayQuestions >= 10;
  const vDone = todayVideos >= 1;
  const missionDoneCount = (qDone ? 1 : 0) + (vDone ? 1 : 0);
  const periodQuestions = progress.periodQuestions ?? todayQuestions;
  const periodVideos = progress.periodVideos ?? todayVideos;
  const period = goalData?.goal?.period || 'month';
  const todayIdx = (new Date().getDay() + 6) % 7;

  return (
    <View style={styles.gapMd}>
      {/* Mục tiêu hôm nay */}
      <View style={styles.goalCard}>
        <View style={styles.goalHeaderRow}>
          <View style={styles.inline}>
            <View style={[styles.goalIconBox, { backgroundColor: theme.brandSoft }]}>
              <Target size={17} color={theme.brand} />
            </View>
            <View>
              <Text style={styles.goalCardTitle}>Mục tiêu hôm nay</Text>
              <Text style={styles.goalCardSub}>Kế hoạch rèn luyện hằng ngày</Text>
            </View>
          </View>
          <View style={[styles.goalBadge, todayProgress >= 100 ? { backgroundColor: '#ECFDF5' } : { backgroundColor: '#F1F5F9' }]}>
            <Text style={[styles.goalBadgeText, { color: todayProgress >= 100 ? '#047857' : '#334155' }]}>{`${todayProgress}% `}</Text>
          </View>
        </View>

        <View style={[styles.pathTrack, { height: 8 }]}>
          <View style={[styles.pathFill, { width: `${todayProgress}% `, backgroundColor: todayProgress >= 100 ? '#10B981' : '#EF4444' }]} />
        </View>

        <View style={[styles.goalInfoBox, { backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.goalInfoTitle, { color: '#1E3A8A' }]}>Kế hoạch học tập</Text>
            <Pressable
              onPress={() => DeviceEventEmitter.emit(OPEN_LEARNING_GOAL_EVENT)}
              hitSlop={8}
              accessibilityRole="button"
              style={({ pressed }) => ({
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: '#FECACA',
                borderBottomWidth: pressed ? 1.5 : 3.5,
                borderBottomColor: '#F87171',
                backgroundColor: pressed ? '#FEF2F2' : '#FFFFFF',
                transform: [{ translateY: pressed ? 2 : 0 }],
              })}
            >
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>
                {goalData?.goal?.expired ? 'Đặt lại mục tiêu' : goalData?.goal ? 'Đổi mục tiêu' : 'Đặt mục tiêu'}
              </Text>
            </Pressable>
          </View>
          <Text style={[styles.goalInfoSub, { color: '#1D4ED8', marginTop: 2 }]}>
            {goalData?.goal
              ? `Mục tiêu giờ học: ${goalData.goal.hoursPerDay} giờ/ngày · ${periodLabel(goalData.goal.period)}${goalData.goal.expired ? ' (Đã kết thúc)' : ''}`
              : 'Chọn số bài mỗi ngày để xây dựng thói quen học tập đều đặn.'}
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <View style={styles.goalHeaderRow}>
            <Text style={styles.goalLabelSmall}>Số lượt luyện mỗi ngày</Text>
            <Text style={styles.goalValueSmall}>{`${goal.dailyTarget} lượt`}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => {
              const active = goal.dailyTarget === n;
              return (
                <Pressable
                  key={n}
                  onPress={() => updateGoal({ dailyTarget: n })}
                  style={[styles.goalTargetBtn, active && styles.goalTargetBtnActive]}
                  accessibilityRole="button"
                >
                  <Text style={[styles.goalTargetBtnText, active && { color: '#FFFFFF', fontWeight: '800' }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.goalFooterBox}>
          <Calendar size={15} color="#64748B" />
          <Text style={styles.goalFooterText}>
            {'Đã hoàn thành '}
            <Text style={{ fontWeight: '700', color: '#0F172A' }}>{`${todaySessions} /${goal.dailyTarget}`}</Text>
            {' lượt bài hôm nay'}
          </Text>
        </View>
      </View>

      {/* Nhiệm vụ hôm nay */}
      <View style={styles.goalCard}>
        <View style={styles.goalHeaderRow}>
          <View style={styles.inline}>
            <View style={[styles.goalIconBox, { backgroundColor: '#FFFBEB' }]}>
              <Sparkles size={17} color="#D97706" />
            </View>
            <View>
              <Text style={styles.goalCardTitle}>Nhiệm vụ hôm nay</Text>
              <Text style={styles.goalCardSub}>Hoàn thành mục tiêu học và rèn luyện</Text>
            </View>
          </View>
          <View style={[styles.goalBadge, { backgroundColor: '#F1F5F9' }]}>
            <Text style={[styles.goalBadgeText, { color: '#334155' }]}>{`${missionDoneCount}/2 hoàn thành`}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Cột 1: Luyện tập (Xanh lá) */}
          <Pressable
            onPress={onGoPractice}
            style={[styles.missionRowCard, { flex: 1, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}
            accessibilityRole="button"
            accessibilityLabel={`Luyện tập: ${qDone ? 'Hoàn thành' : `${todayQuestions}/10 câu`}`}
          >
            <View style={[styles.missionSquareIcon, { backgroundColor: '#10B981' }]}>
              <Gamepad2 size={20} color="#FFFFFF" />
              {qDone ? (
                <View style={styles.missionCheckBadge}>
                  <Check size={10} strokeWidth={3.5} color="#059669" />
                </View>
              ) : null}
            </View>
            <View style={styles.flex}>
              <Text style={[styles.missionRowTitle, { color: '#065F46' }]}>Luyện tập</Text>
              <Text style={[styles.missionRowSub, { color: '#059669' }]}>
                {qDone ? `Hoàn thành · ${todayQuestions} câu` : `${todayQuestions}/10 câu`}
              </Text>
              <View style={[styles.missionRowTrack, { backgroundColor: '#D1FAE5' }]}>
                <View style={[styles.missionRowFill, { width: `${Math.min(100, Math.round((todayQuestions / 10) * 100))}%`, backgroundColor: '#10B981' }]} />
              </View>
            </View>
          </Pressable>

          {/* Cột 2: Xem video */}
          <Pressable
            onPress={onWatchVideo}
            style={[styles.missionRowCard, { flex: 1, backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}
            accessibilityRole="button"
            accessibilityLabel={`Xem video: ${todayVideos}/1 video`}
          >
            <View style={[styles.missionCircleIcon, { backgroundColor: '#8B5CF6' }]}>
              <PlayCircle size={22} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={[styles.missionRowTitle, { color: '#0F172A' }]}>Xem video</Text>
                <ChevronRight size={14} color="#94A3B8" />
              </View>
              <Text style={[styles.missionRowSub, { color: '#64748B' }]}>
                {`${todayVideos}/1 video`}
              </Text>
              <View style={[styles.missionRowTrack, { backgroundColor: '#F1F5F9' }]}>
                <View style={[styles.missionRowFill, { width: `${Math.min(100, Math.round(todayVideos * 100))}%`, backgroundColor: '#8B5CF6' }]} />
              </View>
            </View>
          </Pressable>
        </View>

        <Text style={styles.missionFooterText}>
          {`Cả ${periodLabel(period)}: ${periodQuestions} câu · ${periodVideos} video`}
        </Text>
      </View>

      {/* Chuỗi luyện tập */}
      <View style={styles.goalCard}>
        <View style={styles.goalHeaderRow}>
          <View style={styles.inline}>
            <View style={[styles.goalIconBox, { backgroundColor: '#FFF7ED' }]}>
              <Flame size={17} color="#EA580C" />
            </View>
            <View>
              <Text style={styles.goalCardTitle}>Chuỗi học tập</Text>
              <Text style={styles.goalCardSub}>{`Kỷ lục cao nhất: ${bestStreak} ngày`}</Text>
            </View>
          </View>
          <View style={styles.inline}>
            <Flame size={15} color="#EA580C" fill="#FB923C" />
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#EA580C' }}>{`${streak} ngày`}</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 6 }}>
          {WEEK_DAYS.map((label, idx) => {
            const isToday = idx === todayIdx;
            const active = (isToday && playedToday) || (idx < todayIdx && streak >= (todayIdx - idx + (playedToday ? 1 : 0)));
            return (
              <View
                key={label}
                style={[
                  styles.weekCell,
                  active
                    ? { borderColor: '#FDBA74', backgroundColor: '#FFF7ED' }
                    : isToday
                      ? { borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' }
                      : { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
                ]}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#C2410C' : '#64748B' }}>{label}</Text>
                <Flame size={15} color={active ? '#F97316' : '#CBD5E1'} fill={active ? '#FB923C' : 'transparent'} />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** Hàng môn — cố định trên tab Lộ trình / Luyện tự do. */
function PracticeSubjectStrip({
  pathTopics,
  freeTopics,
  activeId,
  onSelect,
  play,
}: {
  pathTopics: DpTopicPath[];
  freeTopics: DpTopic[];
  activeId: string;
  onSelect: (id: string) => void;
  play: (s: GameSound) => void;
}) {
  const usePathList = pathTopics.length > 0;
  if (!usePathList && !freeTopics.length) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.chipScroller}
      contentContainerStyle={styles.chipRow}
    >
      {usePathList
        ? pathTopics.map((item) => {
          const Icon = TOPIC_ICONS[item.topic.icon] || BookOpen;
          const tone = DP_TOPIC_COLORS[item.topic.color] || DP_TOPIC_COLORS.red;
          const active = item.topic.id === activeId;
          return (
            <Pressable
              key={item.topic.id}
              onPress={() => { play('tap'); onSelect(item.topic.id); }}
              style={[styles.chip, { borderColor: active ? tone.to : '#E2E8F0', backgroundColor: active ? tone.soft : '#FFFFFF' }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.chipIcon, gradient(tone.from, tone.to)]}><Icon size={15} color="#FFFFFF" /></View>
              <View>
                <Text style={styles.chipName}>{item.topic.name}</Text>
                <Text style={styles.chipMeta}>{`${item.completedUnits}/${item.totalUnits} chặng`}</Text>
              </View>
            </Pressable>
          );
        })
        : freeTopics.map((topic) => {
          const Icon = TOPIC_ICONS[topic.icon] || BookOpen;
          const tone = DP_TOPIC_COLORS[topic.color] || DP_TOPIC_COLORS.red;
          const active = topic.id === activeId;
          const total = topic.counts.easy + topic.counts.medium + topic.counts.hard;
          return (
            <Pressable
              key={topic.id}
              onPress={() => { play('tap'); onSelect(topic.id); }}
              style={[styles.chip, { borderColor: active ? tone.to : '#E2E8F0', backgroundColor: active ? tone.soft : '#FFFFFF' }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.chipIcon, gradient(tone.from, tone.to)]}><Icon size={15} color="#FFFFFF" /></View>
              <View>
                <Text style={styles.chipName}>{topic.name}</Text>
                <Text style={styles.chipMeta}>{`${total} câu hỏi`}</Text>
              </View>
            </Pressable>
          );
        })}
    </ScrollView>
  );
}

function HomeView({
  topics, stats, loading, error, starting, onStart, play, initialTopicId = '',
  mode, onModeChange, pathTopics, pathLoading, pathError, onStartStep, onQuickStart, onPathChanged, onBuyXp,
  initialWatchStage = false, pathActiveTopicId = '',
}: {
  topics: DpTopic[];
  stats: DpStats | null;
  loading: boolean;
  error: string;
  starting: boolean;
  onStart: (topicId: string, difficulty: DpDifficulty) => void;
  play: (s: GameSound) => void;
  initialTopicId?: string;
  mode: PracticeMode;
  onModeChange: (mode: PracticeMode) => void;
  pathTopics: DpTopicPath[];
  pathLoading: boolean;
  pathError: string;
  onStartStep: (unitId: string, nodeKey: string, step: DpStepKey, testOut: boolean, opts?: { review?: boolean }) => void;
  onQuickStart: (activeTopic?: DpTopicPath | null) => void;
  onPathChanged: () => void;
  /** Điều hướng đến màn mua gói XP. */
  onBuyXp: () => void;
  initialWatchStage?: boolean;
  pathActiveTopicId?: string;
}) {
  const { user } = useAuth();
  const { width: windowWidth } = useWindowDimensions();
  const isWide = windowWidth >= 1024;
  const [topicId, setTopicId] = useState('');
  const [selectedPathTopicId, setSelectedPathTopicId] = useState('');
  const [difficulty, setDifficulty] = useState<DpDifficulty>('easy');
  const [continueVideo, setContinueVideo] = useState(Boolean(initialWatchStage));

  useEffect(() => {
    if (initialWatchStage) {
      setContinueVideo(true);
    }
  }, [initialWatchStage]);
  const selected = topics.find((t) => t.id === topicId);
  useEffect(() => {
    if (topicId || !topics.length) return;
    const linked = initialTopicId ? topics.find((t) => t.id === initialTopicId) : undefined;
    setTopicId(linked ? linked.id : topics[0].id);
  }, [topicId, topics, initialTopicId]);

  const activePathTopic = useMemo(
    () => pickActivePathTopic(
      { topics: pathTopics, activeTopicId: pathActiveTopicId },
      initialTopicId,
      selectedPathTopicId || pathActiveTopicId,
    ),
    [pathTopics, initialTopicId, selectedPathTopicId, pathActiveTopicId],
  );
  const activeTopicTitle = mode === 'path'
    ? activePathTopic?.topic.name || topics[0]?.name || 'Lộ trình'
    : selected?.name || topics[0]?.name || 'Chủ đề';
  const completedUnits = activePathTopic?.completedUnits || 0;
  const totalUnits = activePathTopic?.totalUnits || 0;

  const mascotMood: MascotMood = stats?.playedToday
    ? 'happy'
    : stats?.streakState === 'lost'
      ? 'sad'
      : stats?.streakState === 'at_risk'
        ? 'determined'
        : 'idle';

  return (
    <View style={styles.gapMd}>
      {/* Top Gamification Bar: Title + Streak Pill + XP Pill */}
      <View style={styles.topGamifiedBar}>
        <View style={styles.topTitleRow}>
          <Sparkles size={18} color={theme.brand} />
          <Text style={styles.topPageTitle}>Luyện tập</Text>
        </View>
        <View style={styles.topBadgesRow}>
          <View style={styles.streakBadgePill}>
            <Flame size={15} color="#EA580C" fill="#FB923C" />
            <Text style={styles.streakBadgeText}>{`${stats?.streak || 0} ngày`}</Text>
          </View>
          <Pressable onPress={() => { play('tap'); onBuyXp(); }} style={styles.xpBadgePill} accessibilityRole="button">
            <Zap size={14} color="#D97706" fill="#F59E0B" />
            <Text style={styles.xpBadgeText}>{`${(stats?.xpTotal || 0).toLocaleString('vi-VN')} XP`}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.mascotMotivationCard}>
        <View style={styles.mascotWrapCompact}>
          <Mascot mood={mascotMood} size={54} />
        </View>
        <View style={styles.mascotContent}>
          <Text style={styles.mascotHeadline} numberOfLines={1}>
            {stats?.playedToday ? 'Đã hoàn thành hôm nay 🎉' : 'Tiếp tục chuỗi luyện tập 🔥'}
          </Text>
          <Text style={styles.mascotSub} numberOfLines={1}>
            {`${activeTopicTitle} · ${totalUnits ? `${completedUnits}/${totalUnits} chặng` : 'Khám phá ngay'}`}
          </Text>
          {totalUnits > 0 ? (
            <View style={styles.mascotProgressTrack}>
              <View style={[styles.mascotProgressFill, { width: `${Math.min(100, Math.round((completedUnits / totalUnits) * 100))}%` }]} />
            </View>
          ) : null}
        </View>
        <DuoButton
          variant="accent"
          size="sm"
          text="Luyện"
          icon={<Play size={13} color="#FFFFFF" fill="#FFFFFF" />}
          loading={starting}
          disabled={starting}
          onPress={() => { play('tap'); onQuickStart(activePathTopic); }}
        />
      </View>

      {/* Banner hết XP luyện tập - chỉ hiện khi xpEmpty hoặc xpTotal <= 0 */}
      {stats && (stats.xpEmpty || (stats.xpTotal || 0) <= 0) ? (
        <View style={styles.xpEmptyBanner}>
          <View style={[styles.inline, { flex: 1 }]}>
            <View style={styles.xpEmptyIconWrap}>
              <Zap size={18} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.xpEmptyTitle}>Hết XP luyện tập</Text>
              <Text style={styles.xpEmptyDesc}>
                {`Hệ thống tự bù về ${stats.dailyAllowanceXp ?? 50} XP lúc 0h hằng ngày.`}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => { play('tap'); onBuyXp(); }} style={styles.xpEmptyBuyBtn} accessibilityRole="button">
            <ShoppingBag size={14} color="#FFFFFF" />
            <Text style={styles.xpEmptyBuyBtnText}>Mua XP</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.practicePanel}>
      <PracticeSubjectStrip
        pathTopics={pathTopics}
        freeTopics={topics}
        activeId={mode === 'path' ? (selectedPathTopicId || topicId || pathActiveTopicId) : (topicId || selectedPathTopicId)}
        onSelect={(id) => {
          setTopicId(id);
          setSelectedPathTopicId(id);
        }}
        play={play}
      />

      {/* Segmented Mode Tabs: Lộ trình | Luyện tự do | Mục tiêu */}
      <View style={styles.modeTabs} accessibilityRole="tablist">
        {MODES.map(({ id, label, icon: Icon }) => {
          const active = mode === id;
          return (
            <Pressable
              key={id}
              onPress={() => { play('tap'); onModeChange(id); }}
              style={[styles.modeTab, active && styles.modeTabActive]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Icon size={15} color={active ? theme.brandDark : colors.muted} />
              <Text style={[styles.modeTabText, active && styles.modeTabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      </View>

      {/* Nội dung chính tương ứng từng Tab */}
      <View style={isWide ? { flexDirection: 'row', alignItems: 'flex-start', gap: 20 } : undefined}>
        <View style={[styles.gapMd, isWide && { flex: 8, minWidth: 0 }]}>
          {mode === 'path' ? (
            <PathView
              topics={pathTopics}
              activeTopicId={selectedPathTopicId || pathActiveTopicId}
              loading={pathLoading}
              error={pathError}
              starting={starting}
              play={play}
              initialTopicId={initialTopicId}
              onTopicChange={setSelectedPathTopicId}
              onStartStep={onStartStep}
              onPathChanged={onPathChanged}
              continueVideo={continueVideo}
              onContinueVideoOpened={() => setContinueVideo(false)}
            />
          ) : null}

          {mode === 'free' && error ? <Text style={styles.error}>{error}</Text> : null}
          {mode === 'free' && loading ? <ActivityIndicator color={theme.brand} /> : null}
          {mode === 'free' && !loading && !topics.length && !error ? (
            <View style={styles.empty}>
              <Mascot mood="thinking" size={72} />
              <Text style={styles.emptyTitle}>Trung tâm đang soạn câu hỏi luyện tập.</Text>
              <Text style={styles.muted}>Quay lại sau nhé!</Text>
            </View>
          ) : null}

          {mode === 'free' && topics.length ? (
            <View style={[styles.card, { gap: 14 }]}>
              <View style={styles.freeModeNotice}>
                <Text style={styles.freeModeNoticeBold}>Chế độ luyện tự do - Ôn tập không tính XP: </Text>
                <Text style={styles.freeModeNoticeText}>
                  Chỉ gồm câu hỏi trắc nghiệm để bạn ôn nhanh. Không cộng và không trừ XP; muốn nhận XP và mở khóa bài học hãy chuyển sang tab Theo lộ trình.
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Độ khó (chỉ trắc nghiệm · 0 XP)</Text>
              <View style={styles.row}>
                {DP_DIFFICULTIES.map((level) => {
                  const active = level.id === difficulty;
                  return (
                    <Pressable
                      key={level.id}
                      onPress={() => { play('tap'); setDifficulty(level.id); }}
                      style={[styles.level, { borderColor: active ? level.color : '#E2E8F0', backgroundColor: active ? level.soft : '#FFFFFF' }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <View style={styles.starsRow}>
                        {[1, 2, 3].map((n) => <Star key={n} size={14} color={n <= level.stars ? level.color : '#CBD5E1'} fill={n <= level.stars ? level.color : 'transparent'} />)}
                      </View>
                      <Text style={[styles.levelLabel, active && { color: level.color }]}>{level.label}</Text>
                      <Text style={styles.levelMeta}>{`Ôn tập · 0 XP · ${selected?.counts[level.id] || 0} câu`}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <DuoButton
                variant="primary"
                size="lg"
                fullWidth
                disabled={!topicId || starting}
                loading={starting}
                icon={<Play size={18} color="#FFFFFF" />}
                text="BẮT ĐẦU ÔN TỰ DO (0 XP)"
                onPress={() => topicId && onStart(topicId, difficulty)}
                style={{ marginTop: 8 }}
              />
            </View>
          ) : null}

          {mode === 'goal' ? (
            <DailyPracticeGoalPanel
              stats={stats}
              userId={user?.id}
              onWatchVideo={() => {
                play('tap');
                onModeChange('path');
                setContinueVideo(true);
              }}
              onGoPractice={() => {
                play('tap');
                onModeChange('path');
                onQuickStart(activePathTopic);
              }}
            />
          ) : null}
        </View>

        {isWide && mode !== 'goal' ? (
          <View style={{ flex: 4, minWidth: 290 }}>
            <DailyPracticeGoalPanel
              stats={stats}
              userId={user?.id}
              onWatchVideo={() => {
                play('tap');
                onModeChange('path');
                setContinueVideo(true);
              }}
              onGoPractice={() => {
                play('tap');
                onModeChange('path');
                onQuickStart(activePathTopic);
              }}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ── Lộ trình ─────────────────────────────────────────────────────────────────
const STEP_LABELS: Partial<Record<DpStepKey, string>> = { learn: 'Dễ', practice: 'Vừa', challenge: 'Khó' };
const STEP_HINTS: Partial<Record<DpStepKey, string>> = {
  learn: 'Câu hỏi mức dễ - làm xong mới mở cấp Vừa',
  practice: 'Câu hỏi mức vừa - làm xong mới mở cấp Khó',
  challenge: 'Câu hỏi mức khó - qua cấp này để mở chặng tiếp theo',
};

/** Danh sách video của chặng (unit + từng cấp) để hiện & mở video. */
export function collectUnitVideos(unit: DpPathUnit): DpPathVideo[] {
  const items: DpPathVideo[] = [];
  const seen = new Set<string>();
  const push = (video?: DpPathVideo) => {
    if (!video?.id || seen.has(video.id)) return;
    seen.add(video.id);
    items.push(video);
  };
  for (const video of unit.videos || []) push(video);
  for (const node of unit.pathNodes || []) {
    for (const level of node.levels || []) {
      for (const video of level.videos || []) {
        push({ ...video, stepLabel: video.stepLabel || level.label || '' });
      }
    }
  }
  return items;
}

/** Video tiếp theo của chặng đang học: ưu tiên chặng dở, rồi video chưa xem và đang mở. */
export function continueStageTarget(topic?: DpTopicPath | null) {
  const units = topic?.units || [];
  const nextId = topic?.next?.unitId || '';
  const ranked = [...units].sort((a, b) => {
    if (a.id === nextId) return -1;
    if (b.id === nextId) return 1;
    return (a.index || 0) - (b.index || 0);
  });
  for (const unit of ranked) {
    if (unit.state === 'locked') continue;
    const videos = collectUnitVideos(unit);
    const pending = videos.find((v) => v.state !== 'completed' && v.state !== 'locked');
    if (pending) return { topicId: topic?.topic?.id || '', unit, videoId: pending.id };
    if (unit.lesson) return { topicId: topic?.topic?.id || '', unit, videoId: '' };
    if (videos.length > 0) return { topicId: topic?.topic?.id || '', unit, videoId: videos[0]?.id || '' };
  }
  return null;
}

function buildUnitPathItems(unit: DpPathUnit) {
  return (unit.pathNodes || []).map((node) => ({
    kind: 'hub' as const,
    key: `hub-${node.key}`,
    node,
    state: node.state,
  }));
}
const NODE_ICONS: Record<string, LucideIcon> = { book: BookOpen, dumbbell: Dumbbell, flame: Flame, crown: Crown };
const STEP_ICONS: Record<DpStepKey, LucideIcon> = { learn: BookOpen, practice: Dumbbell, challenge: Flame, checkpoint: Trophy };
const NODE_LANE_WIDTH = 420;
type PopoverState = { unitId: string; nodeKey?: string; stepKey?: DpStepKey; testOut: boolean };

/** Màu tối hơn cho "đế" nút 3D. */
function darken(hex: string, amount = 0.28) {
  const value = String(hex || '#B91C1C').replace('#', '');
  const channel = (start: number) => Math.max(0, Math.round(parseInt(value.slice(start, start + 2), 16) * (1 - amount)));
  return `rgb(${channel(0)}, ${channel(2)}, ${channel(4)})`;
}

const maxXpFor = (step: DpPathStep) => 10 * (DP_DIFFICULTIES.find((d) => d.id === (step.difficulty || 'medium'))?.xp || 15);

function ProgressRing({
  size,
  progress,
  progressColor,
  dimmed = false,
}: {
  size: number;
  progress: number;
  progressColor: string;
  dimmed?: boolean;
}) {
  const stroke = PATH_HUB_PROGRESS_RING.stroke;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, progress));
  const visibleArc = clamped > 0 && clamped < 1 ? Math.max(clamped, 0.06) : clamped;
  return (
    <Svg width={size} height={size} style={[styles.ring, dimmed && { opacity: 0.55 }]} pointerEvents="none">
      <SvgCircle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={PATH_HUB_PROGRESS_RING.track} strokeWidth={stroke} />
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={progressColor}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - visibleArc)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

function StepNode({ step, isNext, unitProgress, color, selected, onPress }: {
  step: DpPathStep;
  isNext: boolean;
  unitProgress: number;
  color: { from: string; to: string };
  selected: boolean;
  onPress: () => void;
}) {
  const locked = step.state === 'locked';
  const big = false;
  const size = big ? 74 : 66;
  const box = size + 24;
  const Icon = locked ? Lock : step.state === 'completed' && !big ? Check : STEP_ICONS[step.key];
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isNext || selected) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob, isNext, selected]);
  return (
    <View style={styles.nodeWrap}>
      {isNext && !selected ? (
        <Animated.Text style={[styles.nodeBubble, { color: color.to, transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }]}>
          BẮT ĐẦU
        </Animated.Text>
      ) : null
      }
      <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
        {isNext ? (
          <ProgressRing
            size={box}
            progress={unitProgress}
            progressColor={PATH_HUB_PROGRESS_RING.progressActive}
          />
        ) : null}
        <Pressable
          onPress={onPress}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel={`${step.label}${locked ? ' (đang khóa)' : ''}`}
          accessibilityState={{ expanded: selected, disabled: locked }}
          style={({ pressed }) => [
            styles.node,
            {
              width: size,
              height: size - 4,
              borderRadius: size / 2,
              backgroundColor: locked ? '#E2E8F0' : color.from,
              borderBottomWidth: pressed ? 2 : 6,
              borderBottomColor: locked ? '#CBD5E1' : darken(color.to, 0.2),
              transform: [{ translateY: pressed ? 4 : 0 }],
            },
          ]}
        >
          <Icon size={big ? 30 : 26} color={locked ? '#9CA3AF' : '#FFFFFF'} strokeWidth={2.8} />
          {step.state === 'completed' && big ? <View style={styles.nodeCrown}><Crown size={20} color="#F59E0B" fill="#FCD34D" /></View> : null}
        </Pressable>
      </View >
      <Text style={[styles.nodeLabel, locked && { color: '#94A3B8' }]}>{STEP_LABELS[step.key] || step.label}</Text>
    </View >
  );
}

/** Nút video của chặng (🎬) - bấm mở popup trình phát Thắng Tin Học. */
function VideoNode({ video, color, onPress }: { video: DpPathVideo; color: { from: string; to: string }; onPress: () => void }) {
  const locked = video.state === 'locked';
  return (
    <View style={styles.nodeWrap}>
      <View style={{ width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable
          onPress={onPress}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel={`Video: ${video.title}${locked ? ' (đang khóa)' : ''}`}
          style={({ pressed }) => [
            styles.node,
            {
              width: 68,
              height: 62,
              borderRadius: 34,
              backgroundColor: locked ? '#E2E8F0' : color.from,
              borderBottomWidth: pressed ? 2 : 6,
              borderBottomColor: locked ? '#CBD5E1' : darken(color.to, 0.2),
              transform: [{ translateY: pressed ? 4 : 0 }],
            },
          ]}
        >
          {locked ? <Lock size={24} color="#9CA3AF" strokeWidth={2.8} /> : <VideoIcon size={26} color="#FFFFFF" strokeWidth={2.6} />}
          {video.state === 'completed' ? (
            <View style={styles.videoWatchedBadge}><Check size={12} color="#FFFFFF" strokeWidth={3.5} /></View>
          ) : null}
        </Pressable>
      </View>
      <Text numberOfLines={1} style={[styles.nodeLabel, styles.videoLabel, locked && { color: '#94A3B8' }]}>{video.title}</Text>
    </View>
  );
}

/** Một nút trên lộ trình - nút tròn 3D vàng kim + icon trắng + 3 chấm + sao viền theo mẫu thiết kế. */
function PracticeHubNode({ node, color, isNext, selected, onPress, nodeIndex = 0 }: {
  node: DpPathNode;
  color: { from: string; to: string };
  isNext: boolean;
  selected: boolean;
  onPress: () => void;
  nodeIndex?: number;
}) {
  const locked = node.state === 'locked';
  const done = node.state === 'completed';
  const levels = node.levels || [];
  const size = PATH_HUB_DUO.buttonSize.mobile;
  const progress = pathHubNodeProgress(node);
  const progressColor = pathHubProgressColor(node, progress, color);
  const showRing =
    PATH_HUB_DUO.showProgressRing && !locked && isNext && progress > 0 && progress < 1;
  const box = showRing ? size + PATH_HUB_PROGRESS_RING.pad : size;
  const HubIcon = NODE_ICONS[node.icon] || Dumbbell;
  const mapLabel = pathNodeMapLabel(node);
  const startBubble = pathNodeStartBubbleLabel(node);
  const badgeCorner = nodeIndex % 2 === 0 ? 'top-right' : 'top-left';
  return (
    <View style={[styles.hubRoot, styles.hubRootColumn, { width: box }]}>
      <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'visible' }}>
        {isNext && !selected ? (
          <View style={styles.pathStartBubbleMap}>
            <Text style={[styles.pathStartBubbleText, { color: '#D97706' }]}>{startBubble}</Text>
          </View>
        ) : null}
        {showRing ? <ProgressRing size={box} progress={progress} progressColor={progressColor} /> : null}
        <Pressable
          onPress={onPress}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel={node.label}
          accessibilityState={{ expanded: selected, disabled: locked }}
          style={({ pressed }) => [
            styles.node,
            locked
              ? { backgroundColor: '#E8EDF2', borderBottomColor: '#C4C9D1' }
              : { backgroundColor: '#FBBF24', borderBottomColor: '#D97706', borderTopColor: '#FEF08A', borderTopWidth: 1 },
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderBottomWidth: pressed ? 2 : 6,
              transform: [{ translateY: pressed ? 4 : 0 }],
              alignItems: 'center',
              justifyContent: 'center',
              gap: 2,
            },
          ]}
        >
          <HubIcon size={26} color={locked ? '#9CA3AF' : '#FFFFFF'} strokeWidth={PATH_HUB_DUO.iconStroke} />
          {!locked ? (
            <View style={{ flexDirection: 'row', gap: 4, marginTop: 2 }}>
              {[0, 1, 2].map((i) => {
                const lvl = levels[i];
                const isDoneOrActive = lvl ? (lvl.state === 'completed' || lvl.state === 'active') : true;
                return (
                  <View
                    key={i}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: isDoneOrActive ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                    }}
                  />
                );
              })}
            </View>
          ) : null}
          {/* Ngôi sao vàng đính góc trên phải nút */}
          {!locked && (
            <View style={{ position: 'absolute', top: -4, right: -2, zIndex: 10 }} pointerEvents="none">
              <Svg width={18} height={18} viewBox="0 0 24 24">
                <Path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill="#F59E0B"
                  stroke="#D97706"
                  strokeWidth={1.5}
                />
              </Svg>
            </View>
          )}
          {locked ? (
            <View
              style={[
                styles.pathHubLockBadge,
                badgeCorner === 'top-left' ? styles.nodeCrownLeft : styles.nodeCrownRight,
              ]}
            >
              <Lock size={11} color="#64748B" strokeWidth={2.8} />
            </View>
          ) : null}
        </Pressable>
      </View >
      <Text
        numberOfLines={2}
        style={[
          styles.pathNodeLabelBelow,
          { color: locked ? PATH_HUB_DUO.labelLockedColor : '#334155' },
          isNext && !selected ? styles.pathNodeLabelCurrentText : null,
        ]}
      >
        {mapLabel}
      </Text>
    </View >
  );
}

function LevelHubPopover({ node, color, starting, onClose, onStartStep }: {
  node: DpPathNode;
  color: { from: string; to: string };
  starting: boolean;
  onClose: () => void;
  onStartStep: (stepKey: DpStepKey, opts?: { review?: boolean }) => void;
}) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 120, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [pop]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.quitBackdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360 }}>
          <Animated.View style={[styles.hubModalCard, gradient(color.from, color.to), { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
            <Pressable onPress={onClose} style={styles.popoverClose} accessibilityRole="button" accessibilityLabel="Đóng">
              <X size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <Text style={styles.popoverTitle}>{node.label}</Text>
            <Text style={styles.popoverMeta}>Làm lần lượt 3 nấc - xong nấc trước mới mở nấc sau</Text>
            {(node.levels || []).map((step, index) => {
              const locked = step.state === 'locked';
              const done = step.state === 'completed';
              const Icon = STEP_ICONS[step.key];
              return (
                <View key={step.key} style={[styles.hubLevelRow, locked && styles.hubLevelRowLocked]}>
                  <View style={styles.hubLevelIcon}>
                    {done ? <Check size={16} color="#FFFFFF" /> : locked ? <Lock size={14} color="#FFFFFF" /> : <Icon size={16} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.hubLevelTitle}>{`Nấc ${index + 1} · ${STEP_LABELS[step.key] || step.label}`}</Text>
                    <Text style={styles.hubLevelXp}>
                      {done ? 'Đã xong · Ôn lại (0 XP)' : `Cần đúng ${step.passPercent}% · 5 XP/câu (tối đa 50 XP)`}
                    </Text>
                  </View>
                  {!locked ? (
                    <Pressable
                      onPress={() => onStartStep(step.key, { review: done })}
                      disabled={starting}
                      style={styles.hubLevelBtn}
                      accessibilityRole="button"
                    >
                      <Text style={styles.hubLevelBtnText}>{starting ? '…' : done ? 'Ôn lại' : 'Làm'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Popover cho nút Học (Bài 1, Bài 2, Bài 3). */
function StudyHubPopover({ node, color, onClose, onOpenLesson }: {
  node: DpPathNode;
  color: { from: string; to: string };
  onClose: () => void;
  onOpenLesson: (step: DpPathStep) => void;
}) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 120, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [pop]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.quitBackdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360 }}>
          <Animated.View style={[styles.hubModalCard, gradient(color.from, color.to), { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
            <Pressable onPress={onClose} style={styles.popoverClose} accessibilityRole="button" accessibilityLabel="Đóng">
              <X size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <Text style={styles.popoverTitle}>{`${node.label} · Nội dung chặng`}</Text>
            <Text style={styles.popoverMeta}>Đọc lý thuyết, xem video & trả lời câu kiểm tra nhanh</Text>
            {(node.levels || []).map((step, index) => {
              const locked = step.state === 'locked';
              const done = step.state === 'completed';
              return (
                <View key={step.key} style={[styles.hubLevelRow, locked && styles.hubLevelRowLocked]}>
                  <View style={[styles.hubLevelIcon, done && { backgroundColor: '#10B981' }]}>
                    {done ? <Check size={16} strokeWidth={3} color="#FFFFFF" /> : locked ? <Lock size={14} color="#FFFFFF" /> : <BookOpen size={16} color="#FFFFFF" />}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.hubLevelTitle}>{step.label || `Bài ${index + 1}`}</Text>
                    <Text numberOfLines={1} style={styles.hubLevelXp}>{step.title || step.videos?.[0]?.title || 'Lý thuyết & bài tập nhanh'}</Text>
                  </View>
                  {!locked ? (
                    <Pressable onPress={() => onOpenLesson(step)} style={styles.hubLevelBtn} accessibilityRole="button">
                      <Text style={styles.hubLevelBtnText}>{done ? 'XEM LẠI' : 'HỌC'}</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

async function processScreenshot(asset: ImagePicker.ImagePickerAsset, onProgress?: (pct: number) => void): Promise<string> {
  if (Platform.OS === 'web') {
    return new Promise((resolve, reject) => {
      onProgress?.(20);
      const img = new (window as any).Image();
      img.onload = () => {
        onProgress?.(60);
        const scale = Math.min(1, 960 / Math.max(img.width, 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Không tạo được canvas'));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        onProgress?.(90);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Không đọc được hình ảnh'));
      img.src = asset.uri;
    });
  } else {
    onProgress?.(30);
    if (asset.base64) {
      onProgress?.(90);
      const mime = asset.mimeType || 'image/jpeg';
      return `data:${mime};base64,${asset.base64}`;
    }
    throw new Error('Không đọc được dữ liệu ảnh');
  }
}

/** Popup nội dung bài học (nút Học) + câu hỏi kiểm tra nhanh kết nối API. */
function PathLessonModal({ unit, step, color, play, onClose, onCompleted, onOpenVideo }: {
  unit: DpPathUnit;
  step: DpPathStep;
  color: { from: string; to: string };
  play: (s: GameSound) => void;
  onClose: () => void;
  onCompleted: () => void;
  onOpenVideo: (videoId: string) => void;
}) {
  const stepVideo = step.videos?.[0] || null;
  const checkBucketId = stepVideo?.id || `lesson-${step.key}`;
  const checks = useMemo(
    () => stepVideo?.checks || [],
    [stepVideo?.checks],
  );
  const lessonBodyContent = step.content || stepVideo?.content || '';
  const [passedKeys, setPassedKeys] = useState<Set<string>>(() => new Set());
  const [gate, setGate] = useState<any>(null);
  const gateRef = useRef<any>(null);
  const playerApiRef = useRef<VideoPlayerApi | null>(null);

  const [picked, setPicked] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [checkHint, setCheckHint] = useState('');
  const [checkError, setCheckError] = useState('');
  const [checkBusy, setCheckBusy] = useState(false);
  const [missed, setMissed] = useState(false);
  const [cheer, setCheer] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [grading, setGrading] = useState(false);

  const [done, setDone] = useState(step.state === 'completed');
  const [finishing, setFinishing] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const rawUrl = stepVideo?.url || '';
  const url = playableVideoUrl(rawUrl) || (rawUrl.startsWith('/uploads/') ? rawUrl : '');
  const embedded = embeddedVideoUrl(rawUrl);
  const playable = Boolean(embedded || isDirectVideoUrl(rawUrl) || rawUrl.startsWith('/uploads/'));

  useEffect(() => {
    if (!unit.id) return undefined;
    let alive = true;
    dailyPracticeApi.unitVideos(unit.id)
      .then((res: any) => {
        if (alive && Array.isArray(res?.passedCheckIds)) {
          setPassedKeys(new Set(res.passedCheckIds));
        }
      })
      .catch(() => { });
    return () => { alive = false; };
  }, [unit.id]);

  const onTick = (time: number) => {
    if (!stepVideo || !checks.length) return;
    if (gateRef.current) {
      playerApiRef.current?.pause?.();
      return;
    }
    const next = checks
      .filter((check: any) => {
        const id = String(check._id || check.id || '');
        return !passedKeys.has(`${stepVideo.id}:${id}`) && !passedKeys.has(id);
      })
      .sort((a: any, b: any) => (Number(a.atSec) || 0) - (Number(b.atSec) || 0))
      .find((check: any) => time + 0.3 >= (Number(check.atSec) || 0));
    if (next) {
      playerApiRef.current?.pause?.();
      gateRef.current = next;
      setGate(next);
      setPicked(null);
      setAnswerText('');
      setCheckHint('');
      setCheckError('');
      setMissed(false);
      setCheer(false);
      setUploadPct(null);
      setGrading(false);
    }
  };

  const closeGate = () => {
    gateRef.current = null;
    setGate(null);
    setCheer(false);
    setUploadPct(null);
    setGrading(false);
    playerApiRef.current?.play?.();
  };

  const submitCheck = async (imageDataUrl?: string) => {
    if (!gate || !stepVideo || !unit.id || checkBusy) return;
    setCheckBusy(true);
    setCheckError('');
    try {
      const checkId = String(gate._id || gate.id || '');
      const checkIndex = checks.findIndex((c: any) => String(c._id || c.id || '') === checkId);
      const res = await dailyPracticeApi.answerVideoCheck(
        unit.id,
        stepVideo.id,
        Math.max(0, checkIndex),
        picked ?? 0,
        { text: answerText, checkId, imageDataUrl: imageDataUrl || '' },
      );
      if (res.correct) {
        setMissed(false);
        play('correct');
        setCheer(true);
        setTimeout(() => {
          setPassedKeys((prev) => {
            const next = new Set(prev);
            next.add(`${stepVideo.id}:${checkId}`);
            next.add(checkId);
            return next;
          });
          closeGate();
        }, 1200);
      } else if (res.needsReview) {
        setMissed(false);
        setCheckHint(res.hint || 'Chưa đủ ý để kết luận. Hãy viết rõ hơn, lần này không mất XP.');
      } else {
        setMissed(true);
        setPicked(null);
        setAnswerText('');
        setCheckHint(res.hint || (gate.kind === 'screen' ? 'AI chưa chấp nhận. Hãy tải đáp án mới.' : 'Chưa đúng ý. Thử lại nhé!'));
        play('wrong');
      }
    } catch (err) {
      setMissed(false);
      setCheckError(err instanceof Error ? err.message : 'Chưa gửi được câu trả lời');
    } finally {
      setCheckBusy(false);
    }
  };

  const pickAndSendScreenshot = async () => {
    if (checkBusy || uploadPct !== null) return;
    setMissed(false);
    setCheckError('');
    try {
      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          setCheckError('Cần cấp quyền truy cập ảnh để gửi bài.');
          return;
        }
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setUploadPct(15);
      setGrading(false);
      const timer = setInterval(() => {
        setUploadPct((prev) => (prev !== null && prev < 85 ? prev + 12 : prev));
      }, 100);
      let dataUrl = '';
      try {
        dataUrl = await processScreenshot(asset);
      } finally {
        clearInterval(timer);
      }
      setUploadPct(100);
      setGrading(true);
      await submitCheck(dataUrl);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Không tải được ảnh');
    } finally {
      setUploadPct(null);
      setGrading(false);
    }
  };

  const buyHint = async () => {
    if (!gate || !stepVideo || !unit.id || checkBusy) return;
    setCheckBusy(true);
    setCheckError('');
    try {
      const checkId = String(gate._id || gate.id || '');
      const checkIndex = checks.findIndex((c: any) => String(c._id || c.id || '') === checkId);
      const res = await dailyPracticeApi.buyVideoHint(unit.id, stepVideo.id, Math.max(0, checkIndex));
      setCheckHint(res.hint || gate.paidHint || gate.shortHint || 'Đọc kỹ lý thuyết nhé!');
      play('hint');
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Chưa lấy được gợi ý');
    } finally {
      setCheckBusy(false);
    }
  };

  const finishLesson = async () => {
    setFinishing(true);
    try {
      if (stepVideo?.id) {
        await dailyPracticeApi.videoWatched(unit.id, stepVideo.id);
      }
      setDone(true);
      play('tap');
      onCompleted();
    } catch {
      // ignore
    } finally {
      setFinishing(false);
    }
  };

  const pendingChecksCount = checks.filter((c: any) => {
    const id = String(c._id || c.id || '');
    return !passedKeys.has(`${stepVideo?.id}:${id}`) && !passedKeys.has(id);
  }).length;

  const gateChoices: string[] = gate
    ? (Array.isArray(gate.choices) ? gate.choices : Array.isArray(gate.options) ? gate.options : [])
    : [];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.quitBackdrop}>
        <View style={[styles.quitCard, { maxWidth: 560, maxHeight: '92%' }]}>
          <View style={[styles.lessonModalHead, gradient(color.from, color.to)]}>
            <BookOpen size={20} color="#FFFFFF" />
            <View style={[styles.flex, { marginLeft: 10 }]}>
              <Text style={styles.lessonModalEyebrow}>{(step.label || 'Bài học').toUpperCase()}</Text>
              <Text numberOfLines={1} style={styles.lessonModalTitle}>{step.title || stepVideo?.title || step.label}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.lessonModalClose} accessibilityRole="button">
              <X size={18} color="#FFFFFF" />
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: 500 }} contentContainerStyle={{ padding: spacing.lg, gap: 14 }}>
            {lessonBodyContent ? (
              <View style={styles.lessonBodyBox}>
                {lessonBodyContent.split(/\n+/).filter(Boolean).map((line: string, idx: number) => (
                  <Text key={idx} style={styles.lessonBodyText}>{line.replace(/\*\*/g, '')}</Text>
                ))}
              </View>
            ) : (
              <View style={styles.lessonBodyBox}>
                <Text style={styles.lessonBodyText}>
                  {unit.description || `Nội dung trọng tâm của ${unit.title}. Hãy nắm vững lý thuyết trước khi sang các bài luyện tập trắc nghiệm.`}
                </Text>
              </View>
            )}

            {stepVideo?.url && playable ? (
              <View style={styles.lessonVideoFrameWrap}>
                <VideoPlayerFrame
                  key={stepVideo.id}
                  videoUrl={resolveMobilePublicUrl(url)}
                  embeddedUrl={embedded}
                  title={stepVideo.title || step.title || step.label}
                  lessonId={`dp-lesson-${stepVideo.id}`}
                  antiSeekEnabled={false}
                  done={done}
                  brandedChrome
                  playerApiRef={playerApiRef}
                  onProgress={(progress) => onTick(progress.currentTime)}
                  onWatched={async () => {
                    if (stepVideo?.id) {
                      await dailyPracticeApi.videoWatched(unit.id, stepVideo.id);
                      setDone(true);
                      onCompleted();
                    }
                    return true;
                  }}
                />

                {gate ? (
                  <View style={styles.videoGateOverlay}>
                    <View style={styles.videoGateCard}>
                      {cheer ? (
                        <View style={{ alignItems: 'center', padding: 14, gap: 6 }}>
                          <Mascot mood="celebrate" size={60} />
                          <Text style={{ fontSize: 15, fontWeight: '700', color: '#059669' }}>Chính xác! +5 XP</Text>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>Đang tiếp tục video…</Text>
                        </View>
                      ) : (
                        <>
                          <View style={styles.videoGateTopRow}>
                            <Text style={styles.videoGateTime}>{`DỪNG Ở GIÂY ${gate.atSec || 0}`}</Text>
                            <Pressable
                              onPress={closeGate}
                              style={styles.videoGateCloseBtn}
                              accessibilityRole="button"
                              accessibilityLabel="Đóng"
                            >
                              <X size={15} color="#64748B" />
                            </Pressable>
                          </View>

                          {missed ? (
                            <View style={[styles.videoGateMissedBox, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                              <Mascot mood="sad" size={32} />
                              <Text style={[styles.videoGateMissedText, { flex: 1 }]}>
                                {gate.kind === 'screen'
                                  ? 'AI chưa chấp nhận (mất 2 XP). Hãy tải đáp án mới.'
                                  : `Chưa đúng (mất 2 XP). Hãy ${gateChoices.length > 0 ? 'chọn lại' : 'nhập lại'} nhé!`}
                              </Text>
                            </View>
                          ) : null}

                          <Text style={styles.videoGatePrompt}>{gate.prompt}</Text>

                          {gate.kind === 'screen' ? (
                            uploadPct !== null ? (
                              <View style={styles.videoGateUploadProgress}>
                                <View style={styles.videoGateUploadTrack}>
                                  <View
                                    style={[
                                      styles.videoGateUploadFill,
                                      { width: `${grading ? 100 : uploadPct}%` },
                                      grading && { backgroundColor: '#0284C7' },
                                    ]}
                                  />
                                </View>
                                <Text style={styles.videoGateUploadText}>
                                  {grading ? 'AI đang chấm…' : `Đang tải ảnh lên ${uploadPct}%`}
                                </Text>
                              </View>
                            ) : (
                              <Pressable
                                onPress={() => void pickAndSendScreenshot()}
                                disabled={checkBusy}
                                style={styles.videoGateScreenPickBtn}
                                accessibilityRole="button"
                              >
                                <ImageIcon size={18} color="#1E293B" />
                                <Text style={styles.videoGateScreenPickText}>
                                  {missed ? 'Tải đáp án mới' : 'Gửi ảnh bài làm'}
                                </Text>
                              </Pressable>
                            )
                          ) : gateChoices.length > 0 ? (
                            <View style={{ gap: 6, marginVertical: 4 }}>
                              {gateChoices.map((choice: string, index: number) => {
                                const isPicked = picked === index;
                                return (
                                  <Pressable
                                    key={index}
                                    onPress={() => setPicked(index)}
                                    style={[
                                      styles.videoGateChoiceBtn,
                                      isPicked && styles.videoGateChoiceBtnActive,
                                    ]}
                                    accessibilityRole="button"
                                  >
                                    <Text style={[styles.videoGateChoiceText, isPicked && styles.videoGateChoiceTextActive]}>
                                      {choice}
                                    </Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          ) : (
                            <View style={{ marginVertical: 4 }}>
                              <TextInput
                                value={answerText}
                                onChangeText={setAnswerText}
                                placeholder="Nhập đáp án của bạn…"
                                placeholderTextColor="#94A3B8"
                                style={styles.videoGateTextInput}
                              />
                            </View>
                          )}

                          {checkHint ? (
                            <View style={styles.videoGateHintBox}>
                              <Lightbulb size={13} color="#D97706" />
                              <Text style={styles.videoGateHintText}>{checkHint}</Text>
                            </View>
                          ) : null}

                          {checkError ? <Text style={styles.videoGateErrorText}>{checkError}</Text> : null}

                          <View style={styles.videoGateActionsRow}>
                            {gate.kind !== 'screen' ? (
                              <Pressable
                                disabled={checkBusy || (gateChoices.length > 0 ? picked === null : !answerText.trim())}
                                onPress={() => void submitCheck()}
                                style={[
                                  styles.videoGateSubmitBtn,
                                  (checkBusy || (gateChoices.length > 0 ? picked === null : !answerText.trim())) && { opacity: 0.5 },
                                ]}
                                accessibilityRole="button"
                              >
                                {checkBusy ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <Text style={styles.videoGateSubmitBtnText}>Trả lời</Text>
                                )}
                              </Pressable>
                            ) : null}
                            <Pressable
                              onPress={closeGate}
                              style={styles.videoGateCancelBtn}
                              accessibilityRole="button"
                            >
                              <Text style={styles.videoGateCancelBtnText}>Thôi</Text>
                            </Pressable>
                            {Number(gate.hintCostXp) > 0 ? (
                              <Pressable
                                disabled={checkBusy}
                                onPress={() => void buyHint()}
                                style={styles.videoGateHintBtn}
                                accessibilityRole="button"
                              >
                                <Text style={styles.videoGateHintBtnText}>Gợi ý · {gate.hintCostXp} XP</Text>
                              </Pressable>
                            ) : null}
                          </View>

                          <Text style={styles.videoGateFootNote}>
                            {`Đúng lần đầu +5 XP và xem tiếp. Sai mất 2 XP rồi ${gate.kind === 'screen' ? 'tải đáp án mới' : gateChoices.length > 0 ? 'chọn lại' : 'nhập lại'}.`}
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}

            {stepVideo?.url && pendingChecksCount > 0 ? (
              <Text style={styles.lessonPendingNote}>
                Video dừng ở từng mốc. Trả lời đúng mới xem tiếp. Chưa tua được quá phần đã xem.
              </Text>
            ) : null}

            {errMsg ? <Text style={styles.errorInline}>{errMsg}</Text> : null}
          </ScrollView>
          <View style={[styles.lessonModalFoot, { gap: 10, padding: spacing.md }]}>
            <View style={styles.flex}>
              <DuoButton
                variant="secondary"
                size="md"
                fullWidth
                text="Đóng"
                onPress={onClose}
              />
            </View>
            <View style={styles.flex}>
              <DuoButton
                variant={done ? 'secondary' : 'primary'}
                size="md"
                fullWidth
                text={done ? 'Đã học xong' : 'Đánh dấu đã học'}
                icon={finishing ? undefined : <CheckCircle2 size={16} color={done ? '#059669' : '#FFFFFF'} />}
                loading={finishing}
                disabled={finishing}
                onPress={() => { void finishLesson(); }}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Hình cúp đồ họa. Chưa xong thì xám mờ, hoàn thành thì vàng. */
function CupArtwork({ width, height, gold }: { width: number; height: number; gold: boolean }) {
  const tone = gold
    ? {
      hi: '#FFFBEB', mid: '#FDE68A', deep: '#F59E0B', ink: '#B45309',
      handle: '#D97706', handleEdge: '#92400E', handleLite: '#FBBF24', handleLiteEdge: '#F59E0B',
      stem: '#D97706', baseTop: '#B45309',
    }
    : {
      hi: '#F8FAFC', mid: '#CBD5E1', deep: '#64748B', ink: '#0F172A',
      handle: '#334155', handleEdge: '#1E293B', handleLite: '#94A3B8', handleLiteEdge: '#64748B',
      stem: '#475569', baseTop: '#334155',
    };
  return (
    <Svg width={width} height={height} viewBox="0 0 220 250">
      <Defs>
        <LinearGradient id="finaleCupBody" x1="0.28" y1="0" x2="0.78" y2="1">
          <Stop offset="0" stopColor={tone.hi} />
          <Stop offset="0.3" stopColor={tone.mid} />
          <Stop offset="0.64" stopColor={tone.deep} />
          <Stop offset="1" stopColor={tone.ink} />
        </LinearGradient>
        <LinearGradient id="finaleCupRim" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tone.hi} />
          <Stop offset="1" stopColor={tone.ink} />
        </LinearGradient>
        <LinearGradient id="finaleCupBase" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tone.mid} />
          <Stop offset="1" stopColor={tone.ink} />
        </LinearGradient>
      </Defs>
      <Ellipse cx="110" cy="232" rx="64" ry="9" fill={tone.ink} opacity={0.18} />
      <Path d="M58 78c-28 2-34 48-6 62 6-16 4-40 14-52-2-4-4-8-8-10z" fill={tone.handle} />
      <Path d="M162 78c28 2 34 48 6 62-6-16-4-40-14-52 2-4 4-8 8-10z" fill={tone.handleEdge} />
      <Path d="M66 64c-22 6-24 46 2 58 2-14 6-36 16-46-4-6-10-10-18-12z" fill={tone.handleLite} />
      <Path d="M154 64c22 6 24 46-2 58-2-14-6-36-16-46 4-6 10-10 18-12z" fill={tone.handleLiteEdge} />
      <Path d="M74 58c-2 0-8 78 16 108h40c24-30 18-108 16-108-8 10-20 16-36 16s-28-6-36-16z" fill="url(#finaleCupBody)" />
      <Ellipse cx="110" cy="58" rx="48" ry="16" fill="url(#finaleCupRim)" />
      <Ellipse cx="110" cy="56" rx="34" ry="8" fill={tone.ink} opacity={0.42} />
      <Ellipse cx="90" cy="98" rx="14" ry="28" fill="#FFFFFF" opacity={0.62} />
      <Path d="M110 86l6.2 12.6 13.8 2-10 9.8 2.4 13.6L110 117.4 97.6 124l2.4-13.6-10-9.8 13.8-2z" fill={tone.hi} />
      <Path d="M110 92l3.4 7 7.6 1.1-5.5 5.4 1.3 7.5L110 109.2 103.2 113l1.3-7.5-5.5-5.4 7.6-1.1z" fill={tone.ink} />
      <Path d="M96 166h28l10 24H86z" fill={tone.stem} />
      <Ellipse cx="110" cy="196" rx="46" ry="12" fill={tone.ink} />
      <Ellipse cx="110" cy="190" rx="40" ry="9" fill="url(#finaleCupBase)" />
      <Ellipse cx="110" cy="214" rx="58" ry="13" fill={tone.ink} />
      <Ellipse cx="110" cy="208" rx="50" ry="10" fill={tone.baseTop} />
      <Ellipse cx="92" cy="204" rx="16" ry="4" fill="#FFFFFF" opacity={0.45} />
    </Svg>
  );
}

/** Cúp đồ họa mờ dưới rương chặng cuối. Hoàn thành thì phóng to và bắn pháo. */
function CourseFinaleCup({ courseDone, onPress }: {
  courseDone: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(courseDone ? 0.28 : 1)).current;
  const [burst, setBurst] = useState(0);
  useEffect(() => {
    if (!courseDone) {
      scale.setValue(1);
      return undefined;
    }
    scale.setValue(0.28);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 70, useNativeDriver: USE_NATIVE_DRIVER }).start();
    const timer = setInterval(() => setBurst((n) => n + 1), 2600);
    return () => clearInterval(timer);
  }, [courseDone, scale]);
  return (
    <Pressable
      onPress={onPress}
      style={styles.finaleGhost}
      accessibilityRole="button"
      accessibilityLabel="Cúp Vàng Vinh Danh cuối khóa"
    >
      <View style={styles.finaleCupStage}>
        {courseDone ? <Confetti key={burst} count={26} spread={140} /> : null}
        <Animated.View style={{ opacity: courseDone ? 1 : 0.3, transform: [{ scale }] }}>
          <CupArtwork gold={courseDone} width={courseDone ? 214 : 168} height={courseDone ? 244 : 192} />
        </Animated.View>
      </View>
    </Pressable>
  );
}

function CourseTrophyCeremonyModal({ current, play, onClose }: {
  current: DpTopicPath;
  play: (s: GameSound) => void;
  onClose: () => void;
}) {
  useEffect(() => { play('win'); }, [play]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.quitBackdrop}>
        <View style={[styles.quitCard, styles.finaleModalCard]}>
          <Confetti count={34} spread={210} />
          <View style={styles.finaleBadge}>
            <Award size={14} color="#FEF3C7" />
            <Text style={styles.finaleBadgeText}>CHỨNG NHẬN CHINH PHỤC LỘ TRÌNH</Text>
          </View>
          <View style={styles.finaleStageRow}>
            <Mascot mood="graduate" size={82} />
            <View style={styles.finaleCupWrap}>
              <View style={styles.finaleCrownBadge}>
                <Crown size={20} color="#FFFFFF" fill="#FEF08A" />
              </View>
              <View style={styles.finaleCupCircle}>
                <Trophy size={52} color="#FFFFFF" />
              </View>
              <View style={styles.finaleStarsRow}>
                {[0, 1, 2].map((i) => <Star key={i} size={15} color="#F59E0B" fill="#FBBF24" />)}
              </View>
            </View>
            <Mascot mood="celebrate" size={82} />
          </View>
          <Text style={styles.finaleDoneTitle}>CHÚC MỪNG HOÀN THÀNH KHÓA HỌC!</Text>
          <Text style={styles.finaleModalTopic}>{current.topic.name}</Text>
          <Text style={styles.finaleDoneSub}>
            {`Bạn đã kiên trì vượt qua toàn bộ ${current.totalUnits}/${current.totalUnits} chặng học và thử thách. Chiếc Cúp Vàng này là minh chứng cho nỗ lực tuyệt vời của bạn!`}
          </Text>
          <View style={styles.finaleStatsRow}>
            <View style={styles.finaleStatBox}>
              <Text style={styles.finaleStatVal}>100%</Text>
              <Text style={styles.finaleStatLbl}>Hoàn thành</Text>
            </View>
            <View style={styles.finaleStatBox}>
              <Text style={styles.finaleStatVal}>{`${current.totalUnits}/${current.totalUnits}`}</Text>
              <Text style={styles.finaleStatLbl}>Chặng đã vượt</Text>
            </View>
            <View style={styles.finaleStatBox}>
              <Text style={styles.finaleStatVal}>Cúp Vàng</Text>
              <Text style={styles.finaleStatLbl}>Danh hiệu</Text>
            </View>
          </View>
          <View style={{ width: '100%', marginTop: 8 }}>
            <DuoButton
              variant="gold"
              size="lg"
              fullWidth
              text="Tuyệt vời! Tiếp tục chinh phục"
              icon={<Trophy size={18} color="#FFFFFF" />}
              onPress={onClose}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const PATH_NODE_ICONS: Record<string, LucideIcon> = { book: BookOpen, dumbbell: Dumbbell, flame: Flame, crown: Crown };
const PATH_LEVEL_LABELS: Record<string, string> = { learn: 'Dễ', practice: 'Vừa', challenge: 'Khó' };

function pathNodeStatusLabel(state: DpNodeState) {
  if (state === 'locked') return { text: 'Đang khóa', bg: '#F1F5F9', color: '#475569' };
  if (state === 'completed') return { text: 'Đã xong', bg: '#D1FAE5', color: '#065F46' };
  return { text: 'Đang mở', bg: '#FEF3C7', color: '#92400E' };
}

/** Tổng quan mốc trong chặng — từ đầu đến cuối, mở / khóa. */
function UnitStageRoadmapModal({
  unit,
  tone,
  play,
  onClose,
  onPickNode,
  onOpenVideo,
}: {
  unit: DpPathUnit;
  tone: { from: string; to: string };
  play: (key: string) => void;
  onClose: () => void;
  onPickNode: (nodeKey: string) => void;
  onOpenVideo?: () => void;
}) {
  const nodes = useMemo(
    () => [...(unit.pathNodes || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [unit.pathNodes],
  );
  const openCount = nodes.filter((n) => n.state !== 'locked').length;
  const hasVideo = Boolean(unit.lesson) || collectUnitVideos(unit).length > 0;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.roadmapBackdrop} onPress={onClose}>
        <Pressable style={styles.roadmapSheet} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.roadmapHeader, gradient(tone.from, tone.to)]}>
            <View style={styles.roadmapHeaderIcon}>
              <Route size={22} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.roadmapEyebrow}>{`Chặng ${unit.index} · Lộ trình trong chặng`}</Text>
              <Text style={styles.roadmapTitle}>{unit.title}</Text>
              <Text style={styles.roadmapSub}>{`${openCount}/${nodes.length} mốc đã mở`}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.roadmapClose} accessibilityRole="button" accessibilityLabel="Đóng">
              <X size={20} color="#FFFFFF" />
            </Pressable>
          </View>
          <ScrollView style={styles.roadmapScroll} contentContainerStyle={styles.roadmapScrollInner}>
            {nodes.map((node, index) => {
              const locked = node.state === 'locked';
              const done = node.state === 'completed';
              const active = node.state === 'active';
              const Icon = PATH_NODE_ICONS[node.icon] || Dumbbell;
              const badge = pathNodeStatusLabel(node.state);
              const levels = node.levels || [];
              const doneLv = levels.filter((l) => l.state === 'completed').length;
              const levelLine = levels.length
                ? `${doneLv}/${levels.length} cấp (${levels.map((l) => PATH_LEVEL_LABELS[l.key] || l.label).join(' · ')})`
                : '';
              const row = (
                <>
                  <View style={styles.roadmapNodeCol}>
                    <View
                      style={[
                        styles.roadmapNodeBadge,
                        locked && styles.roadmapNodeLocked,
                        done && styles.roadmapNodeDone,
                        active && styles.roadmapNodeActive,
                      ]}
                    >
                      {locked ? <Lock size={18} color="#94A3B8" /> : done ? <Check size={20} color="#FFFFFF" strokeWidth={3} /> : <Icon size={18} color={active ? '#B45309' : '#047857'} />}
                    </View>
                    <Text style={styles.roadmapNodeIndex}>{index + 1}</Text>
                  </View>
                  <View style={{ flex: 1, paddingTop: 2 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.roadmapNodeTitle}>{node.label}</Text>
                      <View style={[styles.roadmapStatusPill, { backgroundColor: badge.bg }]}>
                        <Text style={[styles.roadmapStatusText, { color: badge.color }]}>{badge.text}</Text>
                      </View>
                    </View>
                    {levelLine ? <Text style={styles.roadmapLevelLine}>{levelLine}</Text> : null}
                    {locked ? (
                      <Text style={styles.roadmapHint}>Hoàn thành mốc trước để mở khóa</Text>
                    ) : (
                      <View style={styles.roadmapGoRow}>
                        <Play size={12} color="#047857" fill="#047857" />
                        <Text style={styles.roadmapGoText}>Vào mốc này</Text>
                      </View>
                    )}
                  </View>
                </>
              );
              return locked ? (
                <View key={node.key} style={styles.roadmapRow}>{row}</View>
              ) : (
                <Pressable
                  key={node.key}
                  style={styles.roadmapRow}
                  onPress={() => { play('tap'); onPickNode(node.key); }}
                  accessibilityRole="button"
                >
                  {row}
                </Pressable>
              );
            })}
          </ScrollView>
          {hasVideo && onOpenVideo ? (
            <Pressable
              onPress={() => { play('tap'); onOpenVideo(); }}
              style={styles.roadmapVideoBtn}
              accessibilityRole="button"
            >
              <VideoIcon size={18} color="#334155" />
              <Text style={styles.roadmapVideoBtnText}>Video & hướng dẫn chặng</Text>
            </Pressable>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Header chặng kiểu Duolingo đồng bộ Web UnitStageHeader. */
function UnitStageHeader({
  unit,
  tone,
  locked,
  isNextUnit,
  doneSteps,
  totalSteps,
  progress,
  onOpenRoadmap,
  onToggleTestOut,
  onStageAction,
  isStarted = false,
}: {
  unit: DpPathUnit;
  tone: { from: string; to: string };
  locked: boolean;
  isNextUnit: boolean;
  doneSteps: number;
  totalSteps: number;
  progress: number;
  onOpenRoadmap: () => void;
  onToggleTestOut: () => void;
  onStageAction?: () => void;
  isStarted?: boolean;
}) {
  const hasRoadmap = (unit.pathNodes || []).length > 0;
  const done = unit.state === 'completed';
  const activeAndStarted = !locked && (doneSteps > 0 || Boolean(isStarted));
  const isColored = done || activeAndStarted;
  const statusLabel = done
    ? (unit.testedOut ? 'Đã vượt' : 'Hoàn thành')
    : activeAndStarted
      ? 'Đang học'
      : locked
        ? 'Chưa mở'
        : 'Chưa bắt đầu';

  const ctaLabel = unitStageCtaLabel(unit, { isNextUnit });

  return (
    <View style={styles.unitHeaderOuter}>
      {/* Banner chặng đồng bộ Web */}
      <View
        style={[
          styles.unitHeaderBanner,
          !isColored
            ? gradient('#94A3B8', '#64748B')
            : gradient(tone.from, tone.to),
          {
            boxShadow: `0px 4px 0px ${!isColored ? '#475569' : darken(tone.to, 0.22)}`,
          } as never,
        ]}
      >
        <View style={styles.unitHeaderLeft}>
          <Text style={styles.unitHeaderEyebrow}>{`Chặng ${unit.index} · ${statusLabel}`}</Text>
          <Text numberOfLines={2} style={styles.unitHeaderTitle}>{unit.title}</Text>
          {unit.description ? <Text numberOfLines={2} style={styles.unitHeaderDesc}>{unit.description}</Text> : null}
          <View style={styles.unitHeaderProgressWrap}>
            <View style={styles.unitHeaderProgressTrack}>
              <View style={[styles.unitHeaderProgressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.unitHeaderProgressCount}>{`${doneSteps}/${totalSteps}`}</Text>
          </View>
        </View>
        <View style={styles.unitHeaderRight}>
          {ctaLabel && onStageAction ? (
            <Pressable
              onPress={onStageAction}
              style={styles.unitHeaderCtaBtn}
              accessibilityRole="button"
              accessibilityLabel={ctaLabel}
            >
              <Play size={14} color="#047857" fill="#047857" />
              <Text style={styles.unitHeaderCtaText}>{ctaLabel}</Text>
            </Pressable>
          ) : null}
          {hasRoadmap ? (
            <Pressable
              onPress={onOpenRoadmap}
              style={[styles.unitHeaderGuideBtn, styles.unitHeaderGuideBtnLit]}
              accessibilityRole="button"
              accessibilityLabel="Lộ trình mốc trong chặng"
            >
              <BookOpen size={20} color="#047857" strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {locked && unit.canTestOut ? (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
          <Pressable onPress={onToggleTestOut} style={styles.unitStageTestOut} accessibilityRole="button">
            <FastForward size={13} color="#FFFFFF" />
            <Text style={styles.unitStageTestOutText}>Kiểm tra vượt</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** Bảng bắt đầu bật ngay dưới nút (giống Duolingo). */
function StepPopover({ unit, step, testOut, color, starting, onClose, onStart }: {
  unit: DpPathUnit;
  step: DpPathStep;
  testOut: boolean;
  color: { from: string; to: string };
  starting: boolean;
  onClose: () => void;
  onStart: () => void;
}) {
  const order = unit.steps.findIndex((item) => item.key === step.key) + 1;
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 120, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [pop]);
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.quitBackdrop} onPress={onClose}>
        <Pressable onPress={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 360 }}>
          <Animated.View style={[styles.hubModalCard, gradient(color.from, color.to), { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }] }]}>
            <Pressable onPress={onClose} style={styles.popoverClose} accessibilityRole="button" accessibilityLabel="Đóng">
              <X size={18} color="rgba(255,255,255,0.85)" />
            </Pressable>
            <Text style={styles.popoverTitle}>{testOut ? 'Kiểm tra vượt chặng' : step.label}</Text>
            <Text style={styles.popoverMeta}>
              {testOut ? `Chặng ${unit.index} · Đạt ${step.passPercent}% để vượt chặng` : `Bước ${order}/${unit.steps.length} · Cần đúng ${step.passPercent}%`}
            </Text>
            <Text style={styles.popoverHint}>{testOut ? 'Hoàn thành chặng này và mọi chặng trước đó nếu đạt yêu cầu.' : STEP_HINTS[step.key]}</Text>
            <Pressable
              onPress={onStart}
              disabled={starting}
              accessibilityRole="button"
              style={({ pressed }) => [styles.popoverButton, { transform: [{ translateY: pressed ? 3 : 0 }], boxShadow: `0px ${pressed ? 1 : 4}px 0px rgba(15,23,42,0.18)` } as never]}
            >
              {starting ? <ActivityIndicator color={color.to} /> : <Play size={16} color={color.to} />}
              <Text style={[styles.popoverButtonText, { color: color.to }]}>
                {`${step.state === 'completed' && !testOut ? 'LUYỆN LẠI' : 'BẮT ĐẦU'} +${maxXpFor(step)} XP`}
              </Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Lộ trình luyện tập: chủ đề → chặng → Học / Luyện / Thử thách / Kiểm tra chặng (mở khóa tuần tự). */
function PathView({
  topics,
  loading,
  error,
  starting,
  play,
  initialTopicId = '',
  activeTopicId = '',
  onTopicChange,
  onStartStep,
  onPathChanged,
  continueVideo = false,
  onContinueVideoOpened,
}: {
  topics: DpTopicPath[];
  activeTopicId?: string;
  loading: boolean;
  error: string;
  starting: boolean;
  play: (s: GameSound) => void;
  initialTopicId?: string;
  onTopicChange?: (topicId: string) => void;
  onStartStep: (unitId: string, nodeKey: string, step: DpStepKey, testOut: boolean, opts?: { review?: boolean }) => void;
  onPathChanged: () => void;
  continueVideo?: boolean;
  onContinueVideoOpened?: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [topicId, setTopicId] = useState('');
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [videoOpen, setVideoOpen] = useState<{ unit: DpPathUnit; videoId: string } | null>(null);
  const [roadmapOpen, setRoadmapOpen] = useState<DpPathUnit | null>(null);
  const [lessonOpen, setLessonOpen] = useState<{ unit: DpPathUnit; step: DpPathStep } | null>(null);
  const [trophyCeremonyOpen, setTrophyCeremonyOpen] = useState(false);
  const targetAppliedRef = useRef(false);

  useEffect(() => {
    if (!continueVideo) {
      targetAppliedRef.current = false;
      return;
    }
    if (videoOpen || lessonOpen || targetAppliedRef.current) return;
    const activeTopic = topics.find((item) => item.topic.id === topicId) || topics[0];
    const target = continueStageTarget(activeTopic);
    if (!target) return;
    targetAppliedRef.current = true;
    onContinueVideoOpened?.();
    setVideoOpen({ unit: target.unit, videoId: target.videoId });
  }, [continueVideo, topics, topicId, videoOpen, lessonOpen, onContinueVideoOpened]);

  useEffect(() => {
    if (topicId && topics.some((item) => item.topic.id === topicId)) return;
    if (!topics.length) return;
    let cancelled = false;
    const userKey = String(user?.id || user?._id || '').trim();
    void (async () => {
      const savedId = await resolveSavedPathTopicId(userKey, activeTopicId);
      if (cancelled) return;
      const picked = pickActivePathTopic({ topics, activeTopicId }, initialTopicId, savedId);
      if (picked?.topic?.id) setTopicId(picked.topic.id);
    })();
    return () => { cancelled = true; };
  }, [topicId, topics, initialTopicId, activeTopicId, user?.id, user?._id]);

  useEffect(() => {
    if (!activeTopicId) return;
    const userKey = String(user?.id || user?._id || '').trim();
    void syncLastPathTopicFromServer(activeTopicId, userKey);
  }, [activeTopicId, user?.id, user?._id]);

  useEffect(() => {
    if (!activeTopicId || activeTopicId === topicId) return;
    if (!topics.some((item) => item.topic.id === activeTopicId)) return;
    setTopicId(activeTopicId);
    setPopover(null);
  }, [activeTopicId, topicId, topics]);

  useEffect(() => {
    if (!topicId) return;
    onTopicChange?.(topicId);
    const userKey = String(user?.id || user?._id || '').trim();
    void persistLastPathTopicId(topicId, userKey);
  }, [topicId, onTopicChange, user?.id, user?._id]);

  useEffect(() => {
    if (error) setPopover(null);
  }, [error]);

  const current = topics.find((item) => item.topic.id === topicId) || null;
  const newlyUnlockedUnitId = useNewlyUnlockedUnit(current?.units || []);
  const newlyUnlockedUnit = useMemo(
    () => (newlyUnlockedUnitId ? current?.units?.find((u) => u.id === newlyUnlockedUnitId) || null : null),
    [current, newlyUnlockedUnitId],
  );
  const isBrandStudent = Boolean(user && user.role === 'student' && !isFreePortalMenu(user));
  const color = DP_TOPIC_COLORS[current?.topic.color || 'red'] || DP_TOPIC_COLORS.red;

  if (loading && !topics.length) return <ActivityIndicator color={theme.brand} />;
  if (!topics.length) {
    return (
      <View style={styles.gapMd}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.empty}>
          <Mascot mood="thinking" size={72} />
          <Text style={styles.emptyTitle}>Trung tâm đang soạn lộ trình luyện tập.</Text>
          <Text style={[styles.muted, styles.center]}>Bạn có thể dùng chế độ Luyện tự do trong lúc chờ nhé!</Text>
        </View>
      </View>
    );
  }

  const toggleTestOut = (unit: DpPathUnit) => {
    play('tap');
    setPopover((prev) => (prev && prev.unitId === unit.id && prev.testOut ? null : { unitId: unit.id, testOut: true, stepKey: 'challenge' }));
  };
  const toggleHub = (unit: DpPathUnit, nodeKey: string) => {
    play('tap');
    setPopover((prev) => (prev && prev.unitId === unit.id && !prev.testOut && prev.nodeKey === nodeKey ? null : { unitId: unit.id, nodeKey, testOut: false }));
  };
  const openUnitStageAction = (unit: DpPathUnit, isNextUnit: boolean) => {
    play('tap');
    let nodeKey = 'study';
    if (unit.state === 'completed') {
      nodeKey = unit.pathNodes?.[0]?.key || 'study';
    } else if (isNextUnit && current?.next?.unitId === unit.id && current.next.nodeKey) {
      nodeKey = current.next.nodeKey;
    } else {
      const active = unit.pathNodes?.find((n) => n.state === 'active');
      nodeKey = active?.key || unit.pathNodes?.[0]?.key || 'study';
    }
    setPopover({ unitId: unit.id, nodeKey, testOut: false });
  };
  const watch = (lesson: { subjectId: string; unitId: string }) => navigation.navigate('MainTabs', {
    screen: 'CourseVideos',
    params: { resumeKey: Date.now(), resumeSubjectId: lesson.subjectId, resumeCourseId: '', resumeUnitId: lesson.unitId, resumeSectionId: '' },
  });

  const activePopoverUnit = popover && !popover.testOut && current
    ? current.units.find((u) => u.id === popover.unitId) || null
    : null;
  const activePopoverNode = activePopoverUnit
    ? activePopoverUnit.pathNodes?.find((n) => n.key === popover.nodeKey) || null
    : null;

  return (
    <View style={styles.gapMd}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {current ? (
        <>
          {newlyUnlockedUnit ? <LevelUnlockBanner unit={newlyUnlockedUnit} /> : null}
          <View style={styles.pathTimelineWrap}>
            {current.units.map((unit, unitIdx) => {
              const locked = unit.state === 'locked';
              const doneSteps = unit.steps.filter((step) => step.state === 'completed').length;
              const totalSteps = unit.steps.length;
              const progress = totalSteps ? doneSteps / totalSteps : 0;
              const testOutStep = unit.pathNodes?.flatMap((n) => n.levels || []).find((level) => level.key === 'challenge')
                || unit.steps.find((step) => step.key === 'challenge');
              const testOutOpen = popover?.unitId === unit.id && popover.testOut;
              const isNextUnit = current.next?.unitId === unit.id;
              const tone = unitColor(unit.index);
              const isLast = unitIdx === current.units.length - 1;
              const pathItems = buildUnitPathItems(unit);
              const nextIdx = pathItems.findIndex((item) => (
                current.next?.unitId === unit.id
                && (current.next.nodeKey ? current.next.nodeKey === item.node?.key : item.node?.key === 'study')
              ));
              const unitVideos = collectUnitVideos(unit);
              const preferredVideoId = unitVideos.find((v) => v.state !== 'completed' && v.state !== 'locked')?.id || unitVideos[0]?.id || '';
              return (
                <View key={unit.id} style={[styles.pathUnitRow, !isLast && styles.pathUnitRowBorder]}>
                  <PathITBackdrop
                    accentSoft={tone.soft}
                    hideMap
                    fullBleed
                    topicCompletedUnits={current.completedUnits}
                    topicTotalUnits={current.totalUnits}
                    unitIndex={unitIdx}
                    unitTotal={current.units.length}
                    unitState={unit.state}
                  />
                  <UnitStageHeader
                    unit={unit}
                    tone={tone}
                    locked={locked}
                    isNextUnit={isNextUnit}
                    doneSteps={doneSteps}
                    totalSteps={totalSteps}
                    progress={progress}
                    onOpenRoadmap={() => { play('tap'); setPopover(null); setRoadmapOpen(unit); }}
                    onToggleTestOut={() => toggleTestOut(unit)}
                    onStageAction={() => openUnitStageAction(unit, isNextUnit)}
                  />
                  {testOutOpen && testOutStep ? (
                    <StepPopover
                      unit={unit}
                      step={testOutStep}
                      testOut
                      color={{ from: '#64748B', to: '#334155' }}
                      starting={starting}
                      onClose={() => setPopover(null)}
                      onStart={() => onStartStep(unit.id, 'study', 'challenge', true)}
                    />
                  ) : null}
                  <View style={styles.nodeSnakeWrap}>
                    <VietnamJourneyStage
                      pathItems={pathItems}
                      laneWidthPx={NODE_LANE_WIDTH}
                      nextIdx={nextIdx}
                      locked={locked}
                      mapProps={{
                        topicCompletedUnits: current.completedUnits,
                        topicTotalUnits: current.totalUnits,
                        unitIndex: unitIdx,
                        unitTotal: current.units.length,
                        unitState: unit.state,
                      }}
                      renderNode={(item, { hubNext, index }) => {
                        const hubSelected = item.kind === 'hub' && popover && !popover.testOut && popover.unitId === unit.id && popover.nodeKey === item.node.key;
                        const nodeTone = pathNodeColor(item.node, index, { mapDuo: true });
                        return (
                          <View style={styles.nodeSlot}>
                            <PracticeHubNode
                              node={item.node}
                              color={nodeTone}
                              isNext={hubNext}
                              selected={Boolean(hubSelected)}
                              nodeIndex={index}
                              onPress={() => toggleHub(unit, item.node.key)}
                            />
                          </View>
                        );
                      }}
                    />
                  </View>
                  <View style={styles.pathUnitFooter}>
                    <UnitStageChest unit={unit} play={play} variant="chip" onClaimed={onPathChanged} />
                  </View>

                  {isLast ? (
                    <CourseFinaleCup
                      courseDone={!current.next && (current.totalUnits || 0) > 0 && (current.completedUnits || 0) >= (current.totalUnits || 0)}
                      onPress={() => { play('win'); setTrophyCeremonyOpen(true); }}
                    />
                  ) : null}
                </View>
              );
            })}
          </View>
        </>
      ) : null
      }
      {
        activePopoverUnit && activePopoverNode ? (
          activePopoverNode.kind === 'study' || activePopoverNode.icon === 'book' ? (
            <StudyHubPopover
              node={activePopoverNode}
              color={unitColor(activePopoverUnit.index)}
              onClose={() => setPopover(null)}
              onOpenLesson={(step) => {
                play('tap');
                setPopover(null);
                setLessonOpen({ unit: activePopoverUnit, step });
              }}
            />
          ) : (
            <LevelHubPopover
              node={activePopoverNode}
              color={unitColor(activePopoverUnit.index)}
              starting={starting}
              onClose={() => setPopover(null)}
              onStartStep={(stepKey, opts) => {
                setPopover(null);
                onStartStep(activePopoverUnit.id, activePopoverNode.key, stepKey, false, opts);
              }}
            />
          )
        ) : null
      }
      {
        trophyCeremonyOpen && current ? (
          <CourseTrophyCeremonyModal
            current={current}
            play={play}
            onClose={() => setTrophyCeremonyOpen(false)}
          />
        ) : null
      }
      {
        lessonOpen ? (
          <PathLessonModal
            unit={lessonOpen.unit}
            step={lessonOpen.step}
            color={unitColor(lessonOpen.unit.index)}
            play={play}
            onClose={() => setLessonOpen(null)}
            onCompleted={onPathChanged}
            onOpenVideo={(videoId) => setVideoOpen({ unit: lessonOpen.unit, videoId })}
          />
        ) : null
      }
      {
        roadmapOpen ? (
          <UnitStageRoadmapModal
            unit={roadmapOpen}
            tone={unitColor(roadmapOpen.index)}
            play={play}
            onClose={() => setRoadmapOpen(null)}
            onPickNode={(nodeKey) => {
              const unit = roadmapOpen;
              setRoadmapOpen(null);
              setPopover({ unitId: unit.id, nodeKey, testOut: false });
            }}
            onOpenVideo={() => {
              const unit = roadmapOpen;
              const unitVideos = collectUnitVideos(unit);
              const preferredVideoId = unitVideos.find((v) => v.state !== 'completed' && v.state !== 'locked')?.id || unitVideos[0]?.id || '';
              setRoadmapOpen(null);
              setVideoOpen({ unit, videoId: preferredVideoId });
            }}
          />
        ) : null
      }
      {
        videoOpen ? (
          <PathVideoModal
            unit={videoOpen.unit}
            initialVideoId={videoOpen.videoId}
            color={unitColor(videoOpen.unit.index)}
            userId={String(user?.id || '')}
            play={play}
            onClose={() => setVideoOpen(null)}
            onWatched={async (videoId) => {
              await dailyPracticeApi.videoWatched(videoOpen.unit.id, videoId);
              onPathChanged();
            }}
            onOpenLesson={watch}
          />
        ) : null
      }
    </View >
  );
}

function PathResultCard({ result }: { result: DpPathResult }) {
  const passed = result.passed;
  const isCourseComplete = passed && Boolean(result.topicCompleted && (result.unitCompleted || result.testOut));
  const isUnitTrophy = passed && Boolean(result.unitCompleted || result.testOut);
  let title: string;
  let text: string;
  if (!passed) {
    title = `Chưa qua ${result.testOut ? 'bài kiểm tra vượt chặng' : `bước ${result.stepLabel}`}`;
    text = `Bạn đạt ${result.scorePercent}%, cần từ ${result.passPercent}%. Ôn lại rồi thử lần nữa nhé!`;
  } else if (isCourseComplete) {
    title = 'CHÚC MỪNG HOÀN THÀNH KHÓA HỌC!';
    text = `Bạn đã chinh phục trọn vẹn lộ trình và xuất sắc nhận Cúp Vàng Vinh Danh tại chặng “${result.unitTitle}”!`;
  } else if (result.testOut) {
    title = 'Vượt chặng thành công!';
    text = `Đã hoàn thành đến chặng “${result.unitTitle}”.`;
  } else if (result.unitCompleted && (result.step === 'challenge' || result.step === 'checkpoint')) {
    title = `Hoàn thành chặng “${result.unitTitle}”!`;
    text = result.unlockedUnit ? `Đã mở khóa Chặng ${result.unlockedUnit.index}: ${result.unlockedUnit.title}` : 'Tiếp tục giữ phong độ nhé!';
  } else {
    title = `Qua bước ${result.stepLabel} (${result.scorePercent}%)`;
    text = result.next ? `Bước tiếp theo: ${result.next.stepLabel} · ${result.next.unitTitle}` : 'Tiếp tục giữ phong độ nhé!';
  }

  if (isCourseComplete || isUnitTrophy) {
    return (
      <View style={styles.pathTrophyResult}>
        <View style={styles.finaleCupCircleSmall}>
          <Trophy size={28} color="#FFFFFF" />
        </View>
        <View style={styles.flex}>
          <View style={styles.inline}>
            <Sparkles size={13} color="#D97706" />
            <Text style={styles.pathTrophyEyebrow}>
              {isCourseComplete ? 'CÚP VÀNG HOÀN THÀNH KHÓA HỌC' : 'DANH HIỆU VƯỢT CHẶNG'}
            </Text>
          </View>
          <Text style={styles.pathTrophyTitle}>{title}</Text>
          <Text style={styles.muted}>{text}</Text>
        </View>
        <Mascot mood="happy" size={56} />
      </View>
    );
  }

  return (
    <View style={[styles.pathResult, passed ? styles.pathResultOk : styles.pathResultBad]}>
      <View style={[styles.pathResultIcon, { backgroundColor: passed ? '#059669' : '#F59E0B' }]}>
        {passed ? <Route size={22} color="#FFFFFF" /> : <Lock size={20} color="#FFFFFF" />}
      </View>
      <View style={styles.flex}>
        <Text style={[styles.pathResultTitle, { color: passed ? '#065F46' : '#92400E' }]}>{title}</Text>
        <Text style={styles.muted}>{text}</Text>
      </View>
    </View>
  );
}

// ── Mua thêm XP (VietQR + Polling + Sandbox - đồng bộ BuyXpModal.jsx) ────────
const DEFAULT_XP_PACKS: DpXpPack[] = [
  { id: 'xp_100', xp: 100, priceVnd: 10000, label: '100 XP · 10.000đ' },
  { id: 'xp_300', xp: 300, priceVnd: 25000, label: '300 XP · 25.000đ' },
  { id: 'xp_800', xp: 800, priceVnd: 59000, label: '800 XP · 59.000đ' },
];

function BuyXpModal({ packs, play, onClose, onPurchased }: {
  packs?: DpXpPack[];
  play: (s: GameSound) => void;
  onClose: () => void;
  onPurchased: () => void;
}) {
  const list = packs?.length ? packs : DEFAULT_XP_PACKS;
  const [selectedXp, setSelectedXp] = useState<number>(list[0]?.xp || 100);
  const [checkout, setCheckout] = useState<DpXpCheckout | null>(null);
  const [busy, setBusy] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [paid, setPaid] = useState(false);
  const [errMsg, setErrMsg] = useState('');

  const selectedPack = list.find((p) => p.xp === selectedXp) || list[0];
  const sessionKey = checkout?.sessionId || checkout?.orderCode || '';

  useEffect(() => {
    if (!sessionKey || paid) return undefined;
    const timer = setInterval(() => {
      dailyPracticeApi.xpPurchaseStatus(sessionKey)
        .then((res) => {
          if (res.status === 'paid') {
            setPaid(true);
            play('win');
            onPurchased();
          }
        })
        .catch(() => { });
    }, 3000);
    return () => clearInterval(timer);
  }, [sessionKey, onPurchased, paid, play]);

  const createOrder = async () => {
    setBusy(true);
    setErrMsg('');
    try {
      const packId = selectedPack?.id || `xp_${selectedXp}`;
      const data = await dailyPracticeApi.buyXp(packId);
      setCheckout(data);
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Không tạo được đơn mua XP');
    } finally {
      setBusy(false);
    }
  };

  const simulatePaid = async () => {
    if (!sessionKey || simulating) return;
    setSimulating(true);
    setErrMsg('');
    try {
      const res = await dailyPracticeApi.simulateXpPaid(sessionKey);
      if (res.status === 'paid') {
        setPaid(true);
        play('win');
        onPurchased();
      }
    } catch (err) {
      setErrMsg(err instanceof Error ? err.message : 'Không xác nhận được thanh toán thử');
    } finally {
      setSimulating(false);
    }
  };

  const qrUrl = checkout?.payment?.qrUrl || checkout?.qrUrl || '';
  const bankName = checkout?.payment?.bankName || checkout?.bankName || '';
  const accountNo = checkout?.payment?.accountNo || checkout?.accountNo || '';
  const transferContent = checkout?.payment?.transferContent || checkout?.transferContent || checkout?.orderCode || '';
  const canSimulate = Boolean(checkout?.payment?.canSimulate || checkout?.canSimulate || __DEV__);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.quitBackdrop}>
        <View style={[styles.quitCard, { maxWidth: 420 }]}>
          <View style={styles.buyXpHeader}>
            <View style={styles.buyXpIconWrap}>
              <ShoppingBag size={18} color="#D97706" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.buyXpTitle}>Mua XP luyện tập</Text>
              <Text style={styles.muted}>Chuyển khoản là cộng XP, luyện tiếp được ngay</Text>
            </View>
            <Pressable onPress={onClose} style={{ padding: 6 }} accessibilityRole="button">
              <X size={18} color="#64748B" />
            </Pressable>
          </View>

          {paid ? (
            <View style={{ alignItems: 'center', padding: spacing.xl, gap: 10 }}>
              <Mascot mood="celebrate" size={88} />
              <Text style={[styles.quitTitle, { color: '#047857' }]}>{`Đã cộng +${checkout?.xp || selectedXp} XP!`}</Text>
              <Text style={styles.quitText}>Ví XP của bạn đã được cập nhật. Chúc bạn luyện tập vui vẻ!</Text>
              <View style={{ width: '100%', marginTop: 8 }}>
                <DuoButton
                  variant="primary"
                  size="lg"
                  fullWidth
                  text="Luyện tiếp ngay"
                  icon={<Check size={16} color="#FFFFFF" />}
                  onPress={onClose}
                />
              </View>
            </View>
          ) : checkout ? (
            <View style={{ padding: spacing.lg, gap: 12, alignItems: 'center' }}>
              {qrUrl ? (
                <Image source={{ uri: qrUrl }} style={{ width: 210, height: 210, borderRadius: 14 }} resizeMode="contain" />
              ) : (
                <View style={{ padding: 24, borderRadius: 16, backgroundColor: '#F8FAFC', alignItems: 'center', gap: 6 }}>
                  <QrCode size={42} color="#64748B" />
                  <Text style={styles.muted}>Chuyển khoản theo thông tin bên dưới</Text>
                </View>
              )}
              <View style={styles.buyXpTransferBox}>
                <Text style={styles.buyXpTransferLine}>{`Gói: +${checkout.xp} XP · ${(checkout.amount || 0).toLocaleString('vi-VN')}đ`}</Text>
                {bankName || accountNo ? <Text style={styles.muted}>{`Ngân hàng: ${bankName} · STK: ${accountNo}`}</Text> : null}
                {transferContent ? <Text style={styles.buyXpCode}>{`Nội dung CK: ${transferContent}`}</Text> : null}
              </View>
              <View style={styles.inline}>
                <ActivityIndicator size="small" color="#D97706" />
                <Text style={styles.muted}>Đang chờ xác nhận thanh toán tự động…</Text>
              </View>
              {errMsg ? <Text style={styles.errorInline}>{errMsg}</Text> : null}
              <View style={[styles.row, { alignSelf: 'stretch', gap: 10 }]}>
                <View style={styles.flex}>
                  <DuoButton
                    variant="secondary"
                    size="md"
                    fullWidth
                    text="Đổi gói"
                    onPress={() => setCheckout(null)}
                  />
                </View>
                {canSimulate ? (
                  <View style={styles.flex}>
                    <DuoButton
                      variant="primary"
                      size="md"
                      fullWidth
                      text="Giả lập đã TT"
                      icon={simulating ? undefined : <RefreshCw size={15} color="#FFFFFF" />}
                      loading={simulating}
                      disabled={simulating}
                      onPress={() => { void simulatePaid(); }}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={{ padding: spacing.lg, gap: 10 }}>
              {list.map((pack) => {
                const active = pack.xp === selectedXp;
                return (
                  <Pressable
                    key={pack.id || pack.xp}
                    onPress={() => { play('tap'); setSelectedXp(pack.xp); }}
                    style={[
                      styles.buyXpPackCard,
                      active && styles.buyXpPackCardActive,
                    ]}
                    accessibilityRole="button"
                  >
                    <View style={[styles.buyXpPackBolt, { backgroundColor: active ? '#F59E0B' : '#F1F5F9' }]}>
                      <Zap size={16} color={active ? '#FFFFFF' : '#64748B'} fill={active ? '#FEF08A' : 'transparent'} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.buyXpPackTitle}>{`+${pack.xp} XP`}</Text>
                      <Text style={styles.muted}>{`Đủ khoảng ${Math.max(1, Math.round(pack.xp / 20))} lượt luyện`}</Text>
                    </View>
                    <Text style={styles.buyXpPackPrice}>{`${pack.priceVnd.toLocaleString('vi-VN')}đ`}</Text>
                  </Pressable>
                );
              })}
              {errMsg ? <Text style={styles.errorInline}>{errMsg}</Text> : null}
              <View style={{ width: '100%', marginTop: 4 }}>
                <DuoButton
                  variant="gold"
                  size="lg"
                  fullWidth
                  text={`Mua ${selectedXp} XP`}
                  icon={busy ? undefined : <ShoppingBag size={16} color="#FFFFFF" />}
                  loading={busy}
                  disabled={busy}
                  onPress={() => { void createOrder(); }}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Xác nhận mức cược XP trước khi vào bài ───────────────────────────────────
function StakeSessionConfirm({ stakeXp, xpTotal, testOut, busy, play, onCancel, onConfirm, onBuyXp }: {
  stakeXp: number;
  xpTotal: number;
  testOut: boolean;
  busy: boolean;
  play: (s: GameSound) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onBuyXp: () => void;
}) {
  const { user } = useAuth();
  const isBrandStudent = Boolean(user && user.role === 'student' && !isFreePortalMenu(user));
  const notEnough = xpTotal < stakeXp;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.quitBackdrop}>
        <View style={[styles.quitCard, { maxWidth: 400 }]}>
          <View style={[styles.quitHero, { backgroundColor: '#FFFBEB' }]}>
            <Mascot mood={notEnough ? 'thinking' : 'happy'} size={86} />
            <Text style={styles.quitTitle}>
              {notEnough ? 'Không đủ XP để làm bài' : testOut ? 'Kiểm tra vượt chặng' : 'Sẵn sàng vào bài tập?'}
            </Text>
            {notEnough ? (
              <>
                <Text style={styles.quitText}>
                  {`Bài tập này yêu cầu ${stakeXp} XP (cần ≥ ${stakeXp} XP để bắt đầu). Hiện bạn chỉ có ${xpTotal} XP trong ví. Vui lòng nâng cấp gói Meet (+300 XP/ngày) hoặc mua thêm XP để tiếp tục!`}
                </Text>
                <View style={styles.quitProgress}>
                  <Zap size={13} color="#D97706" fill="#FCD34D" />
                  <Text style={styles.quitProgressText}>{`5 XP/câu · tối đa ${stakeXp} XP · đang có ${xpTotal}`}</Text>
                </View>
              </>
            ) : (
              <View style={styles.stakeGrid2Col}>
                <View style={styles.stakeColBox}>
                  <Text style={styles.statLabel}>Mức cược lượt này</Text>
                  <Text style={styles.stakeColValue}>{`5 XP/câu · tối đa ${stakeXp}`}</Text>
                </View>
                <View style={styles.stakeColBox}>
                  <Text style={styles.statLabel}>Ví XP hiện có</Text>
                  <Text style={styles.stakeColValue}>{`${xpTotal} XP`}</Text>
                </View>
              </View>
            )}
          </View>
          {notEnough ? (
            <View style={[styles.quitActions, { gap: 10 }]}>
              <DuoButton
                variant="gold"
                size="lg"
                fullWidth
                text="Nâng cấp gói Meet (+300 XP/ngày)"
                icon={<Crown size={16} color="#FFFFFF" />}
                onPress={() => { play('tap'); onBuyXp(); }}
              />
              <DuoButton
                variant="secondary"
                size="md"
                fullWidth
                text="Để sau"
                onPress={onCancel}
              />
            </View>
          ) : (
            <View style={[styles.row, { padding: spacing.lg, gap: 12 }]}>
              <View style={styles.flex}>
                <DuoButton
                  variant="secondary"
                  size="md"
                  fullWidth
                  text="Để sau"
                  disabled={busy}
                  onPress={onCancel}
                />
              </View>
              <View style={styles.flex}>
                <DuoButton
                  variant={isBrandStudent ? 'danger' : 'primary'}
                  size="md"
                  fullWidth
                  text="Bắt đầu"
                  icon={busy ? undefined : <Play size={16} color="#FFFFFF" />}
                  loading={busy}
                  disabled={busy}
                  onPress={onConfirm}
                />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── Xác nhận thoát ───────────────────────────────────────────────────────────
function QuitConfirm({ stats, answered, total, busy, play, onStay, onQuit }: {
  stats: DpStats | null;
  answered: number;
  total: number;
  busy?: boolean;
  play: (s: GameSound) => void;
  onStay: () => void;
  onQuit: () => void;
}) {
  const keptToday = Boolean(stats?.playedToday);
  const streak = stats?.streak || 0;
  const left = Math.max(0, total - answered);
  useEffect(() => { play('sad'); }, [play]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onStay}>
      <View style={styles.quitBackdrop}>
        <View style={styles.quitCard} accessibilityViewIsModal>
          <View style={styles.quitHero}>
            <Mascot mood="sad" size={92} />
            <Text style={styles.quitTitle}>{keptToday ? 'Thoát lượt chơi này?' : 'Bạn sẽ mất chuỗi hôm nay!'}</Text>
            <Text style={styles.quitText}>
              {keptToday
                ? 'Kết quả và XP của lượt này sẽ không được tính.'
                : streak > 0
                  ? `Thoát bây giờ, chuỗi 🔥 ${streak} ngày của bạn sẽ về 0 lúc nửa đêm. Bạn có chắc muốn thoát không?`
                  : 'Thoát bây giờ thì hôm nay bạn chưa có chuỗi 🔥 và không nhận được XP. Bạn có chắc muốn thoát không?'}
            </Text>
            {left > 0 ? (
              <View style={styles.quitProgress}>
                <Zap size={13} color="#F59E0B" fill="#FCD34D" />
                <Text style={styles.quitProgressText}>{`Đã làm ${answered}/${total} câu - chỉ còn ${left} câu nữa thôi!`}</Text>
              </View>
            ) : null}
          </View>
          <View style={[styles.quitActions, { gap: 10 }]}>
            <DuoButton
              variant="primary"
              size="lg"
              fullWidth
              text="Ở lại luyện tiếp"
              icon={<Play size={16} color="#FFFFFF" />}
              disabled={busy}
              onPress={onStay}
            />
            <DuoButton
              variant="secondary"
              size="md"
              fullWidth
              text="Vẫn thoát"
              loading={busy}
              disabled={busy}
              onPress={onQuit}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Màn chơi ─────────────────────────────────────────────────────────────────
function PlayView({ session, stats, play, onQuit, onFinished, onDraggingChange }: {
  session: DpSession;
  stats: DpStats | null;
  play: (s: GameSound) => void;
  onQuit: () => void;
  onFinished: (summary: DpSummary) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const [quitOpen, setQuitOpen] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<DpAnswer | null>(null);
  const [chosen, setChosen] = useState<number | boolean | null>(null);
  const [result, setResult] = useState<DpAnswerResult | null>(null);
  const [reveal, setReveal] = useState<DpReveal | null>(null);
  const [hintText, setHintText] = useState('');
  const [hintChargedXp, setHintChargedXp] = useState(0);
  const [busy, setBusy] = useState(false);
  const [xp, setXp] = useState(0);
  const [profileXp, setProfileXp] = useState<number | null>(() => (
    typeof session.profileXp === 'number' ? session.profileXp : typeof stats?.xpTotal === 'number' ? stats.xpTotal : null
  ));
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [combo, setCombo] = useState(0);
  const [comboCelebration, setComboCelebration] = useState<number | null>(null);
  const [wrongTryCount, setWrongTryCount] = useState(0);
  const [answerResetKey, setAnswerResetKey] = useState(0);
  const [retryBaselineKey, setRetryBaselineKey] = useState('');
  const [explainOpen, setExplainOpen] = useState(false);
  const comboPop = useRef(new Animated.Value(1)).current;
  const question = session.questions[index];
  const total = session.questions.length;
  const meta = DP_TYPES[question.type];
  const level = DP_DIFFICULTIES.find((d) => d.id === question.difficulty) || DP_DIFFICULTIES[0];
  useEffect(() => {
    setExplainOpen(false);
    setHintChargedXp(0);
  }, [question.id, answerResetKey]);

  useEffect(() => {
    setRetryBaselineKey('');
  }, [question.id]);

  useEffect(() => {
    if (!result || result.correct) {
      setRetryBaselineKey('');
      return;
    }
    if (pending == null || question.type !== 'order') return;
    setRetryBaselineKey((prev) => {
      if (prev === RETRY_BASELINE_EMPTY || prev === '') return serializePracticeAnswer(pending);
      return prev;
    });
  }, [result, pending, question.type]);

  const stakeXp = Number(session.stakeXp) || 0;
  const isTestOutStake = Boolean(session.path?.testOut && stakeXp > 0);
  const isPerQuestionStake = Boolean(
    !session.xpDisabled
    && !session.review
    && !session.recovery
    && session.path
    && !session.path.testOut,
  );
  const walletXp = profileXp !== null ? inPlayWalletXp(profileXp, isTestOutStake ? stakeXp : 0) : null;
  const perQuestionStakeXp = session.perQuestionStakeXp || QUESTION_STAKE_XP;
  const hintCostXp = session.xpDisabled
    ? 0
    : (isPerQuestionStake
      ? Math.floor(perQuestionStakeXp / 2)
      : (stakeXp > 0 && total > 0 ? Math.floor(stakeXp / (2 * total)) : 0));
  const shakeX = useShake(result && !result.correct ? `${index}-wrong` : null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (typeof stats?.xpTotal === 'number') setProfileXp(stats.xpTotal);
  }, [stats?.xpTotal]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(DAILY_PRACTICE_STATS_EVENT, (detail?: Partial<DpStats> & { stats?: Partial<DpStats>; xpTotal?: number | null }) => {
      if (typeof detail?.xpTotal === 'number') setProfileXp(detail.xpTotal);
      else if (typeof detail?.stats?.xpTotal === 'number') setProfileXp(detail.stats.xpTotal);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    Animated.timing(progress, { toValue: (index + (result ? 1 : 0)) / total, duration: 400, useNativeDriver: false }).start();
  }, [index, progress, result, total]);

  const retryQuestion = useCallback(() => {
    setResult(null);
    setPending(null);
    setChosen(null);
    setAnswerResetKey((key) => key + 1);
  }, []);

  const resetInteractiveAnswer = useCallback(() => {
    setPending(null);
    setChosen(null);
    setAnswerResetKey((key) => key + 1);
  }, []);

  const submit = useCallback(async (answer: DpAnswer | null) => {
    if (!answer || busy || result?.correct) return;
    setBusy(true);
    setError('');
    setChosen('index' in answer ? answer.index : 'value' in answer ? answer.value : null);
    try {
      const data = await dailyPracticeApi.answer(session.id, question.id, answer);
      setResult(data);
      setXp(data.sessionXp);
      if (typeof data.profileXp === 'number') setProfileXp(data.profileXp);
      const isCorrect = data.correct;
      setTitle(isCorrect ? randomPraise() : randomComfort());
      setCombo((value) => {
        const nextCombo = isCorrect ? value + 1 : 0;
        if ([3, 5, 10].includes(nextCombo)) {
          setComboCelebration(nextCombo);
        }
        return nextCombo;
      });
      if (isCorrect) {
        setWrongTryCount(0);
        comboPop.setValue(0.6);
        Animated.spring(comboPop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: USE_NATIVE_DRIVER }).start();
      } else {
        setWrongTryCount(typeof data.wrongTryCount === 'number' ? data.wrongTryCount : (wrongTryCount + 1));
        if (question.type === 'mcq' || question.type === 'truefalse') {
          setChosen(null);
          setPending(null);
        } else {
          setRetryBaselineKey(RETRY_BASELINE_EMPTY);
          resetInteractiveAnswer();
        }
      }
      play(isCorrect ? 'correct' : 'wrong');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được câu trả lời');
    } finally {
      setBusy(false);
    }
  }, [busy, comboPop, play, question.id, question.type, resetInteractiveAnswer, result, session.id, wrongTryCount]);

  const askHint = async () => {
    if (reveal || result?.correct || busy) return;
    setBusy(true);
    try {
      const data = await dailyPracticeApi.hint(session.id, question.id);
      play('hint');
      const charged = Math.max(0, Number((data as { charged?: number }).charged) || 0);
      setReveal(data.reveal || {});
      setHintText(data.hint || '');
      if (typeof data.profileXp === 'number') setProfileXp(data.profileXp);
      if (charged > 0) setHintChargedXp(charged);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lấy được gợi ý');
    } finally {
      setBusy(false);
    }
  };

  const next = async () => {
    if (index + 1 < total) {
      setIndex(index + 1);
      setPending(null);
      setChosen(null);
      setResult(null);
      setReveal(null);
      setHintText('');
      setWrongTryCount(0);
      setAnswerResetKey((key) => key + 1);
      return;
    }
    setBusy(true);
    try {
      onFinished(await dailyPracticeApi.finish(session.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được kết quả');
      setBusy(false);
    }
  };

  const confirmQuit = async () => {
    if (quitting) return;
    setQuitting(true);
    try {
      await dailyPracticeApi.abandon(session.id);
    } catch {
      // vẫn cho thoát nếu phiên đã đóng
    } finally {
      setQuitting(false);
      setQuitOpen(false);
      onQuit();
    }
  };

  const props = { question, reveal, result, play, onChange: setPending };
  const immediate = question.type === 'mcq' || question.type === 'truefalse';
  const mood: MascotMood = result ? (result.correct ? 'happy' : 'thinking') : reveal ? 'thinking' : 'idle';
  const stepTitle = session.path
    ? `Chặng ${session.path.unitIndex} · ${session.path.pathNodeLabel || session.path.unitTitle} · ${session.path.stepLabel}`
    : `Luyện tự do · ${level.label}`;
  const confirmedQuestionXp = result?.correct
    ? (typeof result.xp === 'number' && result.xp > 0
      ? result.xp
      : (isPerQuestionStake && !session.xpDisabled ? QUESTION_STAKE_XP : 0))
    : 0;

  return (
    <DragProvider onDraggingChange={onDraggingChange}>
      <View style={styles.playWrap}>
        <View style={styles.topBarCard}>
          <Pressable onPress={() => setQuitOpen(true)} style={styles.quitBtn} accessibilityRole="button">
            <LogOut size={15} color="#475569" />
            <Text style={styles.quitBtnText}>Thoát</Text>
          </Pressable>
          <View style={styles.flex}>
            <View style={styles.topBarMetaRow}>
              <Text numberOfLines={1} style={styles.topBarStepTitle}>{stepTitle}</Text>
              <Text style={styles.topBarCount}>{`${index + 1}/${total}`}</Text>
            </View>
            <View style={styles.playProgressTrack}>
              <Animated.View style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
            </View>
          </View>
          {combo >= 2 ? (
            <Animated.View style={[styles.comboChip, { transform: [{ scale: comboPop }] }]} accessibilityLabel={`Combo ${combo} câu đúng liên tiếp`}>
              <Flame size={13} color="#FFFFFF" fill="#FCD34D" />
              <Text style={styles.comboText}>{`x${combo}`}</Text>
            </Animated.View>
          ) : null}
          {session.xpDisabled ? (
            <View style={[styles.xpPill, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
              <Text style={[styles.xpText, { color: '#64748B', fontSize: 12 }]}>{session.review ? 'Ôn tập · 0 XP' : '0 XP'}</Text>
            </View>
          ) : walletXp !== null ? (
            <View style={styles.xpPill}>
              <Zap size={14} color="#F59E0B" fill="#FBBF24" />
              <View style={{ alignItems: 'center' }}>
                <Text style={styles.xpText}>{walletXp}</Text>
                {isPerQuestionStake ? <Text style={styles.xpSubText}>{`${perQuestionStakeXp}/câu`}</Text> : null}
                {hintChargedXp > 0 ? (
                  <Text style={styles.xpHintSpend} accessibilityLiveRegion="polite">{`−${hintChargedXp} XP`}</Text>
                ) : null}
              </View>
            </View>
          ) : (
            <View style={styles.xpPill}><Zap size={14} color="#F59E0B" fill="#FBBF24" /><Text style={styles.xpText}>{xp}</Text></View>
          )}
        </View>

        <Animated.View style={[styles.playQuestionCard, { transform: [{ translateX: shakeX }] }]}>
          {!result?.correct ? (
            <Pressable
              onPress={() => { void askHint(); }}
              disabled={Boolean(reveal) || busy}
              style={[
                styles.hintCornerBtn,
                reveal ? styles.disabled : null,
                shouldNudgeHintButton(wrongTryCount, Boolean(reveal)) ? styles.hintFooterBtnNudge : null,
              ]}
              accessibilityRole="button"
            >
                <Lightbulb size={PLAY_QUESTION_CHROME.icon.hintSize} color="#64748B" strokeWidth={PLAY_QUESTION_CHROME.icon.strokeWidth} />
                <Text style={styles.hintCornerBtnText}>
                  {reveal ? 'Đã gợi ý' : session.xpDisabled ? 'Gợi ý' : `Gợi ý · −${hintCostXp}`}
                </Text>
            </Pressable>
          ) : null}
          <View style={[styles.promptRow, !result?.correct ? styles.promptRowHintPad : null]}>
            <View style={styles.promptMascotBox}>
              <Mascot mood={mood} size={PLAY_QUESTION_CHROME.mascotSize.mobile} />
            </View>
            <View style={styles.flex}>
              <View style={styles.questionMetaRow}>
                <Text style={styles.questionEyebrow}>{PLAY_QUESTION_CHROME.label}</Text>
                <Text style={styles.questionMetaSep} aria-hidden>·</Text>
                <Text style={styles.playTypeChip} numberOfLines={1}>{meta.label}</Text>
              </View>
              <Text style={styles.playPrompt} maxFontSizeMultiplier={1.3}>
                {question.prompt}
              </Text>
            </View>
          </View>
          {question.imageUrl ? <Image source={getMobileImageSource(question.imageUrl)} style={styles.image} resizeMode="contain" /> : null}
          {hintText ? (
            <View style={styles.hintRevealWrap}>
              <View style={styles.hintBox}>
                <Lightbulb size={PLAY_QUESTION_CHROME.icon.hintSize} color="#64748B" strokeWidth={PLAY_QUESTION_CHROME.icon.strokeWidth} />
                <Text style={styles.hintText}>{hintText}</Text>
              </View>
              {hintChargedXp > 0 ? (
                <Text style={styles.hintChargeLine}>{`Đã trừ −${hintChargedXp} XP từ ví của bạn.`}</Text>
              ) : null}
            </View>
          ) : null}
          <View key={`${question.id}-${answerResetKey}`} style={styles.answerArea}>
            {question.type === 'mcq' ? <McqQuestion question={question} reveal={reveal} result={result} chosen={typeof chosen === 'number' ? chosen : null} onSubmit={submit} play={play} /> : null}
            {question.type === 'truefalse' ? <TrueFalseQuestion result={result} chosen={typeof chosen === 'boolean' ? chosen : null} onSubmit={submit} play={play} /> : null}
            {question.type === 'order' ? <OrderQuestion {...props} /> : null}
            {question.type === 'match' ? <MatchQuestion {...props} /> : null}
            {question.type === 'fill' ? <FillQuestion {...props} /> : null}
            {question.type === 'sort' ? <SortQuestion {...props} /> : null}
          </View>
          {error ? <Text style={styles.errorInline}>{error}</Text> : null}

          {result ? (
            <MobileAnswerFeedback
              question={question}
              result={result}
              confirmedXp={confirmedQuestionXp}
              rewardKey={`${session.id}:${question.id}`}
              feedbackTitle={title}
              busy={busy}
              play={play}
              onNext={() => { void next(); }}
              onRetry={() => {
                if (immediate) {
                  setResult(null);
                  setChosen(null);
                  setPending(null);
                  return;
                }
                void submit(pending);
              }}
              canRetry={Boolean(
                result
                && !result.correct
                && !busy
                && (immediate || canSubmitRetryAfterWrong({
                  pending,
                  retryBaselineKey,
                  questionType: question.type,
                })),
              )}
              wrongTryCount={wrongTryCount}
              explainOpen={explainOpen}
              onExplainOpenChange={setExplainOpen}
            />
          ) : null}

          {!result?.correct ? (
            <View style={[styles.playCardFooter, result ? styles.playCardFooterTight : null, result && !result.correct ? styles.playCardFooterExplainOnly : null]}>
              {result && !result.correct ? (
                <Pressable
                  onPress={() => {
                    play('tap');
                    setExplainOpen((open) => !open);
                  }}
                  style={({ pressed }) => [styles.hintFooterBtn, styles.explainFooterBtn, pressed && { opacity: 0.92 }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: explainOpen }}
                >
                  <BookOpen size={PLAY_QUESTION_CHROME.icon.hintSize} color="#64748B" strokeWidth={PLAY_QUESTION_CHROME.icon.strokeWidth} />
                  <Text style={styles.explainFooterBtnText}>
                    {explainOpen ? 'Ẩn giải thích' : 'Giải thích'}
                  </Text>
                </Pressable>
              ) : null}
              {!result && !immediate ? (
                <DuoButton
                  variant="primary"
                  size="md"
                  text="Kiểm tra"
                  icon={busy ? undefined : <CheckCircle2 size={17} color="#FFFFFF" />}
                  loading={busy}
                  disabled={!pending || busy}
                  onPress={() => { void submit(pending); }}
                />
              ) : null}
              {!result && immediate ? (
                <Text style={styles.selectAnswerHint}>Chọn 1 đáp án bên trên</Text>
              ) : null}
            </View>
          ) : null}
        </Animated.View>

        {quitOpen ? (
          <QuitConfirm
            stats={stats}
            answered={index + (result?.correct ? 1 : 0)}
            total={total}
            busy={quitting}
            play={play}
            onStay={() => setQuitOpen(false)}
            onQuit={() => { void confirmQuit(); }}
          />
        ) : null}
        {comboCelebration ? (
          <MobileComboCelebrationOverlay
            combo={comboCelebration}
            play={play}
            onDone={() => setComboCelebration(null)}
          />
        ) : null}
      </View>
    </DragProvider>
  );
}

// ── Màn kết quả ──────────────────────────────────────────────────────────────
function RelatedLessonCard({ lesson }: { lesson: DpRelatedLesson }) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const open = () => navigation.navigate('MainTabs', {
    screen: 'CourseVideos',
    params: {
      resumeKey: Date.now(),
      resumeSubjectId: lesson.subjectId,
      resumeCourseId: lesson.courseId,
      resumeUnitId: lesson.unitId,
      resumeSectionId: lesson.sectionId,
    },
  });
  return (
    <View style={styles.relatedCard}>
      <View style={styles.relatedRow}>
        <View style={styles.relatedIcon}><PlayCircle size={24} color="#FFFFFF" /></View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.relatedEyebrow}>
            {`${lesson.completed ? 'Ôn lại video liên quan' : 'Học tiếp video liên quan'} · ${lesson.subjectName}`}
          </Text>
          <Text numberOfLines={1} style={styles.relatedTitle}>{lesson.unitTitle}</Text>
          {lesson.itemTitle ? <Text numberOfLines={1} style={styles.muted}>{lesson.itemTitle}</Text> : null}
        </View>
      </View>
      <Pressable onPress={open} style={styles.primary} accessibilityRole="button">
        <PlayCircle size={17} color="#FFFFFF" />
        <Text style={styles.primaryText}>Xem video liên quan</Text>
      </Pressable>
    </View>
  );
}

function ResultView({ summary, play, starting, onReplay, onHome, onNextStep, onBuyXp }: {
  summary: DpSummary;
  play: (s: GameSound) => void;
  starting: boolean;
  onReplay: () => void;
  onHome: () => void;
  onNextStep: (next: DpNextStep) => void;
  /** Điều hướng đến màn mua gói khi free hết XP. */
  onBuyXp: () => void;
}) {
  const [showReview, setShowReview] = useState(false);
  const pathResult = summary.path || null;
  const nextStep = pathResult?.passed ? pathResult.next : null;
  const good = summary.stars >= 2;
  const message = resultMessage(summary.stars);
  const stars = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  /** Lượt này không tính XP do hết 60 XP free/ngày. */
  const capReached = Boolean(summary.xpCapReached || summary.xpDisabled);
  /** Khi cap reached: chặn nút mở bài tiếp theo, chỉ cho ôn lại. */
  const canProceedToNext = nextStep && !summary.xpCapReached;
  const finishXp = practiceFinishXpDisplay(summary);

  useEffect(() => {
    Animated.stagger(180, stars.map((value, i) => Animated.spring(value, {
      toValue: i < summary.stars ? 1 : 0.6, friction: 4, tension: 120, useNativeDriver: USE_NATIVE_DRIVER,
    }))).start();
  }, [stars, summary.stars]);

  return (
    <View style={styles.gapLg}>
      <View style={[styles.resultCard, good ? styles.resultGood : styles.resultSoft]}>
        {good ? <Confetti count={30} spread={200} /> : null}
        <Mascot mood={good ? 'happy' : 'sad'} size={110} />
        <View style={styles.starsBig}>
          {stars.map((value, i) => (
            <Animated.View key={i} style={{ transform: [{ scale: value }] }}>
              <Star size={42} color={i < summary.stars ? '#F59E0B' : '#CBD5E1'} fill={i < summary.stars ? '#FBBF24' : '#E2E8F0'} />
            </Animated.View>
          ))}
        </View>
        <Text style={styles.resultTitle}>{message.title}</Text>
        <Text style={[styles.muted, styles.center]}>{message.text}</Text>
        <View style={styles.resultStats}>
          <View style={styles.resultStat}><Text style={[styles.resultValue, { color: '#059669' }]}>{`${summary.correctCount}/${summary.total}`}</Text><Text style={styles.statLabel}>câu đúng</Text></View>
          <View style={styles.resultStat}>
            <Text style={[styles.resultValue, { color: !finishXp.positive ? '#DC2626' : finishXp.amount > 0 ? '#D97706' : '#64748B' }]}>
              {`${finishXp.prefix}${finishXp.amount}`}
            </Text>
            <Text style={styles.statLabel}>{summary.xpCapReached ? 'Hết XP free' : 'XP ròng lượt này'}</Text>
          </View>
          <View style={styles.resultStat}>
            <View style={styles.inline}><Flame size={20} color="#EA580C" fill="#FDBA74" /><Text style={[styles.resultValue, { color: '#EA580C' }]}>{summary.stats.streak}</Text></View>
            <Text style={styles.statLabel}>{summary.streakIncreased ? 'chuỗi ngày tăng!' : 'ngày liên tiếp'}</Text>
          </View>
        </View>
      </View>

      {/* Banner hết XP free - chặn mở bài mới, kích thích mua gói */}
      {summary.xpCapReached ? (
        <View style={styles.resultCapBanner}>
          <View style={styles.xpCapBannerTop}>
            <Lock size={16} color="#B91C1C" />
            <Text style={styles.xpCapBannerTitle}>Đã dùng hết {DP_PLAN_XP_CAP.free} XP miễn phí hôm nay</Text>
          </View>
          <Text style={styles.xpCapBannerDesc}>
            {'Streak & tiến độ bài cũ vẫn được ghi nhận. Nhưng để '}
            <Text style={styles.xpCapBannerBold}>mở khóa bài tiếp theo</Text>
            {' bạn cần nâng cấp gói (+300 XP/ngày).'}
          </Text>
          <Pressable onPress={onBuyXp} style={styles.xpCapBannerBtn} accessibilityRole="button">
            <Crown size={15} color="#FFFFFF" />
            <Text style={styles.xpCapBannerBtnText}>Nâng cấp gói Google Meet ngay</Text>
          </Pressable>
        </View>
      ) : null}

      {pathResult ? <PathResultCard result={pathResult} /> : null}
      {summary.relatedLesson ? <RelatedLessonCard lesson={summary.relatedLesson} /> : null}

      {summary.review.length ? (
        <View style={styles.reviewAccordionCard}>
          <Pressable
            onPress={() => setShowReview((prev) => !prev)}
            style={({ pressed }) => [styles.reviewToggleBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
            accessibilityState={{ expanded: showReview }}
          >
            <View style={styles.reviewToggleLeft}>
              <View style={styles.reviewToggleIconBox}>
                <Sparkles size={16} color="#D97706" />
              </View>
              <View style={styles.reviewToggleTitleWrap}>
                <Text style={styles.reviewToggleTitle}>Xem lại câu chưa đúng</Text>
                <Text style={styles.reviewToggleSub}>
                  {showReview
                    ? `Đang hiện ${summary.review.length} câu cần ôn lại`
                    : `Bấm để xem lại đáp án (${summary.review.length} câu)`}
                </Text>
              </View>
            </View>
            <View style={styles.reviewToggleAction}>
              <Text style={styles.reviewToggleActionText}>{showReview ? 'Thu gọn' : 'Xem lại'}</Text>
              {showReview ? <ChevronUp size={16} color="#B45309" /> : <ChevronDown size={16} color="#B45309" />}
            </View>
          </Pressable>

          {showReview ? (
            <View style={styles.reviewListBody}>
              {summary.review.map((item, idx) => (
                <View key={item.id || idx} style={styles.reviewItem}>
                  <Text style={styles.reviewPrompt}>{item.prompt}</Text>
                  <Text style={styles.reviewAnswer}>{`✓ ${item.correctAnswer.text}`}</Text>
                  {item.explanation ? <Text style={styles.reviewExplain}>{item.explanation}</Text> : null}
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable onPress={onHome} style={[styles.secondary, styles.flex]} accessibilityRole="button">
          <ArrowLeft size={17} color={colors.ink} />
          <Text style={styles.secondaryText}>{pathResult ? 'Về lộ trình' : 'Chủ đề khác'}</Text>
        </Pressable>
        {canProceedToNext ? (
          <Pressable onPress={() => onNextStep(nextStep)} disabled={starting} style={[styles.primary, styles.flex, starting && styles.disabled]} accessibilityRole="button">
            {starting ? <ActivityIndicator color="#FFFFFF" /> : <Play size={17} color="#FFFFFF" />}
            <Text numberOfLines={1} style={styles.primaryText}>{`Tiếp: ${nextStep.stepLabel}`}</Text>
          </Pressable>
        ) : capReached && nextStep ? (
          /* Có bài tiếp nhưng hết XP - hiện nút mua thay nút tiếp */
          <Pressable onPress={onBuyXp} style={[styles.primary, styles.flex, { backgroundColor: '#7C3AED' } as never]} accessibilityRole="button">
            <Crown size={17} color="#FFFFFF" />
            <Text style={styles.primaryText}>Mua gói để tiếp</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onReplay} disabled={starting} style={[styles.primary, styles.flex, starting && styles.disabled]} accessibilityRole="button">
            <RotateCcw size={17} color="#FFFFFF" />
            <Text style={styles.primaryText}>{pathResult && !pathResult.passed ? 'Làm lại' : 'Ôn lại'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

type PracticePick =
  | { mode: 'free'; topicId: string; difficulty: DpDifficulty }
  | { mode: 'path'; unitId: string; nodeKey: string; step: DpStepKey; testOut: boolean; review?: boolean };

/** Luyện tập hằng ngày kiểu trò chơi - cùng API, luật chơi với web. */
function shuffleList<T>(list: T[]): T[] {
  if (!Array.isArray(list)) return [];
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function DailyPracticeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const route = useRoute<RouteProp<AppStackParamList, 'DailyPractice'>>();
  const linkedTopicId = route.params?.topicId || '';
  const play = useGameSounds();
  const [topics, setTopics] = useState<DpTopic[]>([]);
  const [stats, setStats] = useState<DpStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [session, setSession] = useState<DpSession | null>(null);
  const [summary, setSummary] = useState<DpSummary | null>(null);
  const [celebrating, setCelebrating] = useState(false);
  const [lastPick, setLastPick] = useState<PracticePick | null>(null);
  const [starting, setStarting] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [mode, setMode] = useState<PracticeMode>('path');
  const [pathTopics, setPathTopics] = useState<DpTopicPath[]>([]);
  const [pathActiveTopicId, setPathActiveTopicId] = useState('');
  const [pathLoading, setPathLoading] = useState(true);
  const [pathError, setPathError] = useState('');
  const [stakePrompt, setStakePrompt] = useState<{ unitId: string; nodeKey: string; step: DpStepKey; testOut: boolean; stakeXp: number } | null>(null);
  const [buyXpOpen, setBuyXpOpen] = useState(false);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const load = useCallback(() => {
    setLoading(true);
    dailyPracticeApi.overview()
      .then((data) => { setTopics(data.topics); setStats(data.stats); setError(''); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được luyện tập hằng ngày'))
      .finally(() => setLoading(false));
  }, []);
  const loadPath = useCallback(() => {
    setPathLoading(true);
    dailyPracticeApi.path()
      .then((data) => {
        setPathTopics(data.topics);
        setPathActiveTopicId(String(data.activeTopicId || '').trim());
      })
      .catch((err: unknown) => setPathError(err instanceof Error ? err.message : 'Không tải được lộ trình luyện tập'))
      .finally(() => setPathLoading(false));
  }, []);
  useEffect(() => { load(); loadPath(); }, [load, loadPath]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(DAILY_PRACTICE_STATS_EVENT, (detail?: Partial<DpStats> & { stats?: Partial<DpStats>; xpTotal?: number | null }) => {
      if (!detail) return;
      setStats((prev) => {
        const nextPatch = detail.stats || detail;
        if (!prev) return nextPatch as DpStats;
        return {
          ...prev,
          ...nextPatch,
          xpTotal: typeof detail.xpTotal === 'number' ? detail.xpTotal : (typeof nextPatch.xpTotal === 'number' ? nextPatch.xpTotal : prev.xpTotal),
        };
      });
    });
    return () => sub.remove();
  }, []);

  const begin = async (pick: PracticePick) => {
    setStarting(true);
    setError('');
    setPathError('');
    try {
      const data = pick.mode === 'path'
        ? await dailyPracticeApi.startPath(pick.unitId, pick.step, pick.testOut, pick.nodeKey || '', { review: pick.review })
        : await dailyPracticeApi.start(pick.topicId, pick.difficulty);
      setStakePrompt(null);
      setLastPick(pick);
      setSummary(null);
      setSession({
        ...data,
        questions: shuffleList(data.questions),
      });
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } catch (err) {
      const status = (err as { status?: number })?.status;
      const message = err instanceof Error ? err.message : 'Không bắt đầu được lượt chơi';
      if (status === 402) {
        setStakePrompt(null);
        setBuyXpOpen(true);
        load();
      } else if (pick.mode === 'path') {
        setStakePrompt(null);
        setPathError(message);
        setSummary(null);
        loadPath();
      } else {
        setError(message);
      }
    } finally {
      setStarting(false);
    }
  };
  const start = (topicId: string, difficulty: DpDifficulty) => begin({ mode: 'free', topicId, difficulty });
  const startStep = (unitId: string, nodeKey: string, step: DpStepKey, testOut = false, opts: { review?: boolean } = {}) => {
    if (opts.review) {
      return begin({ mode: 'path', unitId, nodeKey, step, testOut: false, review: true });
    }
    const stakeXp = testOut ? TEST_OUT_XP : SESSION_STAKE_XP;
    setStakePrompt({ unitId, nodeKey: nodeKey || '', step, testOut, stakeXp });
    return undefined;
  };
  const quickStart = (preferredTopic?: DpTopicPath | null) => {
    const remembered = pickActivePathTopic(
      { topics: pathTopics, activeTopicId: pathActiveTopicId },
      linkedTopicId,
      pathActiveTopicId,
    );
    const target = (preferredTopic?.next ? preferredTopic : null)
      || (remembered?.next ? remembered : null)
      || (linkedTopicId ? pathTopics.find((t) => t.topic.id === linkedTopicId && t.next) : null)
      || pathTopics.find((t) => t.next);
    if (target?.next) {
      setMode('path');
      startStep(target.next.unitId, target.next.nodeKey || 'practice-1', target.next.step, false);
      return;
    }
    if (topics[0]) {
      setMode('free');
      void start(topics[0].id, 'easy');
    }
  };
  useEffect(() => {
    if (route.params?.watch === 'stage') {
      setMode('path');
      navigation.setParams({ watch: undefined } as never);
    }
  }, [route.params?.watch, navigation]);

  useEffect(() => {
    if (route.params?.practice === 'stage') {
      setMode('path');
      navigation.setParams({ practice: undefined } as never);
    }
  }, [route.params?.practice, navigation]);

  const goHome = () => {
    setCelebrating(false);
    setSummary(null);
    setPathError('');
    load();
    loadPath();
  };

  const handleFinishContinue = () => {
    const pathResult = summary?.path;
    if (pathResult?.passed && pathResult.next) {
      setCelebrating(false);
      setSummary(null);
      startStep(pathResult.next.unitId, pathResult.next.nodeKey || 'study', pathResult.next.step);
      return;
    }
    goHome();
  };

  const handleFinishReplay = () => {
    if (lastPick) {
      setCelebrating(false);
      setSummary(null);
      void begin(lastPick);
    }
  };

  const handleFinishRelatedVideo = () => {
    const lesson = summary?.relatedLesson;
    if (!lesson) return;
    navigation.navigate('MainTabs', {
      screen: 'CourseVideos',
      params: {
        resumeKey: Date.now(),
        resumeSubjectId: lesson.subjectId,
        resumeCourseId: lesson.courseId,
        resumeUnitId: lesson.unitId,
        resumeSectionId: lesson.sectionId,
      },
    });
  };
  const goToBuyXp = () => {
    setBuyXpOpen(true);
  };

  return (
    <AppScreen scroll={false} hideBrandingTopBar={Boolean(session)}>
      <ChromeScrollView
        ref={scrollRef}
        scrollEnabled={scrollEnabled}
        showsVerticalScrollIndicator={mode !== 'path'}
        contentContainerStyle={styles.screen}
        style={mode === 'path' ? { scrollbarWidth: 'none' } : undefined}
        keyboardShouldPersistTaps="handled"
      >
        {session ? (
          <PlayView
            session={session}
            play={play}
            stats={stats}
            onQuit={() => { setSession(null); load(); loadPath(); }}
            onDraggingChange={(dragging) => setScrollEnabled(!dragging)}
            onFinished={(data) => {
              setSession(null);
              setSummary(data);
              setCelebrating(true);
              setStats((prev) => (prev ? { ...prev, ...data.stats } : data.stats));
              DeviceEventEmitter.emit(LEARNING_GOAL_CHANGED_EVENT, null);
              scrollRef.current?.scrollTo({ y: 0, animated: false });
            }}
          />
        ) : (
          <HomeView
            key={`${linkedTopicId}-${route.params?.watch || ''}`}
            topics={topics}
            stats={stats}
            loading={loading}
            error={error}
            starting={starting}
            onStart={(t, d) => { void start(t, d); }}
            play={play}
            initialTopicId={linkedTopicId}
            mode={mode}
            onModeChange={setMode}
            pathTopics={pathTopics}
            pathLoading={pathLoading}
            pathError={pathError}
            onStartStep={(unitId, nodeKey, step, testOut, opts) => { startStep(unitId, nodeKey, step, testOut, opts); }}
            onQuickStart={quickStart}
            onPathChanged={() => { load(); loadPath(); }}
            onBuyXp={goToBuyXp}
            initialWatchStage={route.params?.watch === 'stage'}
            pathActiveTopicId={pathActiveTopicId}
          />
        )}
      </ChromeScrollView>
      {summary && celebrating ? (
        <PracticeFinishOverlay
          visible
          summary={summary}
          play={play}
          onDismiss={goHome}
          onContinue={handleFinishContinue}
          onReplay={lastPick ? handleFinishReplay : undefined}
          onRelatedVideo={handleFinishRelatedVideo}
        />
      ) : null}
      {stakePrompt ? (
        <StakeSessionConfirm
          stakeXp={stakePrompt.stakeXp}
          xpTotal={stats?.xpTotal || 0}
          testOut={stakePrompt.testOut}
          busy={starting}
          play={play}
          onCancel={() => { if (!starting) setStakePrompt(null); }}
          onConfirm={() => {
            void begin({
              mode: 'path',
              unitId: stakePrompt.unitId,
              nodeKey: stakePrompt.nodeKey,
              step: stakePrompt.step,
              testOut: stakePrompt.testOut,
            });
          }}
          onBuyXp={() => {
            setStakePrompt(null);
            setBuyXpOpen(true);
          }}
        />
      ) : null}
      {buyXpOpen ? (
        <BuyXpModal
          packs={stats?.xpPacks}
          play={play}
          onClose={() => setBuyXpOpen(false)}
          onPurchased={() => { load(); loadPath(); }}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  screen: { padding: spacing.lg, paddingBottom: 120 },
  relatedCard: { gap: spacing.md, padding: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.brandSoft },
  relatedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  relatedIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  relatedEyebrow: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  relatedTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  gapMd: { gap: spacing.md },
  gapLg: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: '400' },
  socialInline: { color: '#059669', fontWeight: '600' },
  error: { color: '#92400E', backgroundColor: '#FFFBEB', padding: 12, borderRadius: 12, fontSize: 13, fontWeight: '600' },
  errorInline: { color: '#DC2626', fontSize: 13, fontWeight: '600', marginTop: 8 },
  hero: {
    padding: spacing.lg, borderRadius: 26, borderWidth: 1, borderColor: colors.line, gap: spacing.md, backgroundColor: colors.brandSoft,
    backgroundImage: 'linear-gradient(135deg, #ECFDF5 0%, #FFFFFF 50%, #F0FDF4 100%)',
  } as never,
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  heroTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.85)' },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: '400' },
  empty: { alignItems: 'center', gap: 6, padding: spacing.xl, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  topic: { width: '48%', flexGrow: 1, padding: 12, borderRadius: 18, borderWidth: 1.5, gap: 4 },
  topicIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  topicName: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  topicDesc: { color: colors.muted, fontSize: 13, fontWeight: '400' },
  topicCheck: { position: 'absolute', top: 10, right: 10 },
  level: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 1.5, gap: 2 },
  starsRow: { flexDirection: 'row', gap: 2 },
  levelLabel: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  levelMeta: { color: '#64748B', fontSize: 12, fontWeight: '400' },
  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, paddingHorizontal: 18, borderRadius: 14,
    backgroundColor: colors.brand, backgroundImage: 'linear-gradient(180deg, #10B981 0%, #059669 55%, #047857 100%)',
    boxShadow: '0px 6px 14px rgba(4, 120, 87, 0.28)',
  } as never,
  primaryBig: { minHeight: 52 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  secondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, paddingHorizontal: 14, borderRadius: 14,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.55 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
  },
  quitBtnText: { color: '#475569', fontSize: 13, fontWeight: '800' },
  quitBackdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  quitCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 12,
  },
  quitHero: {
    alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg, gap: 6, backgroundColor: '#F0F9FF',
    backgroundImage: 'linear-gradient(135deg, #F0F9FF 0%, #FFFFFF 50%, #F1F5F9 100%)',
  } as never,
  quitTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  quitText: { color: '#475569', fontSize: 14, lineHeight: 20, textAlign: 'center', fontWeight: '400' },
  quitProgress: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB',
  },
  quitProgressText: { color: '#B45309', fontSize: 12, fontWeight: '600' },
  quitActions: { gap: spacing.sm, padding: spacing.lg },
  progressTrack: { flex: 1, height: 14, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#10B981' },
  xpPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  xpText: { color: '#B45309', fontSize: 13, fontWeight: '600' },
  card: { padding: spacing.lg, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, gap: 10 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badgeDark: { color: '#FFFFFF', backgroundColor: '#0F172A', fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  badge: { fontSize: 12, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  promptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  promptRowHintPad: { paddingRight: 88 },
  prompt: { color: colors.ink, fontSize: 16, fontWeight: '600', lineHeight: 24 },
  instruction: { color: '#64748B', fontSize: 13, fontWeight: '400', marginTop: 2 },
  image: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#F8FAFC' },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: PLAY_QUESTION_CHROME.hintRevealBox.backgroundColor,
    borderWidth: 1,
    borderColor: PLAY_QUESTION_CHROME.hintRevealBox.borderColor,
  },
  hintText: {
    flex: 1,
    color: PLAY_QUESTION_CHROME.hintRevealBox.color,
    fontSize: PLAY_QUESTION_CHROME.hintRevealBox.fontSize,
    fontWeight: PLAY_QUESTION_CHROME.hintRevealBox.fontWeight,
    lineHeight: 20,
  },
  hintRevealWrap: { marginTop: 12, gap: 6 },
  hintChargeLine: { color: '#B45309', fontSize: 12, fontWeight: '600', paddingHorizontal: 4 },
  xpHintSpend: { color: '#DC2626', fontSize: 10, fontWeight: '800', marginTop: 2 },
  answerArea: { marginTop: 2, width: '100%' },
  feedback: {
    padding: spacing.lg,
    borderRadius: 24,
    gap: spacing.md,
    borderWidth: 1.5,
    marginTop: spacing.sm,
  },
  feedbackOk: {
    backgroundColor: '#D1FAE5',
    borderColor: '#6EE7B7',
  },
  feedbackBad: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  feedbackRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  feedbackTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  feedbackTitle: { fontSize: 16, fontWeight: '700' },
  feedbackXp: { color: '#D97706', fontSize: 14, fontWeight: '600' },
  feedbackAnswer: { color: '#334155', fontSize: 14, fontWeight: '600', marginTop: 2 },
  feedbackExplain: { color: '#475569', fontSize: 13, marginTop: 4, lineHeight: 19, fontWeight: '400' },
  confettiLayer: { position: 'absolute', left: '50%', top: '40%', width: 0, height: 0, zIndex: 20 },
  confetti: { position: 'absolute', width: 8, height: 12, borderRadius: 2 },
  resultCard: { alignItems: 'center', padding: spacing.xl, borderRadius: 26, borderWidth: 1, gap: 6, overflow: 'hidden' },
  resultGood: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  resultSoft: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  starsBig: { flexDirection: 'row', gap: 8, marginTop: 4 },
  resultTitle: { color: colors.ink, fontSize: 20, fontWeight: '700', marginTop: 6 },
  resultStats: { flexDirection: 'row', gap: 8, marginTop: spacing.md, alignSelf: 'stretch' },
  resultStat: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 14, backgroundColor: '#FFFFFF' },
  resultValue: { fontSize: 20, fontWeight: '700' },
  reviewAccordionCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  reviewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#FFFBEB',
    gap: 10,
  },
  reviewToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  reviewToggleIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reviewToggleTitleWrap: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reviewToggleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
  },
  reviewToggleSub: {
    fontSize: 12,
    fontWeight: '400',
    color: '#B45309',
  },
  reviewToggleAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FDE68A',
    flexShrink: 0,
  },
  reviewToggleActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B45309',
  },
  reviewListBody: {
    padding: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#FEEBC8',
    backgroundColor: '#FFFCF7',
  },
  reviewItem: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 3,
  },
  reviewPrompt: { color: colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 19 },
  reviewAnswer: { color: '#047857', fontSize: 13, fontWeight: '600', lineHeight: 18 },
  reviewExplain: { color: colors.muted, fontSize: 12, fontWeight: '400', lineHeight: 17 },
  modeTabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
  },
  modeTabActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  modeTabText: { color: '#64748B', fontSize: 13, fontWeight: '700' },
  modeTabTextActive: { color: '#047857', fontWeight: '800' },
  practicePanel: {
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
    marginBottom: 4,
  },
  chipScroller: { flexGrow: 0, minHeight: 58, marginHorizontal: -2 },
  chipRow: { gap: 8, paddingRight: spacing.sm, alignItems: 'center' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
    maxWidth: 220,
  },
  chipName: { color: colors.ink, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  chipIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chipMeta: { color: colors.muted, fontSize: 12, fontWeight: '400' },
  pathEyebrow: { fontSize: 12, fontWeight: '600' },
  pathTrack: { flex: 1, height: 12, borderRadius: 999, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  pathFill: { height: '100%', borderRadius: 999 },
  pathCount: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  pathTimeline: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FAFBFC',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  pathTimelineWrap: {
    position: 'relative',
    backgroundColor: '#ECFDF5',
    borderRadius: 0,
    borderWidth: 0,
    overflow: 'visible',
    marginBottom: spacing.sm,
    marginHorizontal: -spacing.md,
    width: undefined,
    alignSelf: 'stretch',
  },
  pathSummaryCard: { position: 'relative', overflow: 'hidden', paddingRight: 56 },
  pathSummaryMascot: { position: 'absolute', right: 4, top: 8 },
  pathUnitRow: {
    position: 'relative',
    alignItems: 'center',
    minHeight: undefined,
    paddingHorizontal: 0,
    paddingVertical: spacing.sm,
    gap: 6,
    zIndex: 2,
    overflow: 'visible',
  },
  pathUnitRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  unitStageCenter: { alignItems: 'center', width: '100%', maxWidth: 360, gap: 6 },
  unitStageHeader: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  unitStageNum: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  unitStageNumText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  unitStageCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(15,23,42,0.06)',
  },
  unitStageMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 6 },
  unitStageEyebrow: { color: '#64748B', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  unitStagePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  unitStagePillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  unitStageActivePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: '#FBBF24' },
  unitStageActivePillText: { color: '#78350F', fontSize: 11, fontWeight: '600' },
  unitStageTitleCenter: { color: colors.ink, fontSize: 16, fontWeight: '600', textAlign: 'center', maxWidth: 280 },
  unitStageDescCenter: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 300, fontWeight: '400' },
  unitStageProgressRowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, width: '100%', maxWidth: 260 },
  unitStageTitle: { color: colors.ink, fontSize: 16, fontWeight: '600', marginTop: 2 },
  unitStageDesc: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 2, fontWeight: '400' },
  unitStageProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  unitStageTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  unitStageFill: { height: '100%', borderRadius: 999 },
  unitStageCount: { color: '#64748B', fontSize: 12, fontWeight: '600' },
  unitStageActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 },
  unitStageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  unitStageBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  unitStageTestOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#1E293B',
  },
  unitStageTestOutText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  nodeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingVertical: 4, paddingRight: spacing.md },
  nodeRowItem: { flexDirection: 'row', alignItems: 'flex-end' },
  nodeRowDash: { width: 14, height: 3, borderRadius: 999, marginBottom: 28, marginHorizontal: 2 },
  nodeSnakeWrap: { alignSelf: 'stretch', width: '100%', maxWidth: '100%', paddingHorizontal: 6, position: 'relative', marginTop: 8, overflow: 'visible' },
  pathMascotSide: { position: 'absolute', top: 12, zIndex: 0, opacity: 0.95 },
  unitBanner: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    borderRadius: 22,
    overflow: 'visible',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg + 4,
  },
  unitBannerShine: {
    position: 'absolute',
    top: 0,
    left: spacing.lg,
    right: spacing.lg,
    height: '50%',
    borderBottomLeftRadius: 999,
    borderBottomRightRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  unitBannerBody: { alignItems: 'center', gap: 4, zIndex: 1 },
  unitBannerChip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  unitBannerMiniBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)' },
  unitBannerMiniBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  unitBannerNotch: {
    position: 'absolute',
    bottom: -10,
    alignSelf: 'center',
    width: 22,
    height: 22,
    borderRadius: 4,
    transform: [{ rotate: '45deg' }],
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  unitEyebrow: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  unitTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  unitDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19, textAlign: 'center', fontWeight: '400' },
  unitProgressText: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500', marginTop: 2 },
  unitActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 10 },
  unitVideoChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  unitBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  unitTestOut: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#FFFFFF' },
  unitTestOutText: { color: '#334155', fontSize: 12, fontWeight: '600' },
  nodeColumn: { alignItems: 'center', alignSelf: 'center', gap: 0, paddingVertical: spacing.xs, zIndex: 1 },
  nodeSlot: { alignItems: 'center', gap: spacing.sm },
  connector: { position: 'absolute', top: -24, left: '50%', width: 0, height: 0 },
  connectorDot: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  connectorDroplet: { position: 'absolute' },
  unitSection: { gap: spacing.lg, padding: 8, paddingBottom: spacing.lg, borderRadius: 26, borderWidth: 1, overflow: 'hidden' },
  decorBubble: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  decorBubbleSmall: { width: 70, height: 70, borderRadius: 35 },
  decorIcon: { position: 'absolute', bottom: 18, opacity: 0.08 },
  decorSparkle: { position: 'absolute', opacity: 0.6 },
  mascotShadow: { position: 'absolute', bottom: -2, alignSelf: 'center', width: 64, height: 12, borderRadius: 999 },
  unitLockChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.2)' },
  unitLockText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  nodeWrap: { alignItems: 'center' },
  hubRoot: { position: 'relative', overflow: 'visible', alignItems: 'center', justifyContent: 'center' },
  hubRootColumn: { flexDirection: 'column', width: 'auto' },
  pathNodeLabelBelow: {
    marginTop: 6,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
    maxWidth: 120,
    paddingHorizontal: 4,
  },
  pathNodeLabelCurrentText: { fontWeight: '800', color: '#334155' },
  pathNodeLabelPill: {
    position: 'absolute',
    top: '50%',
    marginTop: -11,
    zIndex: 0,
    maxWidth: 112,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: 'rgba(255,255,255,0.96)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
  pathNodeLabelRight: { left: '100%', marginLeft: 14 },
  pathNodeLabelLeft: { right: '100%', marginRight: 14 },
  pathNodeLabelDone: { borderColor: '#A7F3D0' },
  pathNodeLabelLocked: { borderColor: '#E2E8F0' },
  pathNodeLabelText: { fontSize: 12, fontWeight: '700', color: '#334155', lineHeight: 16 },
  pathNodeLabelCurrent: {
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 2,
  },
  pathUnitFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 6,
    zIndex: 2,
  },
  pathStartBubbleMap: {
    position: 'absolute',
    bottom: '100%',
    marginBottom: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E2D5',
    backgroundColor: '#FFFFFF',
    zIndex: 5,
  },
  pathStartBubble: {
    marginBottom: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBECE0',
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  pathStartBubbleText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#079D68',
  },
  node: { alignItems: 'center', justifyContent: 'center' },
  nodeCrown: { position: 'absolute', top: -8 },
  nodeCrownRight: { right: -2 },
  nodeCrownLeft: { left: -2 },
  pathHubLockBadge: {
    position: 'absolute',
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#CBD5E1',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  videoWatchedBadge: {
    position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFFFFF',
  },
  videoLabel: { maxWidth: 150, textAlign: 'center' },
  ring: { position: 'absolute', left: 0, top: 0 },
  pathMascot: { position: 'absolute' },
  popover: { width: 270, padding: spacing.md, borderRadius: 18, gap: 2, marginTop: 6 },
  popoverArrow: { position: 'absolute', top: -7, left: 127, width: 16, height: 16, transform: [{ rotate: '45deg' }] },
  popoverClose: { position: 'absolute', top: 12, right: 12, padding: 6, zIndex: 10 },
  popoverTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  popoverMeta: { color: 'rgba(255,255,255,0.92)', fontSize: 13, fontWeight: '600', marginBottom: 2 },
  popoverHint: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2, fontWeight: '400' },
  popoverButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginTop: 10, borderRadius: 12, backgroundColor: '#FFFFFF',
  },
  popoverButtonText: { fontSize: 14, fontWeight: '700' },
  hubModalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: spacing.lg,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 10,
  },
  hubPopover: { width: '100%', maxWidth: 340, alignSelf: 'center', gap: 8 },
  hubLevelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, paddingHorizontal: 12, paddingVertical: 11, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.12)',
  },
  hubLevelRowLocked: { opacity: 0.6, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.12)' },
  hubLevelIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  hubLevelTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  hubLevelHint: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 1, fontWeight: '400' },
  hubLevelXp: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '500', marginTop: 2 },
  hubLevelBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FFFFFF', minWidth: 64, alignItems: 'center', justifyContent: 'center' },
  hubLevelBtnText: { color: '#0F172A', fontSize: 13, fontWeight: '700' },
  comboChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F97316' },
  comboText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  nodeBubble: {
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  pathNudgeBubble: {
    position: 'absolute',
    top: -34,
    left: 0,
    right: 0,
    alignSelf: 'center',
    zIndex: 30,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBECE0',
    shadowColor: '#079D68',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  pathNudgeBubbleText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  nodeLabel: { marginTop: 8, color: '#334155', fontSize: 13, fontWeight: '600' },
  unitChestWrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  unitChestBox: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  unitChestBoxPending: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  unitChestBoxDone: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  unitChestIconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitChestIconPending: {
    backgroundColor: '#E2E8F0',
  },
  unitChestIconDone: {
    backgroundColor: '#F59E0B',
  },
  unitChestTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  unitChestTitleDone: {
    color: '#92400E',
  },
  unitChestSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  unitChestBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pathResult: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 22, borderWidth: 1 },
  pathResultOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  pathResultBad: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  pathResultIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pathResultTitle: { fontSize: 14, fontWeight: '600' },
  xpCapWrap: { gap: 6, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FDE68A' },
  xpCapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  xpCapLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  xpCapLabel: { color: '#B45309', fontSize: 12, fontWeight: '600' },
  xpCapLabelFull: { color: '#DC2626' },
  xpCapPct: { color: '#B45309', fontSize: 12, fontWeight: '600' },
  xpCapTrack: { height: 8, borderRadius: 999, backgroundColor: '#FEF3C7', overflow: 'hidden' },
  xpCapFill: { height: '100%', borderRadius: 999 },
  xpCapHint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  xpCapHintBold: { color: '#B45309', fontWeight: '600' },
  xpCapBanner: {
    padding: spacing.md, borderRadius: 20, borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FEF2F2', gap: 10,
  },
  xpCapBannerTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  xpCapBannerTitle: { color: '#991B1B', fontSize: 15, fontWeight: '700' },
  xpCapBannerDesc: { color: '#475569', fontSize: 13, lineHeight: 18 },
  xpCapBannerBold: { color: '#991B1B', fontWeight: '600' },
  xpCapBannerPlans: { gap: 6, paddingVertical: 4 },
  xpCapPlanRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  xpCapPlanText: { color: '#334155', fontSize: 13 },
  xpCapPlanBold: { color: '#0F172A', fontWeight: '600' },
  xpCapPlanBadge: { color: '#059669', fontWeight: '600', fontSize: 12 },
  xpCapBannerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44,
    borderRadius: 12, backgroundColor: '#DC2626',
  },
  xpCapBannerBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  resultCapBanner: {
    padding: spacing.md, borderRadius: 18, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', gap: 8,
  },
  quickStatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickStatCard: {
    flexBasis: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10,
    borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
  },
  quickStatValue: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  quickBuyBtn: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FFFBEB',
    borderWidth: 1, borderColor: '#FDE68A',
  },
  quickBuyBtnText: { color: '#B45309', fontSize: 11, fontWeight: '600' },
  lessonModalHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.lg },
  lessonModalEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
  lessonModalTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', marginTop: 2 },
  lessonModalClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  lessonVideoCallout: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  lessonVideoCalloutTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  lessonBodyBox: { gap: 8, padding: 14, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  lessonBodyText: { color: '#334155', fontSize: 14, lineHeight: 21 },
  lessonCheckCard: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  lessonCheckPrompt: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  lessonCheckOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  lessonCheckOptLetter: {
    width: 24, height: 24, borderRadius: 8, textAlign: 'center', lineHeight: 24,
    backgroundColor: '#E2E8F0', color: '#334155', fontSize: 12, fontWeight: '600', overflow: 'hidden',
  },
  lessonCheckOptText: { color: colors.ink, fontSize: 14, fontWeight: '500' },
  lessonVideoFrameWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    position: 'relative',
  },
  videoGateOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    zIndex: 40,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  videoGateCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '94%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 12,
    gap: 8,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  videoGateTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  videoGateTime: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '600',
  },
  videoGateCloseBtn: {
    padding: 4,
  },
  videoGateMissedBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  videoGateMissedText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
  },
  videoGatePrompt: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  videoGateChoiceBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  videoGateChoiceBtnActive: {
    backgroundColor: '#0284C7',
  },
  videoGateChoiceText: {
    color: '#1E293B',
    fontSize: 13,
    fontWeight: '600',
  },
  videoGateChoiceTextActive: {
    color: '#FFFFFF',
  },
  videoGateTextInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 7,
    fontSize: 13,
    color: '#0F172A',
  },
  videoGateHintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  videoGateHintText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    fontWeight: '400',
  },
  videoGateErrorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '500',
  },
  videoGateActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  videoGateSubmitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#059669',
  },
  videoGateSubmitBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  videoGateCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  videoGateCancelBtnText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500',
  },
  videoGateHintBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#0F172A',
  },
  videoGateHintBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  videoGateScreenPickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  videoGateScreenPickText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '600',
  },
  videoGateUploadProgress: {
    gap: 6,
    marginVertical: 6,
  },
  videoGateUploadTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  videoGateUploadFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#0284C7',
  },
  videoGateUploadText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
  videoGateFootNote: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '400',
  },
  lessonPendingNote: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: -2,
  },
  lessonModalFoot: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  lessonFootCloseBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  lessonFootCloseBtnText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '600',
  },
  lessonFootDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#EF4444',
  },
  lessonFootDoneBtnDone: {
    backgroundColor: '#F87171',
  },
  lessonFootDoneBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  finaleLockedCard: {
    alignItems: 'center', gap: 6, padding: spacing.lg, borderRadius: 24, borderWidth: 2, borderStyle: 'dashed',
    borderColor: '#FDE68A', backgroundColor: '#FFFBEB',
  },
  finaleLockedCup: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FDE68A',
  },
  finaleLockedEyebrow: { color: '#D97706', fontSize: 11, fontWeight: '600' },
  finaleLockedTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  finaleGhost: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -4,
    marginBottom: 10,
    paddingVertical: 2,
  },
  finaleCupStage: {
    width: 230,
    height: 250,
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'visible',
  },
  finaleDoneCard: {
    alignItems: 'center', gap: 10, padding: spacing.xl, borderRadius: 28, borderWidth: 2, borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB', overflow: 'hidden',
    backgroundImage: 'linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 50%, #FEF3C7 100%)',
  } as never,
  finaleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 5,
    borderRadius: 999, backgroundColor: '#D97706',
  },
  finaleBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
  finaleStageRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 14, marginVertical: 6 },
  finaleCupWrap: { alignItems: 'center' },
  finaleCrownBadge: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EA580C', borderWidth: 2, borderColor: '#FFFFFF', marginBottom: -10, zIndex: 2,
  },
  finaleCupCircle: {
    width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F59E0B', borderWidth: 4, borderColor: '#FEF3C7',
    boxShadow: '0px 10px 24px rgba(217, 119, 6, 0.35)',
  } as never,
  finaleCupCircleSmall: {
    width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F59E0B', borderWidth: 2, borderColor: '#FEF3C7',
  },
  finaleStarsRow: {
    flexDirection: 'row', gap: 3, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FDE68A', marginTop: -10,
  },
  finaleDoneTitle: { color: colors.ink, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  finaleDoneSub: { color: '#475569', fontSize: 13, lineHeight: 19, textAlign: 'center', maxWidth: 380, fontWeight: '400' },
  finaleBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, paddingHorizontal: 22,
    borderRadius: 16, backgroundColor: '#D97706', marginTop: 4,
    backgroundImage: 'linear-gradient(180deg, #F59E0B 0%, #D97706 55%, #B45309 100%)',
  } as never,
  finaleBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  finaleModalCard: {
    maxWidth: 460, padding: spacing.xl, alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB',
    borderWidth: 2, borderColor: '#FCD34D',
  },
  finaleModalTopic: { color: '#B45309', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  finaleStatsRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginVertical: 4 },
  finaleStatBox: {
    flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: '#FDE68A',
  },
  finaleStatVal: { color: '#B45309', fontSize: 15, fontWeight: '700' },
  finaleStatLbl: { color: '#64748B', fontSize: 11, fontWeight: '500', marginTop: 2 },
  pathTrophyResult: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg, borderRadius: 24,
    borderWidth: 2, borderColor: '#FCD34D', backgroundColor: '#FFFBEB',
  },
  pathTrophyEyebrow: { color: '#B45309', fontSize: 11, fontWeight: '600' },
  pathTrophyTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginTop: 2 },
  buyXpHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing.lg,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  buyXpIconWrap: {
    width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
  },
  buyXpTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  buyXpTransferBox: {
    alignSelf: 'stretch', padding: 12, borderRadius: 14, backgroundColor: '#FFFBEB',
    borderWidth: 1, borderColor: '#FDE68A', gap: 4, alignItems: 'center',
  },
  buyXpTransferLine: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  buyXpCode: { color: '#B45309', fontSize: 13, fontWeight: '600', marginTop: 2 },
  buyXpPackCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
  },
  buyXpPackCardActive: {
    borderColor: '#F59E0B', backgroundColor: '#FFFBEB',
  },
  buyXpPackBolt: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buyXpPackTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  buyXpPackPrice: { color: colors.brand, fontSize: 15, fontWeight: '900' },
  stakeGrid2Col: { flexDirection: 'row', gap: 8, alignSelf: 'stretch', marginTop: 8 },
  stakeColBox: {
    flex: 1, padding: 12, borderRadius: 16, backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', gap: 3,
  },
  stakeColValue: { color: colors.ink, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  playWrap: { gap: 10, paddingTop: 12, paddingBottom: 92, maxWidth: 760, width: '100%', alignSelf: 'center' },
  topBarCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  topBarMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  topBarStepTitle: { flex: 1, color: '#64748B', fontSize: 12, fontWeight: '700', marginRight: 8 },
  topBarCount: { color: '#0F172A', fontSize: 12, fontWeight: '800' },
  playProgressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  xpSubText: { color: '#B45309', fontSize: 11, fontWeight: '500' },
  playQuestionCard: {
    position: 'relative',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  hintCornerBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PLAY_QUESTION_CHROME.hintButton.borderColor,
    backgroundColor: PLAY_QUESTION_CHROME.hintButton.backgroundColor,
  },
  hintCornerBtnText: {
    color: PLAY_QUESTION_CHROME.hintButton.color,
    fontSize: PLAY_QUESTION_CHROME.hintButton.fontSize,
    fontWeight: PLAY_QUESTION_CHROME.hintButton.fontWeight,
    maxWidth: 120,
  },
  playMetaChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  playMetaChip: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
    maxWidth: '72%',
  },
  promptMascotBox: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: PLAY_QUESTION_CHROME.mascotWrap.backgroundColor,
    borderWidth: 1,
    borderColor: PLAY_QUESTION_CHROME.mascotWrap.borderColor,
  },
  playPrompt: {
    color: PLAY_QUESTION_CHROME.prompt.color,
    fontSize: PLAY_QUESTION_CHROME.prompt.fontSize,
    fontWeight: PLAY_QUESTION_CHROME.prompt.fontWeight,
    lineHeight: PLAY_QUESTION_CHROME.prompt.lineHeight,
    flexShrink: 1,
    marginTop: 4,
  },
  questionMetaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  questionEyebrow: {
    fontSize: PLAY_QUESTION_CHROME.eyebrow.fontSize,
    fontWeight: PLAY_QUESTION_CHROME.eyebrow.fontWeight,
    color: PLAY_QUESTION_CHROME.eyebrow.color,
  },
  questionMetaSep: { color: '#CBD5E1', fontSize: 12, fontWeight: '400' },
  playTypeChip: {
    fontSize: PLAY_QUESTION_CHROME.typeChip.fontSize,
    fontWeight: PLAY_QUESTION_CHROME.typeChip.fontWeight,
    color: PLAY_QUESTION_CHROME.typeChip.color,
    flexShrink: 1,
    maxWidth: '70%',
  },
  playCardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    paddingTop: 10, marginTop: 2, borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  playCardFooterTight: {
    paddingTop: 8,
    marginTop: 0,
  },
  playCardFooterExplainOnly: {
    justifyContent: 'flex-start',
  },
  explainFooterBtn: {
    borderColor: PLAY_QUESTION_CHROME.hintButton.borderColor,
    backgroundColor: PLAY_QUESTION_CHROME.hintButton.backgroundColor,
  },
  explainFooterBtnText: {
    color: PLAY_QUESTION_CHROME.hintButton.color,
    fontSize: PLAY_QUESTION_CHROME.hintButton.fontSize,
    fontWeight: PLAY_QUESTION_CHROME.hintButton.fontWeight,
  },
  hintFooterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 14, borderWidth: 1.5, borderColor: '#FDE68A', backgroundColor: '#FFFBEB',
  },
  hintFooterBtnNudge: {
    borderColor: '#F59E0B',
    borderWidth: 2,
    backgroundColor: '#FEF3C7',
    shadowColor: '#F59E0B',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  hintFooterBtnText: { color: '#B45309', fontSize: 13, fontWeight: '800' },
  selectAnswerHint: { color: '#94A3B8', fontSize: 13, fontWeight: '400' },
  pageEyebrow: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  topGamifiedBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
    marginBottom: 2,
  },
  topTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  topPageTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  topBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FED7AA',
  },
  streakBadgeText: {
    color: '#C2410C',
    fontSize: 12,
    fontWeight: '900',
  },
  xpBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  xpBadgeText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '900',
  },
  mascotMotivationCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  mascotWrapCompact: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    backgroundColor: '#ECFDF5',
    flexShrink: 0,
  },
  mascotContent: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  mascotHeadline: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.ink,
    lineHeight: 20,
  },
  mascotSub: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  mascotProgressTrack: {
    height: 4,
    borderRadius: 999,
    backgroundColor: '#E2F1EB',
    marginTop: 4,
    overflow: 'hidden',
  },
  mascotProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.brand,
  },
  xpEmptyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: colors.brandSoft,
    borderWidth: 1,
    borderColor: colors.line,
  },
  xpEmptyIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  xpEmptyTitle: { color: colors.brandDark, fontSize: 14, fontWeight: '600' },
  xpEmptyDesc: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  xpEmptyBuyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, backgroundColor: colors.brand,
  },
  xpEmptyBuyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  goalCard: {
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  goalHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalIconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  goalCardTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  goalCardSub: { color: colors.muted, fontSize: 13, fontWeight: '500' },
  goalBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  goalBadgeText: { fontSize: 12, fontWeight: '700' },
  goalInfoBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  goalInfoTitle: { fontSize: 13, fontWeight: '700' },
  goalInfoSub: { fontSize: 12, marginTop: 1, lineHeight: 18 },
  goalLabelSmall: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  goalValueSmall: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  goalTargetBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  goalTargetBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  goalTargetBtnText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  goalFooterBox: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  goalFooterText: { color: '#64748B', fontSize: 13, fontWeight: '500' },
  questItemBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, borderRadius: 12, borderWidth: 1 },
  questCheckCircle: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  questItemTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  questItemDesc: { color: colors.muted, fontSize: 13 },
  questItemTag: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  weekCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  freeModeNotice: {
    padding: 10, borderRadius: 14, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE',
  },
  freeModeNoticeBold: { color: '#1E40AF', fontSize: 13, fontWeight: '600' },
  freeModeNoticeText: { color: '#1E3A8A', fontSize: 13, lineHeight: 18 },
  unitHeaderOuter: { width: '100%', maxWidth: 440, alignSelf: 'center', marginBottom: 12 },
  unitHeaderBanner: {
    flexDirection: 'row', alignItems: 'stretch', borderRadius: 18, overflow: 'hidden',
  },
  unitHeaderLeft: { flex: 1, padding: 14, gap: 3 },
  unitHeaderEyebrow: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600', textTransform: 'uppercase' },
  unitHeaderTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  unitHeaderDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 },
  unitHeaderProgressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  unitHeaderProgressTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  unitHeaderProgressFill: { height: '100%', borderRadius: 999, backgroundColor: '#FFFFFF' },
  unitHeaderProgressCount: { color: 'rgba(255,255,255,0.95)', fontSize: 12, fontWeight: '600' },
  unitHeaderRight: {
    width: 92,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  unitHeaderCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    width: '100%',
  },
  unitHeaderCtaText: { color: '#047857', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  unitHeaderGuideBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  unitHeaderGuideBtnLit: {
    backgroundColor: '#FDE047',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.92)',
    boxShadow: '0px 0px 14px rgba(254,240,138,0.95)',
  },
  roadmapBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  roadmapSheet: {
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  roadmapHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  roadmapHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  roadmapEyebrow: { fontSize: 10, fontWeight: '800', color: 'rgba(255,255,255,0.88)', textTransform: 'uppercase' },
  roadmapTitle: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  roadmapSub: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  roadmapClose: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  roadmapScroll: { maxHeight: 420 },
  roadmapScrollInner: { paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  roadmapRow: { flexDirection: 'row', gap: 12, paddingVertical: 4 },
  roadmapNodeCol: { alignItems: 'center', width: 48 },
  roadmapNodeBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roadmapNodeLocked: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  roadmapNodeDone: { backgroundColor: '#10B981', borderColor: '#34D399' },
  roadmapNodeActive: { borderColor: '#FCD34D', backgroundColor: '#FFFBEB', boxShadow: '0px 0px 12px rgba(251,191,36,0.55)' },
  roadmapNodeIndex: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '900',
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  roadmapNodeTitle: { fontSize: 15, fontWeight: '900', color: '#0F172A', flexShrink: 1 },
  roadmapStatusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  roadmapStatusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  roadmapLevelLine: { fontSize: 11, fontWeight: '600', color: '#64748B', marginTop: 2 },
  roadmapHint: { fontSize: 11, fontWeight: '600', color: '#94A3B8', marginTop: 4 },
  roadmapGoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  roadmapGoText: { fontSize: 11, fontWeight: '800', color: '#047857' },
  roadmapVideoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  roadmapVideoBtnText: { fontSize: 14, fontWeight: '800', color: '#334155' },
  missionRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  missionSquareIcon: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionCircleIcon: {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionCheckBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#10B981',
  },
  missionRowTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  missionRowSub: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  missionRowTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  missionRowFill: {
    height: '100%',
    borderRadius: 999,
  },
  missionFooterText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  pathSummaryTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
}));
