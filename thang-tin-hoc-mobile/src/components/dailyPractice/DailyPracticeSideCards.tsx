import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Brain, RotateCcw, Sparkles, Target } from 'lucide-react-native';
import type { DpSpacedRepetitionSummary } from '../../services/dailyPracticeApi';
import type { PlacementResult } from './PlacementTestModal';

type SpacedReviewCardProps = {
  spaced?: DpSpacedRepetitionSummary | null;
  starting?: boolean;
  onStart: () => void;
};

/** Thẻ Ôn tập ngắt quãng 1-3-7 ngày — đồng bộ Web DailyPracticePage. */
export function SpacedReviewCard({ spaced, starting = false, onStart }: SpacedReviewCardProps) {
  const dueCount = Number(spaced?.dueCount) || 0;
  const totalQueued = Number(spaced?.totalQueued) || 0;
  const rewardXp = Number(spaced?.rewardXp) || 15;
  const nextDueDay = spaced?.nextDueDay || '';
  const disabled = starting || totalQueued === 0;

  const badgeText = dueCount > 0
    ? `${dueCount} câu đến hạn`
    : totalQueued > 0
      ? `${totalQueued} câu chờ lịch`
      : 'Sạch lỗi';

  const bodyText = totalQueued > 0
    ? dueCount > 0
      ? `Bạn có ${dueCount} câu từng làm sai đã tới lịch nhắc lại hôm nay (tổng ${totalQueued} câu đang theo dõi).`
      : `Chưa có câu đến hạn hôm nay (${totalQueued} câu sẽ nhắc lại${nextDueDay ? ` từ ${nextDueDay}` : ''}). Bạn vẫn có thể ôn sớm ngay!`
    : 'Các câu bạn làm sai trong quá trình luyện tập sẽ tự động vào đây để nhắc ôn sau 1, 3 và 7 ngày.';

  const ctaText = dueCount > 0
    ? `Ôn tập ngay (${Math.min(10, totalQueued)} câu)`
    : totalQueued > 0
      ? 'Ôn sớm hàng đợi'
      : 'Chưa có câu cần ôn';

  return (
    <View style={styles.spacedCard}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Brain size={16} color="#059669" />
            <Text style={styles.title}>Ôn tập ngắt quãng</Text>
          </View>
          <Text style={styles.subtitle}>
            {`Chu kỳ 1–3–7 ngày · Đạt ≥ 70% nhận +${rewardXp} XP`}
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            dueCount > 0 ? styles.badgeDue : totalQueued > 0 ? styles.badgeQueued : styles.badgeClean,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              dueCount > 0
                ? styles.badgeTextDue
                : totalQueued > 0
                  ? styles.badgeTextQueued
                  : styles.badgeTextClean,
            ]}
          >
            {badgeText}
          </Text>
        </View>
      </View>

      <Text style={styles.desc}>{bodyText}</Text>

      <Pressable
        disabled={disabled}
        onPress={onStart}
        style={({ pressed }) => [
          styles.spacedBtn,
          disabled && styles.spacedBtnDisabled,
          pressed && !disabled && styles.spacedBtnPressed,
        ]}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <RotateCcw size={15} color="#FFFFFF" />
        <Text style={styles.spacedBtnText}>{ctaText}</Text>
      </Pressable>
    </View>
  );
}

type PlacementEntryCardProps = {
  placementResult: PlacementResult | null;
  onPress: () => void;
};

/** Thẻ Lộ trình dành riêng cho bạn / Đánh giá năng lực 10 câu — đồng bộ Web DailyPracticePage. */
export function PlacementEntryCard({ placementResult, onPress }: PlacementEntryCardProps) {
  return (
    <View style={styles.placementCard}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.titleRow}>
            <Target size={16} color="#0284C7" />
            <Text style={styles.title}>Lộ trình dành riêng cho bạn</Text>
          </View>
          <Text style={styles.subtitle}>
            {placementResult
              ? `Đạt ${placementResult.score}/${placementResult.total} · ${placementResult.recommendedLevel}`
              : 'Trả lời nhanh 10 câu để chọn đúng môn học phù hợp nhất'}
          </Text>
        </View>
        {placementResult ? (
          <View style={styles.evaluatedBadge}>
            <Text style={styles.evaluatedBadgeText}>Đã đánh giá</Text>
          </View>
        ) : null}
      </View>

      {placementResult ? (
        <View style={styles.recommendBox}>
          <Text style={styles.recommendText}>
            {'Gợi ý ưu tiên: '}
            <Text style={styles.recommendTopic}>{placementResult.matchedTopicName}</Text>
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.placementBtn, pressed && styles.placementBtnPressed]}
        accessibilityRole="button"
      >
        <Sparkles size={15} color="#0369A1" />
        <Text style={styles.placementBtnText}>
          {placementResult ? 'Xem đánh giá & Làm lại' : 'Đánh giá năng lực (10 câu)'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  spacedCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'linear-gradient(135deg, rgba(236,253,245,0.78) 0%, #FFFFFF 55%, rgba(240,253,250,0.7) 100%)',
        }
      : {}),
    padding: 16,
    gap: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  } as never,
  placementCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#F0F9FF',
    ...(Platform.OS === 'web'
      ? {
          backgroundImage:
            'linear-gradient(135deg, rgba(240,249,255,0.8) 0%, #FFFFFF 55%, rgba(238,242,255,0.7) 100%)',
        }
      : {}),
    padding: 16,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  } as never,
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  headerLeft: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 14, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 11, fontWeight: '600', color: '#64748B', lineHeight: 16 },
  badge: { flexShrink: 0, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeDue: { backgroundColor: '#059669' },
  badgeQueued: { backgroundColor: '#FEF3C7' },
  badgeClean: { backgroundColor: '#F1F5F9' },
  badgeText: { fontSize: 11, fontWeight: '900' },
  badgeTextDue: { color: '#FFFFFF' },
  badgeTextQueued: { color: '#92400E' },
  badgeTextClean: { color: '#64748B' },
  desc: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: '#475569' },
  spacedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: 16,
    backgroundColor: '#10B981',
    borderBottomWidth: 3.5,
    borderBottomColor: '#047857',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  spacedBtnDisabled: { opacity: 0.5 },
  spacedBtnPressed: { opacity: 0.88, transform: [{ translateY: 1 }] },
  spacedBtnText: { fontSize: 13, fontWeight: '900', color: '#FFFFFF' },
  evaluatedBadge: {
    flexShrink: 0,
    borderRadius: 999,
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  evaluatedBadgeText: { fontSize: 10, fontWeight: '900', color: '#075985' },
  recommendBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0F2FE',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  recommendText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  recommendTopic: { fontWeight: '900', color: '#047857' },
  placementBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BAE6FD',
    backgroundColor: '#FFFFFF',
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  placementBtnPressed: { backgroundColor: '#F0F9FF' },
  placementBtnText: { fontSize: 12, fontWeight: '900', color: '#0369A1' },
});
