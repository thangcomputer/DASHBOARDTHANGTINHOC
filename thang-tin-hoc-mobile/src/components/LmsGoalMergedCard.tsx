import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, DeviceEventEmitter, Image,
  Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Check, ChevronLeft, ChevronRight, Crown, Flame, Gamepad2,
  Lock, Medal, PlayCircle, Sparkles, Target, Trophy,
} from 'lucide-react-native';
import { useAuth } from '../app/AuthContext';
import { mobileApiRequest, resolveMobilePublicUrl } from '../services/apiClient';
import { getStudyResumePoint } from '../services/courseVideoApi';
import {
  LEARNING_GOAL_CHANGED_EVENT, OPEN_LEARNING_GOAL_EVENT, STUDY_MINUTE_EVENT,
  formatStudyMinutes, getLearningGoal, periodLabel,
  type LearningGoalData,
} from '../services/learningGoalApi';
import { colors } from '../theme/tokens';
import type { AppStackParamList } from '../navigation/types';

/* ─── types ─────────────────────────────────────────── */
type LmsItem = { id: string; amount: number; label: string; at?: string };
type LmsCalDay = { key?: string; day?: number; studied?: boolean; today?: boolean } | null;
type LmsCal = { month?: string; days?: LmsCalDay[]; studiedCount?: number };
type LmsBadge = { key: string; title: string; description: string; earned: boolean };
type LmsData = {
  xpTotal: number; level: number; title: string; nextTitle: string;
  xpIntoLevel: number; xpForNextLevel: number; atMaxLevel: boolean;
  streak: number; bestStreak: number; history: LmsItem[];
  calendar: LmsCal | null; badges: LmsBadge[];
};
type RankItem = { studentId: string; rank: number; name: string; avatar?: string; level: number; xp: number; isMe?: boolean };
type Leaderboard = { top: RankItem[]; me: RankItem | null };

const WD = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MQ = 10, MV = 1;

