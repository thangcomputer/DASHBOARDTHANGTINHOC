import React, { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Award, CheckCircle2, ChevronRight, Crown, Gem, Medal, Shield, Trophy } from 'lucide-react-native';
import { getMobileImageSource } from '../services/apiClient';
import { DAILY_PRACTICE_STATS_EVENT } from '../services/dailyPracticeApi';
import {
  LEARNING_GOAL_CHANGED_EVENT,
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

const LEAGUE_TIERS = [
  { key: 'bronze', name: 'Đồng', Icon: Medal, iconColor: '#B45309', minMinutes: 0, ringColor: 'rgba(180, 83, 9, 0.6)', ringWidth: 2, badgeBg: '#FEF3C7', badgeText: '#92400E' },
  { key: 'silver', name: 'Bạc', Icon: Medal, iconColor: '#64748B', minMinutes: 60, ringColor: '#94A3B8', ringWidth: 2, badgeBg: '#E2E8F0', badgeText: '#334155' },
  { key: 'gold', name: 'Vàng', Icon: Award, iconColor: '#F59E0B', minMinutes: 120, ringColor: '#FBBF24', ringWidth: 2, badgeBg: '#FEF9C3', badgeText: '#854D0E' },
  { key: 'platinum', name: 'Bạch Kim', Icon: Shield, iconColor: '#0891B2', minMinutes: 210, ringColor: '#22D3EE', ringWidth: 2, badgeBg: '#CFFAFE', badgeText: '#155E75' },
  { key: 'diamond', name: 'Kim Cương', Icon: Gem, iconColor: '#C026D3', minMinutes: 300, ringColor: '#E879F9', ringWidth: 3, badgeBg: '#FAE8FF', badgeText: '#86198F' },
] as const;

type LeagueTier = (typeof LEAGUE_TIERS)[number];

function TierIcon({ tier, size = 11 }: { tier?: LeagueTier; size?: number }) {
  const Icon = tier?.Icon || Medal;
  return <Icon size={size} color={tier?.iconColor || '#B45309'} />;
}

function leagueForRow(row?: { rank?: number | null; minutes?: number | null; goalDays?: number | null } | null): LeagueTier {
  const mins = Number(row?.minutes) || 0;
  const days = Number(row?.goalDays) || 0;
  if (row?.rank === 1 && mins >= 60) return LEAGUE_TIERS[4];
  if (mins >= 300 || days >= 6) return LEAGUE_TIERS[4];
  if (mins >= 210 || days >= 5) return LEAGUE_TIERS[3];
  if (mins >= 120 || days >= 3) return LEAGUE_TIERS[2];
  if (mins >= 60 || days >= 2) return LEAGUE_TIERS[1];
  return LEAGUE_TIERS[0];
}

function formatWeekDay(key: string) {
  const [, month, day] = String(key || '').split('-');
  return day && month ? `${day}/${month}` : '';
}

function gapMessage(me: LearningLeaderboard['me']) {
  if (!me?.rank) return '';
  if (me.rank === 1) return 'Bạn đang dẫn đầu — giữ phong độ nhé!';
  const ahead = me.ahead;
  if (!ahead) return '';
  if (ahead.goalDays > me.goalDays) {
    return `Đạt thêm ${ahead.goalDays - me.goalDays} ngày mục tiêu để vượt #${ahead.rank}.`;
  }
  return `Học thêm ${formatStudyMinutes(ahead.minutes - me.minutes + 1)} để vượt #${ahead.rank}.`;
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

function Avatar({
  name,
  avatar,
  tier,
}: {
  name: string;
  avatar: string;
  tier: LeagueTier;
}) {
  const [failed, setFailed] = useState(false);
  const initial = String(name || '?').trim().split(/\s+/).pop()?.[0]?.toUpperCase() || '?';
  const frameStyle = { borderColor: tier.ringColor, borderWidth: tier.ringWidth };
  if (avatar && !failed) {
    return <Image source={getMobileImageSource(avatar)} onError={() => setFailed(true)} style={[styles.avatar, frameStyle]} />;
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback, frameStyle]}>
      <Text style={styles.avatarText}>{initial}</Text>
    </View>
  );
}

