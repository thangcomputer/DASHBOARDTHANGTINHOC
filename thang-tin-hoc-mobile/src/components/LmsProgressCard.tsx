import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Crown,
  Flame,
  Lock,
  Medal,
  Sparkles,
  Trophy,
} from 'lucide-react-native';
import { useAuth } from '../app/AuthContext';
import { mobileApiRequest, resolveMobilePublicUrl } from '../services/apiClient';
import { colors } from '../theme/tokens';

type LmsHistoryItem = {
  id: string;
  amount: number;
  reason: string;
  label: string;
  at?: string;
};

type LmsCalendarDay = {
  key?: string;
  day?: number;
  studied?: boolean;
  today?: boolean;
} | null;

type LmsCalendar = {
  month?: string;
  today?: string;
  days?: LmsCalendarDay[];
  studiedCount?: number;
  marks?: number[];
};

type LmsBadge = {
  key: string;
  title: string;
  description: string;
  earned: boolean;
};

type LmsProgressData = {
  xpTotal: number;
  level: number;
  title: string;
  nextLevel: number;
  nextTitle: string;
  xpIntoLevel: number;
  xpForNextLevel: number;
  atMaxLevel: boolean;
  streak: number;
  bestStreak: number;
  lastStudyDay?: string;
  history: LmsHistoryItem[];
  calendar: LmsCalendar | null;
  badges: LmsBadge[];
};

type LmsRankItem = {
  studentId: string;
  rank: number;
  name: string;
  avatar?: string;
  level: number;
  title?: string;
  xp: number;
  isMe?: boolean;
};

type LmsLeaderboardResponse = {
  period: 'week' | 'month' | 'all';
  top: LmsRankItem[];
  me: LmsRankItem | null;
};

const REASON_LABELS: Record<string, string> = {
  welcome: 'Chào mừng thành viên mới',
  section_completed: 'Hoàn thành phần học',
  unit_completed: 'Hoàn thành chủ đề',
  subject_completed: 'Hoàn thành khóa học',
  practice: 'Luyện tập bài học',
  exam: 'Hoàn thành bài thi',
};

