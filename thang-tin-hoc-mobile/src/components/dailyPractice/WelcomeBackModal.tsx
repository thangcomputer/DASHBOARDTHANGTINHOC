import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Sparkles } from 'lucide-react-native';
import { Mascot } from './Mascot';
import type { GameSound } from './useGameSounds';

const SHOW_MS = 3000;

export function vnTodayKey(date = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export async function takeWelcomeBackTurn(userId?: string): Promise<boolean> {
  const id = String(userId || '').trim() || 'student';
  const key = `cms_practice_welcome:${id}`;
  const today = vnTodayKey();
  try {
    const prev = await AsyncStorage.getItem(key);
    if (prev === today) return false;
    await AsyncStorage.setItem(key, today);
  } catch {
    // still show once if storage unavailable
  }
  return true;
}

export function WelcomeBackModal({
  visible,
  unitIndex,
  unitTitle,
  lessonLabel,
  play,
  onEnter,
}: {
  visible: boolean;
  unitIndex?: number;
  unitTitle?: string;
  lessonLabel?: string;
  play?: (s: GameSound) => void;
  onEnter: () => void;
}) {
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return undefined;
    play?.('win');
    bar.setValue(0);
    Animated.timing(bar, {
      toValue: 1,
      duration: SHOW_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    const timer = setTimeout(() => onEnterRef.current(), SHOW_MS);
    return () => {
      clearTimeout(timer);
      bar.stopAnimation();
    };
  }, [visible, play, bar]);

  if (!visible) return null;

  const where = [
    unitIndex ? `Chặng ${unitIndex}` : '',
    unitTitle || '',
    lessonLabel || '',
  ].filter(Boolean).join(' · ');

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Mascot mood="energy" size={120} />
          <View style={styles.badge}>
            <Sparkles size={12} color="#FFFFFF" />
            <Text style={styles.badgeText}>QUAY LẠI LUYỆN TẬP</Text>
          </View>
          <Text style={styles.title}>Chào mừng bạn quay lại</Text>
          <Text style={styles.subtitle}>Hãy cố gắng chinh phục bài giảng tiếp theo nào.</Text>
          {where ? (
            <View style={styles.wherePill}>
              <Text numberOfLines={2} style={styles.whereText}>{where}</Text>
            </View>
          ) : null}
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                { width: bar.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
              ]}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    ...(Platform.OS === 'web'
      ? { backgroundImage: 'linear-gradient(135deg, #FFFBEB 0%, #FFFFFF 55%, #FFF7ED 100%)' }
      : {}),
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 12,
  } as never,
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.5,
    color: '#FFFFFF',
  },
  title: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13.5,
    fontWeight: '600',
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
  },
  wherePill: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.88)',
    borderWidth: 1,
    borderColor: '#FDE68A',
    maxWidth: '100%',
  },
  whereText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 6,
    backgroundColor: '#FEF3C7',
  },
  fill: {
    height: '100%',
    backgroundColor: '#10B981',
  },
});
