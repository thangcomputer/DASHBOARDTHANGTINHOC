import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, DeviceEventEmitter, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import {
  ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Code2, Cpu, Crown, Dumbbell, FastForward, FileText, Flame, Gamepad2, Globe,
  Image as ImageIcon, Keyboard, Lightbulb, Lock, LogOut, Mail, Monitor, Play, PlayCircle, Presentation, RotateCcw, Route, Sheet, ShieldCheck,
  Shuffle, Sparkles, Star, Trophy, Video as VideoIcon, X, XCircle, Zap,
  type LucideIcon,
} from 'lucide-react-native';
import Svg, { Circle as SvgCircle } from 'react-native-svg';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { AppHeader, AppScreen } from '../components/ui';
import { Mascot, type MascotMood } from '../components/dailyPractice/Mascot';
import { DropletMark, PathITBackdrop, PathMascotBuddy, StageDropletBadge } from '../components/dailyPractice/PathDecor';
import { DragProvider } from '../components/dailyPractice/DragKit';
import { Celebration } from '../components/dailyPractice/Celebration';
import { PathVideoModal } from '../components/dailyPractice/PathVideoModal';
import { useAuth } from '../app/AuthContext';
import { FillQuestion, MatchQuestion, McqQuestion, OrderQuestion, SortQuestion, TrueFalseQuestion } from '../components/dailyPractice/Questions';
import { useGameSounds, type GameSound } from '../components/dailyPractice/useGameSounds';
import { LEARNING_GOAL_CHANGED_EVENT } from '../services/learningGoalApi';
import { getMobileImageSource } from '../services/apiClient';
import {
  DP_DIFFICULTIES, DP_TOPIC_COLORS, DP_TYPES, dailyPracticeApi, playQuestionHeaderChips, randomComfort, randomPraise, resultMessage, unitColor,
  type DpNodeState, type DpAnswer, type DpAnswerResult, type DpDifficulty, type DpNextStep, type DpPathNode, type DpPathResult, type DpPathStep, type DpPathUnit, type DpPathVideo, type DpStepKey,
  type DpRelatedLesson, type DpReveal, type DpSession, type DpStats, type DpSummary, type DpTopic, type DpTopicPath,
} from '../services/dailyPracticeApi';
import { colors, spacing } from '../theme/tokens';

const TOPIC_ICONS: Record<string, LucideIcon> = {
  book: BookOpen, monitor: Monitor, 'file-text': FileText, sheet: Sheet, presentation: Presentation, globe: Globe,
  keyboard: Keyboard, shield: ShieldCheck, cpu: Cpu, mail: Mail, image: ImageIcon, code: Code2,
};
const CONFETTI_COLORS = ['#EF4444', '#F59E0B', '#10B981', '#0EA5E9', '#A855F7', '#F97316'];
const gradient = (from: string, to: string) => ({ backgroundColor: to, backgroundImage: `linear-gradient(180deg, ${from} 0%, ${to} 100%)` } as never);

function Confetti({ count = 18, spread = 150 }: { count?: number; spread?: number }) {
  const burst = useRef(new Animated.Value(0)).current;
  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const distance = spread * (0.55 + ((i * 37) % 60) / 100);
    return { dx: Math.cos(angle) * distance, dy: Math.sin(angle) * distance - 30, rot: `${(i % 2 ? 1 : -1) * (200 + i * 20)}deg`, color: CONFETTI_COLORS[i % CONFETTI_COLORS.length] };
  }), [count, spread]);
  useEffect(() => {
    Animated.timing(burst, { toValue: 1, duration: 1100, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
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
    Animated.sequence([0, 1, -1, 1, -1, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 60, useNativeDriver: true }))).start();
  }, [shake, trigger]);
  return shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] });
}

// ── Màn chọn ─────────────────────────────────────────────────────────────────
const MODES: Array<{ id: PracticeMode; label: string; icon: LucideIcon }> = [
  { id: 'path', label: 'Lộ trình', icon: Route },
  { id: 'free', label: 'Luyện tự do', icon: Shuffle },
];
type PracticeMode = 'path' | 'free';

