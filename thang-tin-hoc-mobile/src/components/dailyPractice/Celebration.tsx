import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { Award, Check, Crown, Flame, Gift, Star, Trophy } from 'lucide-react-native';
import { Mascot } from './Mascot';
import { DuoButton } from '../duo/DuoButton';
import { AchievementPopup } from './AchievementPopup';
import type { GameSound } from './useGameSounds';
import type { DpSummary } from '../../services/dailyPracticeApi';
import { spacing } from '../../theme/tokens';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    if (!end) return undefined;
    const anim = new Animated.Value(0);
    const id = anim.addListener(({ value: v }) => setValue(Math.round(v)));
    Animated.timing(anim, { toValue: end, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => { anim.removeListener(id); anim.stopAnimation(); };
  }, [target, duration]);
  return value;
}

/** Hiện dần + nảy nhẹ khi xuất hiện. */
function PopIn({ delay = 0, children, style }: { delay?: number; children: React.ReactNode; style?: object }) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(value, { toValue: 1, delay, friction: 6, tension: 90, useNativeDriver: USE_NATIVE_DRIVER }).start();
  }, [delay, value]);
  return (
    <Animated.View style={[style, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

function Shell({ children, button, onNext }: { children: React.ReactNode; button: string; onNext: () => void }) {
  return (
    <View style={styles.shell}>
      {children}
      <View style={{ width: '100%', marginTop: spacing.sm }}>
        <DuoButton
          variant="primary"
          size="lg"
          fullWidth
          text={button}
          onPress={onNext}
        />
      </View>
    </View>
  );
}

function DoneStage({
  summary,
  play,
  onNext,
  onClose,
  onReviewResults,
}: {
  summary: DpSummary;
  play: (s: GameSound) => void;
  onNext: () => void;
  onClose?: () => void;
  onReviewResults?: () => void;
}) {
  const isPerfect = Boolean(
    summary &&
    (summary.total || 0) >= 2 &&
    (summary.correctCount === summary.total || summary.maxCombo === summary.total)
  );
  const good = summary.stars >= 2;
  useEffect(() => {
    if (isPerfect) play('mascotVictory');
    else play(good ? 'win' : 'sad');
  }, [good, isPerfect, play]);

  return (
    <View style={styles.doneOverlay}>
      <AchievementPopup
        summary={summary}
        play={play}
        onContinue={onNext}
        onReviewResults={onReviewResults || onNext}
        onClose={onClose || onNext}
      />
    </View>
  );
}

function CourseTrophyStage({ summary, play, onNext }: { summary: DpSummary; play: (s: GameSound) => void; onNext: () => void }) {
  const pathResult = summary.path;
  const isFullCourse = Boolean(pathResult?.topicCompleted);
  useEffect(() => {
    play('win');
  }, [play]);
  return (
    <Shell button="NHẬN CÚP VINH DANH" onNext={onNext}>
      <PopIn style={styles.trophyCard}>
        <View style={styles.trophyBadge}>
          <Crown size={14} color="#D97706" fill="#FBBF24" />
          <Text style={styles.trophyBadgeText}>
            {isFullCourse ? 'VINH DANH HOÀN THÀNH KHÓA HỌC' : `HOÀN THÀNH CHẶNG · ${pathResult?.unitTitle || ''}`}
          </Text>
        </View>
        <View style={styles.trophyCenterRow}>
          <Mascot mood="graduate" size={88} />
          <View style={{ alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: 4, marginBottom: 6 }}>
              {[1, 2, 3].map((n) => (
                <Star key={n} size={n === 2 ? 22 : 17} color="#F59E0B" fill="#FBBF24" />
              ))}
            </View>
            <View style={styles.trophyCupBox}>
              <Trophy size={46} color="#FFFFFF" />
            </View>
            <Text style={styles.trophyRibbon}>{isFullCourse ? 'CÚP VÀNG TOÀN KHÓA' : 'CÚP VƯỢT CHẶNG'}</Text>
          </View>
          <Mascot mood="celebrate" size={88} />
        </View>
        <Text style={styles.trophyTitle}>
          {isFullCourse ? 'Chúc mừng bạn đã hoàn thành khóa học!' : `Chinh phục thành công ${pathResult?.unitTitle || 'chặng học'}!`}
        </Text>
        <Text style={styles.trophyDesc}>
          {isFullCourse
            ? 'Tuyệt vời! Bạn đã vượt qua toàn bộ các chặng thử thách và rước Cúp Vàng Vinh Danh!'
            : (pathResult?.unlockedUnit
              ? `Xuất sắc! Bạn đã mở khóa Chặng ${pathResult.unlockedUnit.index}: ${pathResult.unlockedUnit.title}.`
              : 'Phong độ rất ấn tượng! Hãy tiếp tục tiến bước trên lộ trình chinh phục khóa học.')}
        </Text>
        <View style={styles.trophyMetaPill}>
          <Award size={15} color="#D97706" />
          <Text style={styles.trophyMetaText}>{`Đạt ${pathResult?.scorePercent || 100}% chính xác · Danh hiệu Học Viên Xuất Sắc`}</Text>
        </View>
      </PopIn>
    </Shell>
  );
}

function StreakStage({ summary, play, onNext }: { summary: DpSummary; play: (s: GameSound) => void; onNext: () => void }) {
  const streak = summary.stats?.streak || 1;
  const count = useCountUp(streak, 700);
  const flicker = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    play('correct');
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flicker, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(flicker, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: USE_NATIVE_DRIVER }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [flicker, play]);
  return (
    <Shell button="TIẾP TỤC" onNext={onNext}>
      <PopIn style={styles.speech}>
        <Text style={styles.speechText}>
          {streak > 1 ? `Chuỗi ${streak} ngày rồi! Giữ lửa mỗi ngày để kiến thức nhớ thật lâu nhé.` : 'Chuỗi tỏa sáng! Hãy luyện tập mỗi ngày để tạo thói quen học tập nhé.'}
        </Text>
      </PopIn>
      <Animated.View style={{ transform: [{ scale: flicker.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] }) }] }}>
        <Flame size={130} color="#F97316" fill="#FB923C" />
      </Animated.View>
      <Text style={styles.streakNumber}>{count}</Text>
      <Text style={styles.streakLabel}>ngày liên tiếp</Text>
      {summary.week?.length ? (
        <View style={styles.weekRow}>
          {summary.week.map((day, index) => (
            <View key={day.day} style={styles.weekDay}>
              <Text style={[styles.weekLabel, day.today && { color: '#F97316' }]}>{day.label}</Text>
              <PopIn delay={index * 70} style={[styles.weekDot, day.played && styles.weekDotOn]}>
                {day.played ? <Check size={16} color="#FFFFFF" strokeWidth={3.5} /> : null}
              </PopIn>
            </View>
          ))}
        </View>
      ) : null}
    </Shell>
  );
}

