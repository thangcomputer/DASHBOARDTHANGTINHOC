import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Play } from 'lucide-react-native';
import type { AppStackParamList } from '../navigation/types';
import { Mascot } from './dailyPractice/Mascot';
import type { DpStats, DpTopicPath } from '../services/dailyPracticeApi';
import { colors, spacing } from '../theme/tokens';

export function DailyPracticeOverviewCard({
  stats,
  pathTopic: _pathTopic,
  onBuyXp: _onBuyXp,
}: {
  stats: DpStats | null;
  pathTopic?: DpTopicPath | null;
  onBuyXp?: () => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const playedToday = Boolean(stats?.playedToday);

  const handlePractice = () => {
    navigation.navigate('DailyPractice', { practice: 'stage' });
  };

  return (
    <View style={styles.card}>
      {/* Hàng trên: Linh vật + Tiêu đề */}
      <View style={styles.topRow}>
        <View style={styles.mascotWrap}>
          <Mascot mood={playedToday ? 'energy' : 'happy'} size={82} />
        </View>
        <View style={styles.headlineCol}>
          <Text style={styles.title}>
            {playedToday ? 'Hôm nay bạn đã luyện tập - giỏi lắm!' : 'Luyện tập hằng ngày'}
          </Text>
          <Text style={styles.subtitle}>
            Đi hết từng chặng để mở chặng mới, nhận XP và giữ chuỗi ngày 🔥
          </Text>
        </View>
      </View>

      {/* Nút bấm luyện tập */}
      <View style={styles.actionsRow}>
        <Pressable
          onPress={handlePractice}
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={playedToday ? 'Luyện tiếp' : 'Luyện ngay'}
        >
          <Play size={16} color="#FFFFFF" fill="#FFFFFF" />
          <Text style={styles.primaryBtnText}>
            {playedToday ? 'Luyện tiếp' : 'Luyện ngay'}
          </Text>
        </Pressable>
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
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#475569',
    lineHeight: 18,
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
    backgroundColor: colors.brand,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: colors.brand,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