function HomeView({
  topics, stats, loading, error, starting, onStart, play, initialTopicId = '',
  mode, onModeChange, pathTopics, pathLoading, pathError, onStartStep, onPathChanged,
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
  onStartStep: (unitId: string, nodeKey: string, step: DpStepKey, testOut: boolean) => void;
  onPathChanged: () => void;
}) {
  const [topicId, setTopicId] = useState('');
  const [difficulty, setDifficulty] = useState<DpDifficulty>('easy');
  const selected = topics.find((t) => t.id === topicId);
  useEffect(() => {
    if (topicId || !topics.length) return;
    const linked = initialTopicId ? topics.find((t) => t.id === initialTopicId) : undefined;
    setTopicId(linked ? linked.id : topics[0].id);
  }, [topicId, topics, initialTopicId]);

  return (
    <View style={styles.gapLg}>
      <View style={styles.hero}>
        <View style={styles.heroRow}>
          <Mascot mood={stats?.playedToday ? 'happy' : stats?.streakState === 'lost' ? 'sad' : 'idle'} size={92} />
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>LUYỆN TẬP HẰNG NGÀY</Text>
            <Text style={styles.heroTitle}>
              {stats?.playedToday
                ? 'Hôm nay bạn đã luyện tập — giỏi lắm!'
                : stats?.streakState === 'lost'
                  ? `Lấy lại phong độ nào!${stats.lostStreak ? ` Bạn vừa lỡ chuỗi ${stats.lostStreak} ngày` : ''}`
                  : stats?.streakState === 'at_risk'
                    ? `Giữ lửa chuỗi ${stats.streak} ngày — hôm nay chưa luyện!`
                    : 'Sẵn sàng thử thách hôm nay chưa?'}
            </Text>
            <Text style={styles.muted}>
              {mode === 'path' ? 'Đi hết từng chặng để mở chặng mới, nhận XP và giữ chuỗi ngày 🔥' : 'Trả lời 10 câu để nhận XP và giữ chuỗi ngày 🔥'}
              {!stats?.playedToday && (stats?.todayPlayers || 0) > 0 ? <Text style={styles.socialInline}>{` · ${stats?.todayPlayers} bạn đã luyện hôm nay`}</Text> : null}
            </Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          {[
            { icon: Flame, value: stats?.streak || 0, label: 'ngày liên tiếp', from: '#FB923C', to: '#EA580C' },
            { icon: Zap, value: stats?.todayXp || 0, label: 'XP hôm nay', from: '#FBBF24', to: '#D97706' },
            { icon: Trophy, value: stats?.xpTotal || 0, label: 'tổng XP', from: '#F87171', to: '#B91C1C' },
          ].map(({ icon: Icon, value, label, from, to }) => (
            <View key={label} style={styles.stat}>
              <View style={[styles.statIcon, gradient(from, to)]}><Icon size={16} color="#FFFFFF" /></View>
              <View>
                <Text style={styles.statValue}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

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
              <Icon size={16} color={active ? colors.brand : '#64748B'} />
              <Text style={[styles.modeTabText, active && { color: colors.brand }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === 'path' ? (
        <PathView
          topics={pathTopics}
          loading={pathLoading}
          error={pathError}
          starting={starting}
          play={play}
          initialTopicId={initialTopicId}
          onStartStep={onStartStep}
          onPathChanged={onPathChanged}
        />
      ) : null}

      {mode === 'free' && error ? <Text style={styles.error}>{error}</Text> : null}
      {mode === 'free' && loading ? <ActivityIndicator color={colors.brand} /> : null}
      {mode === 'free' && !loading && !topics.length && !error ? (
        <View style={styles.empty}>
          <Mascot mood="thinking" size={72} />
          <Text style={styles.emptyTitle}>Trung tâm đang soạn câu hỏi luyện tập.</Text>
          <Text style={styles.muted}>Quay lại sau nhé!</Text>
        </View>
      ) : null}

      {mode === 'free' && topics.length ? (
        <>
          <Text style={styles.sectionTitle}>1. Chọn chủ đề</Text>
          <View style={styles.topicGrid}>
            {topics.map((topic) => {
              const Icon = TOPIC_ICONS[topic.icon] || BookOpen;
              const color = DP_TOPIC_COLORS[topic.color] || DP_TOPIC_COLORS.red;
              const active = topic.id === topicId;
              return (
                <Pressable
                  key={topic.id}
                  onPress={() => { play('tap'); setTopicId(topic.id); }}
                  style={[styles.topic, { borderColor: active ? color.to : '#E2E8F0', backgroundColor: active ? color.soft : '#FFFFFF' }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={[styles.topicIcon, gradient(color.from, color.to)]}><Icon size={20} color="#FFFFFF" /></View>
                  <Text numberOfLines={1} style={styles.topicName}>{topic.name}</Text>
                  <Text numberOfLines={1} style={styles.topicDesc}>{topic.description || `${topic.counts.easy + topic.counts.medium + topic.counts.hard} câu hỏi`}</Text>
                  {active ? <View style={styles.topicCheck}><CheckCircle2 size={18} color={color.to} /></View> : null}
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.sectionTitle}>2. Chọn độ khó</Text>
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
                  <Text style={styles.levelMeta}>{`${level.xp} XP · ${selected?.counts[level.id] || 0} câu`}</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable onPress={() => topicId && onStart(topicId, difficulty)} disabled={!topicId || starting} style={[styles.primary, styles.primaryBig]} accessibilityRole="button">
            {starting ? <ActivityIndicator color="#FFFFFF" /> : <Play size={18} color="#FFFFFF" />}
            <Text style={styles.primaryText}>Bắt đầu luyện tập</Text>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

// ── Lộ trình ─────────────────────────────────────────────────────────────────
const STEP_LABELS: Partial<Record<DpStepKey, string>> = { learn: 'Dễ', practice: 'Vừa', challenge: 'Khó' };
const STEP_HINTS: Partial<Record<DpStepKey, string>> = {
  learn: 'Câu hỏi mức dễ — làm xong mới mở cấp Vừa',
  practice: 'Câu hỏi mức vừa — làm xong mới mở cấp Khó',
  challenge: 'Câu hỏi mức khó — qua cấp này để mở chặng tiếp theo',
};

function buildUnitPathItems(unit: DpPathUnit) {
  const items: Array<
    | { kind: 'video'; key: string; video: DpPathVideo; state: DpNodeState }
    | { kind: 'hub'; key: string; node: DpPathNode; state: DpNodeState }
  > = [];
  for (const video of unit.videos || []) {
    items.push({ kind: 'video', key: `video-${video.id}`, video, state: video.state });
  }
  for (const node of unit.pathNodes || []) {
    for (const level of node.levels || []) {
      for (const video of level.videos || []) {
        items.push({ kind: 'video', key: `video-${video.id}`, video, state: video.state });
      }
    }
    items.push({ kind: 'hub', key: `hub-${node.key}`, node, state: node.state });
  }
  return items;
}
const NODE_ICONS: Record<string, LucideIcon> = { book: BookOpen, dumbbell: Dumbbell, flame: Flame, crown: Crown };
const STEP_ICONS: Record<DpStepKey, LucideIcon> = { learn: BookOpen, practice: Dumbbell, challenge: Flame, checkpoint: Trophy };
/** Nút lộ trình uốn lượn kiểu Duolingo. */
const NODE_OFFSETS = [0, 58, 0, -58];
const NODE_CONNECTOR_STEP = 22;
const NODE_LANE_WIDTH = 320;
type PopoverState = { unitId: string; nodeKey?: string; stepKey?: DpStepKey; testOut: boolean };

/** Màu tối hơn cho "đế" nút 3D. */
function darken(hex: string, amount = 0.28) {
  const value = String(hex || '#B91C1C').replace('#', '');
  const channel = (start: number) => Math.max(0, Math.round(parseInt(value.slice(start, start + 2), 16) * (1 - amount)));
  return `rgb(${channel(0)}, ${channel(2)}, ${channel(4)})`;
}

const maxXpFor = (step: DpPathStep) => 10 * (DP_DIFFICULTIES.find((d) => d.id === (step.difficulty || 'medium'))?.xp || 15);

function ProgressRing({ size, progress, color }: { size: number; progress: number; color: string }) {
  const stroke = 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <Svg width={size} height={size} style={styles.ring} pointerEvents="none">
      <SvgCircle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
      <SvgCircle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={circumference * (1 - progress)}
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
      Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
      ) : null}
      <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
        {isNext ? <ProgressRing size={box} progress={unitProgress} color={color.from} /> : null}
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
              height: size - 6,
              borderRadius: size / 2,
              backgroundColor: locked ? '#E5E7EB' : color.from,
              boxShadow: `0px ${pressed ? 2 : 7}px 0px ${locked ? '#C4C9D1' : darken(color.to, 0.15)}`,
              transform: [{ translateY: pressed ? 5 : 0 }],
            } as never,
          ]}
        >
          <Icon size={big ? 30 : 26} color={locked ? '#9CA3AF' : '#FFFFFF'} strokeWidth={2.8} />
          {step.state === 'completed' && big ? <View style={styles.nodeCrown}><Crown size={20} color="#F59E0B" fill="#FCD34D" /></View> : null}
        </Pressable>
      </View>
      <Text style={[styles.nodeLabel, locked && { color: '#94A3B8' }]}>{STEP_LABELS[step.key] || step.label}</Text>
    </View>
  );
}

/** Nút video của chặng (🎬) — bấm mở popup trình phát Thắng Tin Học. */
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
              width: 66,
              height: 60,
              borderRadius: 33,
              backgroundColor: locked ? '#E5E7EB' : color.from,
              boxShadow: `0px ${pressed ? 2 : 7}px 0px ${locked ? '#C4C9D1' : darken(color.to, 0.15)}`,
              transform: [{ translateY: pressed ? 5 : 0 }],
            } as never,
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

/** Một nút trên lộ trình — popover 3 nấc Dễ / Vừa / Khó. */
function PracticeHubNode({ node, color, isNext, selected, onPress }: {
  node: DpPathNode;
  color: { from: string; to: string };
  isNext: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const locked = node.state === 'locked';
  const size = 74;
  const box = size + 24;
  const levels = node.levels || [];
  const progress = levels.length ? levels.filter((l) => l.state === 'completed').length / levels.length : 0;
  const HubIcon = NODE_ICONS[node.icon] || Dumbbell;
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isNext || selected) return undefined;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
      ) : null}
      <View style={{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }}>
        {isNext ? <ProgressRing size={box} progress={progress} color={color.from} /> : null}
        <Pressable
          onPress={onPress}
          disabled={locked}
          accessibilityRole="button"
          accessibilityLabel={node.label}
          accessibilityState={{ expanded: selected, disabled: locked }}
          style={({ pressed }) => [
            styles.node,
            {
              width: size,
              height: size - 6,
              borderRadius: size / 2,
              backgroundColor: locked ? '#E5E7EB' : color.from,
              boxShadow: `0px ${pressed ? 2 : 7}px 0px ${locked ? '#C4C9D1' : darken(color.to, 0.15)}`,
              transform: [{ translateY: pressed ? 5 : 0 }],
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            } as never,
          ]}
        >
          <HubIcon size={26} color={locked ? '#9CA3AF' : '#FFFFFF'} strokeWidth={2.8} />
          <View style={{ flexDirection: 'row', gap: 3 }}>
            {levels.map((level) => (
              <View
                key={level.key}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: level.state === 'completed' || level.state === 'active' ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
                }}
              />
            ))}
          </View>
        </Pressable>
      </View>
      <Text style={[styles.nodeLabel, locked && { color: '#94A3B8' }]}>{node.label}</Text>
    </View>
  );
}

function LevelHubPopover({ node, color, starting, onClose, onStartStep }: {
  node: DpPathNode;
  color: { from: string; to: string };
  starting: boolean;
  onClose: () => void;
  onStartStep: (stepKey: DpStepKey) => void;
}) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [pop]);
  return (
    <Animated.View style={[styles.popover, styles.hubPopover, gradient(color.from, color.to), { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
      <View style={[styles.popoverArrow, { backgroundColor: color.from }]} />
      <Pressable onPress={onClose} style={styles.popoverClose} accessibilityRole="button" accessibilityLabel="Đóng"><X size={16} color="rgba(255,255,255,0.85)" /></Pressable>
      <Text style={styles.popoverTitle}>{node.label}</Text>
      <Text style={styles.popoverMeta}>Làm lần lượt 3 nấc — xong nấc trước mới mở nấc sau</Text>
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
              <Text style={styles.hubLevelXp}>{`Cần đúng ${step.passPercent}% · +${maxXpFor(step)} XP`}</Text>
            </View>
            {!locked ? (
              <Pressable
                onPress={() => onStartStep(step.key)}
                disabled={starting}
                style={styles.hubLevelBtn}
                accessibilityRole="button"
              >
                <Text style={styles.hubLevelBtnText}>{starting ? '…' : done ? 'Lại' : 'Làm'}</Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </Animated.View>
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
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [pop]);
  return (
    <Animated.View style={[styles.popover, gradient(color.from, color.to), { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
      <View style={[styles.popoverArrow, { backgroundColor: color.from }]} />
      <Pressable onPress={onClose} style={styles.popoverClose} accessibilityRole="button" accessibilityLabel="Đóng"><X size={16} color="rgba(255,255,255,0.85)" /></Pressable>
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
  );
}

/** Lộ trình luyện tập: chủ đề → chặng → Học / Luyện / Thử thách / Kiểm tra chặng (mở khóa tuần tự). */
function PathView({ topics, loading, error, starting, play, initialTopicId = '', onStartStep, onPathChanged }: {
  topics: DpTopicPath[];
  loading: boolean;
  error: string;
  starting: boolean;
  play: (s: GameSound) => void;
  initialTopicId?: string;
  onStartStep: (unitId: string, nodeKey: string, step: DpStepKey, testOut: boolean) => void;
  onPathChanged: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { user } = useAuth();
  const [topicId, setTopicId] = useState('');
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [videoOpen, setVideoOpen] = useState<{ unit: DpPathUnit; videoId: string } | null>(null);

  useEffect(() => {
    if (topicId && topics.some((item) => item.topic.id === topicId)) return;
    if (!topics.length) return;
    const linked = initialTopicId ? topics.find((item) => item.topic.id === initialTopicId) : undefined;
    const inProgress = topics.find((item) => item.next && item.completedUnits > 0);
    setTopicId((linked || inProgress || topics[0]).topic.id);
  }, [topicId, topics, initialTopicId]);

  useEffect(() => {
    if (error) setPopover(null);
  }, [error]);

  const current = topics.find((item) => item.topic.id === topicId) || null;
  const color = DP_TOPIC_COLORS[current?.topic.color || 'red'] || DP_TOPIC_COLORS.red;

  if (loading && !topics.length) return <ActivityIndicator color={colors.brand} />;
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
  const nextUnit = current?.next ? current.units.find((unit) => unit.id === current.next?.unitId) : undefined;
  const percent = current?.totalUnits ? Math.round((current.completedUnits / current.totalUnits) * 100) : 0;
  const watch = (lesson: { subjectId: string; unitId: string }) => navigation.navigate('MainTabs', {
    screen: 'CourseVideos',
    params: { resumeKey: Date.now(), resumeSubjectId: lesson.subjectId, resumeCourseId: '', resumeUnitId: lesson.unitId, resumeSectionId: '' },
  });

  return (
    <View style={styles.gapMd}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {topics.map((item) => {
          const Icon = TOPIC_ICONS[item.topic.icon] || BookOpen;
          const tone = DP_TOPIC_COLORS[item.topic.color] || DP_TOPIC_COLORS.red;
          const active = item.topic.id === topicId;
          return (
            <Pressable
              key={item.topic.id}
              onPress={() => { play('tap'); setTopicId(item.topic.id); setPopover(null); }}
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
        })}
      </ScrollView>

      {current ? (
        <>
          <View style={[styles.card, styles.pathSummaryCard]}>
            <View style={styles.pathSummaryMascot} pointerEvents="none">
              <Mascot mood={current.next ? 'idle' : 'happy'} size={48} />
            </View>
            <View style={styles.inline}>
              <DropletMark size={12} fill={color.to} />
              <Text style={[styles.pathEyebrow, { color: color.to }]}>{`LỘ TRÌNH ${current.topic.name.toUpperCase()}`}</Text>
            </View>
            <View style={styles.inline}>
              <View style={styles.pathTrack}><View style={[styles.pathFill, gradient(color.from, color.to), { width: `${percent}%` }]} /></View>
              <Text style={styles.pathCount}>{`${current.completedUnits}/${current.totalUnits}`}</Text>
            </View>
            <Text style={styles.muted}>
              {current.next
                ? `Tiếp theo: Chặng ${nextUnit?.index} · ${current.next.unitTitle} — ${current.next.stepLabel}`
                : 'Bạn đã hoàn thành toàn bộ lộ trình chủ đề này 🎉 Luyện lại bất kỳ bước nào để giữ phong độ.'}
            </Text>
            {current.next && nextUnit ? (
              <Pressable
                onPress={() => { if (nextUnit && current.next) toggleHub(nextUnit, current.next.nodeKey || 'study'); }}
                style={styles.primary}
                accessibilityRole="button"
              >
                <Play size={16} color="#FFFFFF" />
                <Text style={styles.primaryText}>Tiếp tục học</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.pathTimelineWrap}>
            <PathITBackdrop accentSoft={color.soft} />
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
              return (
                <View key={unit.id} style={[styles.pathUnitRow, !isLast && styles.pathUnitRowBorder]}>
                  <View style={styles.unitStageCenter}>
                    <StageDropletBadge index={unit.index} locked={locked} accentTo={tone.to} />
                    <View style={styles.unitStageMetaRow}>
                      <Text style={styles.unitStageEyebrow}>{`Chặng ${unit.index}`}</Text>
                      {unit.state === 'completed' ? (
                        <View style={[styles.unitStagePill, { backgroundColor: tone.to }]}>
                          <Text style={styles.unitStagePillText}>{unit.testedOut ? 'Đã vượt' : 'Xong'}</Text>
                        </View>
                      ) : null}
                      {isNextUnit && !locked ? (
                        <View style={styles.unitStageActivePill}>
                          <Text style={styles.unitStageActivePillText}>Đang học</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text numberOfLines={2} style={styles.unitStageTitleCenter}>{unit.title}</Text>
                    {unit.description ? <Text numberOfLines={2} style={styles.unitStageDescCenter}>{unit.description}</Text> : null}
                    <View style={styles.unitStageProgressRowCenter}>
                      <View style={styles.unitStageTrack}>
                        <View style={[styles.unitStageFill, gradient(tone.from, tone.to), { width: `${Math.round(progress * 100)}%` }]} />
                      </View>
                      <Text style={styles.unitStageCount}>{`${doneSteps}/${totalSteps}`}</Text>
                    </View>
                    <View style={styles.unitStageActions}>
                      {unit.lesson || unit.videos?.length ? (
                        <Pressable
                          onPress={() => { play('tap'); setPopover(null); setVideoOpen({ unit, videoId: '' }); }}
                          style={[styles.unitStageBtn, { backgroundColor: locked ? '#94A3B8' : tone.to }]}
                          accessibilityRole="button"
                        >
                          <PlayCircle size={13} color="#FFFFFF" />
                          <Text style={styles.unitStageBtnText}>Video chặng</Text>
                        </Pressable>
                      ) : null}
                      {locked && unit.canTestOut ? (
                        <Pressable onPress={() => toggleTestOut(unit)} style={styles.unitStageTestOut} accessibilityRole="button">
                          <FastForward size={12} color="#FFFFFF" />
                          <Text style={styles.unitStageTestOutText}>Kiểm tra vượt</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
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
                    <View style={[styles.nodeColumn, { width: NODE_LANE_WIDTH, maxWidth: '100%' }]}>
                      {pathItems.map((item, index) => {
                        const hubSelected = item.kind === 'hub' && popover && !popover.testOut && popover.unitId === unit.id && popover.nodeKey === item.node.key;
                        const offset = NODE_OFFSETS[index % NODE_OFFSETS.length];
                        const previous = index > 0 ? NODE_OFFSETS[(index - 1) % NODE_OFFSETS.length] : null;
                        const hubNext = item.kind === 'hub' && Boolean(
                          current.next?.unitId === unit.id
                          && (current.next.nodeKey ? current.next.nodeKey === item.node.key : item.node.key === 'study'),
                        );
                        const linkActive = item.state !== 'locked';
                        const mascotSide = offset >= 0 ? 'left' : 'right';
                        return (
                          <View key={item.key} style={[styles.nodeSlot, { transform: [{ translateX: offset }] }]}>
                            {hubNext ? (
                              <PathMascotBuddy side={mascotSide} mood={locked ? 'thinking' : 'idle'} size={50} />
                            ) : null}
                            {previous !== null ? (
                              <View style={styles.connector} pointerEvents="none">
                                {[0.12, 0.32, 0.52, 0.72, 0.88].map((t) => (
                                  <View
                                    key={t}
                                    style={[styles.connectorDroplet, {
                                      left: (previous - offset) * (1 - t) - 5,
                                      top: 2 + t * NODE_CONNECTOR_STEP,
                                      opacity: 0.45 + t * 0.5,
                                    }]}
                                  >
                                    <DropletMark size={t > 0.7 ? 10 : 8} fill={linkActive ? tone.from : '#CBD5E1'} />
                                  </View>
                                ))}
                              </View>
                            ) : null}
                            {item.kind === 'video' ? (
                              <VideoNode
                                video={item.video}
                                color={tone}
                                onPress={() => {
                                  play('tap');
                                  setPopover(null);
                                  setVideoOpen({ unit, videoId: item.video.id });
                                }}
                              />
                            ) : (
                              <PracticeHubNode
                                node={item.node}
                                color={tone}
                                isNext={hubNext}
                                selected={Boolean(hubSelected)}
                                onPress={() => toggleHub(unit, item.node.key)}
                              />
                            )}
                            {hubSelected ? (
                              <View style={{ transform: [{ translateX: -offset }], width: '100%', maxWidth: 340 }}>
                                <LevelHubPopover
                                  node={item.node}
                                  color={tone}
                                  starting={starting}
                                  onClose={() => setPopover(null)}
                                  onStartStep={(stepKey) => {
                                    setPopover(null);
                                    onStartStep(unit.id, item.node.key, stepKey, false);
                                  }}
                                />
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      ) : null}
      {videoOpen ? (
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
      ) : null}
    </View>
  );
}

function PathResultCard({ result }: { result: DpPathResult }) {
  const passed = result.passed;
  let title: string;
  let text: string;
  if (!passed) {
    title = `Chưa qua ${result.testOut ? 'bài kiểm tra vượt chặng' : `bước ${result.stepLabel}`}`;
    text = `Bạn đạt ${result.scorePercent}%, cần từ ${result.passPercent}%. Ôn lại rồi thử lần nữa nhé!`;
  } else if (result.topicCompleted && (result.unitCompleted || result.testOut)) {
    title = 'Hoàn thành toàn bộ lộ trình!';
    text = 'Bạn đã chinh phục mọi chặng của chủ đề này. Tuyệt vời!';
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

// ── Xác nhận thoát ───────────────────────────────────────────────────────────
function QuitConfirm({ stats, answered, total, play, onStay, onQuit }: {
  stats: DpStats | null;
  answered: number;
  total: number;
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
                <Text style={styles.quitProgressText}>{`Đã làm ${answered}/${total} câu — chỉ còn ${left} câu nữa thôi!`}</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.quitActions}>
            <Pressable onPress={onStay} style={styles.primary} accessibilityRole="button">
              <Play size={16} color="#FFFFFF" />
              <Text style={styles.primaryText}>Ở lại luyện tiếp</Text>
            </Pressable>
            <Pressable onPress={onQuit} style={styles.secondary} accessibilityRole="button">
              <Text style={[styles.secondaryText, { color: '#64748B' }]}>Vẫn thoát</Text>
            </Pressable>
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
  const [index, setIndex] = useState(0);
  const [pending, setPending] = useState<DpAnswer | null>(null);
  const [chosen, setChosen] = useState<number | boolean | null>(null);
  const [result, setResult] = useState<DpAnswerResult | null>(null);
  const [reveal, setReveal] = useState<DpReveal | null>(null);
  const [hintText, setHintText] = useState('');
  const [busy, setBusy] = useState(false);
  const [xp, setXp] = useState(0);
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [combo, setCombo] = useState(0);
  const comboPop = useRef(new Animated.Value(1)).current;
  const question = session.questions[index];
  const total = session.questions.length;
  const meta = DP_TYPES[question.type];
  const level = DP_DIFFICULTIES.find((d) => d.id === question.difficulty) || DP_DIFFICULTIES[0];
  const headerChips = useMemo(
    () => playQuestionHeaderChips(session.path, meta.label, level),
    [session.path, meta.label, level],
  );
  const shakeX = useShake(result && !result.correct ? `${index}-wrong` : null);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: (index + (result ? 1 : 0)) / total, duration: 400, useNativeDriver: false }).start();
  }, [index, progress, result, total]);

  const submit = useCallback(async (answer: DpAnswer | null) => {
    if (!answer || busy || result) return;
    setBusy(true);
    setError('');
    setChosen('index' in answer ? answer.index : 'value' in answer ? answer.value : null);
    try {
      const data = await dailyPracticeApi.answer(session.id, question.id, answer);
      setResult(data);
      setXp(data.sessionXp);
      setTitle(data.correct ? randomPraise() : randomComfort());
      setCombo((value) => (data.correct ? value + 1 : 0));
      if (data.correct) {
        comboPop.setValue(0.6);
        Animated.spring(comboPop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }).start();
      }
      play(data.correct ? 'correct' : 'wrong');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được câu trả lời');
    } finally {
      setBusy(false);
    }
  }, [busy, comboPop, play, question.id, result, session.id]);

  const askHint = async () => {
    if (reveal || result || busy) return;
    setBusy(true);
    try {
      const data = await dailyPracticeApi.hint(session.id, question.id);
      play('hint');
      setReveal(data.reveal || {});
      setHintText(data.hint || '');
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

  const props = { question, reveal, result, play, onChange: setPending };
  const immediate = question.type === 'mcq' || question.type === 'truefalse';
  const mood: MascotMood = result ? (result.correct ? 'happy' : 'sad') : reveal ? 'thinking' : 'idle';

  return (
    <DragProvider onDraggingChange={onDraggingChange}>
      <View style={styles.gapMd}>
        <View style={styles.topBar}>
          <Pressable onPress={() => setQuitOpen(true)} style={styles.quitBtn} accessibilityRole="button">
            <LogOut size={15} color="#475569" />
            <Text style={styles.quitBtnText}>Thoát</Text>
          </Pressable>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
          </View>
          {combo >= 2 ? (
            <Animated.View style={[styles.comboChip, { transform: [{ scale: comboPop }] }]} accessibilityLabel={`Combo ${combo} câu đúng liên tiếp`}>
              <Flame size={13} color="#FFFFFF" fill="#FCD34D" />
              <Text style={styles.comboText}>{`x${combo}`}</Text>
            </Animated.View>
          ) : null}
          <View style={styles.xpPill}><Zap size={14} color="#F59E0B" fill="#FBBF24" /><Text style={styles.xpText}>{xp}</Text></View>
        </View>

        <Animated.View style={[styles.card, { transform: [{ translateX: shakeX }] }]}>
          {result?.correct ? <Confetti key={`c-${index}`} /> : null}
          <View style={styles.badgeRow}>
            <Text style={styles.badgeDark}>{`Câu ${index + 1}/${total}`}</Text>
            {headerChips.map((chip) => (
              <Text key={chip.id} style={[styles.badge, { backgroundColor: chip.soft, color: chip.color }]}>
                {chip.text}
              </Text>
            ))}
          </View>
          <View style={styles.promptRow}>
            <Mascot mood={mood} size={56} />
            <View style={styles.flex}>
              <Text style={styles.prompt}>{question.prompt}</Text>
              <Text style={styles.instruction}>{meta.instruction}</Text>
            </View>
          </View>
          {question.imageUrl ? <Image source={getMobileImageSource(question.imageUrl)} style={styles.image} resizeMode="contain" /> : null}
          {hintText ? (
            <View style={styles.hintBox}>
              <Lightbulb size={16} color="#F59E0B" fill="#FCD34D" />
              <Text style={styles.hintText}>{hintText}</Text>
            </View>
          ) : null}
          <View key={question.id} style={styles.answerArea}>
            {question.type === 'mcq' ? <McqQuestion question={question} reveal={reveal} result={result} chosen={typeof chosen === 'number' ? chosen : null} onSubmit={submit} play={play} /> : null}
            {question.type === 'truefalse' ? <TrueFalseQuestion result={result} chosen={typeof chosen === 'boolean' ? chosen : null} onSubmit={submit} play={play} /> : null}
            {question.type === 'order' ? <OrderQuestion {...props} /> : null}
            {question.type === 'match' ? <MatchQuestion {...props} /> : null}
            {question.type === 'fill' ? <FillQuestion {...props} /> : null}
            {question.type === 'sort' ? <SortQuestion {...props} /> : null}
          </View>
          {error ? <Text style={styles.errorInline}>{error}</Text> : null}
        </Animated.View>

        {quitOpen ? (
          <QuitConfirm
            stats={stats}
            answered={index + (result ? 1 : 0)}
            total={total}
            play={play}
            onStay={() => setQuitOpen(false)}
            onQuit={() => { setQuitOpen(false); onQuit(); }}
          />
        ) : null}
        {!result ? (
          <View style={styles.row}>
            <Pressable onPress={() => { void askHint(); }} disabled={Boolean(reveal) || busy} style={[styles.secondary, reveal ? styles.disabled : null]} accessibilityRole="button">
              <Lightbulb size={17} color="#F59E0B" fill={reveal ? 'transparent' : '#FCD34D'} />
              <Text style={styles.secondaryText}>{reveal ? 'Đã dùng gợi ý' : 'Gợi ý (½ XP)'}</Text>
            </Pressable>
            {!immediate ? (
              <Pressable onPress={() => { void submit(pending); }} disabled={!pending || busy} style={[styles.primary, styles.flex, (!pending || busy) && styles.disabled]} accessibilityRole="button">
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <CheckCircle2 size={17} color="#FFFFFF" />}
                <Text style={styles.primaryText}>Kiểm tra</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={[styles.feedback, result.correct ? styles.feedbackOk : styles.feedbackBad]}>
            <View style={styles.feedbackRow}>
              <Mascot mood={result.correct ? 'happy' : 'sad'} size={52} />
              <View style={styles.flex}>
                <View style={styles.feedbackTitleRow}>
                  {result.correct ? <CheckCircle2 size={20} color="#047857" /> : <XCircle size={20} color="#DC2626" />}
                  <Text style={[styles.feedbackTitle, { color: result.correct ? '#047857' : '#DC2626' }]}>{title}</Text>
                  {result.correct ? <Text style={styles.feedbackXp}>{`+${result.xp} XP`}</Text> : null}
                </View>
                {!result.correct ? <Text style={styles.feedbackAnswer}>{`Đáp án: ${result.correctAnswer.text}`}</Text> : null}
                {result.explanation ? <Text style={styles.feedbackExplain}>{result.explanation}</Text> : null}
              </View>
            </View>
            <Pressable onPress={() => { void next(); }} disabled={busy} style={[styles.primary, { backgroundColor: result.correct ? '#059669' : '#DC2626' }]} accessibilityRole="button">
              {busy ? <ActivityIndicator color="#FFFFFF" /> : null}
              <Text style={styles.primaryText}>{index + 1 < total ? 'Tiếp tục' : 'Xem kết quả'}</Text>
              <ArrowRight size={17} color="#FFFFFF" />
            </Pressable>
          </View>
        )}
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

function ResultView({ summary, play, starting, onReplay, onHome, onNextStep }: {
  summary: DpSummary;
  play: (s: GameSound) => void;
  starting: boolean;
  onReplay: () => void;
  onHome: () => void;
  onNextStep: (next: DpNextStep) => void;
}) {
  const pathResult = summary.path || null;
  const nextStep = pathResult?.passed ? pathResult.next : null;
  const good = summary.stars >= 2;
  const message = resultMessage(summary.stars);
  const stars = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(180, stars.map((value, i) => Animated.spring(value, {
      toValue: i < summary.stars ? 1 : 0.6, friction: 4, tension: 120, useNativeDriver: true,
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
          <View style={styles.resultStat}><Text style={[styles.resultValue, { color: '#D97706' }]}>{`+${summary.gainedXp}`}</Text><Text style={styles.statLabel}>{summary.bonusXp ? `XP (thưởng +${summary.bonusXp})` : 'XP'}</Text></View>
          <View style={styles.resultStat}>
            <View style={styles.inline}><Flame size={20} color="#EA580C" fill="#FDBA74" /><Text style={[styles.resultValue, { color: '#EA580C' }]}>{summary.stats.streak}</Text></View>
            <Text style={styles.statLabel}>{summary.streakIncreased ? 'chuỗi ngày tăng!' : 'ngày liên tiếp'}</Text>
          </View>
        </View>
      </View>

      {pathResult ? <PathResultCard result={pathResult} /> : null}
      {summary.relatedLesson ? <RelatedLessonCard lesson={summary.relatedLesson} /> : null}

      {summary.review.length ? (
        <View style={styles.card}>
          <View style={styles.inline}><Sparkles size={16} color="#F59E0B" /><Text style={styles.sectionTitle}>Xem lại câu chưa đúng</Text></View>
          {summary.review.map((item) => (
            <View key={item.id} style={styles.reviewItem}>
              <Text style={styles.reviewPrompt}>{item.prompt}</Text>
              <Text style={styles.reviewAnswer}>{`✓ ${item.correctAnswer.text}`}</Text>
              {item.explanation ? <Text style={styles.reviewExplain}>{item.explanation}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.row}>
        <Pressable onPress={onHome} style={[styles.secondary, styles.flex]} accessibilityRole="button">
          <ArrowLeft size={17} color={colors.ink} />
          <Text style={styles.secondaryText}>{pathResult ? 'Về lộ trình' : 'Chủ đề khác'}</Text>
        </Pressable>
        {nextStep ? (
          <Pressable onPress={() => onNextStep(nextStep)} disabled={starting} style={[styles.primary, styles.flex, starting && styles.disabled]} accessibilityRole="button">
            {starting ? <ActivityIndicator color="#FFFFFF" /> : <Play size={17} color="#FFFFFF" />}
            <Text numberOfLines={1} style={styles.primaryText}>{`Tiếp: ${nextStep.stepLabel}`}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={onReplay} disabled={starting} style={[styles.primary, styles.flex, starting && styles.disabled]} accessibilityRole="button">
            <RotateCcw size={17} color="#FFFFFF" />
            <Text style={styles.primaryText}>{pathResult && !pathResult.passed ? 'Làm lại' : 'Chơi lại'}</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

type PracticePick =
  | { mode: 'free'; topicId: string; difficulty: DpDifficulty }
  | { mode: 'path'; unitId: string; nodeKey: string; step: DpStepKey; testOut: boolean };

/** Luyện tập hằng ngày kiểu trò chơi — cùng API, luật chơi với web. */
export function DailyPracticeScreen() {
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
  const [pathLoading, setPathLoading] = useState(true);
  const [pathError, setPathError] = useState('');
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
      .then((data) => setPathTopics(data.topics))
      .catch((err: unknown) => setPathError(err instanceof Error ? err.message : 'Không tải được lộ trình luyện tập'))
      .finally(() => setPathLoading(false));
  }, []);
  useEffect(() => { load(); loadPath(); }, [load, loadPath]);

  const begin = async (pick: PracticePick) => {
    setStarting(true);
    setError('');
    setPathError('');
    try {
      const data = pick.mode === 'path'
        ? await dailyPracticeApi.startPath(pick.unitId, pick.step, pick.testOut, pick.nodeKey || '')
        : await dailyPracticeApi.start(pick.topicId, pick.difficulty);
      setLastPick(pick);
      setSummary(null);
      setSession(data);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không bắt đầu được lượt chơi';
      if (pick.mode === 'path') {
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
  const startStep = (unitId: string, nodeKey: string, step: DpStepKey, testOut = false) => begin({ mode: 'path', unitId, nodeKey, step, testOut });
  const goHome = () => {
    setSummary(null);
    setPathError('');
    load();
    loadPath();
  };

  return (
    <AppScreen scroll={false}>
      <AppHeader title="Luyện tập hằng ngày" icon={Gamepad2} />
      <ScrollView ref={scrollRef} scrollEnabled={scrollEnabled} contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
        {session ? (
          <PlayView
            session={session}
            play={play}
            stats={stats}
            onQuit={() => setSession(null)}
            onDraggingChange={(dragging) => setScrollEnabled(!dragging)}
            onFinished={(data) => {
              setSession(null);
              setSummary(data);
              setCelebrating(true);
              setStats((prev) => (prev ? { ...prev, ...data.stats, todayXp: (prev.todayXp || 0) + data.gainedXp } : data.stats));
              DeviceEventEmitter.emit(LEARNING_GOAL_CHANGED_EVENT, null);
              scrollRef.current?.scrollTo({ y: 0, animated: false });
            }}
          />
        ) : summary && celebrating ? (
          <Celebration
            summary={summary}
            play={play}
            onDone={() => { setCelebrating(false); scrollRef.current?.scrollTo({ y: 0, animated: false }); }}
          />
        ) : summary ? (
          <ResultView
            summary={summary}
            play={play}
            starting={starting}
            onReplay={() => { if (lastPick) void begin(lastPick); }}
            onNextStep={(next) => { void startStep(next.unitId, next.nodeKey || 'study', next.step); }}
            onHome={goHome}
          />
        ) : (
          <HomeView
            key={linkedTopicId}
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
            onStartStep={(unitId, nodeKey, step, testOut) => { void startStep(unitId, nodeKey, step, testOut); }}
            onPathChanged={loadPath}
          />
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  screen: { padding: spacing.lg, paddingBottom: 120 },
  relatedCard: { gap: spacing.md, padding: spacing.md, borderRadius: 22, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  relatedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  relatedIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DC2626' },
  relatedEyebrow: { color: '#DC2626', fontSize: 11, fontWeight: '800' },
  relatedTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  flex: { flex: 1, minWidth: 0 },
  center: { textAlign: 'center' },
  gapMd: { gap: spacing.md },
  gapLg: { gap: spacing.lg },
  row: { flexDirection: 'row', gap: spacing.sm },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  socialInline: { color: '#059669', fontWeight: '800' },
  error: { color: '#92400E', backgroundColor: '#FFFBEB', padding: 12, borderRadius: 12, fontSize: 13, fontWeight: '700' },
  errorInline: { color: '#DC2626', fontSize: 13, fontWeight: '700', marginTop: 8 },
  hero: {
    padding: spacing.lg, borderRadius: 26, borderWidth: 1, borderColor: '#FEE2E2', gap: spacing.md, backgroundColor: '#FEF2F2',
    backgroundImage: 'linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 50%, #FFFBEB 100%)',
  } as never,
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eyebrow: { color: '#DC2626', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  heroTitle: { color: colors.ink, fontSize: 18, fontWeight: '900', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.85)' },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statValue: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 6, padding: spacing.xl, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: '#CBD5E1', backgroundColor: '#FFFFFF' },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  sectionTitle: { color: '#334155', fontSize: 14, fontWeight: '900' },
  topicGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  topic: { width: '48%', flexGrow: 1, padding: 12, borderRadius: 18, borderWidth: 2, gap: 4 },
  topicIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  topicName: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  topicDesc: { color: colors.muted, fontSize: 11 },
  topicCheck: { position: 'absolute', top: 10, right: 10 },
  level: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 16, borderWidth: 2, gap: 2 },
  starsRow: { flexDirection: 'row', gap: 2 },
  levelLabel: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  levelMeta: { color: '#94A3B8', fontSize: 10, fontWeight: '700' },
  primary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, paddingHorizontal: 18, borderRadius: 14,
    backgroundColor: colors.brand, backgroundImage: 'linear-gradient(180deg, #F05252 0%, #DC2626 55%, #B91C1C 100%)',
    boxShadow: '0px 6px 14px rgba(185, 28, 28, 0.28)',
  } as never,
  primaryBig: { minHeight: 54 },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  secondary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, paddingHorizontal: 14, borderRadius: 14,
    borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quitBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface,
  },
  quitBtnText: { color: '#475569', fontSize: 13, fontWeight: '800' },
  quitBackdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  quitCard: { width: '100%', maxWidth: 380, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.surface, boxShadow: '0px 24px 48px rgba(15, 23, 42, 0.25)' },
  quitHero: {
    alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.lg, gap: 6, backgroundColor: '#F0F9FF',
    backgroundImage: 'linear-gradient(135deg, #F0F9FF 0%, #FFFFFF 50%, #F1F5F9 100%)',
  } as never,
  quitTitle: { color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  quitText: { color: '#475569', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  quitProgress: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB',
  },
  quitProgressText: { color: '#B45309', fontSize: 12, fontWeight: '900' },
  quitActions: { gap: spacing.sm, padding: spacing.lg },
  progressTrack: { flex: 1, height: 14, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#10B981' },
  xpPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  xpText: { color: '#B45309', fontSize: 14, fontWeight: '900' },
  card: { padding: spacing.lg, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, gap: 10 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badgeDark: { color: '#FFFFFF', backgroundColor: '#0F172A', fontSize: 11, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  badge: { fontSize: 11, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  prompt: { color: colors.ink, fontSize: 17, fontWeight: '900', lineHeight: 23 },
  instruction: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginTop: 2 },
  image: { width: '100%', height: 180, borderRadius: 12, backgroundColor: '#F8FAFC' },
  hintBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 10, borderRadius: 12, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  hintText: { flex: 1, color: '#92400E', fontSize: 13, fontWeight: '700' },
  answerArea: { marginTop: 4 },
  feedback: { padding: spacing.md, borderRadius: 22, gap: spacing.md, borderWidth: 1 },
  feedbackOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  feedbackBad: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  feedbackRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  feedbackTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  feedbackTitle: { fontSize: 18, fontWeight: '900' },
  feedbackXp: { color: '#D97706', fontSize: 14, fontWeight: '900' },
  feedbackAnswer: { color: '#334155', fontSize: 14, fontWeight: '800', marginTop: 2 },
  feedbackExplain: { color: '#475569', fontSize: 13, marginTop: 4, lineHeight: 18 },
  confettiLayer: { position: 'absolute', left: '50%', top: '40%', width: 0, height: 0, zIndex: 20 },
  confetti: { position: 'absolute', width: 8, height: 12, borderRadius: 2 },
  resultCard: { alignItems: 'center', padding: spacing.xl, borderRadius: 26, borderWidth: 1, gap: 6, overflow: 'hidden' },
  resultGood: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  resultSoft: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  starsBig: { flexDirection: 'row', gap: 8, marginTop: 4 },
  resultTitle: { color: colors.ink, fontSize: 22, fontWeight: '900', marginTop: 6 },
  resultStats: { flexDirection: 'row', gap: 8, marginTop: spacing.md, alignSelf: 'stretch' },
  resultStat: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 14, backgroundColor: '#FFFFFF' },
  resultValue: { fontSize: 20, fontWeight: '900' },
  reviewItem: { padding: 10, borderRadius: 12, backgroundColor: '#F8FAFC', gap: 3 },
  reviewPrompt: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  reviewAnswer: { color: '#047857', fontSize: 13, fontWeight: '800' },
  reviewExplain: { color: colors.muted, fontSize: 12 },
  modeTabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 16, backgroundColor: '#F1F5F9' },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12 },
  modeTabActive: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line },
  modeTabText: { color: '#64748B', fontSize: 14, fontWeight: '900' },
  chipRow: { gap: 8, paddingRight: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderWidth: 2 },
  chipIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  chipName: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  chipMeta: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  pathEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  pathTrack: { flex: 1, height: 12, borderRadius: 999, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  pathFill: { height: '100%', borderRadius: 999 },
  pathCount: { color: '#334155', fontSize: 13, fontWeight: '900' },
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
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    overflow: 'visible',
    marginBottom: spacing.sm,
  },
  pathSummaryCard: { position: 'relative', overflow: 'hidden', paddingRight: 56 },
  pathSummaryMascot: { position: 'absolute', right: 4, top: 8 },
  pathUnitRow: { alignItems: 'center', paddingHorizontal: spacing.sm, paddingVertical: spacing.md, gap: spacing.sm, zIndex: 2 },
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
  unitStageNumText: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
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
  unitStageEyebrow: { color: '#64748B', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  unitStagePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  unitStagePillText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  unitStageActivePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: '#FBBF24' },
  unitStageActivePillText: { color: '#78350F', fontSize: 9, fontWeight: '900' },
  unitStageTitleCenter: { color: colors.ink, fontSize: 17, fontWeight: '900', textAlign: 'center', maxWidth: 280 },
  unitStageDescCenter: { color: colors.muted, fontSize: 11, textAlign: 'center', maxWidth: 300 },
  unitStageProgressRowCenter: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, width: '100%', maxWidth: 260 },
  unitStageTitle: { color: colors.ink, fontSize: 16, fontWeight: '900', marginTop: 2 },
  unitStageDesc: { color: colors.muted, fontSize: 11, marginTop: 2 },
  unitStageProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  unitStageTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  unitStageFill: { height: '100%', borderRadius: 999 },
  unitStageCount: { color: '#64748B', fontSize: 10, fontWeight: '800' },
  unitStageActions: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6, marginTop: 8 },
  unitStageBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999 },
  unitStageBtnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  unitStageTestOut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#1E293B',
  },
  unitStageTestOutText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  nodeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingVertical: 4, paddingRight: spacing.md },
  nodeRowItem: { flexDirection: 'row', alignItems: 'flex-end' },
  nodeRowDash: { width: 14, height: 3, borderRadius: 999, marginBottom: 28, marginHorizontal: 2 },
  nodeSnakeWrap: { alignSelf: 'center', width: '100%', maxWidth: 440, paddingHorizontal: 36, position: 'relative', marginTop: 8 },
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
  unitBannerMiniBadgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
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
  unitEyebrow: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.8 },
  unitTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  unitDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 12, textAlign: 'center' },
  unitProgressText: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', marginTop: 2 },
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
  unitBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  unitTestOut: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: '#FFFFFF' },
  unitTestOutText: { color: '#334155', fontSize: 12, fontWeight: '900' },
  nodeColumn: { alignItems: 'center', alignSelf: 'center', gap: 22, paddingVertical: spacing.xs, zIndex: 1 },
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
  unitLockText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  nodeWrap: { alignItems: 'center' },
  node: { alignItems: 'center', justifyContent: 'center' },
  nodeCrown: { position: 'absolute', top: -10, right: -2 },
  videoWatchedBadge: {
    position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#10B981', borderWidth: 2, borderColor: '#FFFFFF',
  },
  videoLabel: { maxWidth: 150, textAlign: 'center' },
  ring: { position: 'absolute', left: 0, top: 0 },
  pathMascot: { position: 'absolute' },
  popover: { width: 270, padding: spacing.md, borderRadius: 18, gap: 2, marginTop: 6 },
  popoverArrow: { position: 'absolute', top: -7, left: 127, width: 16, height: 16, transform: [{ rotate: '45deg' }] },
  popoverClose: { position: 'absolute', top: 6, right: 6, padding: 6, zIndex: 2 },
  popoverTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  popoverMeta: { color: 'rgba(255,255,255,0.88)', fontSize: 12, fontWeight: '800' },
  popoverHint: { color: 'rgba(255,255,255,0.82)', fontSize: 12, marginTop: 2 },
  popoverButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, marginTop: 10, borderRadius: 12, backgroundColor: '#FFFFFF',
  },
  popoverButtonText: { fontSize: 14, fontWeight: '900', letterSpacing: 0.6 },
  hubPopover: { width: '100%', maxWidth: 340, alignSelf: 'center', gap: 8 },
  hubLevelRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.1)',
  },
  hubLevelRowLocked: { opacity: 0.6, borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.1)' },
  hubLevelIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
  hubLevelTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  hubLevelHint: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 1 },
  hubLevelXp: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', marginTop: 2 },
  hubLevelBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#FFFFFF' },
  hubLevelBtnText: { color: '#1E293B', fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  comboChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F97316' },
  comboText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  nodeBubble: {
    marginBottom: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, overflow: 'hidden', backgroundColor: '#FFFFFF',
    borderWidth: 1, borderColor: colors.line, fontSize: 11, fontWeight: '900', letterSpacing: 0.8,
  },
  nodeLabel: { marginTop: 8, color: '#334155', fontSize: 12, fontWeight: '900' },
  pathResult: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: 22, borderWidth: 1 },
  pathResultOk: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  pathResultBad: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  pathResultIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pathResultTitle: { fontSize: 14, fontWeight: '900' },
});
