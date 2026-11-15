import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, Flame, Gamepad2, Smartphone, WifiOff, Zap } from 'lucide-react-native';
import { spacing, typography } from '../theme/tokens';

export function MobileHomeWidgetCard({
  streak,
  playedToday,
  todayXp,
  todayClassesCount,
  nextClassLabel,
  nextClassTime,
  nextClassLive,
  offlineVideosCount,
  onPressPractice,
  onPressSchedule,
  onPressOffline,
}: {
  streak: number;
  playedToday: boolean;
  todayXp: number;
  todayClassesCount: number;
  nextClassLabel: string;
  nextClassTime: string;
  nextClassLive: boolean;
  offlineVideosCount: number;
  onPressPractice: () => void;
  onPressSchedule: () => void;
  onPressOffline: () => void;
}) {
  return (
    <View style={styles.widgetCard}>
      <View style={styles.topRow}>
        <View style={styles.eyebrowRow}>
          <Smartphone size={13} color="#047857" />
          <Text style={styles.eyebrowText}>WIDGET MÀN HÌNH CHÍNH</Text>
        </View>
        <View style={styles.syncPill}>
          <View style={styles.syncDot} />
          <Text style={styles.syncPillText}>Đã đồng bộ</Text>
        </View>
      </View>

      <View style={styles.tileGrid}>
        <Pressable onPress={onPressPractice} style={({ pressed }) => [styles.tile, styles.streakTile, pressed && styles.tilePressed]} accessibilityRole="button">
          <View style={styles.tileHeader}>
            <View style={[styles.iconBadge, playedToday ? styles.flameBadgeDone : styles.flameBadgePending]}>
              <Flame size={16} color={playedToday ? '#EA580C' : '#64748B'} />
            </View>
            <View style={styles.xpPill}>
              <Zap size={11} color="#047857" />
              <Text style={styles.xpPillText}>+{todayXp} XP</Text>
            </View>
          </View>
          <Text style={styles.streakValue}>{streak} ngày</Text>
          <Text style={styles.tileTitle} numberOfLines={1}>
            {playedToday ? 'Đã giữ chuỗi hôm nay' : 'Chạm để giữ chuỗi'}
          </Text>
        </Pressable>

        <Pressable onPress={onPressSchedule} style={({ pressed }) => [styles.tile, styles.scheduleTile, pressed && styles.tilePressed]} accessibilityRole="button">
          <View style={styles.tileHeader}>
            <View style={[styles.iconBadge, nextClassLive ? styles.liveIconBadge : styles.scheduleIconBadge]}>
              <CalendarDays size={16} color={nextClassLive ? '#FFFFFF' : '#2563EB'} />
            </View>
            <Text style={[styles.countPill, nextClassLive && styles.countPillLive]}>
              {nextClassLive ? 'ĐANG HỌC' : `${todayClassesCount} ca hôm nay`}
            </Text>
          </View>
          <Text style={styles.scheduleTime} numberOfLines={1}>{nextClassTime || 'Trống lịch'}</Text>
          <Text style={styles.tileTitle} numberOfLines={1}>{nextClassLabel || 'Không có lịch hôm nay'}</Text>
        </Pressable>
      </View>

      <View style={styles.quickFooter}>
        <Pressable onPress={onPressPractice} style={styles.quickActionPill} accessibilityRole="button">
          <Gamepad2 size={13} color="#047857" />
          <Text style={styles.quickActionText}>Luyện 5 phút</Text>
        </Pressable>
        <Pressable onPress={onPressOffline} style={styles.quickActionPill} accessibilityRole="button">
          <WifiOff size={13} color="#334155" />
          <Text style={styles.quickActionText}>Video offline ({offlineVideosCount})</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  widgetCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eyebrowText: { color: '#047857', fontSize: 10, fontWeight: '900', letterSpacing: 0.7 },
  syncPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
  },
  syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981' },
  syncPillText: { color: '#047857', fontSize: 10, fontWeight: '800' },
  tileGrid: { flexDirection: 'row', gap: 10 },
  tile: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    gap: 5,
  },
  tilePressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  streakTile: { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' },
  scheduleTile: { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
  tileHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  iconBadge: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  flameBadgeDone: { backgroundColor: '#FFEDD5' },
  flameBadgePending: { backgroundColor: '#E2E8F0' },
  scheduleIconBadge: { backgroundColor: '#DBEAFE' },
  liveIconBadge: { backgroundColor: '#2563EB' },
  xpPill: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: '#D1FAE5' },
  xpPillText: { color: '#047857', fontSize: 10, fontWeight: '900' },
  countPill: { color: '#1D4ED8', fontSize: 10, fontWeight: '900', backgroundColor: '#DBEAFE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999 },
  countPillLive: { color: '#FFFFFF', backgroundColor: '#DC2626' },
  streakValue: { color: '#9A3412', fontSize: 18, fontWeight: '900', marginTop: 2 },
  scheduleTime: { color: '#1E3A8A', fontSize: 15, fontWeight: '900', marginTop: 2 },
  tileTitle: { color: '#334155', fontSize: typography.micro, fontWeight: '700' },
  quickFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 2 },
  quickActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  quickActionText: { color: '#1E293B', fontSize: 11, fontWeight: '800' },
});

