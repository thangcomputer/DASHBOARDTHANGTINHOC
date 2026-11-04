import React, { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CalendarDays, Flame, Info, ListChecks, PlayCircle, Target } from 'lucide-react-native';
import {
  LEARNING_GOAL_CHANGED_EVENT,
  OPEN_LEARNING_GOAL_EVENT,
  STUDY_MINUTE_EVENT,
  formatStudyMinutes,
  getLearningGoal,
  periodLabel,
  type LearningGoalData,
} from '../services/learningGoalApi';
import { colors, spacing } from '../theme/tokens';

function percent(value?: number, target?: number) {
  if (!target) return 0;
  return Math.min(100, Math.round(((value || 0) / target) * 100));
}

function openGoal() {
  DeviceEventEmitter.emit(OPEN_LEARNING_GOAL_EVENT);
}

/** Thẻ tiến độ mục tiêu học trên Tổng quan (giống web). */
export function LearningGoalCard() {
  const [data, setData] = useState<LearningGoalData | null>(null);

  const load = useCallback(() => {
    getLearningGoal().then(setData).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const changed = DeviceEventEmitter.addListener(LEARNING_GOAL_CHANGED_EVENT, (next: LearningGoalData) => {
      if (next) setData(next);
    });
    const minute = DeviceEventEmitter.addListener(STUDY_MINUTE_EVENT, (result: { todayMinutes?: number }) => {
      const todayMinutes = Number(result?.todayMinutes);
      if (!Number.isFinite(todayMinutes)) return;
      setData((prev) => {
        if (!prev) return prev;
        const delta = Math.max(0, todayMinutes - (prev.progress.todayMinutes || 0));
        return {
          ...prev,
          progress: { ...prev.progress, todayMinutes, periodMinutes: (prev.progress.periodMinutes || 0) + delta },
        };
      });
    });
    return () => {
      changed.remove();
      minute.remove();
    };
  }, []);

  if (!data) return null;
  const { goal, progress } = data;

  if (!goal) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <View style={styles.headRow}>
          <View style={styles.icon}><Target size={22} color="#FFFFFF" /></View>
          <View style={styles.flex}>
            <Text style={styles.title}>Bạn chưa đặt mục tiêu học</Text>
            <Text style={styles.meta}>Đặt mục tiêu để theo dõi số giờ học mỗi ngày.</Text>
          </View>
        </View>
        <Pressable onPress={openGoal} style={styles.primary} accessibilityRole="button">
          <Text style={styles.primaryText}>Đặt mục tiêu</Text>
        </Pressable>
      </View>
    );
  }

  const todayPct = percent(progress.todayMinutes, progress.dailyTargetMinutes);
  const periodPct = percent(progress.periodMinutes, progress.periodTargetMinutes);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.icon}><Target size={22} color="#FFFFFF" /></View>
        <View style={styles.flex}>
          <Text style={styles.title}>{`Mục tiêu: ${goal.hoursPerDay} giờ/ngày · ${periodLabel(goal.period)}`}</Text>
          <View style={styles.metaRow}>
            <CalendarDays size={12} color={colors.muted} />
            <Text style={styles.meta}>
              {goal.expired ? 'Mục tiêu đã kết thúc' : `Còn ${progress.daysLeft} ngày · ngày ${progress.daysElapsed}/${progress.totalDays}`}
            </Text>
          </View>
        </View>
        <Pressable onPress={openGoal} style={styles.outline} accessibilityRole="button">
          <Text style={styles.outlineText}>{goal.expired ? 'Đặt mới' : 'Đổi'}</Text>
        </Pressable>
      </View>

      <View style={styles.metric}>
        <View style={styles.metricRow}>
          <View style={styles.metricLabel}>
            <Flame size={13} color="#F97316" />
            <Text style={styles.metricLabelText}>Hôm nay</Text>
          </View>
          <Text style={styles.metricValue}>{`${formatStudyMinutes(progress.todayMinutes)} / ${goal.hoursPerDay} giờ`}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${todayPct}%`, backgroundColor: todayPct >= 100 ? '#10B981' : '#F97316' }]} />
        </View>
        {todayPct >= 100 ? <Text style={styles.done}>Đã đạt mục tiêu hôm nay!</Text> : null}
      </View>

      <View style={styles.metric}>
        <View style={styles.metricRow}>
          <Text style={styles.metricLabelText}>{`Cả ${periodLabel(goal.period)}`}</Text>
          <Text style={styles.metricValue}>{`${formatStudyMinutes(progress.periodMinutes)} · ${periodPct}%`}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${periodPct}%`, backgroundColor: colors.brand }]} />
        </View>
      </View>

      <View style={styles.evidence}>
        <Text style={styles.evidenceLabel}>Hôm nay đã học:</Text>
        <View style={styles.evidenceRow}>
          <View style={[styles.chip, { backgroundColor: '#F0F9FF' }]}>
            <ListChecks size={13} color="#0369A1" />
            <Text style={[styles.chipText, { color: '#0369A1' }]}>{`${progress.todayQuestions || 0} câu đã làm`}</Text>
          </View>
          <View style={[styles.chip, { backgroundColor: '#F5F3FF' }]}>
            <PlayCircle size={13} color="#6D28D9" />
            <Text style={[styles.chipText, { color: '#6D28D9' }]}>{`${progress.todayVideos || 0} video đã xem`}</Text>
          </View>
        </View>
        <Text style={styles.periodEvidence}>
          {`Cả ${periodLabel(goal.period)}: ${progress.periodQuestions || 0} câu · ${progress.periodVideos || 0} video`}
        </Text>
        <View style={styles.hintRow}>
          <Info size={12} color="#94A3B8" />
          <Text style={styles.hint}>
            Chỉ tính giờ khi bạn đang ở màn bài học, ôn thi, tài liệu hoặc video — video đang phát, hoặc có chạm màn hình trong 3 phút gần nhất.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  emptyCard: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { color: colors.muted, fontSize: 12 },
  outline: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  outlineText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  primary: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: colors.brand },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  metric: { gap: 6 },
  metricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  metricLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricLabelText: { color: '#475569', fontSize: 12, fontWeight: '800' },
  metricValue: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  track: { height: 10, borderRadius: 999, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  done: { color: '#059669', fontSize: 11, fontWeight: '800' },
  evidence: { gap: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: spacing.md },
  evidenceLabel: { color: '#64748B', fontSize: 12, fontWeight: '800' },
  evidenceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '800' },
  periodEvidence: { color: '#94A3B8', fontSize: 11 },
  hintRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  hint: { flex: 1, color: '#94A3B8', fontSize: 11, lineHeight: 15 },
});
