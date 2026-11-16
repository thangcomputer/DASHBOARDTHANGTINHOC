import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import {
  Award,
  CalendarCheck,
  Flame,
  Layers,
  Play,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react-native';
import { pathTopicPrimaryCtaLabel } from '../../../../shared/dailyPractice/lastPathTopic.mjs';
import { Mascot, type MascotMood } from './Mascot';
import type { GameSound } from './useGameSounds';
import { DuoButton } from '../duo/DuoButton';
import type { DpStats, DpTopicPath } from '../../services/dailyPracticeApi';
import {
  getMobileSoundEnabled,
  setMobileSoundEnabled,
  subscribeToMobileSoundPreference,
} from '../../services/soundPreferences';

const STREAK_MILESTONES = [
  { days: 3, title: 'Mốc 3 ngày liên tiếp!', badge: 'Khởi đầu bứt phá' },
  { days: 7, title: 'Chuỗi 7 ngày rực lửa!', badge: 'Chiến binh tuần lễ' },
  { days: 30, title: 'Kỷ lục 30 ngày kiên trì!', badge: 'Huyền thoại DewSkill' },
];

function getStreakMilestone(streakDays: number) {
  const days = Number(streakDays) || 0;
  if (days <= 0) return null;
  for (let i = STREAK_MILESTONES.length - 1; i >= 0; i -= 1) {
    if (days >= STREAK_MILESTONES[i].days) return STREAK_MILESTONES[i];
  }
  return null;
}

export type DailyPracticeHeroProps = {
  stats: DpStats | null;
  displayName?: string;
  mode: 'path' | 'free' | 'goal';
  onPrimaryAction: () => void;
  primaryDisabled?: boolean;
  primaryLabel: string;
  starting?: boolean;
  pathTopic?: DpTopicPath | null;
  pathContinue?: boolean;
  onBuyXp?: () => void;
  onOpenCertificate?: () => void;
  play?: (s: GameSound) => void;
};

/** Banner chào mừng DewSkill — đồng bộ giao diện & số liệu từ Web DailyPracticeHero. */
export function DailyPracticeHero({
  stats,
  displayName = 'bạn',
  mode,
  onPrimaryAction,
  primaryDisabled = false,
  primaryLabel,
  starting = false,
  pathTopic = null,
  onBuyXp,
  onOpenCertificate,
  play,
}: DailyPracticeHeroProps) {
  const { width } = useWindowDimensions();
  const isWide = width >= 960;
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    let active = true;
    getMobileSoundEnabled()
      .then((enabled) => { if (active) setSoundEnabled(enabled); })
      .catch(() => { });
    const unsub = subscribeToMobileSoundPreference((enabled) => setSoundEnabled(enabled));
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    void setMobileSoundEnabled(next)
      .then(() => {
        setSoundEnabled(next);
        if (next) play?.('tap');
      })
      .catch(() => { });
  }, [play, soundEnabled]);

  const streak = stats?.streak || 0;
  const playedToday = Boolean(stats?.playedToday);
  const mood: MascotMood = playedToday
    ? 'energy'
    : stats?.streakState === 'lost'
      ? 'sad'
      : stats?.streakState === 'at_risk' && streak > 0
        ? 'determined'
        : 'studying';

  const pathMode = Boolean(mode === 'path' && pathTopic?.topic?.name);
  const cleanName = (displayName || '').trim() || 'bạn';

  const chapterCompleted = pathTopic?.completedUnits || 0;
  const chapterTotal = pathTopic?.totalUnits || 0;
  const chapterDone = chapterTotal > 0 && chapterCompleted >= chapterTotal;
  const activeUnit = (pathTopic?.units || []).find((u) => u.state === 'active') || null;
  const activeSteps = Array.isArray(activeUnit?.steps) ? activeUnit.steps : [];
  const activeFraction = activeSteps.length
    ? activeSteps.filter((s) => s.state === 'completed').length / activeSteps.length
    : 0;
  const coursePct = chapterTotal > 0
    ? Math.min(100, Math.round(((chapterCompleted + activeFraction) / chapterTotal) * 100))
    : 0;
  const courseBar = Math.max(coursePct, chapterCompleted > 0 ? 5 : 0);

  const tagline = pathMode
    ? 'Tiếp tục hành trình chinh phục Tin học nhé!'
    : 'Chọn chủ đề, hoàn thành lượt luyện và nhận XP mỗi ngày.';

  const ctaLabel = pathMode && !chapterDone
    ? pathTopicPrimaryCtaLabel(pathTopic)
    : primaryLabel;

  const streakMilestone = useMemo(() => getStreakMilestone(streak), [streak]);

  return (
    <View style={styles.heroCard}>
      <View style={[styles.topSection, isWide && styles.topSectionWide]}>
        <View style={styles.greetingRow}>
          <View style={styles.mascotBox}>
            <Mascot mood={mood} size={isWide ? 80 : 72} />
          </View>
          <View style={styles.greetingCopy}>
            <Text style={styles.greetingText} numberOfLines={1}>
              {'Chào bạn, '}
              <Text style={styles.greetingName}>{cleanName.toUpperCase()}</Text>
              {' 👋'}
            </Text>
            <Text style={styles.taglineText}>{tagline}</Text>
            {streakMilestone ? (
              <View style={styles.milestonePill}>
                <Flame size={13} color="#EA580C" fill="#FB923C" />
                <Text style={styles.milestoneTitle} numberOfLines={1}>{streakMilestone.title}</Text>
                <View style={styles.milestoneBadge}>
                  <Text style={styles.milestoneBadgeText}>{streakMilestone.badge}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        <View style={[styles.statGrid, isWide && styles.statGridWide]}>
          <Pressable
            onPress={() => { play?.('tap'); onBuyXp?.(); }}
            style={styles.statCapsule}
            accessibilityRole="button"
            accessibilityLabel={`Tích lũy ${(stats?.xpTotal || 0).toLocaleString('vi-VN')} XP, bấm để mua thêm XP`}
          >
            <View style={styles.statLabelRow}>
              <Star size={12} color="#F59E0B" fill="#FBBF24" />
              <Text style={styles.statLabel}>Tích lũy</Text>
            </View>
            <Text style={styles.statValue} numberOfLines={1}>
              {(stats?.xpTotal || 0).toLocaleString('vi-VN')}
              <Text style={styles.statUnit}> XP</Text>
            </Text>
          </Pressable>

          <View style={styles.statCapsule}>
            <View style={styles.statLabelRow}>
              <Flame size={12} color="#F97316" fill="#FB923C" />
              <Text style={styles.statLabel}>Chuỗi học</Text>
            </View>
            <View style={styles.statInlineVal}>
              <Flame size={14} color={streak > 0 ? '#F97316' : '#CBD5E1'} fill={streak > 0 ? '#FB923C' : 'transparent'} />
              <Text style={[styles.statValue, { color: '#EA580C' }]} numberOfLines={1}>
                {`${streak} ngày`}
              </Text>
            </View>
          </View>

          <View style={styles.statCapsule}>
            <View style={styles.statLabelRow}>
              <Layers size={12} color="#8B5CF6" />
              <Text style={styles.statLabel}>Chương</Text>
            </View>
            <Text style={styles.statValue} numberOfLines={1}>
              {pathMode ? `${chapterCompleted}/${chapterTotal || '—'}` : '—'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <View style={[styles.progressAndCtaRow, isWide && styles.progressAndCtaRowWide]}>
          <View style={styles.progressCol}>
            <View style={styles.progressHeaderRow}>
              <View style={styles.progressLabelRow}>
                <CalendarCheck size={13} color="#065F46" />
                <Text style={styles.progressLabel}>Tiến độ khóa học</Text>
              </View>
              <Text style={styles.progressPct}>{`${coursePct}%`}</Text>
            </View>
            <View style={styles.progressRail}>
              <View style={[styles.progressFill, { width: `${courseBar}%` }]} />
            </View>
            {pathMode && chapterTotal > 0 ? (
              <Text style={styles.progressSub} numberOfLines={2}>
                {chapterDone
                  ? 'Bạn đã hoàn thành toàn bộ chặng của chủ đề đang học.'
                  : `Đang học: ${pathTopic?.topic.name} · ${chapterCompleted}/${chapterTotal} chặng`}
              </Text>
            ) : (
              <Text style={styles.progressSub} numberOfLines={2}>
                Chọn chế độ Lộ trình hoặc Luyện tự do bên dưới để bắt đầu.
              </Text>
            )}
          </View>

          <View style={[styles.ctaCol, isWide && styles.ctaColWide]}>
            <DuoButton
              variant="primary"
              size="md"
              fullWidth
              disabled={primaryDisabled}
              loading={starting}
              text={ctaLabel}
              icon={mode === 'free' ? <Sparkles size={16} color="#FFFFFF" /> : <Play size={15} color="#FFFFFF" fill="#FFFFFF" />}
              onPress={onPrimaryAction}
            />
            <View style={styles.utilRow}>
              <View style={styles.utilLeft}>
                <Pressable
                  onPress={toggleSound}
                  style={styles.soundBtn}
                  accessibilityRole="button"
                  accessibilityLabel={soundEnabled ? 'Tắt âm thanh' : 'Bật âm thanh'}
                >
                  {soundEnabled ? <Volume2 size={15} color="#047857" /> : <VolumeX size={15} color="#64748B" />}
                </Pressable>
                {onOpenCertificate ? (
                  <Pressable
                    onPress={() => { play?.('tap'); onOpenCertificate(); }}
                    style={styles.certBtn}
                    accessibilityRole="button"
                  >
                    <Award size={12} color="#059669" />
                    <Text style={styles.certBtnText}>Chứng nhận QR</Text>
                  </Pressable>
                ) : null}
              </View>
              {typeof stats?.todayXp === 'number' ? (
                <View style={styles.todayXpRow}>
                  <Zap size={12} color="#F59E0B" fill="#FBBF24" />
                  <Text style={styles.todayXpText}>{`Hôm nay: ${stats.todayXp} XP`}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#E8FBF1',
    ...(Platform.OS === 'web'
      ? { backgroundImage: 'linear-gradient(135deg, #ECFDF5 0%, #D9F9E6 55%, #EFFDF6 100%)' }
      : {}),
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  } as never,
  topSection: {
    padding: 14,
    gap: 12,
  },
  topSectionWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    gap: 18,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  mascotBox: {
    width: 78,
    height: 78,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  greetingCopy: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  greetingText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#065F46',
  },
  greetingName: {
    fontWeight: '900',
    color: '#022C22',
  },
  taglineText: {
    fontSize: 15.5,
    fontWeight: '900',
    lineHeight: 21,
    color: '#022C22',
  },
  milestonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
  },
  milestoneTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C2D12',
    flexShrink: 1,
  },
  milestoneBadge: {
    backgroundColor: '#F97316',
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  milestoneBadgeText: {
    fontSize: 9.5,
    fontWeight: '900',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  statGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statGridWide: {
    width: 340,
    flexShrink: 0,
  },
  statCapsule: {
    flex: 1,
    minWidth: 0,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.98)',
    paddingHorizontal: 8,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  statLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  statInlineVal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0F172A',
  },
  statUnit: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  bottomSection: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(167, 243, 208, 0.72)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  progressAndCtaRow: {
    gap: 12,
  },
  progressAndCtaRowWide: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 18,
  },
  progressCol: {
    flex: 1,
    minWidth: 0,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  progressLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#065F46',
  },
  progressPct: {
    fontSize: 12,
    fontWeight: '900',
    color: '#064E3B',
  },
  progressRail: {
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#10B981',
  },
  progressSub: {
    marginTop: 6,
    fontSize: 11.5,
    fontWeight: '600',
    color: '#047857',
    lineHeight: 16,
  },
  ctaCol: {
    gap: 8,
    width: '100%',
  },
  ctaColWide: {
    width: 300,
    flexShrink: 0,
  },
  utilRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  utilLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  soundBtn: {
    width: 34,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#6EE7B7',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  certBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#065F46',
  },
  todayXpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  todayXpText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#065F46',
  },
});
