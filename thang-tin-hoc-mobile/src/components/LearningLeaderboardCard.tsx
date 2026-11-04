import React, { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { CheckCircle2, Crown, Target, Trophy } from 'lucide-react-native';
import { getMobileImageSource } from '../services/apiClient';
import {
  LEARNING_GOAL_CHANGED_EVENT,
  OPEN_LEARNING_GOAL_EVENT,
  formatStudyMinutes,
  getLearningLeaderboard,
  type LearningLeaderboard,
} from '../services/learningGoalApi';
import { colors, spacing } from '../theme/tokens';

const MEDALS: Record<number, { bg: string; fg: string; image: string }> = {
  1: { bg: '#F59E0B', fg: '#451A03', image: 'linear-gradient(180deg, #FCD34D 0%, #F59E0B 100%)' },
  2: { bg: '#94A3B8', fg: '#1E293B', image: 'linear-gradient(180deg, #E2E8F0 0%, #94A3B8 100%)' },
  3: { bg: '#EA580C', fg: '#431407', image: 'linear-gradient(180deg, #FDBA74 0%, #EA580C 100%)' },
};

function formatWeekDay(key: string) {
  const [, month, day] = String(key || '').split('-');
  return day && month ? `${day}/${month}` : '';
}

function gapMessage(me: LearningLeaderboard['me']) {
  if (!me.rank) return '';
  if (me.rank === 1) return 'Bạn đang dẫn đầu bảng — giữ vững phong độ nhé!';
  const ahead = me.ahead;
  if (!ahead) return '';
  if (ahead.goalDays > me.goalDays) return `Đạt thêm ${ahead.goalDays - me.goalDays} ngày mục tiêu để vượt hạng #${ahead.rank}.`;
  return `Học thêm ${formatStudyMinutes(ahead.minutes - me.minutes + 1)} để vượt hạng #${ahead.rank}.`;
}

function RankBadge({ rank }: { rank: number }) {
  const medal = MEDALS[rank];
  if (!medal) {
    return <View style={[styles.rank, styles.rankPlain]}><Text style={styles.rankPlainText}>{rank}</Text></View>;
  }
  return (
    <View style={[styles.rank, { backgroundColor: medal.bg, backgroundImage: medal.image } as never]}>
      {rank === 1 ? <Crown size={13} color={medal.fg} /> : <Text style={[styles.rankText, { color: medal.fg }]}>{rank}</Text>}
    </View>
  );
}

function Avatar({ name, avatar }: { name: string; avatar: string }) {
  const [failed, setFailed] = useState(false);
  const initial = String(name || '?').trim().split(/\s+/).pop()?.[0]?.toUpperCase() || '?';
  if (avatar && !failed) {
    return <Image source={getMobileImageSource(avatar)} onError={() => setFailed(true)} style={styles.avatar} />;
  }
  return <View style={[styles.avatar, styles.avatarFallback]}><Text style={styles.avatarText}>{initial}</Text></View>;
}

/** Bảng xếp hạng tuần: HV đạt mục tiêu nhiều ngày nhất (bằng nhau so phút học), toàn trung tâm. */
export function LearningLeaderboardCard() {
  const [data, setData] = useState<LearningLeaderboard | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    getLearningLeaderboard()
      .then((next) => { setData(next); setError(''); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được bảng xếp hạng'));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener(LEARNING_GOAL_CHANGED_EVENT, load);
    return () => subscription.remove();
  }, [load]);

  const me = data?.me;
  const top = data?.top || [];
  const meInTop = top.some((row) => row.isMe);

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.icon}><Trophy size={22} color="#FFFFFF" /></View>
        <View style={styles.flex}>
          <Text style={styles.title}>Bảng xếp hạng tuần</Text>
          <Text style={styles.meta}>
            {data ? `${formatWeekDay(data.weekStart)} – ${formatWeekDay(data.weekEnd)} · ${data.participants} học viên tham gia` : 'Đang tải…'}
          </Text>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.list}>
        {data && !top.length ? (
          <Text style={styles.empty}>Tuần này chưa có ai trên bảng — hãy là người đầu tiên!</Text>
        ) : null}
        {top.map((row) => (
          <View key={`${row.rank}-${row.name}`} style={[styles.row, row.isMe ? styles.rowMe : row.rank <= 3 ? styles.rowPodium : null]}>
            <RankBadge rank={row.rank} />
            <Avatar name={row.name} avatar={row.avatar} />
            <View style={styles.flex}>
              <View style={styles.nameRow}>
                <Text numberOfLines={1} style={styles.name}>{row.name}</Text>
                {row.isMe ? <View style={styles.meTag}><Text style={styles.meTagText}>Bạn</Text></View> : null}
              </View>
              <Text style={styles.sub}>{`Mục tiêu ${row.hoursPerDay} giờ/ngày`}</Text>
            </View>
            <View style={styles.right}>
              <View style={styles.daysRow}>
                <CheckCircle2 size={12} color="#059669" />
                <Text style={styles.days}>{`${row.goalDays}/${data?.daysSoFar || 7} ngày`}</Text>
              </View>
              <Text style={styles.minutes}>{formatStudyMinutes(row.minutes)}</Text>
            </View>
          </View>
        ))}
      </View>

      {data && me ? (
        <View style={styles.footer}>
          {!me.hasGoal ? (
            <View style={styles.footerRow}>
              <Text style={[styles.footerText, styles.flex]}>Đặt mục tiêu học để có tên trên bảng xếp hạng.</Text>
              <Pressable onPress={() => DeviceEventEmitter.emit(OPEN_LEARNING_GOAL_EVENT)} style={styles.cta} accessibilityRole="button">
                <Target size={14} color="#FFFFFF" />
                <Text style={styles.ctaText}>Đặt mục tiêu</Text>
              </Pressable>
            </View>
          ) : !me.rank ? (
            <Text style={styles.footerText}>Tuần này bạn chưa học phút nào — vào bài học ngay để lên bảng!</Text>
          ) : (
            <View style={[styles.mine, { backgroundColor: meInTop ? '#ECFDF5' : '#FEF2F2' }]}>
              <Text style={[styles.mineRank, { color: meInTop ? '#047857' : '#B91C1C' }]}>{`#${me.rank}`}</Text>
              <View style={styles.flex}>
                <Text style={styles.mineTitle}>
                  {`Bạn đang hạng ${me.rank}/${data.participants} · ${me.goalDays} ngày đạt · ${formatStudyMinutes(me.minutes)}`}
                </Text>
                <Text style={styles.footerText}>{gapMessage(me)}</Text>
              </View>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: spacing.lg, gap: spacing.md },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D97706',
    backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #D97706 100%)',
  } as never,
  title: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  error: { color: '#92400E', backgroundColor: '#FFFBEB', fontSize: 12, fontWeight: '700', padding: 8, borderRadius: 10 },
  list: { gap: 6 },
  empty: { color: colors.muted, fontSize: 12, textAlign: 'center', paddingVertical: spacing.md, backgroundColor: '#F8FAFC', borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12 },
  rowMe: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' },
  rowPodium: { backgroundColor: 'rgba(255, 251, 235, 0.6)' },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankPlain: { backgroundColor: '#F1F5F9' },
  rankPlainText: { color: '#64748B', fontSize: 12, fontWeight: '900' },
  rankText: { fontSize: 12, fontWeight: '900' },
  avatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: '#FFFFFF' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEE2E2' },
  avatarText: { color: '#B91C1C', fontSize: 14, fontWeight: '900' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, color: colors.ink, fontSize: 14, fontWeight: '800' },
  meTag: { backgroundColor: '#DC2626', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  meTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  sub: { color: '#94A3B8', fontSize: 11 },
  right: { alignItems: 'flex-end' },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  days: { color: '#059669', fontSize: 12, fontWeight: '900' },
  minutes: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, paddingTop: spacing.md },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  footerText: { color: colors.muted, fontSize: 12 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.brand },
  ctaText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  mine: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  mineRank: { fontSize: 18, fontWeight: '900' },
  mineTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
});
