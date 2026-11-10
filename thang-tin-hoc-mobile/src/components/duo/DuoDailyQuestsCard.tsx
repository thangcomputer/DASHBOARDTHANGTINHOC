import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Check, Flame, Gift, Target, Video, Zap } from 'lucide-react-native';

export type QuestItem = {
  id: string;
  icon: 'lightning' | 'video' | 'flame' | 'target';
  title: string;
  current: number;
  target: number;
  unit: string;
  rewardXp?: number;
};

interface DuoDailyQuestsCardProps {
  quests?: QuestItem[];
  todayAnswers?: number;
  todayXp?: number;
  onOpenPractice?: () => void;
}

export function DuoDailyQuestsCard({
  quests,
  todayAnswers = 0,
  todayXp = 0,
  onOpenPractice,
}: DuoDailyQuestsCardProps) {
  const resolvedQuests: QuestItem[] = quests || [
    {
      id: 'quiz',
      icon: 'lightning',
      title: 'Luyện 10 câu trắc nghiệm',
      current: todayAnswers,
      target: 10,
      unit: 'câu',
      rewardXp: 20,
    },
    {
      id: 'video',
      icon: 'video',
      title: 'Xem 1 video bài học',
      current: 0,
      target: 1,
      unit: 'video',
      rewardXp: 15,
    },
    {
      id: 'xp',
      icon: 'flame',
      title: 'Kiếm 50 XP trong ngày',
      current: Math.min(50, todayXp),
      target: 50,
      unit: 'XP',
      rewardXp: 25,
    },
  ];

  const completedCount = resolvedQuests.filter((q) => q.current >= q.target).length;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.targetIconBox}>
            <Target size={18} color="#059669" />
          </View>
          <Text style={styles.cardTitle}>Nhiệm vụ hôm nay</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{`${completedCount}/${resolvedQuests.length} xong`}</Text>
        </View>
      </View>

      <View style={styles.questsList}>
        {resolvedQuests.map((quest) => {
          const isDone = quest.current >= quest.target;
          const pct = Math.min(100, Math.round((quest.current / quest.target) * 100));

          return (
            <Pressable
              key={quest.id}
              onPress={onOpenPractice}
              style={[styles.questRow, isDone && styles.questRowDone]}
              accessibilityRole="button"
            >
              <View style={[styles.questIconBox, isDone ? styles.iconBoxDone : styles.iconBoxNormal]}>
                {isDone ? (
                  <Check size={16} color="#FFFFFF" strokeWidth={3} />
                ) : quest.icon === 'lightning' ? (
                  <Zap size={16} color="#D97706" fill="#F59E0B" />
                ) : quest.icon === 'video' ? (
                  <Video size={16} color="#2563EB" />
                ) : (
                  <Flame size={16} color="#EA580C" fill="#FB923C" />
                )}
              </View>

              <View style={styles.questContentCol}>
                <View style={styles.questTitleRow}>
                  <Text style={[styles.questTitle, isDone && styles.questTitleDone]} numberOfLines={1}>
                    {quest.title}
                  </Text>
                  <Text style={styles.questCountText}>{`${Math.min(quest.current, quest.target)}/${quest.target}`}</Text>
                </View>

                {/* Progress bar */}
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, isDone ? styles.barFillDone : styles.barFillActive, { width: `${pct}%` }]} />
                </View>
              </View>

              {/* Reward pill */}
              <View style={[styles.rewardPill, isDone && styles.rewardPillDone]}>
                <Gift size={13} color={isDone ? '#047857' : '#D97706'} />
                {quest.rewardXp ? (
                  <Text style={[styles.rewardText, isDone && styles.rewardTextDone]}>
                    {`+${quest.rewardXp}`}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  statusBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  questsList: {
    gap: 10,
  },
  questRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  questRowDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  questIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBoxNormal: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  iconBoxDone: {
    backgroundColor: '#10B981',
  },
  questContentCol: {
    flex: 1,
    gap: 5,
  },
  questTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  questTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  questTitleDone: {
    color: '#047857',
  },
  questCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
    marginLeft: 6,
  },
  barTrack: {
    height: 7,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  barFillActive: {
    backgroundColor: '#F59E0B',
  },
  barFillDone: {
    backgroundColor: '#10B981',
  },
  rewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  rewardPillDone: {
    backgroundColor: '#DCFCE7',
  },
  rewardText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#92400E',
  },
  rewardTextDone: {
    color: '#065F46',
  },
});
