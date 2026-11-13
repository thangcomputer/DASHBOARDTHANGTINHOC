import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Award, CheckCircle2, Eye, GraduationCap, Play, PlayCircle, RotateCcw, Star, Target, Timer, Trophy, X, Zap,
} from 'lucide-react-native';
import { Mascot } from './Mascot';
import { DuoButton } from '../duo/DuoButton';
import type { GameSound } from './useGameSounds';
import { practiceFinishXpDisplay, type DpSummary } from '../../services/dailyPracticeApi';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

function formatDuration(seconds?: number) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    const anim = new Animated.Value(0);
    const id = anim.addListener(({ value: v }) => setValue(Math.round(v)));
    Animated.timing(anim, {
      toValue: end,
      duration: end ? duration : 0,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => {
      anim.removeListener(id);
      anim.stopAnimation();
    };
  }, [target, duration]);
  return value;
}

function StatTile({
  label,
  tone,
  Icon,
  value,
  bodyBg,
  delay,
  onPress,
  disabled,
}: {
  label: string;
  tone: string;
  Icon: typeof CheckCircle2;
  value: React.ReactNode;
  bodyBg: string;
  delay: number;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const scale = useRef(new Animated.Value(0.94)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, delay, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 120, delay, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, [delay, opacity, scale]);

  const inner = (
    <Animated.View style={[styles.statTile, { opacity: disabled ? 0.65 : opacity, transform: [{ scale }] }]}>
      <View style={[styles.statHead, { backgroundColor: tone }]}>
        <View style={styles.statHeadIcon}>
          <Icon size={11} color="#FFFFFF" />
        </View>
        <Text style={styles.statHeadText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.72}>
          {label}
        </Text>
      </View>
      <View style={[styles.statBody, { backgroundColor: bodyBg }]}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text style={[styles.statValue, { color: tone }]}>{value}</Text>
        ) : (
          value
        )}
      </View>
    </Animated.View>
  );

  if (onPress && !disabled) {
    return (
      <Pressable onPress={onPress} style={styles.statPressable}>
        {inner}
      </Pressable>
    );
  }
  return <View style={styles.statPressable}>{inner}</View>;
}