function QuestStage({ play, onNext }: { play: (s: GameSound) => void; onNext: () => void }) {
  const fill = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fill, { toValue: 1, duration: 700, delay: 250, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(() => play('win'));
  }, [fill, play]);
  return (
    <Shell button="TIẾP TỤC" onNext={onNext}>
      <Text style={styles.questTitle}>Hoàn thành nhiệm vụ hằng ngày!</Text>
      <PopIn style={styles.questCard}>
        <Text style={styles.questName}>Luyện tập 1 lượt hôm nay</Text>
        <View style={styles.questRow}>
          <View style={styles.questTrack}>
            <Animated.View style={[styles.questFill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
            <Text style={styles.questCount}>1 / 1</Text>
          </View>
          <View style={styles.questChest}><Gift size={24} color="#FFFFFF" /></View>
        </View>
      </PopIn>
    </Shell>
  );
}

/**
 * Chuỗi màn ăn mừng sau lượt chơi (kiểu Duolingo):
 * Đã luyện tập xong → chuỗi ngày (khi tăng) → nhiệm vụ hằng ngày (lượt đầu trong ngày) → kết quả chi tiết.
 */
export function Celebration({
  summary,
  play,
  onDone,
  onClose,
  onReviewResults,
}: {
  summary: DpSummary;
  play: (s: GameSound) => void;
  onDone: () => void;
  onClose?: () => void;
  onReviewResults?: () => void;
}) {
  const hasTrophyStage = Boolean(summary.path?.passed && (summary.path?.topicCompleted || summary.path?.unitCompleted || summary.path?.testOut));
  const stages = useMemo(() => [
    'done',
    ...(hasTrophyStage ? ['trophy'] : []),
    ...(summary.streakIncreased ? ['streak'] : []),
    ...(summary.firstToday ? ['quest'] : []),
  ], [summary, hasTrophyStage]);
  const [index, setIndex] = useState(0);
  const next = () => {
    play('tap');
    if (index + 1 < stages.length) setIndex(index + 1);
    else onDone();
  };
  const stage = stages[index];
  if (stage === 'trophy') return <CourseTrophyStage key="trophy" summary={summary} play={play} onNext={next} />;
  if (stage === 'streak') return <StreakStage key="streak" summary={summary} play={play} onNext={next} />;
  if (stage === 'quest') return <QuestStage key="quest" play={play} onNext={next} />;
  return (
    <DoneStage
      key="done"
      summary={summary}
      play={play}
      onNext={next}
      onClose={onClose}
      onReviewResults={onReviewResults}
    />
  );
}

const styles = StyleSheet.create({
  doneOverlay: {
    flex: 1,
    minHeight: 480,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(15, 23, 42, 0.44)',
  },
  shell: { minHeight: 560, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.lg },
  button: {
    alignSelf: 'stretch', minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
    backgroundColor: '#0EA5E9', boxShadow: '0px 5px 0px #0369A1',
  } as never,
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  doneTitle: { color: '#0284C7', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  doneCaption: { color: '#64748B', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: -6 },
  statRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  statCard: { flex: 1, borderWidth: 2, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  statLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', textAlign: 'center', paddingVertical: 4, letterSpacing: 0.6 },
  statBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12 },
  statValue: { fontSize: 19, fontWeight: '900' },
  speech: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  speechText: { color: '#475569', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  streakNumber: { color: '#F97316', fontSize: 72, fontWeight: '900', lineHeight: 78 },
  streakLabel: { color: '#F97316', fontSize: 22, fontWeight: '900', marginTop: -spacing.md },
  weekRow: { flexDirection: 'row', alignSelf: 'stretch', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 6 },
  weekLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '900' },
  weekDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E2E8F0' },
  weekDotOn: { backgroundColor: '#F97316' },
  questTitle: { color: '#F59E0B', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  questCard: { alignSelf: 'stretch', padding: spacing.lg, borderRadius: 22, borderWidth: 2, borderColor: '#FCD34D', backgroundColor: '#FFFBEB', gap: spacing.sm },
  questName: { color: '#92400E', fontSize: 17, fontWeight: '900' },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  questTrack: { flex: 1, height: 24, borderRadius: 999, backgroundColor: 'rgba(253, 230, 138, 0.7)', overflow: 'hidden', justifyContent: 'center' },
  questFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 999, backgroundColor: '#FBBF24' },
  questCount: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', textAlign: 'center' },
  questChest: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0EA5E9' },
  trophyCard: {
    alignSelf: 'stretch', alignItems: 'center', padding: spacing.lg, borderRadius: 28, borderWidth: 2,
    borderColor: '#FCD34D', backgroundColor: '#FFFBEB', gap: 12,
  },
  trophyBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999, borderWidth: 1, borderColor: '#FCD34D', backgroundColor: '#FEF3C7',
  },
  trophyBadgeText: { color: '#92400E', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  trophyCenterRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 4 },
  trophyCupBox: {
    width: 92, height: 92, borderRadius: 24, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#F59E0B', borderWidth: 3, borderColor: '#FDE68A',
  },
  trophyRibbon: {
    marginTop: 8, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8,
    backgroundColor: '#78350F', color: '#FEF3C7', fontSize: 11, fontWeight: '900', letterSpacing: 0.6,
  },
  trophyTitle: { color: '#0F172A', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  trophyDesc: { color: '#475569', fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 21 },
  trophyMetaPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 14, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A',
  },
  trophyMetaText: { color: '#92400E', fontSize: 12, fontWeight: '800' },
  perfectBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999, backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A',
    marginBottom: -4,
  },
  perfectBadgeText: {
    color: '#92400E', fontSize: 11, fontWeight: '900', letterSpacing: 0.6,
  },
});