function formatWhen(value?: string) {
  if (!value) return '';
  try {
    const d = new Date(value);
    return d.toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function LmsProgressCard() {
  const { subscription, refreshSubscription } = useAuth();
  const [data, setData] = useState<LmsProgressData | null>(null);
  const [tab, setTab] = useState<'history' | 'badges' | 'rank'>('history');
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [board, setBoard] = useState<LmsLeaderboardResponse | null>(null);
  const [celebratingLevel, setCelebratingLevel] = useState<number | null>(null);
  const prevLevelRef = useRef<number | null>(null);

  const loadMe = useCallback(async (month?: string) => {
    try {
      const query = month ? `?month=${encodeURIComponent(month)}` : '';
      const res = await mobileApiRequest<{ success?: boolean; data?: any }>(`/lms-progress/me${query}`);
      const raw = res?.data;
      if (raw) {
        const next: LmsProgressData = {
          xpTotal: Number(raw.xpTotal ?? raw.xp ?? 0),
          level: Number(raw.level ?? 1),
          title: String(raw.title || 'Người nhập môn'),
          nextLevel: Number(raw.nextLevel ?? ((raw.level ?? 1) + 1)),
          nextTitle: String(raw.nextTitle || 'Học viên chăm chỉ'),
          xpIntoLevel: Number(raw.xpIntoLevel ?? 0),
          xpForNextLevel: Number(raw.xpForNextLevel ?? 100),
          atMaxLevel: Boolean(raw.atMaxLevel),
          streak: Number(raw.streak ?? 0),
          bestStreak: Number(raw.bestStreak ?? 0),
          lastStudyDay: raw.lastStudyDay || '',
          history: Array.isArray(raw.history)
            ? raw.history.map((h: any) => ({
              id: String(h._id || h.id || Math.random()),
              amount: Number(h.amount || 0),
              reason: String(h.reason || ''),
              label: String(h.label || REASON_LABELS[h.reason] || 'Hoàn thành bài học'),
              at: String(h.at || h.createdAt || ''),
            }))
            : [],
          calendar: raw.calendar || null,
          badges: Array.isArray(raw.badges)
            ? raw.badges.map((b: any) => ({
              key: String(b.key || b.id || ''),
              title: String(b.title || b.label || ''),
              description: String(b.description || b.desc || ''),
              earned: Boolean(b.earned || b.unlocked),
            }))
            : [],
        };
        if (prevLevelRef.current !== null && next.level > prevLevelRef.current) {
          setCelebratingLevel(next.level);
          setTimeout(() => setCelebratingLevel(null), 5000);
        }
        prevLevelRef.current = next.level;
        setData(next);
      }
    } catch {
      // Bỏ qua lỗi mạng tạm thời
    }
  }, []);

  const loadLeaderboard = useCallback(async (nextPeriod: 'week' | 'month' | 'all') => {
    try {
      const res = await mobileApiRequest<{ success?: boolean; data?: any }>(
        `/lms-progress/leaderboard?period=${nextPeriod}`,
      );
      const raw = res?.data;
      if (raw) {
        setBoard({
          period: nextPeriod,
          top: Array.isArray(raw.top)
            ? raw.top.map((item: any) => ({
              studentId: String(item.studentId || item._id || ''),
              rank: Number(item.rank || 0),
              name: String(item.name || 'Học viên'),
              avatar: String(item.avatar || ''),
              level: Number(item.level || 1),
              title: String(item.title || ''),
              xp: Number(item.xp || 0),
              isMe: Boolean(item.isMe),
            }))
            : [],
          me: raw.me
            ? {
              studentId: String(raw.me.studentId || ''),
              rank: Number(raw.me.rank || 0),
              name: String(raw.me.name || 'Bạn'),
              avatar: String(raw.me.avatar || ''),
              level: Number(raw.me.level || 1),
              title: String(raw.me.title || ''),
              xp: Number(raw.me.xp || 0),
              isMe: true,
            }
            : null,
        });
      }
    } catch {
      setBoard({ period: nextPeriod, top: [], me: null });
    }
  }, []);

  useEffect(() => {
    void loadMe();
    const u = DeviceEventEmitter.addListener('mobile:free-portal-unlocked', () => {
      void loadMe();
      void refreshSubscription();
    });
    return () => { u.remove(); };
  }, [loadMe, refreshSubscription]);

  useEffect(() => {
    if (tab === 'rank') void loadLeaderboard(period);
  }, [tab, period, loadLeaderboard]);

  if (!data) return null;

  const into = data.xpIntoLevel || 0;
  const need = data.xpForNextLevel || 100;
  const progressPct = data.atMaxLevel || !need ? 100 : Math.min(100, Math.max(4, Math.round((into / need) * 100)));

  return (
    <View style={styles.card}>
      {celebratingLevel ? (
        <View style={styles.celebrationBanner}>
          <Sparkles size={15} color="#FFFFFF" />
          <Text style={styles.celebrationText}>
            Chúc mừng! Bạn lên Cấp {celebratingLevel}: {data.title}
          </Text>
        </View>
      ) : null}

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.sectionTag}>HỌC BÀI</Text>
          <Text style={styles.levelText}>Cấp {data.level || 1}</Text>
          <Text style={styles.titleText} numberOfLines={1}>
            {data.title}
          </Text>
        </View>
        <View style={styles.streakPill}>
          <Flame size={14} color="#C2410C" />
          <Text style={styles.streakText}>{data.streak || 0} ngày</Text>
        </View>
      </View>

      <View style={styles.progressSection}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPct}%` }]} />
        </View>
        <View style={styles.progressMetaRow}>
          <Sparkles size={13} color="#F59E0B" />
          <Text style={styles.xpLabelText}>
            {data.xpTotal || 0} XP học bài
            {data.atMaxLevel ? ' · đã đạt cấp cao nhất' : ` · ${into}/${need} tới ${data.nextTitle}`}
          </Text>
        </View>
        <Text style={styles.captionText}>
          Kỷ lục {data.bestStreak || 0} ngày. XP học bài chỉ tính cấp độ và hạng, không dùng để luyện.
        </Text>
      </View>

      <View style={styles.tabBar}>
        {([
          { id: 'history' as const, label: 'Lịch sử' },
          { id: 'badges' as const, label: 'Huy hiệu' },
          { id: 'rank' as const, label: 'Hạng' },
        ]).map(({ id, label }) => {
          const active = tab === id;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
            >
              <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.tabBody}>
        {tab === 'history' ? (() => {
          type TimelineItem = { id: string; kind: 'xp' | 'sub'; label: string; amount: number; at?: string };
          const timeline: TimelineItem[] = [];
          if (data.history) {
            for (const h of data.history) {
              timeline.push({ id: `xp-${h.id}`, kind: 'xp', label: h.label, amount: h.amount, at: h.at });
            }
          }
          if (subscription?.history) {
            for (const sh of subscription.history) {
              timeline.push({
                id: `sub-${sh.id || sh.createdAt}`,
                kind: 'sub',
                label: `Mua gói ${sh.planLabel || sh.plan || ''}`.trim(),
                amount: sh.amount || 0,
                at: sh.createdAt,
              });
            }
          }
          timeline.sort((a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime());

          if (timeline.length === 0) {
            return <Text style={styles.emptyHint}>Chưa có lịch sử.</Text>;
          }

          return (
            <View style={styles.listCol}>
              {timeline.slice(0, 10).map((ev) => (
                <View key={ev.id} style={styles.historyRow}>
                  {ev.kind === 'sub' ? <Crown size={13} color="#F59E0B" style={{ marginRight: 4 }} /> : null}
                  <Text style={styles.historyTitle} numberOfLines={1}>
                    {ev.label}
                  </Text>
                  {ev.kind === 'xp' ? (
                    <Text style={styles.historyXp}>+{ev.amount}</Text>
                  ) : (
                    <Text style={[styles.historyXp, { color: '#D97706' }]}>
                      {ev.amount > 0 ? `${ev.amount.toLocaleString('vi-VN')}đ` : 'Mã kích hoạt'}
                    </Text>
                  )}
                  {ev.at ? (
                    <Text style={styles.historySub} numberOfLines={1}>
                      {formatWhen(ev.at)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          );
        })() : null}

        {tab === 'badges' ? (
          data.badges.length === 0 ? (
            <Text style={styles.emptyHint}>Chưa có huy hiệu.</Text>
          ) : (
            <View style={styles.badgeGrid}>
              {data.badges.map((b) => (
                <View
                  key={b.key}
                  style={[
                    styles.badgeItem,
                    b.earned ? styles.badgeItemUnlocked : styles.badgeItemLocked,
                  ]}
                >
                  <View style={styles.badgeTitleRow}>
                    {b.earned ? (
                      <Medal size={14} color="#D97706" />
                    ) : (
                      <Lock size={13} color="#94A3B8" />
                    )}
                    <Text
                      style={[
                        styles.badgeLabel,
                        !b.earned && { color: '#475569' },
                      ]}
                      numberOfLines={1}
                    >
                      {b.title}
                    </Text>
                  </View>
                  <Text style={styles.badgeDesc} numberOfLines={2}>
                    {b.description}
                  </Text>
                </View>
              ))}
            </View>
          )
        ) : null}

        {tab === 'rank' ? (
          <View style={styles.rankWrap}>
            <View style={styles.periodRow}>
              {[
                { id: 'week' as const, label: 'Tuần' },
                { id: 'month' as const, label: 'Tháng' },
                { id: 'all' as const, label: 'Tất cả' },
              ].map((p) => {
                const active = period === p.id;
                return (
                  <Pressable
                    key={p.id}
                    onPress={() => setPeriod(p.id)}
                    style={[styles.periodBtn, active && styles.periodBtnActive]}
                  >
                    <Text style={[styles.periodBtnText, active && styles.periodBtnTextActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {!board ? (
              <ActivityIndicator size="small" color="#10B981" style={{ marginVertical: 12 }} />
            ) : !board.top || board.top.length === 0 ? (
              <Text style={styles.emptyHint}>Chưa có XP học bài trong kỳ này.</Text>
            ) : (
              <View style={styles.listCol}>
                {board.top.slice(0, 10).map((item, idx) => {
                  const avatarUrl = item.avatar ? resolveMobilePublicUrl(item.avatar) : '';
                  const initial = String(item.name || '?').trim().slice(0, 1).toUpperCase();
                  return (
                    <View
                      key={`${item.studentId || idx}-${item.rank}`}
                      style={[styles.rankRow, item.isMe && styles.rankRowMe]}
                    >
                      <View
                        style={[
                          styles.rankBadge,
                          item.rank <= 3 ? styles.rankBadgeTop : styles.rankBadgeDefault,
                        ]}
                      >
                        {item.rank === 1 ? (
                          <Trophy size={12} color="#78350F" />
                        ) : (
                          <Text
                            style={[
                              styles.rankBadgeText,
                              item.rank <= 3 && styles.rankBadgeTextTop,
                            ]}
                          >
                            {item.rank}
                          </Text>
                        )}
                      </View>

                      {avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.rankAvatar} />
                      ) : (
                        <View style={styles.rankAvatarFallback}>
                          <Text style={styles.rankAvatarText}>{initial}</Text>
                        </View>
                      )}

                      <Text style={styles.rankName} numberOfLines={1}>
                        {item.name}
                        {item.isMe ? ' (Bạn)' : ''}
                      </Text>
                      <Text style={styles.rankLevel}>Cấp {item.level}</Text>
                      <Text style={styles.rankXp}>{item.xp}</Text>
                    </View>
                  );
                })}
                {board.me && !board.top.slice(0, 10).some((item) => item.isMe) ? (
                  <Text style={styles.myRankFooter}>
                    Hạng của bạn: {board.me.rank} · {board.me.xp} XP
                  </Text>
                ) : null}
              </View>
            )}
          </View>
        ) : null}
      </View>
    </View >
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: '#E2E8F0',
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    padding: 16,
    gap: 12,
  },
  celebrationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  celebrationText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#92400E',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  headerLeft: {
    flex: 1,
  },
  sectionTag: {
    fontSize: 10,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  levelText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  titleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 1,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FED7AA',
    borderBottomWidth: 3,
    borderBottomColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  streakText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#C2410C',
  },
  progressSection: {
    gap: 6,
  },
  progressBarBg: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  progressMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  xpLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    flex: 1,
  },
  captionText: {
    fontSize: 11,
    color: '#94A3B8',
    lineHeight: 16,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    padding: 4,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    paddingVertical: 7,
  },
  tabBtnActive: {
    backgroundColor: '#10B981',
    borderWidth: 1,
    borderColor: '#059669',
    borderBottomWidth: 3,
    borderBottomColor: '#047857',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  tabBody: {
    minHeight: 80,
  },
  emptyHint: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 16,
  },
  listCol: {
    gap: 6,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    paddingVertical: 6,
  },
  historyTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  historyXp: {
    fontSize: 12,
    fontWeight: '900',
    color: '#047857',
  },
  historySub: {
    fontSize: 11,
    color: '#94A3B8',
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgeItem: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  badgeItemUnlocked: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  badgeItemLocked: {
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  badgeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: '#1E293B',
    flex: 1,
  },
  badgeDesc: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    lineHeight: 14,
  },
  rankWrap: {
    gap: 8,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 6,
  },
  periodBtn: {
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomWidth: 2,
    borderBottomColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  periodBtnActive: {
    backgroundColor: '#10B981',
    borderColor: '#059669',
    borderBottomWidth: 3,
    borderBottomColor: '#047857',
  },
  periodBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  rankRowMe: {
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeTop: {
    backgroundColor: '#FBBF24',
  },
  rankBadgeDefault: {
    backgroundColor: '#F1F5F9',
  },
  rankBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
  },
  rankBadgeTextTop: {
    color: '#78350F',
  },
  rankAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
  },
  rankAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankAvatarText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.brandDark,
  },
  rankName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  rankLevel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  rankXp: {
    fontSize: 12,
    fontWeight: '900',
    color: '#334155',
  },
  myRankFooter: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },
});

