import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  DeviceEventEmitter,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Flame, Trophy, X, Zap } from 'lucide-react-native';
import { useGameSounds } from './dailyPractice/useGameSounds';
import { resolveMobilePublicUrl } from '../services/apiClient';
import { SOCKET_EVENTS } from '../services/socketService';
import type { StreakHonorPayload } from '../services/courseVideoApi';
import { isFreePortalMenu } from './FreePortalModals';
import type { DemoUser } from '../types';

const AUTO_HIDE_MS = 3000;

export function StreakHonorPopup({ user }: { user: DemoUser | null }) {
  const insets = useSafeAreaInsets();
  const playSound = useGameSounds();
  const playSoundRef = useRef(playSound);
  playSoundRef.current = playSound;

  const [queue, setQueue] = useState<Array<StreakHonorPayload & { _key: string }>>([]);
  const seenIdsRef = useRef(new Set<string>());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnim = useRef(new Animated.Value(1)).current;

  const enabled = Boolean(user && user.role === 'student' && !isFreePortalMenu(user));
  const current = queue[0] || null;

  const enqueue = useCallback((raw?: StreakHonorPayload | null) => {
    if (!enabled || !raw || !raw.studentName) return;
    const key = String(raw.id || `${raw.studentId || raw.studentName}:${raw.streak}:${raw.achievedAt || ''}`);
    if (seenIdsRef.current.has(key)) return;
    seenIdsRef.current.add(key);
    setQueue((prev) => [...prev, { ...raw, _key: key }]);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setQueue([]);
      return undefined;
    }
    const sub = DeviceEventEmitter.addListener(SOCKET_EVENTS.STREAK_HONOR, enqueue);
    return () => { sub.remove(); };
  }, [enabled, enqueue]);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!current) return undefined;
    playSoundRef.current('mascotVictory');
    progressAnim.setValue(1);
    const barAnim = Animated.timing(progressAnim, {
      toValue: 0,
      duration: AUTO_HIDE_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    barAnim.start();
    timerRef.current = setTimeout(() => {
      setQueue((prev) => prev.slice(1));
    }, AUTO_HIDE_MS);
    return () => {
      barAnim.stop();
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [current?._key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!enabled || !current) return null;

  const avatarUrl = current.studentAvatar ? resolveMobilePublicUrl(current.studentAvatar) : '';
  const initial = String(current.studentName || 'H').trim().charAt(0).toUpperCase();
  const barWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { top: Math.max(12, insets.top + 8) }]}
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.avatarWrap}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
            <View style={styles.trophyBadge}>
              <Trophy size={10} color="#FFFFFF" />
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.badgeRow}>
              <View style={styles.streakPill}>
                <Flame size={11} color="#EA580C" fill="#F97316" />
                <Text style={styles.streakPillText}>
                  {`Vinh danh chuỗi ${current.streak || 7} ngày`}
                </Text>
              </View>
              <View style={styles.xpPill}>
                <Zap size={10} color="#FFFFFF" fill="#FFFFFF" />
                <Text style={styles.xpPillText}>{`+${current.rewardXp || 100} XP`}</Text>
              </View>
            </View>
            <Text numberOfLines={1} style={styles.name}>{current.studentName}</Text>
            <Text style={styles.desc}>
              {`Vừa hoàn thành chuỗi ${current.streak || 7} ngày học liên tiếp!`}
            </Text>
          </View>

          <Pressable
            onPress={() => setQueue((prev) => prev.slice(1))}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Đóng thông báo vinh danh"
          >
            <X size={15} color="#64748B" />
          </Pressable>
        </View>

        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, { width: barWidth }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 9900,
    ...(Platform.OS === 'android' ? { elevation: 30 } : null),
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FCD34D',
    backgroundColor: '#FFFBEB',
    padding: 12,
    gap: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: 46, height: 46, borderRadius: 15 },
  avatarInitial: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  trophyBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#059669',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#FFEDD5',
  },
  streakPillText: { color: '#C2410C', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  xpPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#059669',
  },
  xpPillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  name: { color: '#0F172A', fontSize: 14, fontWeight: '900' },
  desc: { color: '#475569', fontSize: 11.5, fontWeight: '700' },
  closeBtn: { padding: 4 },
  progressTrack: { height: 4, borderRadius: 999, backgroundColor: '#FDE68A', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: '#059669' },
});