function ftime(v?: string) {
  if (!v) return '';
  try { return new Date(v).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}
function shiftMon(m?: string, d = 0) {
  if (!m) return '';
  const [y, mo] = String(m).split('-').map(Number);
  const dt = new Date(Date.UTC(y, (mo || 1) - 1 + d, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
}
function pct(v?: number, t?: number) { return !t ? 0 : Math.min(100, Math.round(((v || 0) / t) * 100)); }
function openGoal() { DeviceEventEmitter.emit(OPEN_LEARNING_GOAL_EVENT); }

/* ─── component ─────────────────────────────────────── */
export function LmsGoalMergedCard() {
  const nav = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { subscription, refreshSubscription } = useAuth();

  /* LMS */
  const [lms, setLms] = useState<LmsData | null>(null);
  const [tab, setTab] = useState<'goal' | 'history' | 'badges' | 'rank'>('goal');
  const [period, setPeriod] = useState<'week' | 'month' | 'all'>('week');
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [celebLevel, setCelebLevel] = useState<number | null>(null);
  const prevLvl = useRef<number | null>(null);

  const loadLms = useCallback(async (month?: string) => {
    try {
      const q = month ? `?month=${encodeURIComponent(month)}` : '';
      const res = await mobileApiRequest<{ data?: any }>(`/lms-progress/me${q}`);
      const raw = res?.data;
      if (!raw) return;
      const next: LmsData = {
        xpTotal: Number(raw.xpTotal ?? 0), level: Number(raw.level ?? 1),
        title: String(raw.title || ''), nextTitle: String(raw.nextTitle || ''),
        xpIntoLevel: Number(raw.xpIntoLevel ?? 0), xpForNextLevel: Number(raw.xpForNextLevel ?? 100),
        atMaxLevel: Boolean(raw.atMaxLevel), streak: Number(raw.streak ?? 0),
        bestStreak: Number(raw.bestStreak ?? 0),
        history: (raw.history || []).map((h: any) => ({ id: String(h._id || h.id || Math.random()), amount: Number(h.amount || 0), label: String(h.label || ''), at: String(h.at || h.createdAt || '') })),
        calendar: raw.calendar || null,
        badges: (raw.badges || []).map((b: any) => ({ key: String(b.key || ''), title: String(b.title || ''), description: String(b.description || ''), earned: Boolean(b.earned) })),
      };
      if (prevLvl.current !== null && next.level > prevLvl.current) { setCelebLevel(next.level); setTimeout(() => setCelebLevel(null), 4000); }
      prevLvl.current = next.level;
      setLms(next);
    } catch { /* skip */ }
  }, []);

  const loadBoard = useCallback(async (p: 'week' | 'month' | 'all') => {
    try {
      const res = await mobileApiRequest<{ data?: any }>(`/lms-progress/leaderboard?period=${p}`);
      const raw = res?.data;
      if (!raw) return;
      setBoard({
        top: (raw.top || []).map((r: any) => ({ studentId: String(r.studentId || ''), rank: Number(r.rank), name: String(r.name || ''), avatar: String(r.avatar || ''), level: Number(r.level || 1), xp: Number(r.xp || 0), isMe: Boolean(r.isMe) })),
        me: raw.me ? { studentId: String(raw.me.studentId || ''), rank: Number(raw.me.rank), name: String(raw.me.name || ''), avatar: String(raw.me.avatar || ''), level: Number(raw.me.level || 1), xp: Number(raw.me.xp || 0), isMe: true } : null,
      });
    } catch { setBoard({ top: [], me: null }); }
  }, []);

  useEffect(() => { void loadLms(); }, [loadLms]);
  useEffect(() => { if (tab === 'rank') void loadBoard(period); }, [tab, period, loadBoard]);

  /* Goal */
  const [gd, setGd] = useState<LearningGoalData | null>(null);
  const openVideo = () => { void getStudyResumePoint().catch(() => null); nav.navigate('DailyPractice', { watch: 'stage' } as any); };
  const loadGoal = useCallback(() => { getLearningGoal().then(setGd).catch(() => { }); }, []);
  useFocusEffect(useCallback(() => {
    loadGoal();
    void loadLms();
    void refreshSubscription();
  }, [loadGoal, loadLms, refreshSubscription]));
  useEffect(() => {
    const c = DeviceEventEmitter.addListener(LEARNING_GOAL_CHANGED_EVENT, (n: LearningGoalData) => { if (n) setGd(n); });
    const m = DeviceEventEmitter.addListener(STUDY_MINUTE_EVENT, ({ todayMinutes: mins }: { todayMinutes?: number }) => {
      if (!Number.isFinite(Number(mins))) return;
      setGd(prev => prev ? { ...prev, progress: { ...prev.progress, todayMinutes: Number(mins), periodMinutes: (prev.progress.periodMinutes || 0) + Math.max(0, Number(mins) - (prev.progress.todayMinutes || 0)) } } : prev);
    });
    const u = DeviceEventEmitter.addListener('mobile:free-portal-unlocked', () => {
      void loadLms();
      void refreshSubscription();
    });
    return () => { c.remove(); m.remove(); u.remove(); };
  }, [loadLms, refreshSubscription]);

  if (!lms && !gd) return null;

  /* computed lms */
  const lmsW = lms ? (lms.atMaxLevel || !lms.xpForNextLevel ? 100 : Math.min(100, Math.max(3, Math.round((lms.xpIntoLevel / lms.xpForNextLevel) * 100)))) : 0;

  /* computed goal */
  const { goal, progress: pr = {} as any } = gd || {};
  const todayPct = pct(pr.todayMinutes, pr.dailyTargetMinutes);
  const perPct = pct(pr.periodMinutes, pr.periodTargetMinutes);
  const todayDone = todayPct >= 100;
  const qDone = (pr.todayQuestions || 0) >= MQ;
  const vDone = (pr.todayVideos || 0) >= MV;
  const doneCount = [qDone, vDone].filter(Boolean).length;

  const TABS = [
    { id: 'goal' as const, label: 'Mục tiêu' },
    { id: 'badges' as const, label: 'Huy hiệu' },
    { id: 'rank' as const, label: 'Hạng' },
    { id: 'history' as const, label: 'Lịch sử' },
  ];

  return (
    <View style={s.card}>

      {/* Level up banner */}
      {celebLevel && lms && (
        <View style={s.celebBanner}>
          <Text style={s.celebText}>🎉 Chúc mừng! Bạn lên Cấp {celebLevel}: {lms.title}</Text>
        </View>
      )}

      {/* ══ NỘI DUNG THẺ GỘP ══ */}
      <View style={s.section}>
        {/* Header */}
        <View style={s.row}>
          <View style={s.f1}>
            <Text style={s.sectionTag}>HỌC BÀI</Text>
            <Text style={s.lvlText}>Cấp {lms?.level || 1}</Text>
            <Text style={s.lvlSub} numberOfLines={1}>{lms?.title}</Text>
          </View>
          <View style={s.streakPill}>
            <Flame size={13} color="#C2410C" />
            <Text style={s.streakTxt}>{lms?.streak || 0} ngày</Text>
          </View>
        </View>

        {/* XP bar */}
        <View style={s.barBg}>
          <View style={[s.barFill, { width: `${lmsW}%` as any, backgroundColor: '#10B981' }]} />
        </View>
        <View style={s.xpRow}>
          <Sparkles size={11} color="#F59E0B" />
          <Text style={s.xpTxt} numberOfLines={1}>
            {lms?.xpTotal || 0} XP học bài
            {lms?.atMaxLevel ? ' · đạt cấp cao nhất' : ` · ${lms?.xpIntoLevel || 0}/${lms?.xpForNextLevel || 100} tới ${lms?.nextTitle}`}
          </Text>
        </View>

        {/* Pill tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pillRow}>
          {TABS.map(({ id, label }) => {
            const a = tab === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={[s.pill, a && s.pillActive]}
                accessibilityRole="button"
              >
                <Text style={[s.pillTxt, a && s.pillTxtActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Tab body */}
        {tab === 'goal' && (
          <View style={s.tabGoalWrap}>
            {!goal ? (
              <View style={s.emptyGoalRow}>
                <View style={s.icon}><Target size={18} color="#DC2626" /></View>
                <View style={s.f1}>
                  <Text style={s.goalTitle}>Chưa đặt mục tiêu học</Text>
                  <Text style={s.goalMeta}>Đặt mục tiêu để theo dõi số giờ học.</Text>
                </View>
                <Pressable onPress={openGoal} style={s.ctaBtn} accessibilityRole="button">
                  <Text style={s.ctaTxt}>Đặt ngay</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {/* Header */}
                <View style={s.row}>
                  <View style={s.icon}><Target size={18} color="#DC2626" /></View>
                  <View style={s.f1}>
                    <Text numberOfLines={1} style={s.goalTitle}>Mục tiêu: {goal.hoursPerDay} giờ/ngày</Text>
                    <Text numberOfLines={1} style={s.goalMeta}>
                      {goal.expired ? 'Đã kết thúc' : `${periodLabel(goal.period)} · Còn ${pr.daysLeft} ngày`}
                    </Text>
                  </View>
                  <Pressable onPress={openGoal} style={s.outBtn} accessibilityRole="button">
                    <Text style={s.outTxt}>{goal.expired ? 'Đặt mới' : 'Đổi'}</Text>
                  </Pressable>
                </View>

                {/* Hôm nay */}
                <View style={s.metric}>
                  <View style={s.metricRow}>
                    <View style={s.metricLabel}>
                      <Flame size={13} color={todayDone ? '#10B981' : '#F97316'} />
                      <Text style={s.metricLabelTxt}>Hôm nay</Text>
                    </View>
                    <Text style={s.metricVal}>
                      {`${formatStudyMinutes(pr.todayMinutes)} / ${goal.hoursPerDay} giờ`}
                      <Text style={todayDone ? s.pctDone : s.pct}>{` (${todayPct}%)`}</Text>
                    </Text>
                  </View>
                  <View style={s.barBg}>
                    <View style={[s.barFill, { width: `${todayPct}%` as any, backgroundColor: todayDone ? '#10B981' : '#F97316' }]} />
                  </View>
                  <View style={s.subRow}>
                    <Text style={s.subTxt}>Cả kỳ: {formatStudyMinutes(pr.periodMinutes)} ({perPct}%)</Text>
                    {todayDone && <Text style={s.doneTxt}>✓ Đã đạt hôm nay</Text>}
                  </View>
                </View>

                {/* Nhiệm vụ */}
                <View style={s.missionSection}>
                  <View style={s.metricRow}>
                    <Text style={s.missionLabel}>Nhiệm vụ hôm nay</Text>
                    <Text style={s.missionBadge}>{doneCount}/2 xong</Text>
                  </View>
                  <View style={s.missionRow}>
                    {/* Luyện tập */}
                    <Pressable onPress={() => nav.navigate('DailyPractice')}
                      style={({ pressed }) => [s.mini, qDone && s.miniDone, pressed && s.pressed]}>
                      <View style={[s.miniIcon, qDone ? s.miniIconDone : s.miniIconQ]}>
                        {qDone ? <Check size={13} strokeWidth={3} color="#fff" /> : <Gamepad2 size={14} color="#0284C7" />}
                      </View>
                      <View style={s.f1}>
                        <Text numberOfLines={1} style={s.miniTitle}>Luyện tập</Text>
                        <Text numberOfLines={1} style={[s.miniMeta, qDone && s.miniMetaDone]}>{pr.todayQuestions || 0}/{MQ} câu</Text>
                      </View>
                    </Pressable>
                    {/* Xem video */}
                    <Pressable onPress={openVideo}
                      style={({ pressed }) => [s.mini, vDone && s.miniDone, pressed && s.pressed]}>
                      <View style={[s.miniIcon, vDone ? s.miniIconDone : s.miniIconV]}>
                        {vDone ? <Check size={13} strokeWidth={3} color="#fff" /> : <PlayCircle size={14} color="#7C3AED" />}
                      </View>
                      <View style={s.f1}>
                        <Text numberOfLines={1} style={s.miniTitle}>Xem video</Text>
                        <Text numberOfLines={1} style={[s.miniMeta, vDone && s.miniMetaDone]}>{pr.todayVideos || 0}/{MV} video</Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                <Text style={s.hint}>* Giờ học tính khi bạn làm bài, ôn thi hoặc xem video.</Text>
              </>
            )}
          </View>
        )}

        {tab === 'history' && (() => {
          type TimelineItem = { id: string; kind: 'xp' | 'sub'; label: string; amount: number; at?: string };
          const timeline: TimelineItem[] = [];
          if (lms?.history) {
            for (const h of lms.history) {
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
            return <Text style={s.empty}>Chưa có lịch sử.</Text>;
          }

          return (
            <View style={{ gap: 2 }}>
              {timeline.slice(0, 10).map((ev) => (
                <View key={ev.id} style={s.histRow}>
                  {ev.kind === 'sub' ? <Crown size={13} color="#F59E0B" style={s.histIcon} /> : null}
                  <Text style={s.histLabel} numberOfLines={1}>{ev.label}</Text>
                  {ev.kind === 'xp' ? (
                    <Text style={s.histXp}>+{ev.amount}</Text>
                  ) : (
                    <Text style={s.histSub}>
                      {ev.amount > 0 ? `${ev.amount.toLocaleString('vi-VN')}đ` : 'Mã kích hoạt'}
                    </Text>
                  )}
                  {ev.at ? <Text style={s.histTime}>{ftime(ev.at)}</Text> : null}
                </View>
              ))}
            </View>
          );
        })()}

        {tab === 'badges' && (
          !lms || lms.badges.length === 0
            ? <Text style={s.empty}>Chưa có huy hiệu.</Text>
            : <View style={s.badgeGrid}>
              {lms.badges.map(b => (
                <View key={b.key} style={[s.badgeItem, b.earned ? s.badgeOn : s.badgeOff]}>
                  <View style={s.badgeTR}>
                    {b.earned ? <Medal size={12} color="#D97706" /> : <Lock size={11} color="#94A3B8" />}
                    <Text style={s.badgeLabel} numberOfLines={1}>{b.title}</Text>
                  </View>
                  <Text style={s.badgeDesc} numberOfLines={2}>{b.description}</Text>
                </View>
              ))}
            </View>
        )}

        {tab === 'rank' && (
          <View style={s.rankWrap}>
            <View style={s.pillRow}>
              {(['week', 'month', 'all'] as const).map(p => {
                const lbs = { week: 'Tuần', month: 'Tháng', all: 'Tất cả' } as const;
                const a = period === p;
                return (
                  <Pressable key={p} onPress={() => setPeriod(p)} style={[s.pill, a && s.pillActive]}>
                    <Text style={[s.pillTxt, a && s.pillTxtActive]}>{lbs[p]}</Text>
                  </Pressable>
                );
              })}
            </View>
            {!board
              ? <ActivityIndicator size="small" color="#10B981" style={{ marginVertical: 10 }} />
              : board.top.length === 0
                ? <Text style={s.empty}>Chưa có XP trong kỳ này.</Text>
                : board.top.slice(0, 10).map((r, i) => {
                  const url = r.avatar ? resolveMobilePublicUrl(r.avatar) : '';
                  const ini = String(r.name || '?').trim()[0].toUpperCase();
                  return (
                    <View key={`${r.studentId || i}-${r.rank}`} style={[s.rankRow, r.isMe && s.rankMe]}>
                      <View style={[s.rankBadge, r.rank <= 3 ? s.rankTop : s.rankDef]}>
                        {r.rank === 1 ? <Trophy size={11} color="#78350F" /> : <Text style={[s.rankN, r.rank <= 3 && s.rankNTop]}>{r.rank}</Text>}
                      </View>
                      {url ? <Image source={{ uri: url }} style={s.rankAv} /> : <View style={s.rankAvF}><Text style={s.rankAvTxt}>{ini}</Text></View>}
                      <Text style={s.rankName} numberOfLines={1}>{r.name}{r.isMe ? ' (Bạn)' : ''}</Text>
                      <Text style={s.rankLvl}>Cấp {r.level}</Text>
                      <Text style={s.rankXp}>{r.xp}</Text>
                    </View>
                  );
                })
            }
            {board?.me && !board.top.some(r => r.isMe) && (
              <Text style={s.myRank}>Hạng của bạn: {board.me.rank} · {board.me.xp} XP</Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/* ─── styles ───────────────────────────────────────────── */
const s = StyleSheet.create({
  f1: { flex: 1 },
  card: { borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', overflow: 'hidden' },
  section: { padding: 16, gap: 10 },
  tabGoalWrap: { gap: 10, paddingTop: 4 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E2E8F0', marginHorizontal: 16 },

  celebBanner: { backgroundColor: '#FFFBEB', borderBottomWidth: 1, borderBottomColor: '#FDE68A', paddingHorizontal: 14, paddingVertical: 10 },
  celebText: { fontSize: 12, fontWeight: '900', color: '#92400E' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTag: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 0.6, textTransform: 'uppercase' },
  lvlText: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginTop: 1 },
  lvlSub: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  streakPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFF7ED', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  streakTxt: { fontSize: 12, fontWeight: '900', color: '#C2410C' },

  barBg: { height: 7, borderRadius: 999, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },

  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  xpTxt: { fontSize: 11, fontWeight: '600', color: '#64748B', flex: 1 },

  tabBar: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 3 },
  tabItem: { flex: 1, paddingVertical: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 9 },
  tabItemActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
  tabTxt: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  tabTxtActive: { fontWeight: '900', color: '#0F172A' },

  pillRow: { flexDirection: 'row', gap: 6 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#F1F5F9' },
  pillActive: { backgroundColor: '#0F172A' },
  pillTxt: { fontSize: 11, fontWeight: '800', color: '#64748B' },
  pillTxtActive: { color: '#FFFFFF' },

  empty: { fontSize: 12, fontWeight: '600', color: '#94A3B8', textAlign: 'center', paddingVertical: 10 },

  histRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F8FAFC', paddingVertical: 5 },
  histIcon: { marginRight: 2 },
  histLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: '#334155' },
  histXp: { fontSize: 12, fontWeight: '900', color: '#047857' },
  histSub: { fontSize: 12, fontWeight: '800', color: '#D97706' },
  histTime: { fontSize: 11, color: '#94A3B8' },

  calWrap: { gap: 8 },
  calNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  calNavBtn: { flexDirection: 'row', alignItems: 'center', gap: 2, padding: 6, borderRadius: 8, backgroundColor: '#F8FAFC' },
  calNavTxt: { fontSize: 12, fontWeight: '700', color: '#475569' },
  calMonth: { fontSize: 13, fontWeight: '900', color: '#334155' },
  calDays: { flexDirection: 'row', justifyContent: 'space-between' },
  calWd: { width: '14.2%', textAlign: 'center', fontSize: 10, fontWeight: '900', color: '#94A3B8' },
  calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calCell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', padding: 2 },
  calCircle: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  calStudied: { backgroundColor: '#F97316' },
  calToday: { backgroundColor: '#FFEDD5' },
  calNum: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  calNumS: { color: '#fff', fontWeight: '900' },
  calNumT: { color: '#C2410C', fontWeight: '900' },
  calFoot: { fontSize: 11, fontWeight: '600', color: '#64748B' },

  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgeItem: { width: '48%', flexGrow: 1, borderRadius: 10, borderWidth: 1, padding: 10, gap: 4 },
  badgeOn: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  badgeOff: { borderColor: '#F1F5F9', backgroundColor: '#F8FAFC' },
  badgeTR: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  badgeLabel: { fontSize: 11, fontWeight: '900', color: '#1E293B', flex: 1 },
  badgeDesc: { fontSize: 10, fontWeight: '600', color: '#64748B', lineHeight: 14 },

  rankWrap: { gap: 8 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 5 },
  rankMe: { backgroundColor: '#ECFDF5', borderWidth: 1, borderColor: '#A7F3D0' },
  rankBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rankTop: { backgroundColor: '#FCD34D' },
  rankDef: { backgroundColor: '#F1F5F9' },
  rankN: { fontSize: 10, fontWeight: '900', color: '#64748B' },
  rankNTop: { color: '#78350F' },
  rankAv: { width: 28, height: 28, borderRadius: 14 },
  rankAvF: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  rankAvTxt: { fontSize: 11, fontWeight: '900', color: '#DC2626' },
  rankName: { flex: 1, fontSize: 12, fontWeight: '700', color: '#1E293B' },
  rankLvl: { fontSize: 10, fontWeight: '600', color: '#94A3B8' },
  rankXp: { fontSize: 12, fontWeight: '900', color: '#1E293B' },
  myRank: { fontSize: 11, fontWeight: '600', color: '#94A3B8', textAlign: 'center' },

  emptyGoalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 14, padding: 12 },
  icon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  goalTitle: { color: colors.ink, fontSize: 14, fontWeight: '900' },
  goalMeta: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: 1 },
  ctaBtn: { backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  ctaTxt: { color: '#fff', fontSize: 12, fontWeight: '900' },
  outBtn: { borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5 },
  outTxt: { color: colors.ink, fontSize: 12, fontWeight: '800' },

  metric: { gap: 6 },
  metricRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  metricLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricLabelTxt: { color: '#334155', fontSize: 13, fontWeight: '800' },
  metricVal: { color: colors.ink, fontSize: 13, fontWeight: '900' },
  pct: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  pctDone: { color: '#059669', fontSize: 11, fontWeight: '800' },
  subRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  subTxt: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  doneTxt: { color: '#059669', fontSize: 11, fontWeight: '800' },

  missionSection: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E2E8F0', paddingTop: 10 },
  missionLabel: { color: '#1E293B', fontSize: 13, fontWeight: '900' },
  missionBadge: { color: colors.muted, fontSize: 11, fontWeight: '700', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  missionRow: { flexDirection: 'row', gap: 8 },
  mini: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
  miniDone: { borderColor: '#A7F3D0', backgroundColor: '#ECFDF5' },
  pressed: { opacity: 0.78 },
  miniIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  miniIconQ: { backgroundColor: '#E0F2FE' },
  miniIconV: { backgroundColor: '#F3E8FF' },
  miniIconDone: { backgroundColor: '#10B981' },
  miniTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  miniMeta: { color: colors.muted, fontSize: 11, fontWeight: '700' },
  miniMetaDone: { color: '#047857' },

  hint: { color: '#94A3B8', fontSize: 11, fontWeight: '500', lineHeight: 15 },
});
