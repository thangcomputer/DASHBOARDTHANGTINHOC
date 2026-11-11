import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Calendar, Clock, Plus, Video } from 'lucide-react-native';
import { DuoButton } from './DuoButton';
import { meetLessonName } from '../../utils/meetJoin';

export type ScheduleItem = {
  id: string;
  title: string;
  time: string;
  dateLabel: string;
  teacher?: string;
  meetLink?: string;
  live?: boolean;
  joinable?: boolean;
  ended?: boolean;
  waitLabel?: string;
};

interface DuoScheduleCardProps {
  schedules?: ScheduleItem[];
  todayClasses?: Array<{
    id: string;
    title: string;
    time: string;
    dateLabel: string;
    meetLink?: string;
    live?: boolean;
    joinable?: boolean;
    ended?: boolean;
    waitLabel?: string;
    teacher?: string;
  }>;
  meetCards?: Array<{
    _id?: string;
    id?: string;
    slotKey?: string;
    slotLabel?: string;
    startTime?: string;
    endTime?: string;
    dayLabel?: string;
    live?: boolean;
    linkHoc?: string;
  }>;
  firstSchedule?: {
    title?: string;
    time?: string;
    dateLabel?: string;
  } | null;
  nextMeet?: {
    slotLabel?: string;
    title?: string;
    note?: string;
    startTime?: string;
    endTime?: string;
    dayLabel?: string;
  } | null;
  nextLesson?: Array<{ name: string; meta: string }> | null;
  onPressAllSchedule?: () => void;
  onOpenSchedule?: () => void;
  sectionTitle?: string;
  accentColor?: string;
  scheduleCtaLabel?: string;
  meetEmptyMode?: 'default' | 'purchase' | 'renew';
  onMeetPurchase?: () => void;
  onMeetRenew?: () => void;
}

