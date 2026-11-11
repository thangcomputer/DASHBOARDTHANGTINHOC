import React, { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Check, Flame, Gamepad2, PlayCircle, Target } from 'lucide-react-native';
import type { AppStackParamList } from '../navigation/types';
import { getStudyResumePoint } from '../services/courseVideoApi';
import {
  LEARNING_GOAL_CHANGED_EVENT,
  OPEN_LEARNING_GOAL_EVENT,
  STUDY_MINUTE_EVENT,
  formatStudyMinutes,
  getLearningGoal,
  periodLabel,
  type LearningGoalData,
} from '../services/learningGoalApi';
import { colors, spacing, theme, createThemedStyles } from '../theme/tokens';

function percent(value?: number, target?: number) {
  if (!target) return 0;
  return Math.min(100, Math.round(((value || 0) / target) * 100));
}

function openGoal() {
  DeviceEventEmitter.emit(OPEN_LEARNING_GOAL_EVENT);
}

/** Nhiệm vụ mỗi ngày: một lượt luyện tập (10 câu) và ít nhất một video. */
const MISSION_QUESTIONS = 10;
const MISSION_VIDEOS = 1;

/** Thẻ tiến độ mục tiêu học trên Tổng quan - Thiết kế tinh gọn, hiện đại. */
export function LearningGoalCard() {
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const [data, setData] = useState<LearningGoalData | null>(null);

  const openVideoMission = () => {
    void getStudyResumePoint().catch(() => null);
    navigation.navigate('DailyPractice', { watch: 'stage' });
  };

  const load = useCallback(() => {
    getLearningGoal().then(setData).catch(() => { });
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
          <View style={styles.icon}><Target size={18} color="#DC2626" /></View>
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
  const todayDone = todayPct >= 100;
  const questionsDone = (progress.todayQuestions || 0) >= MISSION_QUESTIONS;
  const videosDone = (progress.todayVideos || 0) >= MISSION_VIDEOS;
  const completedMissions = [questionsDone, videosDone].filter(Boolean).length;

  return (
    <View style={styles.card}>
      {/* 1. Header: Icon + Tiêu đề + Nút Đổi */}
      <View style={styles.headRow}>
        <View style={styles.icon}>
          <Target size={18} color="#DC2626" />
        </View>
        <View style={styles.flex}>
          <Text numberOfLines={1} style={styles.title}>
            {`Mục tiêu: ${goal.hoursPerDay} giờ/ngày`}
          </Text>
          <Text numberOfLines={1} style={styles.meta}>
            {goal.expired ? 'Đã kết thúc' : `${periodLabel(goal.period)} · Còn ${progress.daysLeft} ngày`}
          </Text>
        </View>
        <Pressable
          onPress={openGoal}
          style={({ pressed }) => ({
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 10,
            borderWidth: 1.5,
            borderColor: '#FECACA',
            borderBottomWidth: pressed ? 1.5 : 3.5,
            borderBottomColor: '#F87171',
            backgroundColor: pressed ? '#FEF2F2' : '#FFFFFF',
            transform: [{ translateY: pressed ? 2 : 0 }],
          })}
          accessibilityRole="button"
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#DC2626' }}>{goal.expired ? 'Đặt mới' : 'Đổi mục tiêu'}</Text>
        </Pressable>
      </View>

      {/* 2. Tiến độ hôm nay (Thanh bar chính, mượt mà) */}
      <View style={styles.metric}>
        <View style={styles.metricRow}>
          <View style={styles.metricLabel}>
            <Flame size={14} color={todayDone ? '#10B981' : '#F97316'} />
            <Text style={styles.metricLabelText}>Hôm nay</Text>
          </View>
          <Text style={styles.metricValue}>
            {`${formatStudyMinutes(progress.todayMinutes)} / ${goal.hoursPerDay} giờ`}
            <Text style={todayDone ? styles.metricPctDone : styles.metricPct}>
              {` (${todayPct}%)`}
            </Text>
          </Text>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.fill,
              { width: `${todayPct}%`, backgroundColor: todayDone ? '#10B981' : '#F97316' },
            ]}
          />
        </View>
        <View style={styles.subMetaRow}>
          <Text style={styles.subMetaText}>
            {`Chu kỳ: ${formatStudyMinutes(progress.periodMinutes)} (${periodPct}%)`}
          </Text>
          {todayDone ? (
            <Text style={styles.doneText}>✓ Đã đạt hôm nay</Text>
          ) : null}
        </View>
      </View>

      {/* 3. Nhiệm vụ hôm nay (2 thẻ mini dạng pill) */}
      <View style={styles.evidence}>
        <View style={styles.metricRow}>
          <Text style={styles.evidenceLabel}>Nhiệm vụ hôm nay</Text>
          <Text style={styles.missionCount}>
            {`${completedMissions}/2 hoàn thành`}
          </Text>
        </View>

        <View style={styles.missionRow}>
          {/* Luyện tập */}
          <Pressable
            onPress={() => navigation.navigate('DailyPractice')}
            style={({ pressed }) => [
              styles.miniMission,
              questionsDone && styles.miniMissionDone,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <View style={[styles.miniIconBox, questionsDone ? styles.miniIconDone : styles.miniIconPractice]}>
              {questionsDone ? (
                <Check size={14} strokeWidth={3} color="#FFFFFF" />
              ) : (
                <Gamepad2 size={15} color="#0284C7" />
              )}
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.miniMissionTitle}>Luyện tập</Text>
              <Text numberOfLines={1} style={[styles.miniMissionMeta, questionsDone && styles.miniMissionMetaDone]}>
                {`${progress.todayQuestions || 0}/${MISSION_QUESTIONS} câu`}
              </Text>
            </View>
          </Pressable>

          {/* Xem video */}
          <Pressable
            onPress={openVideoMission}
            style={({ pressed }) => [
              styles.miniMission,
              videosDone && styles.miniMissionDone,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
          >
            <View style={[styles.miniIconBox, videosDone ? styles.miniIconDone : styles.miniIconVideo]}>
              {videosDone ? (
                <Check size={14} strokeWidth={3} color="#FFFFFF" />
              ) : (
                <PlayCircle size={15} color="#7C3AED" />
              )}
            </View>
            <View style={styles.flex}>
              <Text numberOfLines={1} style={styles.miniMissionTitle}>Xem video</Text>
              <Text numberOfLines={1} style={[styles.miniMissionMeta, videosDone && styles.miniMissionMetaDone]}>
                {`${progress.todayVideos || 0}/${MISSION_VIDEOS} video`}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* 4. Ghi chú siêu gọn nhẹ */}
      <Text style={styles.hint}>
        * Giờ học tính khi bạn làm bài, ôn thi hoặc xem video.
      </Text>
    </View>
  );
}

const styles = createThemedStyles((colors) => StyleSheet.create({
  flex: { flex: 1 },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12,
  },
  emptyCard: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 1 },
  outline: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  outlineText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  primary: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.brand,
  },
  primaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  metric: { gap: 6 },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  metricLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metricLabelText: { color: '#334155', fontSize: 13, fontWeight: '800' },
  metricValue: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  metricPct: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  metricPctDone: { color: '#059669', fontSize: 12, fontWeight: '800' },
  track: { height: 8, borderRadius: 999, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  subMetaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subMetaText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  doneText: { color: '#059669', fontSize: 11, fontWeight: '800' },
  evidence: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 10,
  },
  evidenceLabel: { color: '#1E293B', fontSize: 13, fontWeight: '900' },
  missionCount: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  missionRow: { flexDirection: 'row', gap: 8 },
  miniMission: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#F8FAFC',
  },
  miniMissionDone: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  pressed: { opacity: 0.8 },
  miniIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniIconPractice: { backgroundColor: '#E0F2FE' },
  miniIconVideo: { backgroundColor: '#F3E8FF' },
  miniIconDone: { backgroundColor: '#10B981' },
  miniMissionTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  miniMissionMeta: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  miniMissionMetaDone: { color: '#047857' },
  hint: { color: '#94A3B8', fontSize: 11, lineHeight: 14, fontWeight: '500' },
}), { remapGreen: true });