export function AchievementPopup({
  summary,
  play,
  onContinue,
  onReviewResults,
  onReplay,
  onDismiss,
  onRelatedVideo,
}: {
  summary: DpSummary;
  play?: (s: GameSound) => void;
  onContinue: () => void;
  onReviewResults?: () => void;
  onReplay?: () => void;
  onDismiss?: () => void;
  onRelatedVideo?: () => void;
}) {
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(width * 0.93, 380);

  const total = Math.max(1, Number(summary?.total) || 1);
  const correctCount = Math.max(0, Number(summary?.correctCount) || 0);
  const accuracy = typeof summary?.path?.scorePercent === 'number'
    ? summary.path.scorePercent
    : Math.round((correctCount / total) * 100);
  const xpDisplay = practiceFinishXpDisplay(summary);
  const animatedXp = useCountUp(xpDisplay.amount);
  const animatedAccuracy = useCountUp(accuracy);
  const stars = Number(summary?.stars) || (accuracy >= 90 ? 3 : accuracy >= 60 ? 2 : 1);
  const good = stars >= 2;
  const isPerfect = Boolean(
    summary &&
    (summary.total || 0) >= 2 &&
    (summary.correctCount === summary.total || summary.maxCombo === summary.total)
  );
  const mascotMood = good ? 'celebrate' : (summary?.passed ? 'graduate' : 'sad');
  const maxCombo = Math.max(0, Number(summary?.maxCombo) || 0);
  const durationLabel = formatDuration(summary.durationSeconds);
  const hasRelatedVideo = Boolean(summary.relatedLesson);

  const shell = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (good) play?.('win');
    Animated.timing(shell, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();
  }, [good, play, shell]);

  const xpValueText = xpDisplay.prefix ? `${xpDisplay.prefix}${animatedXp}` : `${animatedXp}`;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          width: cardWidth,
          opacity: shell,
          transform: [{ scale: shell.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }],
        },
      ]}
    >
      {onDismiss ? (
        <Pressable onPress={() => { play?.('tap'); onDismiss(); }} style={styles.closeBtn} accessibilityRole="button" accessibilityLabel="Đóng">
          <X size={17} color="#64748B" />
        </Pressable>
      ) : null}

      <View style={styles.header}>
        <View style={styles.starsRow}>
          {[1, 2, 3].map((n) => (
            <Star key={n} size={n === 2 ? 20 : 16} color={n <= stars ? '#F59E0B' : '#E2E8F0'} fill={n <= stars ? '#FBBF24' : '#E2E8F0'} />
          ))}
        </View>
        <View style={styles.heroRow}>
          <Mascot mood={mascotMood} size={92} />
          {isPerfect ? (
            <View style={styles.perfectBadge}>
              <Trophy size={34} color="#FFFFFF" />
              <Text style={styles.perfectBadgeText}>HOÀN HẢO</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.laurel}>🌿</Text>
          <View style={styles.titleBlock}>
            {isPerfect ? (
              <>
                <Text style={styles.titleMain}>Xuất sắc tuyệt đối!</Text>
                <Text style={styles.titleMain}>Đã luyện tập xong!</Text>
              </>
            ) : (
              <Text style={styles.titleMain}>{good ? 'Đã luyện tập xong!' : 'Hoàn thành lượt luyện!'}</Text>
            )}
          </View>
          <Text style={styles.laurel}>🌿</Text>
        </View>

        {xpDisplay.caption ? (
          <View style={[styles.xpPill, { maxWidth: cardWidth - 32 }]}>
            <Text style={styles.xpPillText} numberOfLines={3} textAlign="center">
              {xpDisplay.caption}
            </Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <StatTile label="CHÍNH XÁC" tone="#22C55E" Icon={CheckCircle2} value={`${animatedAccuracy}%`} bodyBg="#ECFDF5" delay={60} />
          <StatTile label="ĐIỂM SỐ" tone="#3B82F6" Icon={Award} value={`${correctCount}/${total}`} bodyBg="#EFF6FF" delay={140} />
          <StatTile label="NHẬN VỀ" tone="#F59E0B" Icon={Zap} value={xpValueText} bodyBg="#FFFBEB" delay={220} />
        </View>

        <View style={styles.actions}>
          {(onReplay || onReviewResults) ? (
            <View style={styles.actionsSecondaryRow}>
              {onReplay ? (
                <View style={styles.actionHalf}>
                  <DuoButton
                    variant="secondary"
                    size="sm"
                    fullWidth
                    text="Làm lại"
                    accessibilityLabel="Làm lại bài luyện tập"
                    icon={<RotateCcw size={14} color="#64748B" />}
                    onPress={onReplay}
                    textStyle={styles.actionTextCompact}
                    style={styles.actionBtnCompact}
                  />
                </View>
              ) : null}
              {onReviewResults ? (
                <View style={[styles.actionHalf, !onReplay && styles.actionHalfSolo]}>
                  <DuoButton
                    variant="secondary"
                    size="sm"
                    fullWidth
                    text="Xem lại"
                    accessibilityLabel="Xem lại kết quả"
                    icon={<Eye size={14} color="#64748B" />}
                    onPress={onReviewResults}
                    textStyle={styles.actionTextCompact}
                    style={styles.actionBtnCompact}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
          <DuoButton
            variant="primary"
            size="md"
            fullWidth
            text="TIẾP TỤC HỌC"
            icon={<Play size={15} color="#FFFFFF" fill="#FFFFFF" />}
            onPress={onContinue}
            style={styles.actionPrimaryBtn}
          />
        </View>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <GraduationCap size={16} color="#059669" />
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.statsRow}>
          <StatTile
            label="VIDEO LIÊN QUAN"
            tone="#F59E0B"
            Icon={PlayCircle}
            value={hasRelatedVideo ? <PlayCircle size={22} color="#F59E0B" /> : '—'}
            bodyBg="#FFFBEB"
            delay={300}
            onPress={hasRelatedVideo ? onRelatedVideo : undefined}
            disabled={!hasRelatedVideo}
          />
          <StatTile label="COMBO" tone="#3B82F6" Icon={Target} value={`×${maxCombo}`} bodyBg="#EFF6FF" delay={380} />
          <StatTile label="THỜI GIAN" tone="#22C55E" Icon={Timer} value={durationLabel} bodyBg="#ECFDF5" delay={460} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignSelf: 'center',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: 14,
    paddingBottom: 18,
    paddingHorizontal: 14,
    backgroundColor: '#D1FAE5',
  },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 8 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  perfectBadge: {
    width: 86,
    height: 86,
    borderRadius: 22,
    backgroundColor: '#F59E0B',
    borderWidth: 3,
    borderColor: '#FDE68A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  perfectBadgeText: { marginTop: 2, fontSize: 9, fontWeight: '900', color: '#78350F', letterSpacing: 0.6 },
  body: { paddingHorizontal: 12, paddingBottom: 14, paddingTop: 10, width: '100%' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 2 },
  laurel: { fontSize: 12, opacity: 0.85, width: 18, textAlign: 'center' },
  titleBlock: { flex: 1, minWidth: 0, alignItems: 'center' },
  titleMain: { color: '#065F46', fontSize: 16, fontWeight: '900', textAlign: 'center', lineHeight: 21 },
  xpPill: {
    alignSelf: 'center',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  xpPillText: { color: '#065F46', fontSize: 11, fontWeight: '700', lineHeight: 15 },
  statsRow: { flexDirection: 'row', gap: 5, marginTop: 12, width: '100%' },
  statPressable: { flex: 1, minWidth: 0 },
  statTile: { flex: 1, borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9' },
  statHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 5,
    paddingHorizontal: 3,
    minHeight: 30,
  },
  statHeadIcon: { flexShrink: 0, width: 14, alignItems: 'center' },
  statHeadText: {
    flex: 1,
    minWidth: 0,
    color: '#FFFFFF',
    fontSize: 7.5,
    fontWeight: '900',
    letterSpacing: 0.2,
    textAlign: 'center',
    lineHeight: 9,
  },
  statBody: { alignItems: 'center', justifyContent: 'center', paddingVertical: 8, minHeight: 42 },
  statValue: { fontSize: 14, fontWeight: '900' },
  actions: { marginTop: 12, width: '100%', gap: 8 },
  actionsSecondaryRow: { flexDirection: 'row', gap: 8, width: '100%' },
  actionHalf: { flex: 1, minWidth: 0 },
  actionHalfSolo: { flex: 1 },
  actionBtnCompact: { paddingHorizontal: 6, minWidth: 0 },
  actionTextCompact: { fontSize: 12, flexShrink: 1 },
  actionPrimaryBtn: { width: '100%' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#D1FAE5' },
});
