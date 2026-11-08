import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BookOpen, Flame, Play, Route, ShoppingBag, Zap } from 'lucide-react-native';
import type { AppStackParamList } from '../navigation/types';
import { Mascot } from './dailyPractice/Mascot';
import type { DpStats, DpTopicPath } from '../services/dailyPracticeApi';
import { colors, radius, spacing } from '../theme/tokens';

export function DailyPracticeOverviewCard({
  stats,
  pathTopic,
  onBuyXp,
}: {
  stats: DpStats | null;
  pathTopic?: DpTopicPath | null;
  onBuyXp?: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const playedToday = Boolean(stats?.playedToday);
  const streak = stats?.streak || 0;
  const xpTotal = stats?.xpTotal || 0;

  const topicName = pathTopic?.topic?.name || 'Windows cơ bản';
  const completedUnits = pathTopic?.completedUnits ?? (pathTopic?.totalUnits ? pathTopic.totalUnits : 5);
  const totalUnits = pathTopic?.totalUnits || 5;

  const handlePractice = () => {
    navigation.navigate('DailyPractice', { practice: 'stage' });
  };

  const handleBuy = () => {
    if (onBuyXp) {
      onBuyXp();
    } else {
      navigation.navigate('DailyPractice');
    }
  };

  return (
    <View style={styles.card}>
      {/* Hàng trên: Linh vật + Tiêu đề */}
      <View style={styles.topRow}>
        <View style={styles.mascotWrap}>
          <Mascot mood={playedToday ? 'energy' : 'happy'} size={82} />
        </View>
        <View style={styles.headlineCol}>
          <Text style={styles.eyebrow}>LUYỆN TẬP HẰNG NGÀY</Text>
          <Text style={styles.title}>
            {playedToday ? 'Hôm nay bạn đã luyện tập — giỏi lắm!' : 'Luyện tập hằng ngày'}
          </Text>
          <Text style={styles.subtitle}>
            Đi hết từng chặng để mở chặng mới, nhận XP và giữ chuỗi ngày 🔥
          </Text>
        </View>
      </View>

      {/* Hàng nút bấm: [Luyện tiếp] & [Mua thêm XP] */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={handlePractice}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Luyện tiếp"
        >
          <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.primaryBtnText}>
            {playedToday ? 'Luyện tiếp' : 'Luyện ngay'}
          </Text>
        </Pressable>

        <Pressable
          onPress={handleBuy}
          style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Mua thêm XP"
        >
          <ShoppingBag size={16} color="#D97706" />
          <Text style={styles.secondaryBtnText}>Mua thêm XP</Text>
        </Pressable>
      </View>

      {/* Lưới 4 thẻ thống kê (2 cột x 2 hàng) */}
      <View style={styles.statsGrid}>
        {/* Ô 1: Môn / chủ đề */}
        <View style={styles.statBox}>
          <View style={[styles.statIconWrap, { backgroundColor: '#EFF6FF' }]}>
            <BookOpen size={17} color="#2563EB" />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Môn / chủ đề</Text>
            <Text numberOfLines={1} style={styles.statValue}>{topicName}</Text>
          </View>
        </View>

        {/* Ô 2: Tiến độ lộ trình */}
        <View style={styles.statBox}>
          <View style={[styles.statIconWrap, { backgroundColor: '#F5F3FF' }]}>
            <Route size={17} color="#7C3AED" />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Tiến độ lộ trình</Text>
            <Text numberOfLines={1} style={styles.statValue}>{`${completedUnits}/${totalUnits} chặng`}</Text>
          </View>
        </View>

        {/* Ô 3: Chuỗi hiện tại */}
        <View style={styles.statBox}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FFF7ED' }]}>
            <Flame size={17} color="#EA580C" />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>Chuỗi hiện tại</Text>
            <Text numberOfLines={1} style={styles.statValue}>{`${streak} ngày`}</Text>
          </View>
        </View>

        {/* Ô 4: XP luyện + Nút [+ Mua] */}
        <View style={styles.statBox}>
          <View style={[styles.statIconWrap, { backgroundColor: '#FFFBEB' }]}>
            <Zap size={17} color="#D97706" />
          </View>
          <View style={styles.statContent}>
            <Text style={styles.statLabel}>XP luyện</Text>
            <Text numberOfLines={1} style={styles.statValue}>{`${xpTotal.toLocaleString('vi-VN')} XP`}</Text>
          </View>
          <Pressable
            onPress={handleBuy}
            style={styles.buyMiniPill}
            accessibilityRole="button"
            accessibilityLabel="Mua thêm XP"
          >
            <Text style={styles.buyMiniPillText}>+ Mua</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: '#F43F5E',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 14,
    elevation: 2,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mascotWrap: {
    width: 82,
    height: 82,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headlineCol: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: '#DC2626',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 17,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#DC2626',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FDE68A',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  secondaryBtnText: {
    color: '#D97706',
    fontSize: 15,
    fontWeight: '900',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statBox: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 56,
  },
  statIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statContent: {
    flex: 1,
    minWidth: 0,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 1,
  },
  buyMiniPill: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FDE68A',
    flexShrink: 0,
  },
  buyMiniPillText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D97706',
  },
});

