import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, DeviceEventEmitter, Easing, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import {
  ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Code2, Cpu, FileText, Flame, Gamepad2, Globe, Image as ImageIcon, Keyboard,
  Lightbulb, LogOut, Mail, Monitor, Play, PlayCircle, Presentation, RotateCcw, Sheet, ShieldCheck, Sparkles, Star, Trophy, XCircle, Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AppStackParamList } from '../navigation/types';
import { AppHeader, AppScreen } from '../components/ui';
import { Mascot, type MascotMood } from '../components/dailyPractice/Mascot';
import { DragProvider } from '../components/dailyPractice/DragKit';
import { FillQuestion, MatchQuestion, McqQuestion, OrderQuestion, SortQuestion, TrueFalseQuestion } from '../components/dailyPractice/Questions';
import { useGameSounds, type GameSound } from '../components/dailyPractice/useGameSounds';
import { LEARNING_GOAL_CHANGED_EVENT } from '../services/learningGoalApi';
import { getMobileImageSource } from '../services/apiClient';
import {
  DP_DIFFICULTIES, DP_TOPIC_COLORS, DP_TYPES, dailyPracticeApi, randomComfort, randomPraise, resultMessage,
  type DpAnswer, type DpAnswerResult, type DpDifficulty, type DpRelatedLesson, type DpReveal, type DpSession, type DpStats, type DpSummary,
  type DpTopic,
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
function HomeView({ topics, stats, loading, error, starting, onStart, play, initialTopicId = '' }: {
  topics: DpTopic[];
  stats: DpStats | null;
  loading: boolean;
  error: string;
  starting: boolean;
  onStart: (topicId: string, difficulty: DpDifficulty) => void;
  play: (s: GameSound) => void;
  initialTopicId?: string;
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
              Trả lời 10 câu để nhận XP và giữ chuỗi ngày 🔥
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

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? <ActivityIndicator color={colors.brand} /> : null}
      {!loading && !topics.length && !error ? (
        <View style={styles.empty}>
          <Mascot mood="thinking" size={72} />
          <Text style={styles.emptyTitle}>Trung tâm đang soạn câu hỏi luyện tập.</Text>
          <Text style={styles.muted}>Quay lại sau nhé!</Text>
        </View>
      ) : null}

      {topics.length ? (
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
  const question = session.questions[index];
  const total = session.questions.length;
  const meta = DP_TYPES[question.type];
  const level = DP_DIFFICULTIES.find((d) => d.id === question.difficulty) || DP_DIFFICULTIES[0];
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
      play(data.correct ? 'correct' : 'wrong');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được câu trả lời');
    } finally {
      setBusy(false);
    }
  }, [busy, play, question.id, result, session.id]);

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
          <View style={styles.xpPill}><Zap size={14} color="#F59E0B" fill="#FBBF24" /><Text style={styles.xpText}>{xp}</Text></View>
        </View>

        <Animated.View style={[styles.card, { transform: [{ translateX: shakeX }] }]}>
          {result?.correct ? <Confetti key={`c-${index}`} /> : null}
          <View style={styles.badgeRow}>
            <Text style={styles.badgeDark}>{`Câu ${index + 1}/${total}`}</Text>
            <Text style={[styles.badge, { backgroundColor: level.soft, color: level.color }]}>{`${meta.label} · ${level.label}`}</Text>
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

function ResultView({ summary, play, onReplay, onHome }: { summary: DpSummary; play: (s: GameSound) => void; onReplay: () => void; onHome: () => void }) {
  const good = summary.stars >= 2;
  const message = resultMessage(summary.stars);
  const stars = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    play(good ? 'win' : 'sad');
    Animated.stagger(180, stars.map((value, i) => Animated.spring(value, {
      toValue: i < summary.stars ? 1 : 0.6, friction: 4, tension: 120, useNativeDriver: true,
    }))).start();
  }, [good, play, stars, summary.stars]);

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
        <Pressable onPress={onHome} style={[styles.secondary, styles.flex]} accessibilityRole="button"><ArrowLeft size={17} color={colors.ink} /><Text style={styles.secondaryText}>Chủ đề khác</Text></Pressable>
        <Pressable onPress={onReplay} style={[styles.primary, styles.flex]} accessibilityRole="button"><RotateCcw size={17} color="#FFFFFF" /><Text style={styles.primaryText}>Chơi lại</Text></Pressable>
      </View>
    </View>
  );
}

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
  const [lastPick, setLastPick] = useState<{ topicId: string; difficulty: DpDifficulty } | null>(null);
  const [starting, setStarting] = useState(false);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const load = useCallback(() => {
    setLoading(true);
    dailyPracticeApi.overview()
      .then((data) => { setTopics(data.topics); setStats(data.stats); setError(''); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được luyện tập hằng ngày'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const start = async (topicId: string, difficulty: DpDifficulty) => {
    setStarting(true);
    setError('');
    try {
      const data = await dailyPracticeApi.start(topicId, difficulty);
      setLastPick({ topicId, difficulty });
      setSummary(null);
      setSession(data);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không bắt đầu được lượt chơi');
    } finally {
      setStarting(false);
    }
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
              setStats((prev) => (prev ? { ...prev, ...data.stats, todayXp: (prev.todayXp || 0) + data.gainedXp } : data.stats));
              DeviceEventEmitter.emit(LEARNING_GOAL_CHANGED_EVENT, null);
              scrollRef.current?.scrollTo({ y: 0, animated: false });
            }}
          />
        ) : summary ? (
          <ResultView
            summary={summary}
            play={play}
            onReplay={() => { if (lastPick) void start(lastPick.topicId, lastPick.difficulty); }}
            onHome={() => { setSummary(null); load(); }}
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
});
