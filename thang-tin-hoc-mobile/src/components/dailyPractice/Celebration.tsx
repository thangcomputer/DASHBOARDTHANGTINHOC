import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Flame, Gift, Target, Timer, Zap, type LucideIcon } from 'lucide-react-native';
import { Mascot } from './Mascot';
import type { GameSound } from './useGameSounds';
import type { DpSummary } from '../../services/dailyPracticeApi';
import { spacing } from '../../theme/tokens';

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
    Animated.spring(value, { toValue: 1, delay, friction: 6, tension: 90, useNativeDriver: true }).start();
  }, [delay, value]);
  return (
    <Animated.View style={[style, { opacity: value, transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

function formatDuration(seconds?: number) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function StatCard({ label, tone, icon: Icon, value, delay }: { label: string; tone: string; icon: LucideIcon; value: string | number; delay: number }) {
  return (
    <PopIn delay={delay} style={[styles.statCard, { borderColor: tone }]}>
      <Text style={[styles.statLabel, { backgroundColor: tone }]}>{label}</Text>
      <View style={styles.statBody}>
        <Icon size={18} color={tone} />
        <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
      </View>
    </PopIn>
  );
}

function Shell({ children, button, onNext }: { children: React.ReactNode; button: string; onNext: () => void }) {
  return (
    <View style={styles.shell}>
      {children}
      <Pressable onPress={onNext} style={styles.button} accessibilityRole="button">
        <Text style={styles.buttonText}>{button}</Text>
      </Pressable>
    </View>
  );
}

function DoneStage({ summary, play, onNext }: { summary: DpSummary; play: (s: GameSound) => void; onNext: () => void }) {
  const xp = useCountUp(summary.gainedXp);
  const good = summary.stars >= 2;
  const fly = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    play(good ? 'win' : 'sad');
    Animated.spring(fly, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }).start();
  }, [fly, good, play]);
  return (
    <Shell button="NHẬN XP" onNext={onNext}>
      <Animated.View style={{ opacity: fly, transform: [{ translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }, { rotate: fly.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) }] }}>
        <Mascot mood={good ? 'happy' : 'idle'} size={140} />
      </Animated.View>
      <Text style={styles.doneTitle}>{good ? 'Đã luyện tập xong!' : 'Hoàn thành lượt luyện!'}</Text>
      <View style={styles.statRow}>
        <StatCard label="TỔNG XP" tone="#F59E0B" icon={Zap} value={xp} delay={150} />
        <StatCard label="COMBO" tone="#0EA5E9" icon={Target} value={`x${summary.maxCombo || 0}`} delay={300} />
        <StatCard label="THỜI GIAN" tone="#10B981" icon={Timer} value={formatDuration(summary.durationSeconds)} delay={450} />
      </View>
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
      Animated.timing(flicker, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(flicker, { toValue: 0, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
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
export function Celebration({ summary, play, onDone }: { summary: DpSummary; play: (s: GameSound) => void; onDone: () => void }) {
  const stages = useMemo(() => [
    'done',
    ...(summary.streakIncreased ? ['streak'] : []),
    ...(summary.firstToday ? ['quest'] : []),
  ], [summary]);
  const [index, setIndex] = useState(0);
  const next = () => {
    play('tap');
    if (index + 1 < stages.length) setIndex(index + 1);
    else onDone();
  };
  const stage = stages[index];
  if (stage === 'streak') return <StreakStage key="streak" summary={summary} play={play} onNext={next} />;
  if (stage === 'quest') return <QuestStage key="quest" play={play} onNext={next} />;
  return <DoneStage key="done" summary={summary} play={play} onNext={next} />;
}

const styles = StyleSheet.create({
  shell: { minHeight: 560, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingVertical: spacing.lg },
  button: {
    alignSelf: 'stretch', minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm,
    backgroundColor: '#0EA5E9', boxShadow: '0px 5px 0px #0369A1',
  } as never,
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
  doneTitle: { color: '#0284C7', fontSize: 26, fontWeight: '900', textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
  statCard: { flex: 1, borderWidth: 2, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  statLabel: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', textAlign: 'center', paddingVertical: 4, letterSpacing: 0.6 },
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
});
