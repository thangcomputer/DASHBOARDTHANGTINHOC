import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CalendarX2, Flame, Gamepad2, Play, Trophy, Users, X, Zap } from 'lucide-react-native';
import { navigationRef } from '../../navigation/navigationRef';
import { dailyPracticeApi, reminderCopy, type DpStats } from '../../services/dailyPracticeApi';
import { colors, radius, spacing } from '../../theme/tokens';
import { Mascot } from './Mascot';
import { useGameSounds } from './useGameSounds';

const STORAGE_PREFIX = 'mobile_daily_practice_reminder:';

/** Ngày hôm nay theo giờ Việt Nam (YYYY-MM-DD), khớp cách server tính chuỗi ngày. */
function vnTodayKey(date = new Date()) {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Nhắc luyện tập hằng ngày: tối đa một lần mỗi ngày, chỉ khi hôm nay chưa luyện tập.
 * `ready` do LearningGoalHost quyết định — sau popup mục tiêu học và không khi đang khóa PIN.
 */
export function DailyPracticeReminder({ userId, ready }: { userId: string; ready: boolean }) {
  const play = useGameSounds();
  const [data, setData] = useState<{ stats: DpStats; topicCount: number } | null>(null);
  const [open, setOpen] = useState(false);
  const checkedRef = useRef(false);
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    dailyPracticeApi.overview()
      .then((overview) => { if (active) setData({ stats: overview.stats, topicCount: overview.topics.length }); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready || !data || checkedRef.current) return;
    if (data.stats.playedToday || !data.topicCount) return;
    if (navigationRef.isReady() && navigationRef.getCurrentRoute()?.name === 'DailyPractice') return;
    checkedRef.current = true;
    const key = `${STORAGE_PREFIX}${userId}`;
    const today = vnTodayKey();
    AsyncStorage.getItem(key)
      .then((seen) => {
        if (seen === today) return;
        void AsyncStorage.setItem(key, today);
        setOpen(true);
        play(data.stats.streakState === 'lost' ? 'sad' : 'hint');
        Animated.spring(enter, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }).start();
      })
      .catch(() => {});
  }, [data, enter, play, ready, userId]);

  if (!open || !ready || !data) return null;
  const { stats } = data;
  const copy = reminderCopy(stats, data.topicCount);
  const lost = stats.streakState === 'lost';
  const players = stats.todayPlayers || 0;
  const close = () => setOpen(false);
  const tiles = lost
    ? [
      { icon: CalendarX2, value: stats.missedDays || 0, label: 'ngày đã nghỉ', color: '#475569', bg: '#F1F5F9' },
      { icon: Flame, value: stats.lostStreak || 0, label: 'chuỗi vừa mất', color: '#EA580C', bg: '#FFF7ED' },
      { icon: Trophy, value: stats.bestStreak || 0, label: 'kỷ lục chuỗi', color: '#DC2626', bg: '#FEF2F2' },
    ]
    : [
      { icon: Flame, value: stats.streak || 0, label: 'ngày liên tiếp', color: '#EA580C', bg: '#FFF7ED' },
      { icon: Zap, value: stats.xpTotal || 0, label: 'tổng XP', color: '#D97706', bg: '#FFFBEB' },
      { icon: Trophy, value: stats.bestStreak || 0, label: 'kỷ lục chuỗi', color: '#DC2626', bg: '#FEF2F2' },
    ];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[styles.card, {
            opacity: enter,
            transform: [{ scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          }]}
          accessibilityViewIsModal
        >
          <View style={[styles.hero, lost && styles.heroLost]}>
            <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Để sau">
              <X size={18} color={colors.muted} />
            </Pressable>
            <Mascot mood={copy.mood} size={100} />
            <View style={[styles.pill, lost && styles.pillLost]}>
              <Gamepad2 size={13} color="#FFFFFF" />
              <Text style={styles.pillText}>{copy.badge}</Text>
            </View>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.text}</Text>
          </View>

          <View style={styles.stats}>
            {tiles.map(({ icon: Icon, value, label, color, bg }) => (
              <View key={label} style={[styles.stat, { backgroundColor: bg }]}>
                <Icon size={18} color={color} />
                <Text style={[styles.statValue, { color }]}>{value}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {players > 0 ? (
            <View style={styles.social}>
              <Users size={14} color="#047857" />
              <Text style={styles.socialText}>{`${players} học viên đã luyện tập hôm nay — đừng để bị bỏ lại!`}</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <Pressable onPress={close} style={styles.secondary} accessibilityRole="button">
              <Text style={styles.secondaryText}>Để sau</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                close();
                if (navigationRef.isReady()) navigationRef.navigate('DailyPractice');
              }}
              style={styles.primary}
              accessibilityRole="button"
            >
              <Play size={16} color="#FFFFFF" />
              <Text style={styles.primaryText}>{copy.cta}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(2, 6, 23, 0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 380, borderRadius: 28, backgroundColor: colors.surface, overflow: 'hidden', boxShadow: '0px 24px 48px rgba(15, 23, 42, 0.25)' },
  hero: {
    alignItems: 'center', paddingHorizontal: spacing.xl, paddingTop: 26, paddingBottom: spacing.lg, backgroundColor: '#FEF2F2',
    backgroundImage: 'linear-gradient(135deg, #FEF2F2 0%, #FFFFFF 50%, #FFFBEB 100%)',
  } as never,
  close: {
    position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: 18, zIndex: 2,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  heroLost: {
    backgroundColor: '#F0F9FF',
    backgroundImage: 'linear-gradient(135deg, #F0F9FF 0%, #FFFFFF 50%, #F1F5F9 100%)',
  } as never,
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: '#DC2626' },
  pillLost: { backgroundColor: '#334155' },
  social: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: spacing.lg, marginTop: spacing.md,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#ECFDF5',
  },
  socialText: { flexShrink: 1, color: '#047857', fontSize: 12, fontWeight: '800' },
  pillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  title: { marginTop: 8, color: colors.ink, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  subtitle: { marginTop: 6, color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  stats: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 16 },
  statValue: { marginTop: 2, fontSize: 18, fontWeight: '900' },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  secondary: {
    flex: 1, minHeight: 46, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface,
  },
  secondaryText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  primary: {
    flex: 1.4, minHeight: 46, borderRadius: radius.md, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.brand, backgroundImage: 'linear-gradient(180deg, #F05252 0%, #DC2626 55%, #B91C1C 100%)',
    boxShadow: '0px 8px 18px rgba(185, 28, 28, 0.3)',
  } as never,
  primaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
});
