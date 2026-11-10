import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Flame, Sparkles, Zap } from 'lucide-react-native';
import type { GameSound } from './useGameSounds';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface MobileComboLightningOverlayProps {
  combo?: number;
  play: (sound: GameSound) => void;
  onDone: () => void;
}

/**
 * Hiệu ứng toàn màn hình kiểu tia chớp bùng nổ khi đạt combo 3 câu liên tiếp đúng trên Mobile.
 * Tự động biến mất sau 2.2 giây, có âm thanh tia chớp kích thích hưng phấn học tập.
 */
export function MobileComboLightningOverlay({
  combo = 3,
  play,
  onDone,
}: MobileComboLightningOverlayProps) {
  const flashAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Phát âm thanh tia sét
    play('lightning');

    // 2. Chuỗi animation chớp sáng (Lightning Flash)
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 1, duration: 70, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(flashAnim, { toValue: 0.25, duration: 50, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(flashAnim, { toValue: 0.95, duration: 70, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(flashAnim, { toValue: 0.75, duration: 120, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    // 3. Rung giật màn hình (Screen Shake)
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 12, duration: 45, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: -12, duration: 45, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 8, duration: 45, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 45, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 45, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();

    // 4. Nảy pop-in huy hiệu trung tâm
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      tension: 140,
      useNativeDriver: USE_NATIVE_DRIVER,
    }).start();

    // 5. Tự động biến mất sau 2.2 giây
    const fadeTimer = setTimeout(() => {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.quad),
        useNativeDriver: USE_NATIVE_DRIVER,
      }).start();
    }, 1800);

    const closeTimer = setTimeout(() => {
      onDone();
    }, 2200);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [flashAnim, scaleAnim, shakeAnim, opacityAnim, onDone, play]);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View
        style={[
          styles.container,
          {
            opacity: opacityAnim,
            transform: [{ translateX: shakeAnim }],
          },
        ]}
      >
        {/* Màn chớp điện tối kết hợp ánh sáng chớp vàng rực */}
        <Animated.View
          style={[
            styles.flashBackdrop,
            {
              opacity: flashAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.7, 0.95],
              }),
            },
          ]}
        />

        {/* Thẻ Combo trung tâm */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Vòng hào quang tia sét */}
          <View style={styles.haloRing}>
            <View style={styles.iconCircle}>
              <Zap size={44} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          </View>

          {/* Huy hiệu Tia chớp bùng nổ */}
          <View style={styles.badge}>
            <Flame size={14} color="#FEF08A" />
            <Text style={styles.badgeText}>TIA CHỚP BÙNG NỔ</Text>
            <Flame size={14} color="#FEF08A" />
          </View>

          {/* Tiêu đề COMBO X3! */}
          <Text style={styles.comboTitle}>
            COMBO <Text style={styles.comboAccent}>X{combo}!</Text>
          </Text>

          {/* Lời cổ vũ */}
          <Text style={styles.subtitle}>
            {combo === 3
              ? '⚡ 3 CÂU ĐÚNG LIÊN TIẾP – QUÁ XUẤT SẮC! ⚡'
              : `⚡ ${combo} CÂU ĐÚNG LIÊN TIẾP – KHÔNG THỂ CẢN PHÁ! ⚡`}
          </Text>

          <View style={styles.sparkleRow}>
            <Sparkles size={14} color="#FDE047" />
            <Text style={styles.sparkleText}>Tăng tốc độ & nhân đôi cảm hứng học tập!</Text>
            <Sparkles size={14} color="#FDE047" />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  flashBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0F172A',
  },
  card: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#FDE047',
    backgroundColor: 'rgba(30, 41, 59, 0.95)',
    width: '100%',
    maxWidth: 340,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  haloRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(245, 158, 11, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F59E0B',
    borderWidth: 3,
    borderColor: '#FEF08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EA580C',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FED7AA',
    marginBottom: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  comboTitle: {
    color: '#FFFFFF',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  comboAccent: {
    color: '#FDE047',
  },
  subtitle: {
    color: '#FEF08A',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  sparkleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  sparkleText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
});