/** Bảng xếp hạng tuần: HV đạt mục tiêu nhiều ngày nhất (bằng nhau so phút học), toàn trung tâm. */
export function LearningLeaderboardCard({ isBrandStudent = false }: { isBrandStudent?: boolean }) {
  const [data, setData] = useState<LearningLeaderboard | null>(null);
  const [error, setError] = useState('');
  const freePortal = !isBrandStudent;

  const load = useCallback(() => {
    getLearningLeaderboard()
      .then((next) => { setData(next); setError(''); })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Không tải được bảng xếp hạng'));
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const goalSub = DeviceEventEmitter.addListener(LEARNING_GOAL_CHANGED_EVENT, load);
    const statsSub = DeviceEventEmitter.addListener(DAILY_PRACTICE_STATS_EVENT, load);
    return () => {
      goalSub.remove();
      statsSub.remove();
    };
  }, [load]);

  const me = data?.me;
  const top = data?.top || [];
  const meInTop = top.some((row) => row.isMe);
  const myLeague = leagueForRow(me);
  const nextTierIdx = Math.min(LEAGUE_TIERS.length - 1, LEAGUE_TIERS.findIndex((t) => t.key === myLeague.key) + 1);
  const nextLeague = LEAGUE_TIERS[nextTierIdx];

  return (
    <View style={styles.card}>
      <View style={styles.headRow}>
        <View style={styles.icon}><Trophy size={20} color="#FFFFFF" /></View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <Text numberOfLines={1} style={styles.title}>Bảng xếp hạng tuần</Text>
            <View style={[styles.leagueBadge, { backgroundColor: myLeague.badgeBg }]}>
              <TierIcon tier={myLeague} size={13} />
              <Text style={[styles.leagueBadgeText, { color: myLeague.badgeText }]}>{myLeague.name}</Text>
            </View>
          </View>
          <Text numberOfLines={1} style={styles.meta}>
            {data
              ? `${formatWeekDay(data.weekStart)} – ${formatWeekDay(data.weekEnd)} · ${data.participants} ${freePortal ? 'học viên tham gia' : 'HV'}`
              : 'Đang tải…'}
          </Text>
        </View>
      </View>

      {me && myLeague.key !== 'diamond' ? (
        <View style={styles.leagueStrip}>
          <View style={styles.leagueStripLeft}>
            <Text style={styles.leagueStripLabel}>Hạng tuần:</Text>
            <View style={styles.leagueTierTrack}>
              {LEAGUE_TIERS.map((t, idx) => (
                <View key={t.key} style={styles.leagueTierItem}>
                  <TierIcon tier={t} size={14} />
                  {idx < LEAGUE_TIERS.length - 1 ? <ChevronRight size={12} color="#94A3B8" /> : null}
                </View>
              ))}
            </View>
          </View>
          <Text style={styles.leagueNextText}>
            {`Lên ${nextLeague.name}: ${Math.max(0, nextLeague.minMinutes - (Number(me.minutes) || 0))}p`}
          </Text>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.list}>
        {data && !top.length ? (
          <Text style={styles.empty}>Tuần này chưa có ai — hãy là người đầu tiên!</Text>
        ) : null}
        {top.map((row) => {
          const tier = leagueForRow(row);
          const xpVisible = freePortal ? row.xp > 0 : (row.rank === 1 && row.xp > 0);
          return (
            <View key={`${row.rank}-${row.name}`} style={[styles.row, row.isMe ? styles.rowMeBrand : row.rank <= 3 ? styles.rowPodium : null]}>
              <RankBadge rank={row.rank} />
              <Avatar name={row.name} avatar={row.avatar} tier={tier} />
              <View style={styles.flex}>
                <View style={styles.nameRow}>
                  <Text numberOfLines={1} style={styles.name}>{row.name}</Text>
                  {row.isMe ? <View style={styles.meTagBrand}><Text style={styles.meTagText}>BẠN</Text></View> : null}
                </View>
                <View style={styles.tierRow}>
                  <TierIcon tier={tier} size={13} />
                  <Text numberOfLines={1} style={styles.sub}>
                    {`Hạng ${tier.name}${freePortal && row.hoursPerDay ? ` · Mục tiêu ${row.hoursPerDay}g/ngày` : ''}`}
                  </Text>
                </View>
              </View>
              <View style={styles.right}>
                <View style={styles.daysRow}>
                  <CheckCircle2 size={11} color="#059669" />
                  <Text style={styles.days}>{`${row.goalDays}/${data?.daysSoFar || 7}${freePortal ? ' ngày' : ''}`}</Text>
                </View>
                <Text style={styles.minutes}>
                  {formatStudyMinutes(row.minutes)}
                  {xpVisible ? <Text style={styles.xp}>{` · ${row.xp} XP`}</Text> : null}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {data && me ? (
        <View style={styles.footer}>
          {!me.hasGoal ? (
            <Text style={styles.footerText}>Đặt mục tiêu ở tab Mục tiêu để lên bảng.</Text>
          ) : !me.rank ? (
            <Text style={styles.footerText}>Chưa có phút học tuần này — vào bài học ngay để lên bảng.</Text>
          ) : meInTop ? (
            gapMessage(me) ? (
              <Text style={styles.footerText}>{gapMessage(me)}</Text>
            ) : null
          ) : (
            <View style={styles.mine}>
              <Text style={styles.mineRank}>{`#${me.rank}`}</Text>
              <Text style={styles.mineCopy}>
                <Text style={styles.mineStrong}>{`${me.goalDays} ngày đạt · ${formatStudyMinutes(me.minutes)}`}</Text>
                {gapMessage(me) ? ` — ${gapMessage(me)}` : ''}
              </Text>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, padding: 14, gap: 10 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D97706',
    backgroundImage: 'linear-gradient(180deg, #FBBF24 0%, #D97706 100%)',
  } as never,
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexShrink: 1, color: '#0F172A', fontSize: 14, fontWeight: '900' },
  leagueBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  leagueBadgeText: { fontSize: 10, fontWeight: '900' },
  meta: { color: '#64748B', fontSize: 11, marginTop: 2 },
  leagueStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    borderRadius: 12, backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 6,
  },
  leagueStripLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, minWidth: 0 },
  leagueStripLabel: { color: '#475569', fontSize: 11, fontWeight: '600' },
  leagueTierTrack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leagueTierItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  leagueNextText: { color: '#047857', fontSize: 11, fontWeight: '800', flexShrink: 0 },
  error: { color: '#92400E', backgroundColor: '#FFFBEB', fontSize: 11, fontWeight: '700', padding: 8, borderRadius: 10 },
  list: { gap: 4 },
  empty: { color: '#64748B', fontSize: 11, textAlign: 'center', paddingVertical: spacing.md, backgroundColor: '#F8FAFC', borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6, paddingVertical: 6, borderRadius: 12 },
  rowMeBrand: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  rowPodium: { backgroundColor: 'rgba(255, 251, 235, 0.55)' },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rankPlain: { backgroundColor: '#F1F5F9' },
  rankPlainText: { color: '#64748B', fontSize: 11, fontWeight: '900' },
  rankText: { fontSize: 11, fontWeight: '900' },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#ECFDF5' },
  avatarText: { color: '#047857', fontSize: 12, fontWeight: '900' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, color: '#1E293B', fontSize: 13, fontWeight: '800' },
  meTagBrand: { backgroundColor: '#D1FAE5', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  meTagText: { color: '#065F46', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  sub: { flexShrink: 1, color: '#64748B', fontSize: 10, fontWeight: '600' },
  right: { alignItems: 'flex-end' },
  daysRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  days: { color: '#059669', fontSize: 11, fontWeight: '900' },
  minutes: { color: '#64748B', fontSize: 10, fontWeight: '600', marginTop: 1 },
  xp: { color: '#D97706', fontWeight: '800' },
  footer: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 8 },
  footerText: { color: '#64748B', fontSize: 11, lineHeight: 16 },
  mine: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#F8FAFC' },
  mineRank: { fontSize: 16, fontWeight: '900', color: '#059669' },
  mineCopy: { flex: 1, color: '#475569', fontSize: 11, lineHeight: 16 },
  mineStrong: { fontWeight: '800', color: '#1E293B' },
});
