import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { CheckCircle2, Flame, Play, Sparkles, Trophy, Zap } from 'lucide-react-native';
import type { AppStackParamList } from '../navigation/types';
import { DuoButton } from './duo/DuoButton';
import { Mascot } from './dailyPractice/Mascot';
import { useAuth } from '../app/AuthContext';
import { isFreePortalMenu } from '../utils/freePortalHelper';
import type { DpStats, DpTopicPath } from '../services/dailyPracticeApi';
import { colors, spacing } from '../theme/tokens';

export function DailyPracticeOverviewCard({
  stats,
  pathTopic,
  onBuyXp: _onBuyXp,
}: {
  stats: DpStats | null;
  pathTopic?: DpTopicPath | null;
  onBuyXp?: () => void;
}) {
  const { user } = useAuth();
  const isBrandStudent = Boolean(user && user.role === 'student' && !isFreePortalMenu(user));
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const playedToday = Boolean(stats?.playedToday);
  const streak = stats?.streak || 0;
  const todayXp = stats?.todayXp || 0;
  const xpTotal = stats?.xpTotal || 0;

  const totalUnits = pathTopic?.totalUnits || 0;
  const completedUnits = pathTopic?.completedUnits || 0;
  const topicDone = totalUnits > 0 && completedUnits >= totalUnits;
  const pct = totalUnits > 0 ? Math.min(100, Math.round((completedUnits / totalUnits) * 100)) : 0;
  const barWidth = Math.max(pct, completedUnits > 0 ? 6 : 0);
  const topicName = pathTopic?.topic?.name || 'Lộ trình kỹ năng';

  const handlePractice = () => {
    navigation.navigate('DailyPractice');
  };

  let headline = 'Sẵn sàng thử thách hôm nay chưa?';
  if (topicDone) headline = 'Đã hoàn thành lộ trình chủ đề này';
  else if (playedToday) headline = 'Hôm nay bạn đã luyện tập — giỏi lắm!';
  else if (streak > 0) headline = `Giữ chuỗi ${streak} ngày luyện tập liên tiếp`;

  const subtitle = topicDone
    ? 'Có thể ôn lại từng chặng bên dưới để củng cố kiến thức.'
    : pathTopic?.next?.unitTitle
      ? `Tiếp theo: ${pathTopic.next.unitTitle}${pathTopic.next.stepLabel ? ` · ${pathTopic.next.stepLabel}` : ''}`
      : 'Đi hết từng chặng để mở bài mới, nhận XP và giữ chuỗi ngày.';

  return (
    <View style={styles.card}>
      {/* Hàng trên: Linh vật + Thông tin lộ trình */}
      <View style={styles.topRow}>
        <View style={[styles.mascotStage, isBrandStudent && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
          <Mascot mood={playedToday ? 'energy' : 'happy'} size={72} />
          {topicDone ? (
            <View style={[styles.mascotCornerBadge, { backgroundColor: '#10B981' }]}>
              <CheckCircle2 size={12} color="#FFFFFF" />
            </View>
          ) : playedToday ? (
            <View style={[styles.mascotCornerBadge, { backgroundColor: '#F97316' }]}>
              <Flame size={11} color="#FFFFFF" fill="#FFFFFF" />
            </View>
          ) : null}
        </View>

        <View style={styles.headlineCol}>
          <View style={styles.badgeRow}>
            <View style={[styles.topicPill, isBrandStudent && { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
              <Sparkles size={11} color={isBrandStudent ? '#059669' : '#059669'} />
              <Text style={[styles.topicPillText, isBrandStudent && { color: '#059669' }]} numberOfLines={1}>
                {`LỘ TRÌNH · ${topicName}`}
              </Text>
            </View>
            {topicDone ? (
              <View style={styles.donePill}>
                <CheckCircle2 size={11} color="#059669" />
                <Text style={styles.donePillText}>{`Hoàn tất ${completedUnits}/${totalUnits}`}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.title}>{headline}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
      </View>

      {/* Thanh tiến độ chặng */}
      {totalUnits > 0 ? (
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Tiến độ lộ trình</Text>
            <Text style={styles.progressValue}>{`${completedUnits}/${totalUnits} chặng · ${pct}%`}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${barWidth}%` }, isBrandStudent && { backgroundColor: '#10B981' }]} />
          </View>
        </View>
      ) : null}

      {/* 3 thẻ chỉ số ngang gọn gàng */}
      <View style={styles.metricsRow}>
        <View style={[styles.metricPill, styles.metricStreak]}>
          <View style={[styles.metricIconBox, { backgroundColor: '#FFEDD5' }]}>
            <Flame size={14} color="#EA580C" fill="#FB923C" />
          </View>
          <View style={styles.metricTextCol}>
            <Text style={[styles.metricValue, { color: '#7C2D12' }]}>{`${streak} ngày`}</Text>
            <Text style={styles.metricLabel}>Chuỗi</Text>
          </View>
        </View>

        <View style={[styles.metricPill, styles.metricTodayXp]}>
          <View style={[styles.metricIconBox, { backgroundColor: '#FEF3C7' }]}>
            <Zap size={14} color="#D97706" fill="#FBBF24" />
          </View>
          <View style={styles.metricTextCol}>
            <Text style={[styles.metricValue, { color: '#78350F' }]}>{todayXp.toLocaleString('vi-VN')}</Text>
            <Text style={styles.metricLabel}>XP hôm nay</Text>
          </View>
        </View>

        <View style={[styles.metricPill, styles.metricTotalXp]}>
          <View style={[styles.metricIconBox, { backgroundColor: '#EDE9FE' }]}>
            <Trophy size={14} color="#7C3AED" />
          </View>
          <View style={styles.metricTextCol}>
            <Text style={[styles.metricValue, { color: '#1E1B4B' }]}>{xpTotal.toLocaleString('vi-VN')}</Text>
            <Text style={styles.metricLabel}>Tổng XP</Text>
          </View>
        </View>
      </View>

      {/* Nút hành động 3D */}
      <DuoButton
        variant={isBrandStudent ? 'danger' : 'primary'}
        size="lg"
        fullWidth
        icon={<Play size={16} color="#FFFFFF" fill="#FFFFFF" />}
        text={topicDone ? 'Ôn lại lộ trình' : playedToday ? 'Luyện tiếp' : 'Bắt đầu luyện tập'}
        onPress={handlePractice}
        accessibilityLabel={topicDone ? 'Ôn lại lộ trình' : playedToday ? 'Luyện tiếp' : 'Bắt đầu luyện tập'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
    marginBottom: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  mascotStage: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: '#ECFDF5',
    borderWidth: 1.5,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  mascotCornerBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headlineCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  topicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  topicPillText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#047857',
    letterSpacing: 0.4,
  },
  donePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  donePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 21,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
    lineHeight: 17,
  },
  progressSection: {
    gap: 5,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  progressValue: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.brand,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    padding: 1.5,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
  },
  metricStreak: {
    backgroundColor: '#FFF7ED',
    borderColor: '#FED7AA',
  },
  metricTodayXp: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  metricTotalXp: {
    backgroundColor: '#F5F3FF',
    borderColor: '#DDD6FE',
  },
  metricIconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  metricTextCol: {
    flex: 1,
    minWidth: 0,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '900',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
});
