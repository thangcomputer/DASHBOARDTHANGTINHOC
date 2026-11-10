import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CheckCircle, Crown, Sparkles, Star } from 'lucide-react-native';
import { Mascot } from './Mascot';
import type { GameSound } from './useGameSounds';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface MobilePerfectStreakOverlayProps {
  total?: number;
  play: (sound: GameSound) => void;
  onDone: () => void;
}

/**
 * Hiệu ứng toàn màn hình chúc mừng linh vật khi người học làm đúng hết liên tiếp (100% chính xác) trên Mobile.
 * Tự biến mất sau vài giây hoặc chạm để tiếp tục ngay.
 * Có âm thanh khải hoàn chiến thắng của linh vật.
 */
export function MobilePerfectStreakOverlay({
  total = 0,
  play,
  onDone,
}: MobilePerfectStreakOverlayProps) {
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;
  const crownBob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Phát âm thanh khải hoàn linh vật
    play('mascotVictory');

    // 2. Nảy pop-in thẻ chúc mừng
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 110,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    // 3. Vương miện nhấp nhô vui nhộn
    Animated.loop(
      Animated.sequence([
        Animated.timing(crownBob, { toValue: -6, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(crownBob, { toValue: 0, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      ])
    ).start();

    // 4. Tự động biến mất sau 3.2 giây
    const fadeTimer = setTimeout(() => {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }, 2900);

    const closeTimer = setTimeout(() => {
      onDone();
    }, 3200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [scaleAnim, opacityAnim, crownBob, onDone, play]);

  const handleDismiss = () => {
    Animated.timing(opacityAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start(() => onDone());
  };

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Pressable onPress={handleDismiss} style={styles.pressableBackdrop}>
        <Animated.View style={[styles.container, { opacity: opacityAnim }]}>
          {/* Nền mờ sang trọng với tone vàng rực */}
          <View style={styles.backdrop} />

          {/* Thẻ linh vật ăn mừng trung tâm */}
          <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
            {/* Vương miện vàng lơ lửng */}
            <Animated.View style={[styles.crownWrapper, { transform: [{ translateY: crownBob }] }]}>
              <View style={styles.crownCircle}>
                <Crown size={28} color="#B45309" fill="#F59E0B" />
              </View>
            </Animated.View>

            {/* Huy hiệu 100% */}
            <View style={styles.badge}>
              <Sparkles size={13} color="#D97706" />
              <Text style={styles.badgeText}>BÁCH PHÁT BÁCH TRÚNG 100%</Text>
              <Sparkles size={13} color="#D97706" />
            </View>

            {/* Linh vật ăn mừng vui vẻ */}
            <View style={styles.mascotBox}>
              <Mascot mood="celebrate" size={120} />
            </View>

            {/* Dãy sao vàng */}
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={18} color="#F59E0B" fill="#FBBF24" />
              ))}
            </View>

            {/* Tiêu đề */}
            <Text style={styles.title}>XUẤT SẮC TUYỆT ĐỐI! 🎯</Text>

            {/* Trạng thái chuỗi đúng hết */}
            <Text style={styles.streakNotice}>
              ĐÚNG HẾT TẤT CẢ CÁC CÂU LIÊN TIẾP!
            </Text>

            {/* Lời chúc chi tiết */}
            <Text style={styles.description}>
              {total
                ? `Bạn đã vượt qua toàn bộ ${total}/${total} câu hỏi liên tiếp mà không sai một câu nào. Phong độ đỉnh cao!`
                : 'Bạn đã hoàn thành 100% câu hỏi chính xác liên tiếp. Phong độ đỉnh cao!'}
            </Text>

            {/* Nút bấm xác nhận */}
            <Pressable
              onPress={handleDismiss}
              style={({ pressed }) => [styles.actionButton, pressed && styles.actionButtonPressed]}
              accessibilityRole="button"
            >
              <CheckCircle size={18} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Tuyệt vời, tiếp tục thôi!</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pressableBackdrop: {
    flex: 1,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 36,
    paddingBottom: 22,
    paddingHorizontal: 20,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    width: '100%',
    maxWidth: 350,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 16,
  },
  crownWrapper: {
    position: 'absolute',
    top: -24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FEF08A',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#B45309',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 8,
  },
  badgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  mascotBox: {
    marginVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  title: {
    color: '#0F172A',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  streakNotice: {
    color: '#B45309',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  description: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: 8,
    lineHeight: 18,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    alignSelf: 'stretch',
    paddingVertical: 13,
    borderRadius: 16,
    marginTop: 18,
    shadowColor: '#047857',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButtonPressed: {
    backgroundColor: '#047857',
    transform: [{ scale: 0.98 }],
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});