export function DuoScheduleCard({
  schedules,
  todayClasses = [],
  meetCards = [],
  firstSchedule,
  nextMeet,
  nextLesson = [],
  onPressAllSchedule,
  onOpenSchedule,
  sectionTitle = 'Lịch học hôm nay',
  accentColor = '#059669',
  scheduleCtaLabel = 'Xem lịch học',
  meetEmptyMode = 'default',
  onMeetPurchase,
  onMeetRenew,
}: DuoScheduleCardProps) {
  const onAll = onOpenSchedule || onPressAllSchedule;

  let resolvedList: ScheduleItem[] = schedules || [];
  if (!schedules) {
    if (todayClasses.length > 0) {
      resolvedList = todayClasses.map((c) => ({
        id: c.id,
        title: c.title,
        time: c.time,
        dateLabel: c.dateLabel,
        meetLink: c.meetLink,
        live: c.live,
        joinable: c.joinable,
        ended: c.ended,
        waitLabel: c.waitLabel,
        teacher: c.teacher,
      }));
    } else if (meetCards.length > 0) {
      resolvedList = meetCards.map((m) => ({
        id: m._id || m.id || m.slotKey || String(Math.random()),
        title: meetLessonName(m),
        time: `${m.startTime || ''} – ${m.endTime || ''}`,
        dateLabel: m.dayLabel || 'Hôm nay',
        meetLink: m.linkHoc,
        live: m.live,
      }));
    }
  }

  if (resolvedList.length === 0) {
    const upcomingText = nextLesson.length
      ? ''
      : firstSchedule
      ? `Lịch tới: ${firstSchedule.title || 'Buổi học'} · ${firstSchedule.time} (${firstSchedule.dateLabel})`
      : nextMeet
      ? `Lịch Meet tới: ${meetLessonName(nextMeet)} · ${nextMeet.startTime || ''}–${nextMeet.endTime || ''}${nextMeet.dayLabel ? ` (${nextMeet.dayLabel})` : ''}`
      : 'Bạn có thể tự ôn luyện hoặc làm bài tập hôm nay nhé!';

    const upsell = meetEmptyMode === 'purchase' || meetEmptyMode === 'renew';

    return (
      <View style={[styles.card, styles.emptyCardWrap]}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Calendar size={18} color={accentColor} />
            <Text style={styles.cardTitle}>{sectionTitle}</Text>
          </View>
        </View>
        <View style={[styles.emptyCard, upsell && meetEmptyMode === 'purchase' && styles.emptyCardPurchase, upsell && meetEmptyMode === 'renew' && styles.emptyCardRenew]}>
          <View style={[styles.emptyIconBox, upsell && styles.emptyIconBoxUpsell]}>
            <Video size={upsell ? 22 : 20} color={meetEmptyMode === 'renew' ? '#D97706' : upsell ? accentColor : '#94A3B8'} />
          </View>
          {meetEmptyMode === 'purchase' ? (
            <>
              <Text style={styles.emptyTitle}>Học Meet cùng giảng viên</Text>
              <Text style={styles.emptySub}>
                Mua gói Meet online để được xếp lịch và vào lớp Google Meet học trực tiếp với giáo viên.
              </Text>
              {onMeetPurchase ? (
                <DuoButton
                  variant="primary"
                  size="md"
                  icon={<Video size={16} color="#FFFFFF" />}
                  label="Mua gói Meet"
                  onPress={onMeetPurchase}
                />
              ) : null}
            </>
          ) : meetEmptyMode === 'renew' ? (
            <>
              <Text style={styles.emptyTitle}>Gói Meet đã hết hạn</Text>
              <Text style={styles.emptySub}>
                Gia hạn để tiếp tục nhận lịch học Meet và vào lớp cùng giảng viên.
              </Text>
              {onMeetRenew ? (
                <DuoButton
                  variant="primary"
                  size="md"
                  icon={<Calendar size={16} color="#FFFFFF" />}
                  label="Gia hạn ngay"
                  onPress={onMeetRenew}
                />
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.emptyTitle}>Hôm nay không có lịch</Text>
              {upcomingText ? <Text style={styles.emptySub}>{upcomingText}</Text> : null}
              {nextLesson.length > 0 ? <UpcomingLessons items={nextLesson} /> : null}
              {onAll ? (
                <DuoButton
                  variant="secondary"
                  size="sm"
                  icon={<Calendar size={14} color="#475569" />}
                  label={scheduleCtaLabel}
                  onPress={onAll}
                />
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  }

  const hasLive = resolvedList.some((item) => item.live);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Calendar size={18} color={accentColor} />
          <Text style={styles.cardTitle}>{sectionTitle}</Text>
        </View>
        {hasLive ? (
          <View style={styles.headerLiveBadge}>
            <View style={styles.headerLiveDot} />
            <Text style={styles.headerLiveText}>Đang diễn ra</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.schedulesList}>
        {resolvedList.map((item) => (
          <View key={item.id} style={[styles.itemCard, item.live && styles.itemCardLive]}>
            <View style={styles.itemInfoCol}>
              <View style={styles.itemTitleRow}>
                {item.live ? (
                  <View style={styles.livePulseBadge}>
                    <Text style={styles.livePulseText}>ĐANG DIỄN RA</Text>
                  </View>
                ) : null}
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {item.title}
                </Text>
              </View>

              <View style={styles.itemMetaRow}>
                <Clock size={13} color="#64748B" />
                <Text style={styles.itemMetaText}>{item.time}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.itemMetaText}>{item.dateLabel}</Text>
                {item.teacher ? (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <Text style={styles.itemTeacherText}>GV: {item.teacher}</Text>
                  </>
                ) : null}
              </View>
            </View>

            {item.ended ? (
              <DuoButton
                variant="secondary"
                size="sm"
                disabled
                text="Đã kết thúc"
              />
            ) : item.meetLink && item.joinable ? (
              <MeetJoinGlow>
                <DuoButton
                  variant="danger"
                  size="sm"
                  icon={<Video size={14} color="#FFFFFF" />}
                  text="Vào Meet"
                  onPress={() => {
                    if (item.meetLink) void Linking.openURL(item.meetLink);
                  }}
                />
              </MeetJoinGlow>
            ) : item.meetLink ? (
              <DuoButton
                variant="secondary"
                size="sm"
                disabled
                icon={<Video size={14} color="#94A3B8" />}
                text="Vào Meet"
                accessibilityLabel={item.waitLabel || 'Chưa đến giờ vào lớp'}
              />
            ) : (
              <View style={styles.noLinkPill}>
                <Text style={styles.noLinkText}>Chưa có link</Text>
              </View>
            )}
          </View>
        ))}
      </View>
      {nextLesson.length > 0 ? <UpcomingLessons items={nextLesson} /> : null}
    </View>
  );
}

function UpcomingLessons({ items }: { items: Array<{ name: string; meta: string }> }) {
  return (
    <View style={styles.nextLesson}>
      <Text style={styles.nextLessonHeading}>Lịch học tiếp theo</Text>
      {items.map((item) => (
        <View key={`${item.name}-${item.meta}`} style={styles.nextLessonRow}>
          <View style={styles.nextLessonPlus}>
            <Plus size={11} color="#059669" strokeWidth={3} />
          </View>
          <Text style={styles.nextLessonLine}>
            <Text style={styles.nextLessonName}>{item.name}</Text>
            {` · ${item.meta}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function MeetJoinGlow({ children }: { children: React.ReactNode }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={styles.meetGlowWrap}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.meetGlowRing,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.12] }) }],
          },
        ]}
      />
      <View style={styles.meetGlowButton}>{children}</View>
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
    gap: 12,
    overflow: 'visible',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    flex: 1,
  },
  headerLiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#D1FAE5',
  },
  headerLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  headerLiveText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  emptyCardWrap: {
    gap: 12,
  },
  calendarIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
  },
  viewAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
  },
  schedulesList: {
    gap: 10,
    overflow: 'visible',
  },
  meetGlowWrap: {
    position: 'relative',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    overflow: 'visible',
  },
  meetGlowRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#FCA5A5',
    backgroundColor: 'rgba(248, 113, 113, 0.45)',
  },
  meetGlowButton: {
    zIndex: 2,
    borderRadius: 14,
    shadowColor: '#DC2626',
    shadowOpacity: 0.9,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  nextLesson: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    gap: 4,
  },
  nextLessonHeading: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '900',
  },
  nextLessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextLessonPlus: {
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D1FAE5',
  },
  nextLessonLine: {
    flex: 1,
    color: '#64748B',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
  },
  nextLessonName: { color: '#1E293B', fontWeight: '900' },
  itemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    overflow: 'visible',
  },
  itemCardLive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  itemInfoCol: {
    flex: 1,
    gap: 4,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  livePulseText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    flex: 1,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemMetaText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  metaDot: {
    fontSize: 12,
    color: '#94A3B8',
  },
  itemTeacherText: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
  },
  noLinkPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  noLinkText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
  },
  waitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 120,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  waitPillText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  emptyIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 2,
    paddingHorizontal: 4,
  },
  emptyCardPurchase: {
    borderColor: '#A7F3D0',
    backgroundColor: '#ECFDF5',
  },
  emptyCardRenew: {
    borderColor: '#FDE68A',
    backgroundColor: '#FFFBEB',
  },
  emptyIconBoxUpsell: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
});
