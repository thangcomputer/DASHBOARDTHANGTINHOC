import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Check, Gift, Lock, Sparkles, X, Zap } from 'lucide-react-native';
import type { GameSound } from './useGameSounds';
import { DpPathUnit, dailyPracticeApi, UNIT_CHEST_REWARD_XP } from '../../services/dailyPracticeApi';

function unitStepProgress(unit: DpPathUnit) {
  const steps = unit.steps || [];
  const totalSteps = steps.length;
  const doneSteps = steps.filter((step) => step.state === 'completed').length;
  return { doneSteps, totalSteps };
}

const CONFETTI_COLORS = ['#F59E0B', '#10B981', '#3B82F6', '#EC4899', '#8B5CF6', '#F97316', '#EAB308'];

function ChestCelebrationConfetti({ count = 26 }: { count?: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  const pieces = useMemo(() => Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (i % 3) * 0.15;
    const distance = 90 + ((i * 37) % 75);
    return {
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance - 25,
      rot: `${(i % 2 ? 1 : -1) * (180 + i * 25)}deg`,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: (i % 3 === 0) ? 9 : 6,
      shape: i % 2 === 0 ? 'rect' : 'circle',
    };
  }), [count]);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 1100,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [anim]);

  return (
    <View pointerEvents="none" style={styles.confettiHost}>
      {pieces.map((p, idx) => (
        <Animated.View
          key={idx}
          style={[
            styles.confettiPiece,
            {
              width: p.size,
              height: p.size * (p.shape === 'rect' ? 1.5 : 1),
              borderRadius: p.shape === 'circle' ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity: anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 0.9, 0] }),
              transform: [
                { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
                { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.rot] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function useAnimatedCount(target: number, duration: number = 850, active: boolean = false) {
  const [count, setCount] = useState(1);

  useEffect(() => {
    if (!active || target <= 0) {
      setCount(1);
      return;
    }
    let startTimestamp: number | null = null;
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic: fast start, smooth deceleration into target
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.max(1, Math.round(1 + (target - 1) * ease));
      setCount(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration, active]);

  return count;
}

type Props = {
  unit: DpPathUnit;
  play?: (sound: GameSound) => void;
  onClaimed?: () => void;
  variant?: 'bar' | 'chip';
};

export function UnitStageChest({ unit, play, onClaimed, variant = 'bar' }: Props) {
  const { doneSteps, totalSteps } = unitStepProgress(unit);
  const rewardXp = unit.chestRewardXp ?? UNIT_CHEST_REWARD_XP;
  const complete = unit.state === 'completed' || (totalSteps > 0 && doneSteps >= totalSteps);
  const claimed = Boolean(unit.chestClaimed);
  const claimable = complete && !claimed;
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const [claimedXp, setClaimedXp] = useState(rewardXp);

  const doneStyle = complete && !claimed;
  const claimedStyle = claimed;

  const liveCounter = useAnimatedCount(claimedXp, 850, showCelebration);

  // Animations for celebration popup
  const scaleAnim = useRef(new Animated.Value(0.2)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const chestBounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (showCelebration) {
      scaleAnim.setValue(0.2);
      opacityAnim.setValue(0);
      chestBounce.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 75,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();

      const bounceLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(chestBounce, {
            toValue: -10,
            duration: 650,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }),
          Animated.timing(chestBounce, {
            toValue: 0,
            duration: 650,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: Platform.OS !== 'web',
          }),
        ])
      );
      bounceLoop.start();

      return () => bounceLoop.stop();
    }
  }, [showCelebration, scaleAnim, opacityAnim, chestBounce]);

  const onPress = async () => {
    if (!claimable || claiming) return;
    setError('');
    setClaiming(true);
    play?.('tap');
    try {
      const result = await dailyPracticeApi.claimUnitChest(unit.id);
      const earned = Number(result?.xp) || rewardXp || 50;
      setClaimedXp(earned);
      setShowCelebration(true);
      if (earned > 0) {
        play?.('win');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không mở được rương');
    } finally {
      setClaiming(false);
    }
  };

  const handleCloseCelebration = () => {
    setShowCelebration(false);
    onClaimed?.();
  };

  const content = (
    <>
      <View style={[styles.iconBox, claimedStyle ? styles.iconClaimed : doneStyle ? styles.iconDone : styles.iconPending]}>
        {claimedStyle ? <Check size={20} color="#FFFFFF" strokeWidth={3} /> : <Gift size={20} color={doneStyle ? '#FFFFFF' : '#94A3B8'} strokeWidth={2.5} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, (claimedStyle || doneStyle) && (claimedStyle ? styles.titleClaimed : styles.titleDone)]}>
          {claimedStyle
            ? `Đã mở rương · +${rewardXp} XP`
            : doneStyle
              ? `Mở rương chặng · +${rewardXp} XP`
              : `Rương phần thưởng chặng (${doneSteps}/${totalSteps})`}
        </Text>
        <Text style={styles.sub}>
          {claimedStyle
            ? 'Phần thưởng đã vào ví XP của bạn'
            : doneStyle
              ? 'Chúc mừng bạn đã chinh phục toàn bộ chặng!'
              : 'Hoàn thành các bài tập để nhận quà'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      {claimedStyle ? (
        <View style={[styles.badge, styles.badgeClaimed]}>
          <Sparkles size={14} color="#059669" />
        </View>
      ) : doneStyle ? (
        <View style={styles.badge}>
          {claiming ? <ActivityIndicator size="small" color="#D97706" /> : <Sparkles size={14} color="#D97706" />}
        </View>
      ) : (
        <Lock size={16} color="#CBD5E1" />
      )}
    </>
  );

  const ariaLabel = claimedStyle
    ? `Đã mở rương chặng, +${rewardXp} XP`
    : doneStyle
      ? `Mở rương chặng, nhận ${rewardXp} XP`
      : `Rương phần thưởng chặng ${doneSteps}/${totalSteps}`;

  const chipIcon = (
    <View style={[styles.chipIcon, claimedStyle ? styles.iconClaimed : doneStyle ? styles.iconDone : styles.iconPending]}>
      {claimedStyle ? (
        <Check size={18} color="#FFFFFF" strokeWidth={3} />
      ) : doneStyle && claiming ? (
        <ActivityIndicator size="small" color="#FFFFFF" />
      ) : (
        <Gift size={18} color={doneStyle ? '#FFFFFF' : '#94A3B8'} strokeWidth={2.5} />
      )}
    </View>
  );

  const chipProgress = (
    <Text style={[styles.chipCount, claimedStyle ? styles.chipCountClaimed : doneStyle ? styles.chipCountDone : styles.chipCountPending]}>
      {claimedStyle ? `+${rewardXp}` : `${doneSteps}/${totalSteps}`}
    </Text>
  );

  const chipWrapStyle = [styles.chipWrap, doneStyle && !claimedStyle && styles.chipWrapReady];

  const chipNode = (
    <View style={chipWrapStyle}>
      {chipIcon}
      {chipProgress}
    </View>
  );

  return (
    <>
      {variant === 'chip' ? (
        claimable ? (
          <Pressable
            onPress={onPress}
            disabled={claiming}
            style={chipWrapStyle}
            accessibilityRole="button"
            accessibilityLabel={ariaLabel}
          >
            {chipIcon}
            {chipProgress}
          </Pressable>
        ) : (
          <View accessibilityLabel={ariaLabel}>{chipNode}</View>
        )
      ) : (
        <View style={styles.wrap}>
          {claimable ? (
            <Pressable
              onPress={onPress}
              disabled={claiming}
              style={[styles.box, styles.boxDone, claiming && styles.boxBusy]}
              accessibilityRole="button"
              accessibilityLabel={ariaLabel}
            >
              {content}
            </Pressable>
          ) : (
            <View style={[styles.box, claimedStyle ? styles.boxClaimed : doneStyle ? styles.boxDone : styles.boxPending]}>
              {content}
            </View>
          )}
        </View>
      )}

      {/* Modal hiệu ứng bay ra nhận 50XP + lớp phủ trắng mờ chuyên nghiệp */}
      <Modal
        visible={showCelebration}
        transparent
        animationType="none"
        onRequestClose={handleCloseCelebration}
      >
        <View style={styles.modalRoot}>
          {Platform.OS === 'ios' || Platform.OS === 'android' ? (
            <BlurView intensity={70} tint="light" style={StyleSheet.absoluteFill}>
              <View style={styles.backdropTint} />
            </BlurView>
          ) : (
            <View style={styles.backdropWeb} />
          )}

          <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseCelebration} />

          {/* Hạt pháo hoa confetti bay bung ra từ rương */}
          <ChestCelebrationConfetti count={28} />

          <Animated.View
            style={[
              styles.celebrationCard,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Pressable
              onPress={handleCloseCelebration}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Đóng"
            >
              <X size={18} color="#64748B" strokeWidth={2.5} />
            </Pressable>

            {/* Tag chúc mừng */}
            <View style={styles.badgeCelebration}>
              <Sparkles size={13} color="#D97706" />
              <Text style={styles.badgeCelebrationText}>PHẦN THƯỞNG HOÀN THÀNH CHẶNG</Text>
            </View>

            {/* Rương nhảy nhót bay ra với hào quang vàng */}
            <Animated.View style={[styles.chestContainer, { transform: [{ translateY: chestBounce }] }]}>
              <View style={styles.chestGlowHalo} />
              <View style={styles.chestBigIcon}>
                <Gift size={42} color="#FFFFFF" strokeWidth={2.5} />
                <View style={styles.sparkleFloating}>
                  <Sparkles size={20} color="#FDE047" />
                </View>
              </View>
            </Animated.View>

            {/* Tiêu đề */}
            <Text style={styles.celebrationTitle}>Mở Rương Thành Công!</Text>
            <Text style={styles.celebrationSub}>
              Chúc mừng bạn đã chinh phục toàn bộ chặng học và nhận trọn vẹn phần thưởng!
            </Text>

            {/* Khung số XP nhảy số siêu nhanh và mượt từ 1 đến 50 */}
            <View style={styles.xpCounterBox}>
              <View style={styles.xpIconWrap}>
                <Zap size={24} color="#D97706" fill="#FBBF24" />
              </View>
              <Text style={styles.xpCounterNumber}>+{liveCounter} XP</Text>
            </View>

            <Text style={styles.xpNote}>
              {liveCounter >= claimedXp ? '✨ 50 XP đã được cộng vào ví của bạn!' : 'Đang đồng bộ phần thưởng...'}
            </Text>

            {/* Nút nhận thưởng 3D xanh nổi bật */}
            <Pressable
              onPress={handleCloseCelebration}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel="Tuyệt vời, nhận ngay"
            >
              <Check size={20} color="#FFFFFF" strokeWidth={3} />
              <Text style={styles.actionBtnText}>Tuyệt vời · Nhận ngay</Text>
            </Pressable>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chipWrap: {
    alignItems: 'center',
    gap: 2,
  },
  chipWrapReady: {
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 0 12px rgba(251,191,36,0.45)',
    } : {
      shadowColor: '#F59E0B',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 8,
      elevation: 4,
    }),
  },
  chipIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#CBD5E1',
  },
  chipCount: {
    fontSize: 9,
    fontWeight: '900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  chipCountPending: { backgroundColor: '#F8FAFC', color: '#64748B' },
  chipCountDone: { backgroundColor: '#FEF3C7', color: '#92400E' },
  chipCountClaimed: { backgroundColor: '#D1FAE5', color: '#065F46' },
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 22,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  box: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  boxPending: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  boxDone: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
  boxClaimed: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  boxBusy: { opacity: 0.85 },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPending: { backgroundColor: '#E2E8F0' },
  iconDone: { backgroundColor: '#F59E0B' },
  iconClaimed: { backgroundColor: '#10B981' },
  title: { fontSize: 14, fontWeight: '800', color: '#475569' },
  titleDone: { color: '#92400E' },
  titleClaimed: { color: '#065F46' },
  sub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  error: { fontSize: 11, color: '#DC2626', marginTop: 4, fontWeight: '600' },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeClaimed: { backgroundColor: '#D1FAE5' },

  /* Modal celebration & lớp phủ trắng */
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
  },
  backdropWeb: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    ...(Platform.OS === 'web' ? {
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
    } : {}),
  },
  confettiHost: {
    position: 'absolute',
    left: '50%',
    top: '46%',
    width: 0,
    height: 0,
    zIndex: 10,
  },
  confettiPiece: {
    position: 'absolute',
  },
  celebrationCard: {
    width: '100%',
    maxWidth: 350,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    zIndex: 20,
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 25px 50px -12px rgba(245, 158, 11, 0.25), 0 0 0 1px rgba(251, 191, 36, 0.2)',
    } : {
      shadowColor: '#D97706',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.25,
      shadowRadius: 24,
      elevation: 12,
    }),
  },
  closeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  badgeCelebration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 16,
  },
  badgeCelebrationText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#92400E',
    letterSpacing: 0.5,
  },
  chestContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  chestGlowHalo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(251, 191, 36, 0.25)',
  },
  chestBigIcon: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FEF08A',
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)',
      boxShadow: '0 12px 28px rgba(245, 158, 11, 0.45)',
    } : {
      shadowColor: '#D97706',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    }),
  },
  sparkleFloating: {
    position: 'absolute',
    top: -6,
    right: -8,
  },
  celebrationTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  celebrationSub: {
    fontSize: 12.5,
    lineHeight: 18,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 10,
    marginBottom: 18,
  },
  xpCounterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#FFFBEB',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FDE68A',
    marginBottom: 6,
    minWidth: 170,
  },
  xpIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpCounterNumber: {
    fontSize: 34,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: -0.5,
  },
  xpNote: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#059669',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: '#059669',
    borderBottomWidth: 4,
    borderBottomColor: '#047857',
    ...(Platform.OS === 'web' ? {
      boxShadow: '0 8px 18px rgba(5, 150, 105, 0.35)',
    } : {
      shadowColor: '#059669',
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 6,
    }),
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
